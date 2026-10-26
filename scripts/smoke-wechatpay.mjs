// WeChat login + WeChat Pay v3 against a local fake WeChat server. Exercises
// request signing, response/notification verification, AES-GCM decryption,
// amount checks, idempotency, query fallback and refunds.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createCipheriv, createSign, createVerify, generateKeyPairSync, randomBytes } from 'node:crypto';
import { loadConfig } from '../server/config.mjs';
import { createApp } from '../server/app.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruyi-pay-test-'));
const pem = (k) => k.export({ type: k.type === 'private' ? 'pkcs8' : 'spki', format: 'pem' });
const merchant = generateKeyPairSync('rsa', { modulusLength: 2048 });
const platform = generateKeyPairSync('rsa', { modulusLength: 2048 });
fs.writeFileSync(path.join(dir, 'apiclient_key.pem'), pem(merchant.privateKey));
fs.writeFileSync(path.join(dir, 'pub_key.pem'), pem(platform.publicKey));
const API_V3_KEY = 'a'.repeat(16) + 'b'.repeat(16);
const PUB_KEY_ID = 'PUB_KEY_ID_0000000000000001';
const MCHID = '1900000001';
const APPID = 'wx_test_app';

/* ---------- fake WeChat server ---------- */
const trades = new Map();
const refunds = [];
let lastPrepayBody = null;
const platformSign = (message) => createSign('RSA-SHA256').update(message).sign(platform.privateKey, 'base64');
function signedHeaders(body) {
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(8).toString('hex');
  return { 'wechatpay-timestamp': ts, 'wechatpay-nonce': nonce, 'wechatpay-serial': PUB_KEY_ID, 'wechatpay-signature': platformSign(`${ts}\n${nonce}\n${body}\n`) };
}
function verifyMerchant(req, body) {
  const auth = String(req.headers.authorization || '');
  const fields = Object.fromEntries([...auth.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const message = `${req.method}\n${req.url}\n${fields.timestamp}\n${fields.nonce_str}\n${body}\n`;
  return auth.startsWith('WECHATPAY2-SHA256-RSA2048 ') && fields.mchid === MCHID && fields.serial_no === 'MERCHANT_SERIAL'
    && createVerify('RSA-SHA256').update(message).verify(merchant.publicKey, fields.signature, 'base64');
}
const fake = http.createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  const send = (status, payload) => {
    const text = payload === null ? '' : JSON.stringify(payload);
    res.writeHead(status, { 'content-type': 'application/json', ...signedHeaders(text) });
    res.end(text);
  };
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/sns/jscode2session') return send(200, { openid: `o_${url.searchParams.get('js_code')}`, session_key: 'k' });
  if (!url.pathname.startsWith('/v3/')) return send(404, { code: 'NOT_FOUND' });
  if (!verifyMerchant(req, body)) return send(401, { code: 'SIGN_ERROR', message: 'bad merchant signature' });
  if (url.pathname === '/v3/pay/transactions/jsapi') {
    lastPrepayBody = JSON.parse(body);
    trades.set(lastPrepayBody.out_trade_no, { trade_state: 'NOTPAY', amount: lastPrepayBody.amount.total });
    return send(200, { prepay_id: `wx_prepay_${lastPrepayBody.out_trade_no}` });
  }
  const trade = url.pathname.match(/^\/v3\/pay\/transactions\/out-trade-no\/([^/]+)(\/close)?$/);
  if (trade && trade[2]) return trades.has(trade[1]) ? send(204, null) : send(400, { code: 'ORDER_NOT_EXIST' });
  if (trade) {
    const t = trades.get(trade[1]);
    if (!t) return send(404, { code: 'ORDER_NOT_EXIST' });
    return send(200, { out_trade_no: trade[1], mchid: MCHID, appid: APPID, trade_state: t.trade_state, transaction_id: `T_${trade[1]}`, success_time: new Date().toISOString(), amount: { total: t.amount } });
  }
  if (url.pathname === '/v3/refund/domestic/refunds') {
    refunds.push(JSON.parse(body));
    return send(200, { refund_id: 'R1', status: 'PROCESSING' });
  }
  send(404, { code: 'NOT_FOUND' });
});
await new Promise((resolve) => fake.listen(0, '127.0.0.1', resolve));
const fakeBase = `http://127.0.0.1:${fake.address().port}`;

/* ---------- app under test ---------- */
const app = createApp({
  logger: { log() {}, warn() {}, error() {} },
  config: loadConfig({
    DATABASE_PATH: ':memory:', SEED_DEMO: '0',
    WECHAT_AUTH_MODE: 'wechat', WECHAT_APPID: APPID, WECHAT_APPSECRET: 'secret', WECHAT_API_BASE_URL: fakeBase,
    PAYMENT_MODE: 'wechat', WECHATPAY_MCHID: MCHID, WECHATPAY_CERT_SERIAL: 'MERCHANT_SERIAL',
    WECHATPAY_PRIVATE_KEY_PATH: path.join(dir, 'apiclient_key.pem'), WECHATPAY_APIV3_KEY: API_V3_KEY,
    WECHATPAY_PUBLIC_KEY_ID: PUB_KEY_ID, WECHATPAY_PUBLIC_KEY_PATH: path.join(dir, 'pub_key.pem'),
    WECHATPAY_NOTIFY_URL: 'https://api.example.com/api/pay/notify', WECHATPAY_API_BASE_URL: fakeBase,
  }),
});
await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${app.address().port}`;
async function request(pathname, { token, method = 'GET', body, headers = {}, raw } = {}) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

function encrypt(obj) {
  const nonce = randomBytes(6).toString('hex');
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(API_V3_KEY), Buffer.from(nonce));
  cipher.setAAD(Buffer.from('transaction'));
  const data = Buffer.concat([cipher.update(JSON.stringify(obj)), cipher.final(), cipher.getAuthTag()]);
  return { algorithm: 'AEAD_AES_256_GCM', ciphertext: data.toString('base64'), associated_data: 'transaction', original_type: 'transaction', nonce };
}
function notify(eventType, resource, { tamper = false, ts } = {}) {
  const raw = JSON.stringify({ id: randomBytes(4).toString('hex'), event_type: eventType, resource_type: 'encrypt-resource', resource: encrypt(resource) });
  const headers = signedHeaders(raw);
  if (ts) {
    headers['wechatpay-timestamp'] = ts;
    headers['wechatpay-signature'] = platformSign(`${ts}\n${headers['wechatpay-nonce']}\n${raw}\n`);
  }
  return request('/api/pay/notify', { method: 'POST', raw: tamper ? raw.replace('TRANSACTION', 'TRANSACTIOM') : raw, headers });
}
const tx = (orderId, total, extra = {}) => ({ out_trade_no: orderId, transaction_id: `T_${orderId}`, trade_state: 'SUCCESS', mchid: MCHID, appid: APPID, success_time: new Date().toISOString(), amount: { total, payer_total: total }, ...extra });

try {
  const login = await request('/api/auth/login', { method: 'POST', body: { code: 'c1' } });
  assert.equal(login.status, 200);
  const token = login.body.session.token;
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { code: 'c1' } })).body.created, false, '同一 openid 复用同一用户');
  assert.equal((await request('/api/orders')).status, 401, '正式模式未登录拒绝');

  const order = (await request('/api/orders', { token, method: 'POST', body: { items: [{ productId: 'a', quantity: 1 }], customer: { phone: '13800000000' } } })).body.order;
  assert.equal(order.totals.total, 38, '未绑定手机号按原价');

  /* prepay + client signature */
  const pay = await request(`/api/orders/${order.id}/pay`, { token, method: 'POST' });
  assert.equal(pay.status, 200, JSON.stringify(pay.body));
  assert.equal(pay.body.order.status, 'pending_payment', '仅下单不会变成已支付');
  assert.equal(lastPrepayBody.amount.total, 3800);
  assert.equal(lastPrepayBody.payer.openid, 'o_c1');
  assert.match(lastPrepayBody.time_expire, /\+08:00$/);
  const p = pay.body.payment;
  assert.equal(p.package, `prepay_id=wx_prepay_${order.id}`);
  assert.ok(createVerify('RSA-SHA256').update(`${p.appId}\n${p.timeStamp}\n${p.nonceStr}\n${p.package}\n`).verify(merchant.publicKey, p.paySign, 'base64'), 'paySign 可被验证');

  /* notification: tampered / stale / valid / replay */
  assert.equal((await notify('TRANSACTION.SUCCESS', tx(order.id, 3800), { tamper: true })).status, 401);
  assert.equal((await notify('TRANSACTION.SUCCESS', tx(order.id, 3800), { ts: String(Math.floor(Date.now() / 1000) - 600) })).status, 401, '过期时间戳拒绝');
  assert.equal((await request(`/api/orders/${order.id}`, { token })).body.order.status, 'pending_payment');
  assert.equal((await notify('TRANSACTION.SUCCESS', tx(order.id, 3800))).status, 204);
  const paid = (await request(`/api/orders/${order.id}`, { token })).body.order;
  assert.equal(paid.status, 'paid');
  assert.equal((await notify('TRANSACTION.SUCCESS', tx(order.id, 3800))).status, 204, '重复通知幂等');

  /* wrong amount is rejected */
  const order2 = (await request('/api/orders', { token, method: 'POST', body: { items: [{ productId: 'd', quantity: 1 }], customer: { phone: '13800000000' } } })).body.order;
  await request(`/api/orders/${order2.id}/pay`, { token, method: 'POST' });
  assert.equal((await notify('TRANSACTION.SUCCESS', tx(order2.id, 1))).status, 500);
  assert.equal((await request(`/api/orders/${order2.id}`, { token })).body.order.status, 'pending_payment', '金额不符不入账');

  /* lost notification -> client sync queries WeChat Pay */
  trades.get(order2.id).trade_state = 'SUCCESS';
  assert.equal((await request(`/api/orders/${order2.id}?sync=1`, { token })).body.order.status, 'paid');

  /* customer cancels a paid order -> refund requested, then refund notification */
  const cancelled = (await request(`/api/orders/${order.id}/cancel`, { token, method: 'POST' })).body.order;
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.refundStatus, 'processing');
  assert.equal(refunds[0].amount.refund, 3800);
  assert.equal(refunds[0].out_refund_no, `RF${order.id}`);
  assert.equal((await notify('REFUND.SUCCESS', { out_trade_no: order.id, out_refund_no: `RF${order.id}`, refund_status: 'SUCCESS' })).status, 204);
  assert.equal((await request(`/api/orders/${order.id}`, { token })).body.order.refundStatus, 'success');

  /* unpaid order times out: closed at WeChat Pay, then cancelled */
  const order3 = (await request('/api/orders', { token, method: 'POST', body: { items: [{ productId: 'a', quantity: 1 }], customer: { phone: '13800000000' } } })).body.order;
  app.db.run('UPDATE orders SET created_at = :old WHERE id = :id', { old: new Date(Date.now() - 20 * 60000).toISOString(), id: order3.id });
  await app.runJobs();
  assert.equal((await request(`/api/orders/${order3.id}`, { token })).body.order.status, 'cancelled');

  console.log('WeChat login & WeChat Pay v3 smoke test passed');
} finally {
  await app.shutdown();
  fake.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
