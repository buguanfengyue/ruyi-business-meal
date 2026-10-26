import { httpError, readBody, readJson, str } from './http.mjs';
import { refundIfNeeded } from './admin.mjs';
import { yuan } from './services.mjs';

/** Customer-facing API used by the mini-program and the web replica. */
export function registerPublicRoutes(router, { db, config, services, auth, payments, limiter, ip }) {
  /**
   * Resolve the caller. A valid bearer session always wins. Without one, mock
   * mode falls back to the demo user so curl/smoke tests keep working; wechat
   * mode fails closed for anything user-scoped.
   */
  function currentUser(req, { required = false } = {}) {
    const session = auth.sessionFromRequest(req);
    if (session) return session.user;
    if (auth.mode === 'mock') {
      const demo = services.getUser('demo-user');
      if (demo) return demo;
    }
    if (required) throw httpError(401, 'AUTH_REQUIRED', '请先完成微信登录');
    return null;
  }

  const store = () => services.getSetting('store');

  router.get('/api/health', () => {
    db.one('SELECT 1 AS ok');
    return { service: 'ruyi-api', version: '1.0.0', auth: auth.publicConfig(), payment: payments.mode, now: new Date().toISOString() };
  });

  router.get('/api/auth/config', () => ({ auth: auth.publicConfig() }));

  router.post('/api/auth/login', async ({ req }) => {
    limiter.check(`login:${ip(req)}`);
    const body = await readJson(req);
    const session = await auth.login(body.code);
    if (session.created && body.inviterId) services.recordInvitation(session.user, body.inviterId);
    const user = services.getUser(session.user.id);
    return { session: { token: session.token, expiresAt: session.expiresAt }, user: services.presentUser(user), created: session.created };
  });

  router.post('/api/auth/logout', ({ req }) => {
    auth.logout(auth.bearerToken(req));
    return {};
  });

  router.post('/api/auth/phone', async ({ req }) => {
    const body = await readJson(req);
    const session = await auth.bindPhone(auth.bearerToken(req), body.code);
    return { session: { token: session.token }, user: services.presentUser(session.user) };
  });

  router.get('/api/bootstrap', ({ req }) => {
    const session = auth.sessionFromRequest(req);
    const user = session?.user || currentUser(req);
    const categories = services.listCategories();
    return {
      store: { ...store(), categories },
      categories,
      products: services.listProducts(),
      user: user ? services.presentUser(user) : null,
      authenticated: Boolean(session),
      cart: {},
      orders: user ? services.listUserOrders(user.id) : [],
      config: { currency: 'CNY', checkoutRequiresRegistration: true, mockPayment: payments.mode === 'mock', payment: payments.mode, auth: auth.publicConfig() },
    };
  });

  router.get('/api/products', ({ query }) => {
    const products = services.listProducts({ category: query.get('category'), q: query.get('q') });
    return { products, total: products.length };
  });

  router.get('/api/me', ({ req }) => {
    const session = auth.sessionFromRequest(req);
    const user = session?.user || currentUser(req);
    return { user: user ? services.presentUser(user) : null, authenticated: Boolean(session) };
  });

  // Account deletion (注销账号), required by mini-program review guidelines.
  router.del('/api/me', ({ req }) => {
    const session = auth.sessionFromRequest(req);
    if (!session) throw httpError(401, 'AUTH_REQUIRED', '请先完成微信登录');
    const active = db.one("SELECT COUNT(*) AS n FROM orders WHERE user_id = :id AND status IN ('pending_payment','paid','preparing')", { id: session.user.id }).n;
    if (active) throw httpError(409, 'ACTIVE_ORDERS', '还有未完成的订单，完成或取消后再注销');
    services.deleteUser(session.user.id);
    services.audit(`user:${session.user.id}`, 'user.delete', session.user.id);
    return {};
  });

  router.post('/api/session/register', async ({ req }) => {
    const user = currentUser(req, { required: true });
    const body = await readJson(req);
    const nickname = str(body.nickname, 40);
    if (!nickname || nickname.length > 30) throw httpError(400, 'INVALID_NICKNAME', '昵称不能为空且不超过 30 个字符');
    return { user: services.presentUser(services.updateUser(user.id, { nickname, registered: 1 })) };
  });

  /* coupons */
  router.get('/api/coupons', ({ req, query }) => {
    const coupons = services.listCoupons(currentUser(req, { required: true }).id, query.get('status'));
    return { coupons, total: coupons.length };
  });
  router.post('/api/coupons/redeem', async ({ req }) => {
    const user = currentUser(req, { required: true });
    limiter.check(`redeem:${user.id}`);
    const body = await readJson(req);
    return { status: 201, coupon: services.redeemCoupon(user.id, body.code) };
  });
  router.post('/api/coupons/:id/gift', ({ req, params }) => services.giftCoupon(currentUser(req, { required: true }).id, params.id));

  /* membership, points, invite, partner */
  router.get('/api/membership', ({ req }) => {
    const user = currentUser(req, { required: true });
    const levels = services.getSetting('memberLevels').map((level) => ({ ...level, discountText: `${Math.round(level.rate * 1000) / 100}折` }));
    return { member: services.memberInfo(user), phoneBound: Boolean(user.phone), levels, pointsRule: services.getSetting('pointsRule') };
  });
  router.get('/api/points', ({ req }) => {
    const user = currentUser(req, { required: true });
    return { points: services.memberInfo(user).points, rule: services.getSetting('pointsRule'), records: services.pointsRecords(user.id) };
  });
  router.get('/api/invite', ({ req }) => {
    const user = currentUser(req, { required: true });
    const summary = services.partnerSummary(user.id);
    const rewards = services.getSetting('rewards');
    return { inviterId: user.id, newUserReward: rewards.newUser, inviterReward: rewards.inviter, invited: summary.invited, invalid: summary.invalid };
  });
  router.get('/api/partner', ({ req }) => {
    const user = currentUser(req, { required: true });
    return { inviterId: user.id, rules: services.getSetting('partner').rules, ...services.partnerSummary(user.id) };
  });
  router.post('/api/partner/withdraw', ({ req }) => {
    const user = currentUser(req, { required: true });
    if (services.partnerSummary(user.id).withdrawable <= 0) throw httpError(400, 'NOTHING_TO_WITHDRAW', '暂无可提现佣金');
    // Real payout needs WeChat Pay "商家转账到零钱"; never fake it.
    throw httpError(501, 'WITHDRAW_NOT_CONFIGURED', '提现需开通微信支付商家转账到零钱');
  });

  /* addresses */
  router.get('/api/addresses', ({ req }) => {
    const addresses = services.listAddresses(currentUser(req, { required: true }).id);
    return { addresses, total: addresses.length };
  });
  router.post('/api/addresses', async ({ req }) => ({ status: 201, address: services.createAddress(currentUser(req, { required: true }).id, await readJson(req)) }));
  router.del('/api/addresses/:id', ({ req, params }) => {
    services.deleteAddress(currentUser(req, { required: true }).id, params.id);
    return {};
  });

  /* cart & orders */
  router.post('/api/cart/quote', async ({ req }) => {
    const user = currentUser(req);
    const body = await readJson(req);
    const items = Array.isArray(body.items) ? body.items : Object.entries(body.cart || {}).map(([productId, quantity]) => ({ productId, quantity }));
    return services.presentQuote(services.calculateQuote(user, items, body.couponId));
  });

  router.get('/api/orders', ({ req, query }) => {
    const orders = services.listUserOrders(currentUser(req, { required: true }).id, query.get('status'));
    return { orders, total: orders.length };
  });

  router.post('/api/orders', async ({ req }) => {
    const user = currentUser(req, { required: true });
    limiter.check(`order:${user.id}`);
    const row = services.createOrder(user, await readJson(req));
    return { status: 201, order: services.presentOrder(row) };
  });

  router.get('/api/orders/:id', async ({ req, params, query }) => {
    const user = currentUser(req, { required: true });
    let row = services.getOwnOrderRow(user.id, params.id);
    // After wx.requestPayment succeeds the client polls with ?sync=1 in case
    // the WeChat Pay notification has not arrived yet.
    if (query.get('sync') === '1') row = await payments.syncOrder(row);
    return { order: services.presentOrder(row) };
  });

  router.post('/api/orders/:id/pay', async ({ req, params }) => {
    const user = currentUser(req, { required: true });
    const row = services.getOwnOrderRow(user.id, params.id);
    if (row.status !== 'pending_payment') throw httpError(409, 'ORDER_NOT_PAYABLE', `订单当前状态不可支付：${services.presentOrder(row).statusText}`);
    const result = await payments.startPayment(row, user);
    return { order: services.presentOrder(result.row), payment: result.payment, amount: yuan(row.total_fen) };
  });

  router.post('/api/orders/:id/cancel', async ({ req, params }) => {
    const user = currentUser(req, { required: true });
    services.getOwnOrderRow(user.id, params.id);
    let row = services.cancelOrder(params.id, { by: 'customer' });
    if (!row.paid_at) await payments.closeOrder(row).catch(() => {});
    row = await refundIfNeeded(row, payments, services);
    return { order: services.presentOrder(row) };
  });

  /* WeChat Pay notifications (payment + refund). Raw body needed for the signature. */
  router.post('/api/pay/notify', async ({ req, res }) => {
    const raw = await readBody(req);
    const result = await payments.handleNotify(req, raw);
    if (result.body) {
      const body = JSON.stringify(result.body);
      res.writeHead(result.status, { 'content-type': 'application/json' });
      res.end(body);
    } else {
      res.writeHead(result.status);
      res.end();
    }
  });
}
