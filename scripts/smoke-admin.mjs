// Merchant API, persistence across restarts, background jobs, account deletion.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../server/config.mjs';
import { createApp } from '../server/app.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ruyi-admin-test-'));
const env = { DATABASE_PATH: path.join(dir, 'ruyi.db'), WECHAT_AUTH_MODE: 'mock', SEED_DEMO: '0', ADMIN_USERNAME: 'boss', ADMIN_PASSWORD: 'correct-horse-1' };
const quiet = { log() {}, warn() {}, error: console.error };

async function start() {
  const app = createApp({ config: loadConfig(env), logger: quiet });
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.address().port}`;
  const request = async (pathname, { token, method = 'GET', body } = {}) => {
    const response = await fetch(`${base}${pathname}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* csv */ }
    return { status: response.status, body: json, text, headers: response.headers };
  };
  return { app, request };
}

let { app, request } = await start();
try {
  /* admin auth */
  assert.equal((await request('/api/admin/orders')).status, 401);
  assert.equal((await request('/api/admin/login', { method: 'POST', body: { username: 'boss', password: 'wrong-password' } })).status, 401);
  const login = await request('/api/admin/login', { method: 'POST', body: { username: 'boss', password: 'correct-horse-1' } });
  assert.equal(login.status, 200);
  const admin = login.body.token;

  /* a customer places and pays an order */
  const alice = (await request('/api/auth/login', { method: 'POST', body: { code: 'mock:alice' } })).body.session.token;
  await request('/api/auth/phone', { token: alice, method: 'POST', body: { code: 'p' } });
  await request('/api/session/register', { token: alice, method: 'POST', body: { nickname: 'Alice' } });
  const since = new Date().toISOString();
  const order1 = (await request('/api/orders', { token: alice, method: 'POST', body: { items: [{ productId: 'a', quantity: 1 }], note: '=cmd()' } })).body.order;
  assert.equal(order1.pickupNo, 1);
  assert.equal(order1.totals.total, 37.24);
  assert.equal((await request(`/api/orders/${order1.id}/pay`, { token: alice, method: 'POST' })).body.order.status, 'paid');

  /* merchant sees it via polling and processes it */
  const polled = await request(`/api/admin/orders?since=${encodeURIComponent(since)}`, { token: admin });
  assert.equal(polled.body.orders.length, 1);
  assert.equal(polled.body.orders[0].statusText, '待接单');
  assert.ok(polled.body.serverTime);
  const dash = await request('/api/admin/dashboard', { token: admin });
  assert.equal(dash.body.dashboard.waitingAccept, 1);
  assert.equal(dash.body.dashboard.revenue, 37.24);
  assert.equal(dash.body.dashboard.customers, 1);
  assert.equal(dash.body.dashboard.byFulfillment.delivery.orders, 1);
  const tabbed = await request('/api/admin/orders?tab=accept', { token: admin });
  assert.equal(tabbed.body.total, 1);
  assert.equal(tabbed.body.tabCounts.unpaid, 0);
  assert.equal(tabbed.body.summary.paid, 37.24);
  const byName = await request(`/api/admin/orders?q=${encodeURIComponent('38元A套餐')}`, { token: admin });
  assert.equal(byName.body.total, 1, '可按商品名搜索订单');
  assert.equal((await request(`/api/admin/orders/${order1.id}/accept`, { token: admin, method: 'POST' })).body.order.status, 'preparing');
  const lateCancel = await request(`/api/orders/${order1.id}/cancel`, { token: alice, method: 'POST' });
  assert.equal(lateCancel.status, 409, '商家接单后顾客不能自行取消');
  assert.equal((await request(`/api/admin/orders/${order1.id}/complete`, { token: admin, method: 'POST' })).body.order.status, 'completed');
  assert.equal((await request(`/api/admin/orders/${order1.id}/accept`, { token: admin, method: 'POST' })).status, 409);
  const detail = await request(`/api/admin/orders/${order1.id}`, { token: admin });
  assert.equal(detail.body.paymentEvents[0].kind, 'mock_paid');

  /* merchant cancels a paid order -> refund */
  const order2 = (await request('/api/orders', { token: alice, method: 'POST', body: { items: [{ productId: 'd', quantity: 1 }] } })).body.order;
  assert.equal(order2.pickupNo, 2);
  await request(`/api/orders/${order2.id}/pay`, { token: alice, method: 'POST' });
  const cancelled = await request(`/api/admin/orders/${order2.id}/cancel`, { token: admin, method: 'POST', body: { reason: '食材售罄' } });
  assert.equal(cancelled.body.order.status, 'cancelled');
  assert.equal(cancelled.body.order.refundStatus, 'success');
  assert.equal(cancelled.body.order.cancelReason, '食材售罄');

  /* reports */
  const sales = await request('/api/admin/reports/sales', { token: admin });
  assert.equal(sales.body.report.rows.find((r) => r.productId === 'd').refundQuantity, 1);
  assert.equal(sales.body.report.rows.find((r) => r.productId === 'a').actual, 37.24);
  const daily = await request('/api/admin/reports/daily', { token: admin });
  assert.equal(daily.body.report.days[0].orders, 1);
  assert.equal(daily.body.report.days[0].refunds, 1);
  const couponSummary = await request('/api/admin/coupons/summary', { token: admin });
  assert.ok(Array.isArray(couponSummary.body.coupons));
  assert.equal(couponSummary.body.rewards.newUser.title, '10元邀新券');

  /* catalog management */
  const created = await request('/api/admin/products', { token: admin, method: 'POST', body: { name: '红烧肉套餐', price: 29.4, oldPrice: 30, categoryId: 'a', emoji: '🥩' } });
  assert.equal(created.status, 201);
  const pid = created.body.product.id;
  assert.ok((await request('/api/products')).body.products.some((p) => p.id === pid));
  await request(`/api/admin/products/${pid}`, { token: admin, method: 'PUT', body: { available: false } });
  assert.ok(!(await request('/api/products')).body.products.some((p) => p.id === pid), '下架商品不再对顾客展示');
  assert.equal((await request('/api/cart/quote', { token: alice, method: 'POST', body: { items: [{ productId: pid, quantity: 1 }] } })).status, 409);
  assert.equal((await request('/api/admin/products', { token: admin, method: 'POST', body: { name: '', price: 1 } })).status, 400);
  assert.equal((await request(`/api/admin/products/${pid}`, { token: admin, method: 'DELETE' })).status, 200);
  assert.equal((await request('/api/admin/categories/recommend', { token: admin, method: 'DELETE' })).status, 400);
  const cat = await request('/api/admin/categories', { token: admin, method: 'POST', body: { id: 'drinks', label: '饮品', emoji: '🥤' } });
  assert.equal(cat.status, 201);

  /* settings: pause the store */
  const settings = (await request('/api/admin/settings', { token: admin })).body.settings;
  await request('/api/admin/settings/store', { token: admin, method: 'PUT', body: { ...settings.store, accepting: false, notice: '今日休息' } });
  const closed = await request('/api/orders', { token: alice, method: 'POST', body: { items: [{ productId: 'a', quantity: 1 }] } });
  assert.equal(closed.status, 409);
  assert.equal(closed.body.error.message, '今日休息');
  await request('/api/admin/settings/store', { token: admin, method: 'PUT', body: settings.store });
  assert.equal((await request('/api/admin/settings/partner', { token: admin, method: 'PUT', body: { commissionRate: 2 } })).status, 400);
  await request('/api/admin/settings/partner', { token: admin, method: 'PUT', body: { ...settings.partner, commissionRate: 0.1 } });

  /* customers & coupons */
  const members = await request('/api/admin/customers?member=yes', { token: admin });
  assert.equal(members.body.total, 1);
  assert.equal(members.body.stats.members, 1);
  const customers = await request('/api/admin/customers?q=Alice', { token: admin });
  assert.equal(customers.body.total, 1);
  const aliceId = customers.body.customers[0].id;
  assert.equal(customers.body.customers[0].orderCount, 1);
  const issued = await request(`/api/admin/customers/${aliceId}/coupons`, { token: admin, method: 'POST', body: { title: '老客回馈券', amount: 5, threshold: 30, validDays: 7, count: 2 } });
  assert.equal(issued.status, 201);
  assert.equal((await request('/api/coupons?status=available', { token: alice })).body.total, 2);

  /* CSV export with formula-injection protection */
  const csv = await request('/api/admin/orders/export.csv', { token: admin });
  assert.equal(csv.status, 200);
  assert.ok(csv.text.startsWith('"订单号"')); // fetch strips the UTF-8 BOM (kept for Excel)
  assert.ok(csv.text.includes(order1.id));
  assert.ok(csv.text.includes(`"'=cmd()"`), 'CSV 公式注入应被转义');

  /* auto-cancel of unpaid orders */
  const stale = (await request('/api/orders', { token: alice, method: 'POST', body: { items: [{ productId: 'a', quantity: 1 }] } })).body.order;
  app.db.run('UPDATE orders SET created_at = :old WHERE id = :id', { old: new Date(Date.now() - 16 * 60000).toISOString(), id: stale.id });
  await app.runJobs();
  assert.equal((await request(`/api/orders/${stale.id}`, { token: alice })).body.order.status, 'cancelled');

  const audit = await request('/api/admin/audit', { token: admin });
  const actions = audit.body.logs.map((l) => l.action);
  for (const action of ['order.accept', 'order.complete', 'order.cancel', 'product.create', 'settings.update', 'coupon.issue', 'order.auto_cancel']) {
    assert.ok(actions.includes(action), `审计日志缺少 ${action}`);
  }
  const backup = await request('/api/admin/backup', { token: admin, method: 'POST' });
  assert.ok(fs.existsSync(path.join(dir, 'backups', backup.body.file)));

  /* restart: everything persists, including sessions */
  await app.shutdown();
  ({ app, request } = await start());
  assert.equal((await request('/api/orders', { token: alice })).body.total, 3, '重启后订单仍在');
  assert.equal((await request('/api/admin/me', { token: admin })).status, 200, '重启后管理员会话仍有效');
  assert.equal((await request('/api/me', { token: alice })).body.user.nickname, 'Alice');
  assert.ok((await request('/api/products')).body.products.every((p) => p.id !== pid));
  assert.equal((await request('/api/admin/settings', { token: admin })).body.settings.partner.commissionRate, 0.1);

  /* account deletion */
  const active = (await request('/api/orders', { token: alice, method: 'POST', body: { items: [{ productId: 'a', quantity: 1 }] } })).body.order;
  assert.equal((await request('/api/me', { token: alice, method: 'DELETE' })).status, 409);
  await request(`/api/orders/${active.id}/cancel`, { token: alice, method: 'POST' });
  assert.equal((await request('/api/me', { token: alice, method: 'DELETE' })).status, 200);
  assert.equal((await request('/api/orders', { token: alice })).status, 401, '注销后会话失效');
  const anonymised = await request(`/api/admin/customers/${aliceId}`, { token: admin });
  assert.equal(anonymised.body.customer.phone, '');
  assert.equal(anonymised.body.orders[0].customer.nickname, '已注销用户');

  /* brute force protection */
  let limited = false;
  for (let i = 0; i < 35 && !limited; i += 1) {
    limited = (await request('/api/admin/login', { method: 'POST', body: { username: 'boss', password: 'nope-nope-nope' } })).status === 429;
  }
  assert.ok(limited, '连续错误登录应被限流');

  console.log('Admin & persistence smoke test passed');
} finally {
  await app.shutdown();
  fs.rmSync(dir, { recursive: true, force: true });
}
