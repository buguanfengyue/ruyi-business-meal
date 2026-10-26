import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// End-to-end checkout chain: login -> register -> address -> coupon quote ->
// order -> mock pay -> cancel, plus fail-closed checks for wechat mode.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function startServer(port, env) {
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: root,
    env: { ...process.env, DATABASE_PATH: ':memory:', RUYI_API_PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const base = `http://127.0.0.1:${port}`;
  async function request(pathname, { token, ...options } = {}) {
    const response = await fetch(`${base}${pathname}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    return { status: response.status, body: await response.json() };
  }
  async function ready() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        return await request('/api/health');
      } catch {
        await wait(50);
      }
    }
    throw new Error(output || `API 未在 ${port} 端口启动`);
  }
  return { child, request, ready };
}

const post = (body) => ({ method: 'POST', body: JSON.stringify(body) });

const mock = startServer(8790, { WECHAT_AUTH_MODE: 'mock' });
const wechat = startServer(8791, { WECHAT_AUTH_MODE: 'wechat', WECHAT_APPID: 'wx_test', WECHAT_APPSECRET: 'test-secret', WECHAT_API_BASE_URL: 'http://127.0.0.1:9' });

try {
  await mock.ready();
  const { request } = mock;

  const login = await request('/api/auth/login', post({ code: 'flow-test-code' }));
  assert.equal(login.status, 200);
  const token = login.body.session.token;
  assert.equal(login.body.user.availableCoupons, 2);

  const register = await request('/api/session/register', { token, ...post({ nickname: '链路测试' }) });
  assert.equal(register.status, 200);
  assert.equal(register.body.user.registered, true);
  const me = await request('/api/me', { token });
  assert.equal(me.body.user.nickname, '链路测试');

  const badAddress = await request('/api/addresses', { token, ...post({ name: '张三', phone: '123', detail: 'x' }) });
  assert.equal(badAddress.status, 400);
  const address = await request('/api/addresses', { token, ...post({ name: '张三', phone: '15805320100', detail: '测试路 1 号' }) });
  assert.equal(address.status, 201);
  const addresses = await request('/api/addresses', { token });
  assert.equal(addresses.body.total, 1);

  const coupons = await request('/api/coupons', { token });
  assert.equal(coupons.body.total, 2);
  const [couponA, couponB] = coupons.body.coupons;
  assert.equal(couponA.title, '10元邀新券');
  assert.equal(couponA.status, 'available');

  // List price 38*2 + 28 = 104; 白银 (phone bound) 98折 -> 101.92; coupon 满100减10.
  const items = [{ productId: 'a', quantity: 2 }, { productId: 'd', quantity: 1 }];
  const tooLow = await request('/api/cart/quote', { token, ...post({ items: [{ productId: 'd', quantity: 1 }], couponId: couponA.id }) });
  assert.equal(tooLow.status, 400);
  assert.equal(tooLow.body.error.code, 'COUPON_THRESHOLD');
  const quote = await request('/api/cart/quote', { token, ...post({ items, couponId: couponA.id }) });
  assert.equal(quote.status, 200);
  assert.equal(quote.body.subtotal, 104);
  assert.equal(quote.body.discount, 2.08);
  assert.equal(quote.body.memberName, '白银会员');
  assert.equal(quote.body.total, 91.92);

  const order = await request('/api/orders', {
    token,
    ...post({ items, couponId: couponA.id, addressId: address.body.address.id, schedule: '12:00', note: '少放餐具' }),
  });
  assert.equal(order.status, 201);
  const orderId = order.body.order.id;
  assert.equal(order.body.order.totals.total, 91.92);
  assert.equal(order.body.order.address.detail, '测试路 1 号');
  assert.equal(order.body.order.statusText, '待支付');
  assert.equal(order.body.order.userId, undefined);

  const reuse = await request('/api/cart/quote', { token, ...post({ items, couponId: couponA.id }) });
  assert.equal(reuse.body.error.code, 'COUPON_UNAVAILABLE');
  assert.equal((await request('/api/me', { token })).body.user.availableCoupons, 1);

  const paid = await request(`/api/orders/${orderId}/pay`, { token, method: 'POST' });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.order.status, 'paid');
  const payAgain = await request(`/api/orders/${orderId}/pay`, { token, method: 'POST' });
  assert.equal(payAgain.status, 409);

  const list = await request('/api/orders?status=paid', { token });
  assert.equal(list.body.total, 1);

  const membership = await request('/api/membership', { token });
  assert.equal(membership.body.member.level, 1);
  assert.equal(membership.body.member.points, 91);
  assert.equal(membership.body.member.next.name, '黄金会员');
  assert.equal(membership.body.levels[1].discountText, '9.5折');
  const points = await request('/api/points', { token });
  assert.equal(points.body.records.length, 1);

  const cancelled = await request(`/api/orders/${orderId}/cancel`, { token, method: 'POST' });
  assert.equal(cancelled.body.order.status, 'cancelled');
  const afterCancel = (await request('/api/me', { token })).body.user;
  assert.equal(afterCancel.availableCoupons, 2);
  assert.equal(afterCancel.points, 0);

  const missing = await request('/api/orders/RY-NOPE', { token });
  assert.equal(missing.status, 404);

  // Invite: a new mock user logging in with inviterId gets a coupon, and so does the inviter.
  const friend = await request('/api/auth/login', post({ code: 'mock:friend', inviterId: 'demo-user' }));
  assert.equal(friend.body.created, true);
  assert.equal(friend.body.user.availableCoupons, 1);
  assert.equal(friend.body.user.member.level, 0, '未绑定手机号不是会员');
  const friendToken = friend.body.session.token;
  const invite = await request('/api/invite', { token });
  assert.equal(invite.body.invited.length, 1);
  assert.equal((await request('/api/me', { token })).body.user.availableCoupons, 3);
  const again = await request('/api/auth/login', post({ code: 'mock:friend', inviterId: 'demo-user' }));
  assert.equal(again.body.created, false, '同一用户再次登录不重复发奖励');
  const partner = await request('/api/partner', { token });
  assert.equal(partner.body.invited.length, 1);
  assert.equal(partner.body.withdrawable, 0);
  assert.equal((await request('/api/partner/withdraw', { token, method: 'POST' })).status, 400);

  // Gift a coupon -> friend redeems it with the code.
  const gift = await request(`/api/coupons/${couponB.id}/gift`, { token, method: 'POST' });
  assert.equal(gift.status, 200);
  assert.equal(gift.body.coupon.status, 'gifted');
  const ownRedeem = await request('/api/coupons/redeem', { token, ...post({ code: gift.body.giftCode }) });
  assert.equal(ownRedeem.status, 400);
  const redeem = await request('/api/coupons/redeem', { token: friendToken, ...post({ code: gift.body.giftCode.toLowerCase() }) });
  assert.equal(redeem.status, 201);
  assert.equal(redeem.body.coupon.status, 'available');
  const redeemTwice = await request('/api/coupons/redeem', { token: friendToken, ...post({ code: gift.body.giftCode }) });
  assert.equal(redeemTwice.status, 409);
  const gifted = await request('/api/coupons?status=gifted', { token });
  assert.equal(gifted.body.total, 1);

  // Phone binding persists on the stored user across a fresh login.
  await request('/api/auth/phone', { token: friendToken, ...post({ code: 'phone-code' }) });
  const relogin = await request('/api/auth/login', post({ code: 'mock:friend' }));
  assert.equal(relogin.body.user.member.level, 1);

  // wechat mode must never fall back to the shared demo user.
  await wechat.ready();
  for (const pathname of ['/api/orders', '/api/coupons', '/api/addresses']) {
    const anonymous = await wechat.request(pathname);
    assert.equal(anonymous.status, 401, `${pathname} 未登录应返回 401`);
  }
  const anonymousOrder = await wechat.request('/api/orders', post({ items, customer: { phone: '15805320100' } }));
  assert.equal(anonymousOrder.status, 401);
  const unreachable = await wechat.request('/api/auth/login', post({ code: 'x' }));
  assert.equal(unreachable.status, 502);
  assert.equal(unreachable.body.error.code, 'WECHAT_API_UNREACHABLE');

  console.log('Checkout flow smoke test passed');
} finally {
  mock.child.kill('SIGTERM');
  wechat.child.kill('SIGTERM');
}
