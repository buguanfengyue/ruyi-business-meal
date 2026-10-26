// Runs the native mini-program page logic against a live API by stubbing the
// `wx` / `App` / `Page` / `getApp` runtime in Node. It cannot check WXML
// rendering, but it exercises every page's JS and the full customer flow.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../server/config.mjs';
import { createApp } from '../server/app.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'miniprogram');
// The repo is "type": "module", so load the mini-program's CommonJS files
// with a tiny module loader instead of Node's resolver.
const cache = new Map();
function loadCjs(file) {
  const full = file.endsWith('.js') ? file : `${file}.js`;
  if (cache.has(full)) return cache.get(full).exports;
  const module = { exports: {} };
  cache.set(full, module);
  const fn = vm.runInThisContext(`(function (require, module, exports) {\n${fs.readFileSync(full, 'utf8')}\n})`, { filename: full });
  fn((rel) => loadCjs(path.resolve(path.dirname(full), rel)), module, module.exports);
  return module.exports;
}

const server = createApp({ config: loadConfig({ DATABASE_PATH: ':memory:', WECHAT_AUTH_MODE: 'mock' }), logger: { log() {}, warn() {}, error: console.error } });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const apiBase = `http://127.0.0.1:${server.address().port}`;

/* ---------- wx runtime stub ---------- */
const storage = {};
const log = [];
let loginCode = 'harness-code';
let tapIndex = 0;
globalThis.wx = {
  getStorageSync: (k) => storage[k] ?? '',
  setStorageSync: (k, v) => { storage[k] = JSON.parse(JSON.stringify(v)); },
  login: ({ success }) => success({ code: loginCode }),
  request: ({ url, method, data, header, success, fail }) => {
    fetch(url, { method, headers: header, body: method && method !== 'GET' && data ? JSON.stringify(data) : undefined })
      .then(async (r) => success({ statusCode: r.status, data: await r.json() }))
      .catch((e) => fail({ errMsg: e.message }));
  },
  navigateTo: ({ url }) => log.push(['navigateTo', url]),
  redirectTo: ({ url }) => log.push(['redirectTo', url]),
  switchTab: ({ url }) => log.push(['switchTab', url]),
  navigateBack: () => log.push(['navigateBack']),
  showToast: ({ title }) => log.push(['toast', title]),
  showModal: ({ success }) => success({ confirm: true }),
  showActionSheet: ({ success }) => success({ tapIndex }),
  setClipboardData: ({ data }) => log.push(['clipboard', data]),
  setNavigationBarTitle: () => {},
  stopPullDownRefresh: () => {},
  makePhoneCall: ({ phoneNumber }) => log.push(['call', phoneNumber]),
  requestPayment: () => { throw new Error('mock mode must not call wx.requestPayment'); },
};
let app;
const pages = {};
let current;
globalThis.App = (def) => { app = def; };
globalThis.getApp = () => app;
globalThis.Page = (def) => { pages[current] = def; };
function page(name) {
  const inst = Object.create(pages[name]);
  inst.data = JSON.parse(JSON.stringify(pages[name].data));
  inst.setData = function setData(patch) {
    for (const [k, v] of Object.entries(patch)) {
      const parts = k.split('.');
      let o = this.data;
      while (parts.length > 1) o = o[parts.shift()];
      o[parts[0]] = v;
    }
  };
  return inst;
}

loadCjs(path.join(root, 'app.js'));
app.onLaunch({ query: {} });
app.globalData.apiBase = apiBase;
for (const p of ['home', 'menu', 'checkout', 'orders', 'order-detail', 'me', 'coupons', 'addresses', 'info', 'auth', 'member', 'partner', 'invite', 'points', 'bookings']) {
  current = p;
  loadCjs(path.join(root, 'pages', p, `${p}.js`));
}
const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const ev = (dataset = {}, value) => ({ currentTarget: { dataset }, detail: { value } });

try {
  const home = page('home');
  await home.load();
  assert.equal(home.data.error, '', home.data.error);
  assert.ok(app.globalData.token.startsWith('ruyi_'));

  const menu = page('menu');
  await menu.onLoad();
  assert.equal(menu.data.list.length, 4);
  menu.pickCat(ev({ id: 'soup' })); assert.equal(menu.data.list.length, 1);
  menu.onSearch(ev({}, '58元')); assert.equal(menu.data.list.length, 1);
  menu.onSearch(ev({}, ''));
  menu.add(ev({ id: 'a' })); menu.add(ev({ id: 'a' })); menu.add(ev({ id: 'd' }));
  assert.equal(menu.data.count, 3);
  menu.goCheckout(); assert.equal(menu.data.showRegister, true, '未注册用户应弹出注册');
  menu.onNickname(ev({}, '小程序用户'));
  await menu.register();
  assert.deepEqual(log.at(-1), ['navigateTo', '/pages/checkout/checkout']);
  menu.callStore(); assert.deepEqual(log.at(-1), ['call', '15805320100']);

  const addresses = page('addresses');
  await addresses.load();
  addresses.startAdd();
  addresses.onInput(ev({ field: 'name' }, '李四'));
  addresses.onInput(ev({ field: 'phone' }, '13900000000'));
  addresses.onInput(ev({ field: 'detail' }, '模拟路 8 号'));
  await addresses.save(); await wait();
  assert.equal(addresses.data.addresses.length, 1);

  const checkout = page('checkout');
  checkout.onLoad(); checkout.onShow(); await wait(300);
  assert.equal(checkout.data.quote.totalText, '101.92');
  assert.ok(checkout.data.addressId, '自动选中地址');
  assert.equal(checkout.data.couponText, '2张可用');
  tapIndex = 1; checkout.chooseCoupon(); tapIndex = 0; await wait(200);
  assert.equal(checkout.data.quote.totalText, '91.92');
  checkout.onSchedule({ detail: { value: '2' } });
  await checkout.submit();
  const redirect = log.at(-1);
  assert.equal(redirect[0], 'redirectTo');
  assert.deepEqual(app.globalData.cart, {});
  const orderId = redirect[1].split('id=')[1];

  const detail = page('order-detail');
  detail.onLoad({ id: orderId }); await wait();
  assert.equal(detail.data.order.canPay, true);
  await detail.pay();
  assert.equal(detail.data.order.status, 'paid');
  detail.callStore(); assert.deepEqual(log.at(-1), ['call', '15805320100']);

  const me = page('me');
  await me.load();
  assert.equal(me.data.user.nickname, '小程序用户');
  assert.equal(me.data.memberName, '白银会员');

  const member = page('member');
  await member.load();
  assert.equal(member.data.view.name, '白银会员');
  member.onSwipe({ detail: { current: 1 } });
  assert.equal(member.data.view.discountText, '9.5折');

  const points = page('points');
  await points.onShow();
  assert.equal(points.data.data.points, 91);

  const coupons = page('coupons');
  coupons.onLoad({}); await coupons.onShow();
  assert.equal(coupons.data.list.length, 1);
  coupons.gift(); await wait(300);
  const giftCode = coupons.data.giftCode;
  assert.ok(giftCode);
  assert.equal(coupons.onShareAppMessage({}).path, `/pages/coupons/coupons?claim=${giftCode}`);

  const invite = page('invite');
  await invite.onShow();
  assert.equal(invite.onShareAppMessage().path, '/pages/home/home?inviter=demo-user');

  // A friend opens the share card (hot start with ?inviter) and claims the gift.
  app.globalData.token = '';
  app.onShow({ query: { inviter: 'demo-user' } });
  loginCode = 'mock:buddy';
  const friendHome = page('home');
  await friendHome.load();
  assert.equal(friendHome.data.user.availableCoupons, 1, '新用户获得邀新券');
  const claim = page('coupons');
  claim.onLoad({ claim: giftCode }); await claim.onShow(); await wait(200);
  assert.equal(claim.data.all.filter((c) => c.status === 'available').length, 2, '通过分享链接领取转赠券');

  // Back to the first user; an expired token re-logins transparently.
  loginCode = 'harness-code';
  app.globalData.token = 'ruyi_expired';
  const partner = page('partner');
  await partner.onShow();
  assert.equal(partner.data.data.invited.length, 1);
  const bookings = page('bookings');
  await bookings.onShow();
  assert.equal(bookings.data.orders.length, 1);

  console.log('Mini-program page logic smoke test passed');
} finally {
  await server.shutdown();
}
