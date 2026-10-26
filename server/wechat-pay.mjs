import fs from 'node:fs';
import { createDecipheriv, createSign, createVerify, randomBytes } from 'node:crypto';
import { httpError } from './http.mjs';

/**
 * Payment adapter.
 *
 * mock:   /pay marks the order paid immediately; refunds succeed instantly.
 * wechat: WeChat Pay API v3 (JSAPI). The order only becomes paid after a
 *         verified notification or an authenticated query of WeChat Pay,
 *         never because the client says so. Uses "微信支付公钥" verification.
 */
export function createPayments({ config, services, logger = console }) {
  return config.pay.mode === 'wechat'
    ? createWechatPay({ config, services, logger })
    : createMockPay({ services });
}

function createMockPay({ services }) {
  return {
    mode: 'mock',
    async startPayment(row) {
      const { row: paid } = services.markOrderPaid(row.id, { method: 'mock' });
      services.logPaymentEvent(row.id, 'mock_paid', { total: paid.total_fen });
      return { row: paid, payment: null };
    },
    async refund(row) {
      services.logPaymentEvent(row.id, 'mock_refund', { total: row.total_fen });
      return services.setRefundStatus(row.id, 'success', `MR${row.id}`);
    },
    async closeOrder() {},
    async syncOrder(row) { return row; },
    async handleNotify() { return { status: 404, body: { code: 'FAIL', message: 'mock 模式不接收支付回调' } }; },
  };
}

const nonce = () => randomBytes(16).toString('hex');

function rfc3339(date, timezone) {
  // WeChat requires an explicit offset; China has no DST so +08:00 is stable.
  const offset = timezone === 'Asia/Shanghai' ? 8 * 60 : -date.getTimezoneOffset();
  const local = new Date(date.getTime() + offset * 60000);
  const sign = offset >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const mm = String(Math.abs(offset) % 60).padStart(2, '0');
  return `${local.toISOString().slice(0, 19)}${sign}${hh}:${mm}`;
}

export function decryptResource(resource, apiV3Key) {
  if (resource?.algorithm !== 'AEAD_AES_256_GCM') throw new Error('unsupported resource algorithm');
  const data = Buffer.from(resource.ciphertext, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(apiV3Key, 'utf8'), Buffer.from(resource.nonce, 'utf8'));
  decipher.setAuthTag(data.subarray(data.length - 16));
  if (resource.associated_data) decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]).toString('utf8'));
}

function createWechatPay({ config, services, logger }) {
  const p = config.pay;
  const privateKey = fs.readFileSync(p.privateKeyPath, 'utf8');
  const publicKey = fs.readFileSync(p.publicKeyPath, 'utf8');

  const sign = (message) => createSign('RSA-SHA256').update(message).sign(privateKey, 'base64');

  function verify({ timestamp, nonceStr, signature, serial, body }) {
    if (!timestamp || !nonceStr || !signature) return false;
    if (serial !== p.publicKeyId) return false;
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
    try {
      return createVerify('RSA-SHA256').update(`${timestamp}\n${nonceStr}\n${body}\n`).verify(publicKey, signature, 'base64');
    } catch {
      return false;
    }
  }

  async function call(method, path, payload) {
    const body = payload ? JSON.stringify(payload) : '';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const nonceStr = nonce();
    const signature = sign(`${method}\n${path}\n${timestamp}\n${nonceStr}\n${body}\n`);
    let response;
    try {
      response = await fetch(`${p.apiBase}${path}`, {
        method,
        body: body || undefined,
        signal: AbortSignal.timeout(10000),
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'user-agent': 'ruyi-api/1.0',
          authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${p.mchId}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${p.certSerialNo}"`,
        },
      });
    } catch (cause) {
      logger.error?.('[wechat-pay] request failed', path, cause.message);
      throw httpError(502, 'WECHATPAY_UNREACHABLE', '微信支付暂时无法访问，请稍后重试');
    }
    const text = await response.text();
    const ok = verify({
      timestamp: response.headers.get('wechatpay-timestamp'),
      nonceStr: response.headers.get('wechatpay-nonce'),
      signature: response.headers.get('wechatpay-signature'),
      serial: response.headers.get('wechatpay-serial'),
      body: text,
    });
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
    if (!response.ok) {
      logger.error?.('[wechat-pay] api error', path, response.status, data.code);
      throw httpError(502, 'WECHATPAY_API_ERROR', `微信支付调用失败（${data.code || response.status}）`, { wechatCode: data.code });
    }
    // Only trust successful responses that carry a valid WeChat Pay signature.
    if (!ok) throw httpError(502, 'WECHATPAY_BAD_SIGNATURE', '微信支付响应验签失败');
    return { status: response.status, data };
  }

  const outTradePath = (id) => `/v3/pay/transactions/out-trade-no/${encodeURIComponent(id)}`;

  function applyTransaction(row, tx, source) {
    if (tx.out_trade_no !== row.id) throw new Error('out_trade_no mismatch');
    if (tx.trade_state !== 'SUCCESS') return { row, changed: false };
    if (tx.mchid && tx.mchid !== p.mchId) throw new Error('mchid mismatch');
    if (tx.appid && tx.appid !== p.appId) throw new Error('appid mismatch');
    if (Number(tx.amount?.total) !== row.total_fen) throw new Error(`amount mismatch: ${tx.amount?.total} != ${row.total_fen}`);
    const result = services.markOrderPaid(row.id, { method: 'wechat', transactionId: tx.transaction_id, paidAt: tx.success_time ? new Date(tx.success_time).toISOString() : undefined });
    services.logPaymentEvent(row.id, `paid_via_${source}`, { transactionId: tx.transaction_id, total: tx.amount?.total });
    return result;
  }

  return {
    mode: 'wechat',

    /** Create (or refresh) a JSAPI prepay and return wx.requestPayment params. */
    async startPayment(row, user) {
      if (!user.openid) throw httpError(400, 'OPENID_REQUIRED', '请使用微信登录后再支付');
      const expire = new Date(Date.parse(row.created_at) + config.orderPayTimeoutMinutes * 60000);
      const { data } = await call('POST', '/v3/pay/transactions/jsapi', {
        appid: p.appId,
        mchid: p.mchId,
        description: `如一商务餐-取餐号${row.pickup_no}`.slice(0, 127),
        out_trade_no: row.id,
        time_expire: rfc3339(expire, config.timezone),
        notify_url: p.notifyUrl,
        amount: { total: row.total_fen, currency: 'CNY' },
        payer: { openid: user.openid },
      });
      const timeStamp = String(Math.floor(Date.now() / 1000));
      const nonceStr = nonce();
      const pkg = `prepay_id=${data.prepay_id}`;
      services.logPaymentEvent(row.id, 'prepay', { total: row.total_fen });
      return {
        row,
        payment: { appId: p.appId, timeStamp, nonceStr, package: pkg, signType: 'RSA', paySign: sign(`${p.appId}\n${timeStamp}\n${nonceStr}\n${pkg}\n`) },
      };
    },

    /** Ask WeChat Pay for the real state (covers lost notifications). */
    async syncOrder(row) {
      if (row.paid_at || row.status !== 'pending_payment') return row;
      try {
        const { data } = await call('GET', `${outTradePath(row.id)}?mchid=${encodeURIComponent(p.mchId)}`);
        return applyTransaction(row, data, 'query').row;
      } catch (error) {
        // Never prepaid (customer didn't tap pay): WeChat Pay has no record.
        if (error.details?.wechatCode === 'ORDER_NOT_EXIST') return row;
        throw error;
      }
    },

    async closeOrder(row) {
      try {
        await call('POST', `${outTradePath(row.id)}/close`, { mchid: p.mchId });
      } catch (error) {
        // ORDER_NOT_EXIST: the customer never started paying; fine to ignore.
        if (error.details?.wechatCode !== 'ORDER_NOT_EXIST') throw error;
      }
    },

    async refund(row) {
      const refundNo = row.refund_no || `RF${row.id}`;
      const { data } = await call('POST', '/v3/refund/domestic/refunds', {
        out_trade_no: row.id,
        out_refund_no: refundNo,
        reason: (row.cancel_reason || '订单取消').slice(0, 80),
        notify_url: p.refundNotifyUrl,
        amount: { refund: row.total_fen, total: row.total_fen, currency: 'CNY' },
      });
      services.logPaymentEvent(row.id, 'refund_requested', { refundId: data.refund_id, status: data.status });
      const status = data.status === 'SUCCESS' ? 'success' : ['ABNORMAL', 'CLOSED'].includes(data.status) ? 'failed' : 'processing';
      return services.setRefundStatus(row.id, status, refundNo);
    },

    /** POST /api/pay/notify — verify, decrypt, apply. Must answer 200/204 quickly. */
    async handleNotify(req, rawBody) {
      const valid = verify({
        timestamp: req.headers['wechatpay-timestamp'],
        nonceStr: req.headers['wechatpay-nonce'],
        signature: req.headers['wechatpay-signature'],
        serial: req.headers['wechatpay-serial'],
        body: rawBody,
      });
      if (!valid) {
        logger.warn?.('[wechat-pay] notify signature invalid');
        return { status: 401, body: { code: 'FAIL', message: '签名验证失败' } };
      }
      try {
        const event = JSON.parse(rawBody);
        const resource = decryptResource(event.resource, p.apiV3Key);
        const row = services.getOrderRow(resource.out_trade_no);
        if (!row) return { status: 404, body: { code: 'FAIL', message: '订单不存在' } };
        if (event.event_type === 'TRANSACTION.SUCCESS') {
          const result = applyTransaction(row, resource, 'notify');
          if (result.needsRefund) services.audit('system', 'order.paid_after_cancel', row.id, { transactionId: resource.transaction_id });
        } else if (event.event_type?.startsWith('REFUND.')) {
          const status = resource.refund_status === 'SUCCESS' ? 'success' : resource.refund_status === 'PROCESSING' ? 'processing' : 'failed';
          services.setRefundStatus(row.id, status, resource.out_refund_no);
          services.logPaymentEvent(row.id, 'refund_notify', { status: resource.refund_status });
        }
        return { status: 204, body: null };
      } catch (error) {
        logger.error?.('[wechat-pay] notify handling failed', error.message);
        return { status: 500, body: { code: 'FAIL', message: '处理失败' } };
      }
    },
  };
}
