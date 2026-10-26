import { randomUUID } from 'node:crypto';
import { httpError, str, validPhone } from './http.mjs';

export const yuan = (fen) => Math.round(Number(fen || 0)) / 100;
export const toFen = (value) => Math.round(Number(value || 0) * 100);
const nowIso = () => new Date().toISOString();
const shortId = (prefix, length = 10) => `${prefix}${randomUUID().replaceAll('-', '').slice(0, length)}`;
const parseJson = (value, fallback = null) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };

export const ORDER_STATUS_TEXT = {
  pending_payment: '待支付',
  paid: '待接单',
  preparing: '备餐中',
  completed: '已完成',
  cancelled: '已取消',
};
export const REFUND_STATUS_TEXT = { pending: '待退款', processing: '退款中', success: '已退款', failed: '退款失败' };
const COUPON_STATUS_TEXT = { available: '可使用', used: '已使用', unavailable: '不可用', gifted: '已赠送' };
// Orders counted as real spending (membership, points, revenue).
const SPENT_STATUSES = "('paid','preparing','completed')";

export function createServices({ db, config }) {
  const tz = config.timezone;

  function localParts(date = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map((p) => [p.type, p.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
  }

  /* ---------- settings ---------- */
  function getSetting(key) {
    const row = db.one('SELECT value FROM settings WHERE key = :key', { key });
    return parseJson(row?.value);
  }
  function setSetting(key, value) {
    db.run(`INSERT INTO settings (key, value, updated_at) VALUES (:key, :value, :now)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, { key, value: JSON.stringify(value), now: nowIso() });
    return value;
  }

  function audit(actor, action, target, detail) {
    db.run('INSERT INTO audit_log (actor, action, target, detail_json, created_at) VALUES (:actor, :action, :target, :detail, :now)', {
      actor, action, target: target ?? null, detail: detail ? JSON.stringify(detail) : null, now: nowIso(),
    });
  }

  /* ---------- catalog ---------- */
  const presentCategory = (row) => ({ id: row.id, label: row.label, emoji: row.emoji, sort: row.sort });
  function presentProduct(row) {
    return {
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      price: yuan(row.price_fen),
      oldPrice: yuan(row.list_price_fen),
      description: row.description,
      // Compatibility alias for the existing web prototype.
      desc: row.description,
      emoji: row.emoji,
      imageUrl: row.image_url,
      available: Boolean(row.available),
      sort: row.sort,
    };
  }
  const listCategories = () => db.all('SELECT * FROM categories ORDER BY sort, created_at').map(presentCategory);
  function listProducts({ category, q, includeUnavailable = false } = {}) {
    const keyword = str(q, 50).toLowerCase();
    return db.all(`SELECT * FROM products ${includeUnavailable ? '' : 'WHERE available = 1'} ORDER BY sort, created_at`)
      .filter((p) => !category || category === 'recommend' || p.category_id === category)
      .filter((p) => !keyword || `${p.name} ${p.description}`.toLowerCase().includes(keyword))
      .map(presentProduct);
  }

  /* ---------- users & membership ---------- */
  const getUser = (id) => db.one('SELECT * FROM users WHERE id = :id AND deleted_at IS NULL', { id });

  function memberInfo(user) {
    const levels = getSetting('memberLevels') || [];
    const spentFen = db.one(`SELECT COALESCE(SUM(total_fen), 0) AS s FROM orders WHERE user_id = :id AND status IN ${SPENT_STATUSES}`, { id: user.id }).s;
    const reached = user.phone ? levels.filter((level) => spentFen >= toFen(level.minSpent)) : [];
    const current = reached.at(-1) || null;
    const next = levels.find((level) => level.level > (current?.level || 0)) || null;
    return {
      level: current?.level || 0,
      name: current?.name || '',
      rate: current?.rate || 1,
      totalSpent: yuan(spentFen),
      points: Math.floor(spentFen / 100),
      next: next ? { level: next.level, name: next.name, gap: user.phone ? yuan(Math.max(0, toFen(next.minSpent) - spentFen)) : null } : null,
    };
  }

  function presentUser(user) {
    const member = memberInfo(user);
    const available = db.all('SELECT * FROM coupons WHERE user_id = :id', { id: user.id }).filter((c) => couponStatus(c) === 'available').length;
    return {
      id: user.id,
      nickname: user.nickname,
      phone: user.phone,
      registered: Boolean(user.registered),
      balance: yuan(user.balance_fen),
      authMode: user.auth_mode,
      points: member.points,
      member,
      availableCoupons: available,
    };
  }

  function createUser({ id = shortId('u_', 12), openid = null, unionid = null, authMode, nickname = '未授权', phone = '' }) {
    db.run(`INSERT INTO users (id, openid, unionid, nickname, phone, auth_mode, created_at)
      VALUES (:id, :openid, :unionid, :nickname, :phone, :authMode, :now)`, { id, openid, unionid, nickname, phone, authMode, now: nowIso() });
    return getUser(id);
  }

  function updateUser(id, fields) {
    const allowed = { nickname: 'nickname', phone: 'phone', registered: 'registered' };
    const sets = Object.keys(fields).filter((key) => allowed[key]).map((key) => `${allowed[key]} = :${key}`);
    if (sets.length) db.run(`UPDATE users SET ${sets.join(', ')} WHERE id = :id`, { ...fields, id });
    return getUser(id);
  }

  /** Account deletion: anonymise the profile, keep orders for bookkeeping. */
  function deleteUser(id) {
    db.tx(() => {
      db.run(`UPDATE users SET nickname = '已注销用户', phone = '', openid = NULL, unionid = NULL, registered = 0, deleted_at = :now WHERE id = :id`, { id, now: nowIso() });
      db.run('DELETE FROM sessions WHERE user_id = :id', { id });
      db.run('DELETE FROM addresses WHERE user_id = :id', { id });
      db.run(`UPDATE orders SET customer_phone = '', customer_nickname = '已注销用户', address_json = NULL WHERE user_id = :id`, { id });
    });
  }

  /* ---------- coupons ---------- */
  function couponStatus(row, now = Date.now()) {
    if (row.used_by) return 'used';
    if (row.gift_code) return 'gifted';
    if (now < Date.parse(row.valid_from) || now > Date.parse(row.valid_to)) return 'unavailable';
    return 'available';
  }

  function presentCoupon(row) {
    const status = couponStatus(row);
    return {
      id: row.id,
      title: row.title,
      amount: yuan(row.amount_fen),
      threshold: yuan(row.threshold_fen),
      validFrom: row.valid_from,
      validTo: row.valid_to,
      source: row.source,
      status,
      statusText: COUPON_STATUS_TEXT[status],
      giftCode: row.gift_code,
      claimed: Boolean(row.claimed_by),
    };
  }

  /** Issue a coupon from a template { title, amount, threshold, validDays }. */
  function issueCoupon(userId, template, source) {
    const start = new Date();
    const end = new Date(start.getTime() + Number(template.validDays) * 86400000);
    end.setHours(23, 59, 0, 0);
    const id = shortId('cp_');
    db.run(`INSERT INTO coupons (id, user_id, title, amount_fen, threshold_fen, valid_from, valid_to, source, created_at)
      VALUES (:id, :userId, :title, :amount, :threshold, :from, :to, :source, :now)`, {
      id, userId, title: template.title, amount: toFen(template.amount), threshold: toFen(template.threshold),
      from: start.toISOString(), to: end.toISOString(), source, now: nowIso(),
    });
    return db.one('SELECT * FROM coupons WHERE id = :id', { id });
  }

  const listCoupons = (userId, status) => db.all('SELECT * FROM coupons WHERE user_id = :userId ORDER BY created_at DESC', { userId })
    .map(presentCoupon).filter((c) => !status || c.status === status);

  function giftCoupon(userId, couponId) {
    const row = db.one('SELECT * FROM coupons WHERE id = :couponId AND user_id = :userId', { couponId, userId });
    if (!row) throw httpError(404, 'COUPON_NOT_FOUND', '优惠券不存在');
    const status = couponStatus(row);
    if (status !== 'available') throw httpError(409, 'COUPON_UNAVAILABLE', `优惠券${COUPON_STATUS_TEXT[status]}，不能转赠`);
    const code = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
    db.run('UPDATE coupons SET gift_code = :code, gifted_at = :now WHERE id = :id', { code, now: nowIso(), id: row.id });
    return { coupon: presentCoupon(db.one('SELECT * FROM coupons WHERE id = :id', { id: row.id })), giftCode: code };
  }

  function redeemCoupon(userId, rawCode) {
    const code = str(rawCode, 32).toUpperCase();
    if (!code) throw httpError(400, 'INVALID_REDEEM_CODE', '请输入兑换码');
    return db.tx(() => {
      const source = db.one('SELECT * FROM coupons WHERE gift_code = :code', { code });
      if (!source) throw httpError(404, 'REDEEM_CODE_NOT_FOUND', '兑换码无效');
      if (source.claimed_by) throw httpError(409, 'REDEEM_CODE_USED', '兑换码已被领取');
      if (source.user_id === userId) throw httpError(400, 'REDEEM_OWN_COUPON', '不能领取自己转赠的优惠券');
      if (Date.now() > Date.parse(source.valid_to)) throw httpError(409, 'COUPON_EXPIRED', '优惠券已过期');
      const id = shortId('cp_');
      db.run(`INSERT INTO coupons (id, user_id, title, amount_fen, threshold_fen, valid_from, valid_to, source, created_at)
        VALUES (:id, :userId, :title, :amount, :threshold, :from, :to, 'gift', :now)`, {
        id, userId, title: source.title, amount: source.amount_fen, threshold: source.threshold_fen, from: source.valid_from, to: source.valid_to, now: nowIso(),
      });
      db.run('UPDATE coupons SET claimed_by = :userId WHERE id = :id', { userId, id: source.id });
      return presentCoupon(db.one('SELECT * FROM coupons WHERE id = :id', { id }));
    });
  }

  /* ---------- pricing ---------- */
  function calculateQuote(user, rawItems, couponId) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) throw httpError(400, 'EMPTY_CART', '购物车不能为空');
    const seen = new Set();
    const items = rawItems.map((raw) => {
      const id = String(raw?.productId ?? raw?.id ?? '');
      const quantity = Number(raw?.quantity ?? raw?.count);
      const product = db.one('SELECT * FROM products WHERE id = :id', { id });
      if (!product) throw httpError(400, 'PRODUCT_NOT_FOUND', `商品不存在：${id || '未提供商品 ID'}`);
      if (!product.available) throw httpError(409, 'PRODUCT_UNAVAILABLE', `商品已下架：${product.name}`);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw httpError(400, 'INVALID_QUANTITY', `商品数量必须是 1-99 的整数：${product.name}`);
      if (seen.has(id)) throw httpError(400, 'DUPLICATE_PRODUCT', `商品不能重复传入：${id}`);
      seen.add(id);
      // Line totals use the list price; the member discount applies once on the subtotal.
      return { productId: product.id, name: product.name, unitPriceFen: product.list_price_fen, quantity, lineTotalFen: product.list_price_fen * quantity };
    });
    const subtotalFen = items.reduce((sum, item) => sum + item.lineTotalFen, 0);
    const member = user ? memberInfo(user) : { level: 0, rate: 1, name: '' };
    const discountFen = Math.round(subtotalFen * (1 - member.rate));
    const afterMemberFen = subtotalFen - discountFen;
    let coupon = null;
    if (couponId) {
      coupon = db.one('SELECT * FROM coupons WHERE id = :couponId AND user_id = :userId', { couponId: String(couponId), userId: user?.id ?? '' });
      if (!coupon) throw httpError(400, 'COUPON_NOT_FOUND', '优惠券不存在');
      const status = couponStatus(coupon);
      if (status !== 'available') throw httpError(409, 'COUPON_UNAVAILABLE', `优惠券${COUPON_STATUS_TEXT[status]}：${coupon.title}`);
      if (afterMemberFen < coupon.threshold_fen) throw httpError(400, 'COUPON_THRESHOLD', `未满足使用门槛：${coupon.title}`);
    }
    const couponDiscountFen = coupon ? coupon.amount_fen : 0;
    return {
      items,
      subtotalFen,
      discountFen,
      couponDiscountFen,
      totalFen: Math.max(0, afterMemberFen - couponDiscountFen),
      member,
      coupon: coupon ? { id: coupon.id, title: coupon.title } : null,
    };
  }

  const presentQuote = (q) => ({
    items: q.items.map(presentItem),
    subtotal: yuan(q.subtotalFen),
    discount: yuan(q.discountFen),
    memberLevel: q.member.level,
    memberName: q.member.name,
    couponDiscount: yuan(q.couponDiscountFen),
    coupon: q.coupon,
    total: yuan(q.totalFen),
  });

  function presentItem(item) {
    return { productId: item.productId, name: item.name, unitPrice: yuan(item.unitPriceFen), quantity: item.quantity, lineTotal: yuan(item.lineTotalFen) };
  }

  /* ---------- addresses ---------- */
  const presentAddress = (row) => ({ id: row.id, name: row.name, phone: row.phone, detail: row.detail });
  const listAddresses = (userId) => db.all('SELECT * FROM addresses WHERE user_id = :userId ORDER BY created_at', { userId }).map(presentAddress);
  function createAddress(userId, body) {
    const name = str(body.name, 40);
    const phone = validPhone(body.phone);
    const detail = str(body.detail, 200);
    if (!name || name.length > 20) throw httpError(400, 'INVALID_ADDRESS_NAME', '联系人不能为空且不超过 20 个字符');
    if (!phone) throw httpError(400, 'INVALID_PHONE', '请提供有效的 11 位手机号');
    if (!detail || detail.length > 100) throw httpError(400, 'INVALID_ADDRESS_DETAIL', '详细地址不能为空且不超过 100 个字符');
    if (db.one('SELECT COUNT(*) AS n FROM addresses WHERE user_id = :userId', { userId }).n >= 20) throw httpError(400, 'TOO_MANY_ADDRESSES', '最多保存 20 个地址');
    const id = shortId('addr_', 8);
    db.run('INSERT INTO addresses (id, user_id, name, phone, detail, created_at) VALUES (:id, :userId, :name, :phone, :detail, :now)', { id, userId, name, phone, detail, now: nowIso() });
    return presentAddress(db.one('SELECT * FROM addresses WHERE id = :id', { id }));
  }
  function deleteAddress(userId, id) {
    const result = db.run('DELETE FROM addresses WHERE id = :id AND user_id = :userId', { id, userId });
    if (!result.changes) throw httpError(404, 'ADDRESS_NOT_FOUND', '地址不存在');
  }

  /* ---------- orders ---------- */
  function presentOrder(row, { admin = false } = {}) {
    const items = parseJson(row.items_json, []);
    const order = {
      id: row.id,
      pickupNo: row.pickup_no,
      status: row.status,
      statusText: ORDER_STATUS_TEXT[row.status] || row.status,
      fulfillment: row.fulfillment,
      schedule: row.schedule,
      note: row.note,
      createdAt: row.created_at,
      paidAt: row.paid_at,
      acceptedAt: row.accepted_at,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
      cancelReason: row.cancel_reason,
      refundStatus: row.refund_status,
      refundStatusText: row.refund_status ? REFUND_STATUS_TEXT[row.refund_status] : null,
      customer: { phone: row.customer_phone, nickname: row.customer_nickname },
      address: parseJson(row.address_json),
      items: items.map(presentItem),
      coupon: row.coupon_id ? { id: row.coupon_id, title: row.coupon_title } : null,
      totals: {
        subtotal: yuan(row.subtotal_fen),
        discount: yuan(row.discount_fen),
        couponDiscount: yuan(row.coupon_discount_fen),
        total: yuan(row.total_fen),
      },
    };
    if (admin) Object.assign(order, { userId: row.user_id, memberLevel: row.member_level, paymentMethod: row.payment_method, transactionId: row.transaction_id, refundNo: row.refund_no, refundedAt: row.refunded_at, updatedAt: row.updated_at });
    return order;
  }

  const getOrderRow = (id) => db.one('SELECT * FROM orders WHERE id = :id', { id });
  function getOwnOrderRow(userId, id) {
    const row = db.one('SELECT * FROM orders WHERE id = :id AND user_id = :userId', { id, userId });
    if (!row) throw httpError(404, 'ORDER_NOT_FOUND', '订单不存在');
    return row;
  }

  function assertStoreOpen() {
    const store = getSetting('store');
    if (!store.accepting) throw httpError(409, 'STORE_CLOSED', store.notice || '门店暂停接单，请稍后再来');
    const { open = '00:00', close = '24:00' } = store.hours || {};
    const { time } = localParts();
    const inHours = open <= close ? time >= open && time < close : time >= open || time < close;
    if (!inHours) throw httpError(409, 'STORE_CLOSED', `当前不在营业时间（${open}-${close}）`);
  }

  function createOrder(user, body) {
    assertStoreOpen();
    const rawItems = Array.isArray(body.items) ? body.items : Object.entries(body.cart || {}).map(([productId, quantity]) => ({ productId, quantity }));
    const customer = body.customer && typeof body.customer === 'object' ? body.customer : {};
    const phone = validPhone(customer.phone || user.phone);
    if (!phone) throw httpError(400, 'INVALID_PHONE', '请提供有效的 11 位手机号');
    const nickname = str(customer.nickname || user.nickname, 30);

    return db.tx(() => {
      const quote = calculateQuote(user, rawItems, body.couponId);
      let address = null;
      if (body.addressId) {
        const row = db.one('SELECT * FROM addresses WHERE id = :id AND user_id = :userId', { id: String(body.addressId), userId: user.id });
        if (!row) throw httpError(400, 'ADDRESS_NOT_FOUND', '收货地址不存在');
        address = presentAddress(row);
      }
      const { date } = localParts();
      const pickupNo = db.one('SELECT COALESCE(MAX(pickup_no), 0) + 1 AS n FROM orders WHERE business_date = :date', { date }).n;
      const id = `RY${date.replaceAll('-', '')}${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
      const now = nowIso();
      db.run(`INSERT INTO orders (id, user_id, pickup_no, business_date, status, fulfillment, schedule, note, customer_phone, customer_nickname,
          address_json, items_json, coupon_id, coupon_title, subtotal_fen, discount_fen, coupon_discount_fen, total_fen, member_level, created_at, updated_at)
        VALUES (:id, :userId, :pickupNo, :date, 'pending_payment', :fulfillment, :schedule, :note, :phone, :nickname,
          :address, :items, :couponId, :couponTitle, :subtotal, :discount, :couponDiscount, :total, :level, :now, :now)`, {
        id, userId: user.id, pickupNo, date,
        fulfillment: body.fulfillment === 'pickup' ? 'pickup' : 'delivery',
        schedule: str(body.schedule || '立即取单', 20),
        note: str(body.note, 200),
        phone, nickname,
        address: address ? JSON.stringify(address) : null,
        items: JSON.stringify(quote.items),
        couponId: quote.coupon?.id, couponTitle: quote.coupon?.title,
        subtotal: quote.subtotalFen, discount: quote.discountFen, couponDiscount: quote.couponDiscountFen, total: quote.totalFen,
        level: quote.member.level, now,
      });
      if (quote.coupon) db.run('UPDATE coupons SET used_by = :id WHERE id = :couponId', { id, couponId: quote.coupon.id });
      return getOrderRow(id);
    });
  }

  function listUserOrders(userId, status) {
    return db.all(`SELECT * FROM orders WHERE user_id = :userId ${status ? 'AND status = :status' : ''} ORDER BY created_at DESC LIMIT 200`, { userId, status })
      .map((row) => presentOrder(row));
  }

  /** Paid via mock payment or a verified WeChat Pay notification. Idempotent. */
  function markOrderPaid(orderId, { method, transactionId = null, paidAt = nowIso() }) {
    return db.tx(() => {
      const row = getOrderRow(orderId);
      if (!row) throw httpError(404, 'ORDER_NOT_FOUND', '订单不存在');
      if (row.paid_at) return { row, changed: false };
      if (row.status !== 'pending_payment') {
        // Paid after auto-cancel: record it so the merchant can refund.
        db.run(`UPDATE orders SET paid_at = :paidAt, payment_method = :method, transaction_id = :transactionId, refund_status = 'pending', updated_at = :now WHERE id = :id`,
          { paidAt, method, transactionId, now: nowIso(), id: orderId });
        return { row: getOrderRow(orderId), changed: true, needsRefund: true };
      }
      db.run(`UPDATE orders SET status = 'paid', paid_at = :paidAt, payment_method = :method, transaction_id = :transactionId, updated_at = :now WHERE id = :id`,
        { paidAt, method, transactionId, now: nowIso(), id: orderId });
      return { row: getOrderRow(orderId), changed: true };
    });
  }

  const TRANSITIONS = {
    accept: { from: ['paid'], to: 'preparing', stamp: 'accepted_at' },
    complete: { from: ['paid', 'preparing'], to: 'completed', stamp: 'completed_at' },
  };
  function transitionOrder(orderId, action) {
    const rule = TRANSITIONS[action];
    return db.tx(() => {
      const row = getOrderRow(orderId);
      if (!row) throw httpError(404, 'ORDER_NOT_FOUND', '订单不存在');
      if (!rule.from.includes(row.status)) throw httpError(409, 'INVALID_ORDER_STATUS', `订单当前状态（${ORDER_STATUS_TEXT[row.status]}）不能执行该操作`);
      db.run(`UPDATE orders SET status = :to, ${rule.stamp} = :now, updated_at = :now WHERE id = :id`, { to: rule.to, now: nowIso(), id: orderId });
      return getOrderRow(orderId);
    });
  }

  /**
   * Cancel and release the coupon. Customers may cancel before the merchant
   * accepts; the merchant may cancel any unfinished order. A paid order is
   * flagged refund_status = 'pending' for the payment adapter to refund.
   */
  function cancelOrder(orderId, { by, reason }) {
    const allowed = by === 'customer' ? ['pending_payment', 'paid'] : ['pending_payment', 'paid', 'preparing'];
    return db.tx(() => {
      const row = getOrderRow(orderId);
      if (!row) throw httpError(404, 'ORDER_NOT_FOUND', '订单不存在');
      if (!allowed.includes(row.status)) {
        const hint = by === 'customer' && row.status === 'preparing' ? '，商家已接单，请联系商家处理' : '';
        throw httpError(409, 'ORDER_NOT_CANCELLABLE', `订单当前状态不可取消：${ORDER_STATUS_TEXT[row.status]}${hint}`);
      }
      db.run(`UPDATE orders SET status = 'cancelled', cancelled_at = :now, cancel_reason = :reason, refund_status = :refund, updated_at = :now WHERE id = :id`, {
        now: nowIso(), reason: str(reason || (by === 'customer' ? '顾客取消' : '商家取消'), 100), refund: row.paid_at ? 'pending' : null, id: orderId,
      });
      db.run('UPDATE coupons SET used_by = NULL WHERE used_by = :id', { id: orderId });
      return getOrderRow(orderId);
    });
  }

  function setRefundStatus(orderId, status, refundNo) {
    db.run(`UPDATE orders SET refund_status = :status, refund_no = COALESCE(:refundNo, refund_no),
      refunded_at = CASE WHEN :status = 'success' THEN :now ELSE refunded_at END, updated_at = :now WHERE id = :id`,
    { status, refundNo: refundNo ?? null, now: nowIso(), id: orderId });
    return getOrderRow(orderId);
  }

  /** Unpaid orders older than the timeout; the caller closes and cancels them. */
  function expiredUnpaidOrders(timeoutMinutes) {
    const cutoff = new Date(Date.now() - timeoutMinutes * 60000).toISOString();
    return db.all("SELECT * FROM orders WHERE status = 'pending_payment' AND created_at < :cutoff", { cutoff });
  }

  function logPaymentEvent(orderId, kind, detail) {
    db.run('INSERT INTO payment_events (order_id, kind, detail_json, created_at) VALUES (:orderId, :kind, :detail, :now)', { orderId, kind, detail: JSON.stringify(detail), now: nowIso() });
  }

  function pointsRecords(userId) {
    return db.all(`SELECT id, total_fen, paid_at, created_at FROM orders WHERE user_id = :userId AND status IN ${SPENT_STATUSES} ORDER BY created_at DESC`, { userId })
      .map((row) => ({ orderId: row.id, points: Math.floor(row.total_fen / 100), at: row.paid_at || row.created_at }));
  }

  /* ---------- invitations & partner ---------- */
  function recordInvitation(invitee, inviterId) {
    const inviter = getUser(String(inviterId || ''));
    if (!inviter || inviter.id === invitee.id) return false;
    if (db.one('SELECT 1 AS x FROM invitations WHERE invitee_id = :id', { id: invitee.id })) return false;
    const rewards = getSetting('rewards');
    db.tx(() => {
      db.run(`INSERT INTO invitations (id, inviter_id, invitee_id, status, created_at) VALUES (:id, :inviter, :invitee, 'valid', :now)`,
        { id: shortId('inv_', 8), inviter: inviter.id, invitee: invitee.id, now: nowIso() });
      for (let i = 0; i < rewards.newUser.count; i += 1) issueCoupon(invitee.id, rewards.newUser, 'invite');
      for (let i = 0; i < rewards.inviter.count; i += 1) issueCoupon(inviter.id, rewards.inviter, 'invite_reward');
    });
    return true;
  }

  function partnerSummary(userId) {
    const rate = Number(getSetting('partner')?.commissionRate || 0);
    const rows = db.all(`SELECT i.status, i.created_at, u.nickname, u.registered,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total_fen END), 0) AS settled_fen,
        COALESCE(SUM(CASE WHEN o.status IN ('paid','preparing') THEN o.total_fen END), 0) AS pending_fen
      FROM invitations i JOIN users u ON u.id = i.invitee_id LEFT JOIN orders o ON o.user_id = i.invitee_id
      WHERE i.inviter_id = :userId GROUP BY i.id ORDER BY i.created_at DESC`, { userId })
      .map((row) => {
        const settled = Math.round(row.settled_fen * rate);
        const pending = Math.round(row.pending_fen * rate);
        return { nickname: row.registered ? row.nickname : '微信用户', status: row.status, invitedAt: row.created_at, settledFen: settled, pendingFen: pending, commission: yuan(settled + pending) };
      });
    const withdrawableFen = rows.reduce((sum, row) => sum + row.settledFen, 0);
    const pendingFen = rows.reduce((sum, row) => sum + row.pendingFen, 0);
    const strip = ({ settledFen, pendingFen: p, ...row }) => row;
    return {
      commissionRate: rate,
      withdrawable: yuan(withdrawableFen),
      pending: yuan(pendingFen),
      totalIncome: yuan(withdrawableFen + pendingFen),
      invited: rows.filter((row) => row.status === 'valid').map(strip),
      invalid: rows.filter((row) => row.status !== 'valid').map(strip),
    };
  }

  /* ---------- merchant reports ---------- */
  // Order-list tabs of the merchant console. Tabs for features we don't run
  // (riders, express shipping, split bills) match nothing.
  const ORDER_TABS = {
    paid: "status IN ('paid','preparing','completed')",
    unpaid: "status = 'pending_payment'",
    refunding: "refund_status IN ('pending','processing','failed')",
    refunded: "refund_status = 'success'",
    cancelled: "status = 'cancelled'",
    todo: "status IN ('paid','preparing')",
    accept: "status = 'paid'",
    preparing: "status = 'preparing'",
    completed: "status = 'completed'",
    delivery: "status IN ('paid','preparing') AND fulfillment = 'delivery'",
    none: '0',
  };
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function dateRange({ from, to } = {}) {
    const today = localParts().date;
    const start = DATE_RE.test(String(from || '')) ? from : today;
    const end = DATE_RE.test(String(to || '')) ? to : start;
    return start <= end ? { from: start, to: end } : { from: end, to: start };
  }

  function dashboard(range = {}) {
    const { from, to } = dateRange(range);
    const p = { from, to };
    const inRange = 'business_date BETWEEN :from AND :to';
    const agg = db.one(`SELECT
        COALESCE(SUM(CASE WHEN status IN ${SPENT_STATUSES} THEN total_fen END), 0) AS revenue_fen,
        COALESCE(SUM(CASE WHEN status IN ${SPENT_STATUSES} THEN 1 END), 0) AS paid_orders,
        COALESCE(SUM(CASE WHEN paid_at IS NOT NULL THEN total_fen END), 0) AS order_amount_fen,
        COALESCE(SUM(CASE WHEN refund_status = 'success' THEN total_fen END), 0) AS refund_fen,
        COUNT(DISTINCT CASE WHEN status IN ${SPENT_STATUSES} THEN user_id END) AS customers,
        COUNT(DISTINCT CASE WHEN status IN ${SPENT_STATUSES} AND member_level > 0 THEN user_id END) AS member_customers,
        COUNT(*) AS orders
      FROM orders WHERE ${inRange}`, p);
    const byFulfillment = Object.fromEntries(['delivery', 'pickup', 'dinein', 'express'].map((k) => [k, { orders: 0, amount: 0 }]));
    for (const row of db.all(`SELECT fulfillment, COUNT(*) AS n, SUM(total_fen) AS fen FROM orders WHERE ${inRange} AND status IN ${SPENT_STATUSES} GROUP BY fulfillment`, p)) {
      byFulfillment[row.fulfillment] = { orders: row.n, amount: yuan(row.fen) };
    }
    const byPayment = Object.fromEntries(db.all(`SELECT COALESCE(payment_method, 'unknown') AS m, SUM(total_fen) AS fen FROM orders WHERE ${inRange} AND status IN ${SPENT_STATUSES} GROUP BY m`, p).map((r) => [r.m, yuan(r.fen)]));
    const counts = Object.fromEntries(db.all('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').map((r) => [r.status, r.n]));
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const day = localParts(new Date(Date.now() - i * 86400000)).date;
      const r = db.one(`SELECT COUNT(*) AS n, COALESCE(SUM(total_fen), 0) AS fen FROM orders WHERE business_date = :day AND status IN ${SPENT_STATUSES}`, { day });
      days.push({ date: day, orders: r.n, revenue: yuan(r.fen) });
    }
    return {
      range: { from, to },
      revenue: yuan(agg.revenue_fen),
      paidOrders: agg.paid_orders,
      orders: agg.orders,
      orderAmount: yuan(agg.order_amount_fen),
      refund: yuan(agg.refund_fen),
      customers: agg.customers,
      memberShare: agg.customers ? Math.round((agg.member_customers / agg.customers) * 1000) / 10 : 0,
      perCustomer: agg.customers ? yuan(Math.round(agg.revenue_fen / agg.customers)) : 0,
      byFulfillment,
      byPayment,
      newCustomers: db.one('SELECT COUNT(*) AS n FROM users WHERE substr(created_at, 1, 10) BETWEEN :from AND :to', p).n,
      waitingAccept: counts.paid || 0,
      preparing: counts.preparing || 0,
      pendingRefunds: db.one("SELECT COUNT(*) AS n FROM orders WHERE refund_status IN ('pending','failed')").n,
      last7Days: days,
    };
  }

  function orderFilter({ status, tab, from, to, date, q, since }) {
    const where = [];
    const params = {};
    if (status) { where.push('status = :status'); params.status = status; }
    if (date) { where.push('business_date = :date'); params.date = date; }
    if (from || to) { Object.assign(params, dateRange({ from, to })); where.push('business_date BETWEEN :from AND :to'); }
    if (since) { where.push('updated_at > :since'); params.since = since; }
    if (q) {
      where.push('(id LIKE :q OR customer_phone LIKE :q OR customer_nickname LIKE :q OR items_json LIKE :q OR CAST(pickup_no AS TEXT) = :exact)');
      params.q = `%${str(q, 40)}%`;
      params.exact = str(q, 40);
    }
    const base = [...where];
    if (tab && ORDER_TABS[tab]) where.push(ORDER_TABS[tab]);
    const toClause = (list) => (list.length ? `WHERE ${list.join(' AND ')}` : '');
    return { clause: toClause(where), baseClause: toClause(base), params };
  }

  function adminListOrders({ page = 1, pageSize = 20, ...filters }) {
    const { clause, baseClause, params } = orderFilter(filters);
    const size = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const offset = (Math.max(1, Number(page) || 1) - 1) * size;
    const total = db.one(`SELECT COUNT(*) AS n FROM orders ${clause}`, params).n;
    const orders = db.all(`SELECT * FROM orders ${clause} ORDER BY created_at DESC LIMIT ${size} OFFSET ${offset}`, params).map((row) => presentOrder(row, { admin: true }));
    // Summary follows the search filters but not the status tab, like the original console.
    const sum = db.one(`SELECT COUNT(*) AS n,
        COALESCE(SUM(CASE WHEN status IN ${SPENT_STATUSES} THEN total_fen END), 0) AS paid_fen,
        COALESCE(SUM(CASE WHEN status = 'pending_payment' THEN total_fen END), 0) AS unpaid_fen,
        COALESCE(SUM(CASE WHEN refund_status = 'success' THEN total_fen END), 0) AS refund_fen
      FROM orders ${baseClause}`, params);
    const tabCounts = Object.fromEntries(Object.entries(ORDER_TABS).map(([key, cond]) => [key, db.one(`SELECT COUNT(*) AS n FROM orders ${baseClause ? `${baseClause} AND` : 'WHERE'} ${cond}`, params).n]));
    return {
      orders, total, page: Math.max(1, Number(page) || 1), pageSize: size,
      summary: { orders: sum.n, paid: yuan(sum.paid_fen), unpaid: yuan(sum.unpaid_fen), refund: yuan(sum.refund_fen) },
      tabCounts,
    };
  }

  /** 销售汇总: per product, from paid (or refunded) orders in the range. */
  function salesReport(range) {
    const { from, to } = dateRange(range);
    const rows = new Map();
    const totals = { salesFen: 0, discountFen: 0, refundFen: 0 };
    for (const order of db.all('SELECT * FROM orders WHERE business_date BETWEEN :from AND :to AND paid_at IS NOT NULL', { from, to })) {
      const items = parseJson(order.items_json, []);
      const refunded = order.refund_status === 'success';
      const orderDiscount = order.discount_fen + order.coupon_discount_fen;
      for (const item of items) {
        const key = item.productId;
        const row = rows.get(key) || { productId: key, name: item.name, quantity: 0, refundQuantity: 0, salesFen: 0, discountFen: 0, refundFen: 0 };
        const share = order.subtotal_fen ? Math.round((item.lineTotalFen / order.subtotal_fen) * orderDiscount) : 0;
        row.quantity += item.quantity;
        row.salesFen += item.lineTotalFen;
        row.discountFen += share;
        if (refunded) { row.refundQuantity += item.quantity; row.refundFen += item.lineTotalFen - share; }
        rows.set(key, row);
        totals.salesFen += item.lineTotalFen;
        totals.discountFen += share;
        if (refunded) totals.refundFen += item.lineTotalFen - share;
      }
    }
    const categoryOf = Object.fromEntries(db.all('SELECT p.id, c.label FROM products p LEFT JOIN categories c ON c.id = p.category_id').map((r) => [r.id, r.label]));
    return {
      range: { from, to },
      totals: { sales: yuan(totals.salesFen), discount: yuan(totals.discountFen), refund: yuan(totals.refundFen), actual: yuan(totals.salesFen - totals.discountFen - totals.refundFen) },
      rows: [...rows.values()].sort((a, b) => b.salesFen - a.salesFen).map((r) => ({
        productId: r.productId, name: r.name, category: categoryOf[r.productId] || '-',
        quantity: r.quantity, refundQuantity: r.refundQuantity, actualQuantity: r.quantity - r.refundQuantity,
        sales: yuan(r.salesFen), discount: yuan(r.discountFen), refund: yuan(r.refundFen), actual: yuan(r.salesFen - r.discountFen - r.refundFen),
      })),
    };
  }

  /** 营业报表: one row per business day with the figures we actually record. */
  function dailyReport(range) {
    const { from, to } = dateRange(range);
    const byDay = new Map(db.all(`SELECT business_date AS d,
        COUNT(CASE WHEN status IN ${SPENT_STATUSES} THEN 1 END) AS orders,
        COALESCE(SUM(CASE WHEN paid_at IS NOT NULL THEN subtotal_fen END), 0) AS gross_fen,
        COALESCE(SUM(CASE WHEN status IN ${SPENT_STATUSES} THEN total_fen END), 0) AS net_fen,
        COALESCE(SUM(CASE WHEN paid_at IS NOT NULL AND payment_method = 'wechat' THEN total_fen END), 0) AS wechat_fen,
        COALESCE(SUM(CASE WHEN paid_at IS NOT NULL THEN total_fen END), 0) AS collected_fen,
        COUNT(CASE WHEN refund_status = 'success' THEN 1 END) AS refunds,
        COALESCE(SUM(CASE WHEN refund_status = 'success' THEN total_fen END), 0) AS refund_fen,
        COALESCE(SUM(CASE WHEN refund_status = 'success' AND payment_method = 'wechat' THEN total_fen END), 0) AS wechat_refund_fen,
        COUNT(CASE WHEN status IN ${SPENT_STATUSES} AND fulfillment = 'delivery' THEN 1 END) AS delivery_orders,
        COALESCE(SUM(CASE WHEN status IN ${SPENT_STATUSES} AND fulfillment = 'delivery' THEN total_fen END), 0) AS delivery_fen,
        COUNT(CASE WHEN status IN ${SPENT_STATUSES} AND fulfillment = 'pickup' THEN 1 END) AS pickup_orders,
        COALESCE(SUM(CASE WHEN status IN ${SPENT_STATUSES} AND fulfillment = 'pickup' THEN total_fen END), 0) AS pickup_fen,
        COALESCE(SUM(CASE WHEN status IN ${SPENT_STATUSES} THEN discount_fen END), 0) AS member_fen,
        COALESCE(SUM(CASE WHEN status IN ${SPENT_STATUSES} THEN coupon_discount_fen END), 0) AS coupon_fen
      FROM orders WHERE business_date BETWEEN :from AND :to GROUP BY business_date`, { from, to }).map((r) => [r.d, r]));
    const newUsers = new Map(db.all('SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n FROM users WHERE substr(created_at, 1, 10) BETWEEN :from AND :to GROUP BY d', { from, to }).map((r) => [r.d, r.n]));
    const days = [];
    for (let t = Date.parse(`${to}T00:00:00Z`); t >= Date.parse(`${from}T00:00:00Z`) && days.length < 366; t -= 86400000) {
      const d = new Date(t).toISOString().slice(0, 10);
      const r = byDay.get(d) || {};
      const v = (k) => r[k] || 0;
      days.push({
        date: d, newVisitors: newUsers.get(d) || 0,
        collected: yuan(v('collected_fen')), wechatReceived: yuan(v('wechat_fen') - v('wechat_refund_fen')), orderNet: yuan(v('net_fen')),
        orders: v('orders'), orderGross: yuan(v('gross_fen')), orderWechat: yuan(v('wechat_fen')),
        refunds: v('refunds'), refundAmount: yuan(v('refund_fen')), wechatRefund: yuan(v('wechat_refund_fen')),
        deliveryOrders: v('delivery_orders'), deliveryAmount: yuan(v('delivery_fen')), pickupOrders: v('pickup_orders'), pickupAmount: yuan(v('pickup_fen')),
        memberDiscount: yuan(v('member_fen')), couponDiscount: yuan(v('coupon_fen')),
      });
    }
    return { range: { from, to }, days };
  }

  /** Coupons grouped by template (title/amount/threshold) for the merchant. */
  function couponSummary() {
    const now = new Date().toISOString();
    return db.all(`SELECT title, amount_fen, threshold_fen, source, COUNT(*) AS issued,
        COUNT(used_by) AS used, COUNT(gift_code) AS gifted,
        COUNT(CASE WHEN used_by IS NULL AND gift_code IS NULL AND valid_to >= :now THEN 1 END) AS available
      FROM coupons GROUP BY title, amount_fen, threshold_fen, source ORDER BY issued DESC`, { now })
      .map((r) => ({ title: r.title, amount: yuan(r.amount_fen), threshold: yuan(r.threshold_fen), source: r.source, issued: r.issued, used: r.used, gifted: r.gifted, available: r.available }));
  }

  function listCustomers({ q, member, phone, from, to, page = 1, pageSize = 20 }) {
    const params = {};
    let clause = 'WHERE u.deleted_at IS NULL';
    if (q) { clause += ' AND (u.nickname LIKE :q OR u.phone LIKE :q OR u.id = :exact)'; params.q = `%${str(q, 40)}%`; params.exact = str(q, 40); }
    // Membership requires a bound phone (白银及以上).
    if (member === 'yes' || phone === 'yes') clause += " AND u.phone <> ''";
    if (member === 'no' || phone === 'no') clause += " AND u.phone = ''";
    if (from && DATE_RE.test(from)) { clause += ' AND substr(u.created_at, 1, 10) >= :from'; params.from = from; }
    if (to && DATE_RE.test(to)) { clause += ' AND substr(u.created_at, 1, 10) <= :to'; params.to = to; }
    const size = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const offset = (Math.max(1, Number(page) || 1) - 1) * size;
    const total = db.one(`SELECT COUNT(*) AS n FROM users u ${clause}`, params).n;
    const rows = db.all(`SELECT u.*, COUNT(o.id) AS order_count, MAX(o.created_at) AS last_order_at FROM users u
      LEFT JOIN orders o ON o.user_id = u.id AND o.status IN ${SPENT_STATUSES} ${clause} GROUP BY u.id ORDER BY u.created_at DESC LIMIT ${size} OFFSET ${offset}`, params);
    const stats = db.one(`SELECT COUNT(*) AS users, COUNT(CASE WHEN phone <> '' THEN 1 END) AS members, COALESCE(SUM(balance_fen), 0) AS balance_fen,
        COUNT(CASE WHEN id IN (SELECT DISTINCT user_id FROM orders WHERE status IN ${SPENT_STATUSES}) THEN 1 END) AS ordered
      FROM users WHERE deleted_at IS NULL`);
    const spent = db.all(`SELECT user_id, SUM(total_fen) AS fen FROM orders WHERE status IN ${SPENT_STATUSES} GROUP BY user_id`);
    return {
      total,
      stats: {
        users: stats.users, members: stats.members, balance: yuan(stats.balance_fen), ordered: stats.ordered,
        points: spent.reduce((acc, r) => acc + Math.floor(r.fen / 100), 0),
      },
      customers: rows.map((row) => ({ ...presentUser(row), createdAt: row.created_at, orderCount: row.order_count, lastOrderAt: row.last_order_at })),
    };
  }

  return {
    localParts, getSetting, setSetting, audit,
    listCategories, listProducts, presentProduct, presentCategory,
    getUser, createUser, updateUser, deleteUser, presentUser, memberInfo,
    couponStatus, presentCoupon, issueCoupon, listCoupons, giftCoupon, redeemCoupon,
    calculateQuote, presentQuote,
    listAddresses, createAddress, deleteAddress,
    presentOrder, getOrderRow, getOwnOrderRow, createOrder, listUserOrders, markOrderPaid, transitionOrder, cancelOrder, setRefundStatus, expiredUnpaidOrders, logPaymentEvent, pointsRecords,
    recordInvitation, partnerSummary,
    dashboard, adminListOrders, listCustomers, salesReport, dailyReport, couponSummary,
  };
}
