import path from 'node:path';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { hashToken } from './wechat-auth.mjs';
import { httpError, readJson, str } from './http.mjs';
import { toFen } from './services.mjs';

/* ---------- passwords ---------- */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, N, r, p, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(String(password), Buffer.from(salt, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return timingSafeEqual(expected, actual);
}

export function createAdmin(db, username, password) {
  const name = str(username, 32);
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(name)) throw new Error('管理员用户名需为 3-32 位字母、数字或 _.-');
  if (String(password).length < 10) throw new Error('管理员密码至少 10 位');
  const id = `adm_${randomUUID().slice(0, 8)}`;
  db.run('INSERT INTO admins (id, username, password_hash, created_at) VALUES (:id, :name, :hash, :now)', { id, name, hash: hashPassword(password), now: new Date().toISOString() });
  return id;
}

export function setAdminPassword(db, username, password) {
  if (String(password).length < 10) throw new Error('管理员密码至少 10 位');
  const result = db.run('UPDATE admins SET password_hash = :hash WHERE username = :username', { hash: hashPassword(password), username });
  if (!result.changes) throw new Error(`管理员不存在：${username}`);
  db.run('DELETE FROM admin_sessions WHERE admin_id = (SELECT id FROM admins WHERE username = :username)', { username });
}

/* ---------- validation ---------- */
const bool = (value) => value === true || value === 1 || value === '1' || value === 'true';
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

function money(value, field, { min = 0, max = 99999 } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw httpError(400, 'INVALID_FIELD', `${field}必须是 ${min}-${max} 之间的数字`);
  return Math.round(number * 100) / 100;
}

function validateProduct(body, db, existing = {}) {
  const merged = { ...existing, ...body };
  const name = str(merged.name, 60);
  if (!name) throw httpError(400, 'INVALID_FIELD', '商品名称不能为空');
  const categoryId = merged.categoryId ? str(merged.categoryId, 40) : null;
  if (categoryId && !db.one('SELECT 1 AS x FROM categories WHERE id = :id', { id: categoryId })) throw httpError(400, 'CATEGORY_NOT_FOUND', '分类不存在');
  const imageUrl = str(merged.imageUrl, 500);
  if (imageUrl && !/^https:\/\//.test(imageUrl)) throw httpError(400, 'INVALID_FIELD', '商品图片必须是 https 地址');
  const listPrice = money(merged.oldPrice ?? merged.listPrice ?? merged.price, '原价', { min: 0.01 });
  return {
    name,
    categoryId,
    price: toFen(money(merged.price, '会员价', { min: 0.01 })),
    listPrice: toFen(listPrice),
    description: str(merged.description, 300),
    emoji: str(merged.emoji, 8),
    imageUrl,
    available: merged.available === undefined ? 1 : Number(bool(merged.available)),
    sort: Number.isInteger(Number(merged.sort)) ? Number(merged.sort) : 0,
  };
}

const SETTING_VALIDATORS = {
  store(v) {
    const phone = str(v.phone, 20);
    if (!/^[\d-]{5,20}$/.test(phone)) throw httpError(400, 'INVALID_FIELD', '门店电话格式不正确');
    const open = str(v.hours?.open, 5) || '00:00';
    const close = str(v.hours?.close, 5) || '24:00';
    if (!HHMM.test(open) || !HHMM.test(close)) throw httpError(400, 'INVALID_FIELD', '营业时间格式应为 HH:MM');
    const name = str(v.name, 40);
    if (!name) throw httpError(400, 'INVALID_FIELD', '门店名称不能为空');
    return { id: 'ruyi-store', name, phone, distanceText: str(v.distanceText, 40), fulfillmentModes: ['delivery'], hours: { open, close }, accepting: bool(v.accepting ?? true), notice: str(v.notice, 100) };
  },
  memberLevels(v) {
    if (!Array.isArray(v) || v.length < 1 || v.length > 5) throw httpError(400, 'INVALID_FIELD', '会员等级需为 1-5 个');
    let last = -1;
    return v.map((level, index) => {
      const minSpent = money(level.minSpent, '升级门槛', { min: 0, max: 1000000 });
      const rate = Number(level.rate);
      if (!(rate >= 0.5 && rate <= 1)) throw httpError(400, 'INVALID_FIELD', '会员折扣需在 0.5-1 之间');
      if (minSpent < last) throw httpError(400, 'INVALID_FIELD', '会员等级门槛需逐级递增');
      last = minSpent;
      const name = str(level.name, 20);
      if (!name) throw httpError(400, 'INVALID_FIELD', '会员等级名称不能为空');
      return { level: index + 1, name, rate, minSpent, rule: str(level.rule, 100) };
    });
  },
  pointsRule: (v) => str(v, 300),
  rewards(v) {
    const one = (r, label) => {
      const validDays = Number(r?.validDays);
      const count = Number(r?.count);
      if (!Number.isInteger(validDays) || validDays < 1 || validDays > 365) throw httpError(400, 'INVALID_FIELD', `${label}有效天数需为 1-365`);
      if (!Number.isInteger(count) || count < 0 || count > 5) throw httpError(400, 'INVALID_FIELD', `${label}张数需为 0-5`);
      const title = str(r.title, 30);
      if (!title) throw httpError(400, 'INVALID_FIELD', `${label}名称不能为空`);
      return { title, amount: money(r.amount, `${label}金额`, { min: 0.01, max: 1000 }), threshold: money(r.threshold, `${label}门槛`), validDays, count };
    };
    return { newUser: one(v.newUser, '新用户券'), inviter: one(v.inviter, '邀请人券') };
  },
  partner(v) {
    const rate = Number(v.commissionRate);
    if (!(rate >= 0 && rate <= 0.5)) throw httpError(400, 'INVALID_FIELD', '佣金比例需在 0-0.5 之间');
    return { commissionRate: rate, rules: str(v.rules, 2000) };
  },
};

function csvCell(value) {
  const text = String(value ?? '');
  // Neutralise spreadsheet formula injection and quote everything.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

/* ---------- routes ---------- */
export function registerAdminRoutes(router, { db, config, services, payments, limiter, ip }) {
  const ttl = config.admin.sessionTtlSeconds;

  function requireAdmin(req) {
    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const row = token ? db.one(`SELECT s.expires_at, a.id, a.username FROM admin_sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = :hash`, { hash: hashToken(token) }) : null;
    if (!row || row.expires_at <= Date.now()) throw httpError(401, 'ADMIN_AUTH_REQUIRED', '请先登录商户后台');
    return { id: row.id, username: row.username, token };
  }

  // Wrap handlers so every admin route is authenticated and audited consistently.
  const guarded = (handler) => async (ctx) => handler({ ...ctx, admin: requireAdmin(ctx.req) });
  const actor = (admin) => `admin:${admin.username}`;

  router.post('/api/admin/login', async ({ req }) => {
    const body = await readJson(req);
    const username = str(body.username, 32);
    limiter.check(`admin-login:${ip(req)}`);
    limiter.check(`admin-login-user:${username}`);
    const admin = db.one('SELECT * FROM admins WHERE username = :username', { username });
    if (!admin || !verifyPassword(body.password || '', admin.password_hash)) {
      services.audit(`ip:${ip(req)}`, 'admin.login_failed', username);
      throw httpError(401, 'INVALID_CREDENTIALS', '用户名或密码错误');
    }
    const token = `adm_${randomBytes(24).toString('hex')}`;
    const expiresAt = Date.now() + ttl * 1000;
    const now = new Date().toISOString();
    db.run('INSERT INTO admin_sessions (token_hash, admin_id, expires_at, created_at) VALUES (:hash, :id, :expiresAt, :now)', { hash: hashToken(token), id: admin.id, expiresAt, now });
    db.run('UPDATE admins SET last_login_at = :now WHERE id = :id', { now, id: admin.id });
    services.audit(`admin:${username}`, 'admin.login', null, { ip: ip(req) });
    return { token, expiresAt: new Date(expiresAt).toISOString(), admin: { username } };
  });

  router.post('/api/admin/logout', guarded(({ admin }) => {
    db.run('DELETE FROM admin_sessions WHERE token_hash = :hash', { hash: hashToken(admin.token) });
    return {};
  }));

  router.get('/api/admin/me', guarded(({ admin }) => ({ admin: { username: admin.username } })));

  router.post('/api/admin/password', guarded(async ({ req, admin }) => {
    const body = await readJson(req);
    const row = db.one('SELECT * FROM admins WHERE id = :id', { id: admin.id });
    if (!verifyPassword(body.currentPassword || '', row.password_hash)) throw httpError(400, 'INVALID_CREDENTIALS', '当前密码不正确');
    try { setAdminPassword(db, admin.username, String(body.newPassword || '')); } catch (error) { throw httpError(400, 'INVALID_PASSWORD', error.message); }
    services.audit(actor(admin), 'admin.password_changed');
    return {};
  }));

  router.get('/api/admin/dashboard', guarded(({ query }) => ({ dashboard: services.dashboard({ from: query.get('from'), to: query.get('to') }), store: services.getSetting('store') })));

  router.get('/api/admin/reports/sales', guarded(({ query }) => ({ report: services.salesReport({ from: query.get('from'), to: query.get('to') }) })));
  router.get('/api/admin/reports/daily', guarded(({ query }) => ({ report: services.dailyReport({ from: query.get('from'), to: query.get('to') }) })));
  router.get('/api/admin/coupons/summary', guarded(() => ({ coupons: services.couponSummary(), rewards: services.getSetting('rewards') })));

  /* orders */
  router.get('/api/admin/orders/export.csv', guarded(({ query, res, admin }) => {
    const from = str(query.get('from'), 10) || services.localParts().date;
    const to = str(query.get('to'), 10) || from;
    const rows = db.all('SELECT * FROM orders WHERE business_date BETWEEN :from AND :to ORDER BY created_at', { from, to }).map((row) => services.presentOrder(row, { admin: true }));
    const header = ['订单号', '营业日', '取餐号', '状态', '下单时间', '支付时间', '顾客', '电话', '商品', '原价合计', '会员优惠', '优惠券', '实付', '支付方式', '微信支付单号', '退款状态', '备注'];
    const lines = rows.map((o) => [o.id, from === to ? from : o.createdAt.slice(0, 10), o.pickupNo, o.statusText, o.createdAt, o.paidAt, o.customer.nickname, o.customer.phone,
      o.items.map((i) => `${i.name}×${i.quantity}`).join('；'), o.totals.subtotal, o.totals.discount, o.totals.couponDiscount, o.totals.total, o.paymentMethod, o.transactionId, o.refundStatusText, o.note].map(csvCell).join(','));
    services.audit(actor(admin), 'orders.export', `${from}~${to}`, { count: rows.length });
    const body = `\uFEFF${header.map(csvCell).join(',')}\n${lines.join('\n')}\n`;
    res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="orders-${from}-${to}.csv"`, 'cache-control': 'no-store' });
    res.end(body);
  }));

  // Polling for new orders: pass the previous `serverTime` as `since`.
  router.get('/api/admin/orders', guarded(({ query }) => ({
    ...services.adminListOrders(Object.fromEntries(['status', 'tab', 'from', 'to', 'date', 'q', 'since', 'page', 'pageSize'].map((k) => [k, query.get(k)]))),
    serverTime: new Date().toISOString(),
  })));

  router.get('/api/admin/orders/:id', guarded(({ params }) => {
    const row = services.getOrderRow(params.id);
    if (!row) throw httpError(404, 'ORDER_NOT_FOUND', '订单不存在');
    const events = db.all('SELECT kind, detail_json, created_at FROM payment_events WHERE order_id = :id ORDER BY id', { id: row.id })
      .map((e) => ({ kind: e.kind, detail: JSON.parse(e.detail_json), at: e.created_at }));
    return { order: services.presentOrder(row, { admin: true }), paymentEvents: events };
  }));

  for (const action of ['accept', 'complete']) {
    router.post(`/api/admin/orders/:id/${action}`, guarded(({ params, admin }) => {
      const row = services.transitionOrder(params.id, action);
      services.audit(actor(admin), `order.${action}`, row.id);
      return { order: services.presentOrder(row, { admin: true }) };
    }));
  }

  router.post('/api/admin/orders/:id/cancel', guarded(async ({ req, params, admin }) => {
    const body = await readJson(req);
    let row = services.cancelOrder(params.id, { by: 'merchant', reason: body.reason });
    services.audit(actor(admin), 'order.cancel', row.id, { reason: row.cancel_reason });
    row = await refundIfNeeded(row, payments, services);
    return { order: services.presentOrder(row, { admin: true }) };
  }));

  // Retry a failed/pending refund (e.g. merchant account balance was short).
  router.post('/api/admin/orders/:id/refund', guarded(async ({ params, admin }) => {
    const row = services.getOrderRow(params.id);
    if (!row) throw httpError(404, 'ORDER_NOT_FOUND', '订单不存在');
    if (!['pending', 'failed'].includes(row.refund_status)) throw httpError(409, 'REFUND_NOT_NEEDED', '该订单无需退款');
    services.audit(actor(admin), 'order.refund_retry', row.id);
    return { order: services.presentOrder(await refundIfNeeded(row, payments, services), { admin: true }) };
  }));

  /* catalog */
  router.get('/api/admin/products', guarded(() => ({ products: services.listProducts({ includeUnavailable: true }), categories: services.listCategories() })));

  router.post('/api/admin/products', guarded(async ({ req, admin }) => {
    const body = await readJson(req);
    const p = validateProduct(body, db);
    const id = str(body.id, 40) || `p_${randomUUID().slice(0, 8)}`;
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw httpError(400, 'INVALID_FIELD', '商品 ID 只能包含字母、数字、_-');
    if (db.one('SELECT 1 AS x FROM products WHERE id = :id', { id })) throw httpError(409, 'PRODUCT_EXISTS', '商品 ID 已存在');
    const now = new Date().toISOString();
    db.run(`INSERT INTO products (id, category_id, name, price_fen, list_price_fen, description, emoji, image_url, available, sort, created_at, updated_at)
      VALUES (:id, :categoryId, :name, :price, :listPrice, :description, :emoji, :imageUrl, :available, :sort, :now, :now)`, { ...p, id, now });
    services.audit(actor(admin), 'product.create', id, { name: p.name, price: p.price });
    return { status: 201, product: services.presentProduct(db.one('SELECT * FROM products WHERE id = :id', { id })) };
  }));

  router.put('/api/admin/products/:id', guarded(async ({ req, params, admin }) => {
    const existing = db.one('SELECT * FROM products WHERE id = :id', { id: params.id });
    if (!existing) throw httpError(404, 'PRODUCT_NOT_FOUND', '商品不存在');
    const current = services.presentProduct(existing);
    const p = validateProduct(await readJson(req), db, current);
    db.run(`UPDATE products SET category_id = :categoryId, name = :name, price_fen = :price, list_price_fen = :listPrice, description = :description,
      emoji = :emoji, image_url = :imageUrl, available = :available, sort = :sort, updated_at = :now WHERE id = :id`, { ...p, id: params.id, now: new Date().toISOString() });
    services.audit(actor(admin), 'product.update', params.id, { before: { price: current.price, oldPrice: current.oldPrice, available: current.available }, after: { price: p.price / 100, oldPrice: p.listPrice / 100, available: Boolean(p.available) } });
    return { product: services.presentProduct(db.one('SELECT * FROM products WHERE id = :id', { id: params.id })) };
  }));

  router.del('/api/admin/products/:id', guarded(({ params, admin }) => {
    // Orders keep an item snapshot, so deleting a product never breaks history.
    const result = db.run('DELETE FROM products WHERE id = :id', { id: params.id });
    if (!result.changes) throw httpError(404, 'PRODUCT_NOT_FOUND', '商品不存在');
    services.audit(actor(admin), 'product.delete', params.id);
    return {};
  }));

  router.get('/api/admin/categories', guarded(() => ({ categories: services.listCategories() })));

  router.post('/api/admin/categories', guarded(async ({ req, admin }) => {
    const body = await readJson(req);
    const id = str(body.id, 40) || `c_${randomUUID().slice(0, 6)}`;
    const label = str(body.label, 20);
    if (!label) throw httpError(400, 'INVALID_FIELD', '分类名称不能为空');
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw httpError(400, 'INVALID_FIELD', '分类 ID 只能包含字母、数字、_-');
    if (db.one('SELECT 1 AS x FROM categories WHERE id = :id', { id })) throw httpError(409, 'CATEGORY_EXISTS', '分类 ID 已存在');
    db.run('INSERT INTO categories (id, label, emoji, sort, created_at) VALUES (:id, :label, :emoji, :sort, :now)', { id, label, emoji: str(body.emoji, 8), sort: Number(body.sort) || 0, now: new Date().toISOString() });
    services.audit(actor(admin), 'category.create', id, { label });
    return { status: 201, category: services.presentCategory(db.one('SELECT * FROM categories WHERE id = :id', { id })) };
  }));

  router.put('/api/admin/categories/:id', guarded(async ({ req, params, admin }) => {
    const existing = db.one('SELECT * FROM categories WHERE id = :id', { id: params.id });
    if (!existing) throw httpError(404, 'CATEGORY_NOT_FOUND', '分类不存在');
    const body = await readJson(req);
    const label = str(body.label ?? existing.label, 20);
    if (!label) throw httpError(400, 'INVALID_FIELD', '分类名称不能为空');
    db.run('UPDATE categories SET label = :label, emoji = :emoji, sort = :sort WHERE id = :id', { id: params.id, label, emoji: str(body.emoji ?? existing.emoji, 8), sort: Number(body.sort ?? existing.sort) || 0 });
    services.audit(actor(admin), 'category.update', params.id, { label });
    return { category: services.presentCategory(db.one('SELECT * FROM categories WHERE id = :id', { id: params.id })) };
  }));

  router.del('/api/admin/categories/:id', guarded(({ params, admin }) => {
    if (params.id === 'recommend') throw httpError(400, 'CATEGORY_PROTECTED', '“推荐”分类用于展示全部商品，不能删除');
    const result = db.run('DELETE FROM categories WHERE id = :id', { id: params.id });
    if (!result.changes) throw httpError(404, 'CATEGORY_NOT_FOUND', '分类不存在');
    services.audit(actor(admin), 'category.delete', params.id);
    return {};
  }));

  /* settings */
  router.get('/api/admin/settings', guarded(() => ({ settings: Object.fromEntries(Object.keys(SETTING_VALIDATORS).map((key) => [key, services.getSetting(key)])) })));

  router.put('/api/admin/settings/:key', guarded(async ({ req, params, admin }) => {
    const validate = SETTING_VALIDATORS[params.key];
    if (!validate) throw httpError(404, 'SETTING_NOT_FOUND', '设置项不存在');
    const body = await readJson(req);
    const before = services.getSetting(params.key);
    const value = services.setSetting(params.key, validate(body.value ?? body));
    services.audit(actor(admin), 'settings.update', params.key, { before, after: value });
    return { key: params.key, value };
  }));

  /* customers */
  router.get('/api/admin/customers', guarded(({ query }) => services.listCustomers(Object.fromEntries(['q', 'member', 'phone', 'from', 'to', 'page', 'pageSize'].map((k) => [k, query.get(k)])))));

  router.get('/api/admin/customers/:id', guarded(({ params }) => {
    const user = db.one('SELECT * FROM users WHERE id = :id', { id: params.id });
    if (!user) throw httpError(404, 'CUSTOMER_NOT_FOUND', '顾客不存在');
    return {
      customer: { ...services.presentUser(user), createdAt: user.created_at, deletedAt: user.deleted_at },
      orders: db.all('SELECT * FROM orders WHERE user_id = :id ORDER BY created_at DESC LIMIT 50', { id: user.id }).map((row) => services.presentOrder(row, { admin: true })),
      coupons: services.listCoupons(user.id),
      addresses: services.listAddresses(user.id),
      invitedBy: db.one('SELECT inviter_id FROM invitations WHERE invitee_id = :id', { id: user.id })?.inviter_id || null,
    };
  }));

  router.post('/api/admin/customers/:id/coupons', guarded(async ({ req, params, admin }) => {
    const user = services.getUser(params.id);
    if (!user) throw httpError(404, 'CUSTOMER_NOT_FOUND', '顾客不存在');
    const body = await readJson(req);
    const template = SETTING_VALIDATORS.rewards({ newUser: { ...body, count: body.count ?? 1 }, inviter: { title: 'x', amount: 1, threshold: 0, validDays: 1, count: 0 } }).newUser;
    if (template.count < 1) throw httpError(400, 'INVALID_FIELD', '发券张数至少 1 张');
    const coupons = db.tx(() => Array.from({ length: template.count }, () => services.presentCoupon(services.issueCoupon(user.id, template, 'merchant'))));
    services.audit(actor(admin), 'coupon.issue', user.id, template);
    return { status: 201, coupons };
  }));

  /* audit & backup */
  router.get('/api/admin/audit', guarded(({ query }) => {
    const size = Math.min(100, Number(query.get('pageSize')) || 50);
    const offset = (Math.max(1, Number(query.get('page')) || 1) - 1) * size;
    return { logs: db.all(`SELECT * FROM audit_log ORDER BY id DESC LIMIT ${size} OFFSET ${offset}`).map((l) => ({ id: l.id, actor: l.actor, action: l.action, target: l.target, detail: l.detail_json ? JSON.parse(l.detail_json) : null, at: l.created_at })) };
  }));

  router.post('/api/admin/backup', guarded(({ admin }) => {
    if (db.file === ':memory:') throw httpError(400, 'BACKUP_UNAVAILABLE', '内存数据库无法备份');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
    const file = path.join(path.dirname(path.resolve(db.file)), 'backups', `ruyi-${stamp}.db`);
    db.backupTo(file);
    services.audit(actor(admin), 'db.backup', path.basename(file));
    return { file: path.basename(file) };
  }));

}

/** Run the refund for a cancelled paid order; failures are kept for retry. */
export async function refundIfNeeded(row, payments, services) {
  if (row.refund_status !== 'pending' && row.refund_status !== 'failed') return row;
  try {
    return await payments.refund(row);
  } catch (error) {
    services.audit('system', 'order.refund_failed', row.id, { message: error.message });
    return services.setRefundStatus(row.id, 'failed');
  }
}
