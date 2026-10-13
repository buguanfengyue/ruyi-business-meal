import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL, URL } from 'node:url';
import { createState } from './data.mjs';
import { createWechatAuth } from './wechat-auth.mjs';

const DEFAULT_PORT = 8787;
const MAX_BODY_BYTES = 1024 * 1024;

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function publicProduct(product) {
  return {
    id: product.id,
    categoryId: product.categoryId,
    name: product.name,
    price: product.price,
    oldPrice: product.oldPrice,
    description: product.description,
    // Keep `desc` as a small compatibility alias for the existing prototype.
    desc: product.description,
    emoji: product.emoji,
    available: product.available,
  };
}

function publicUser(user) {
  return Object.fromEntries(Object.entries(user).filter(([key]) => !key.startsWith('_')));
}

function publicOrder(order) {
  return {
    ...order,
    items: order.items.map((item) => ({ ...item })),
    customer: { ...order.customer },
    totals: { ...order.totals },
  };
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function error(res, status, code, message, details) {
  json(res, status, { ok: false, error: { code, message, ...(details ? { details } : {}) } });
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const e = new Error('请求体过大');
      e.status = 413;
      e.code = 'PAYLOAD_TOO_LARGE';
      throw e;
    }
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const e = new Error('请求体必须是合法 JSON');
    e.status = 400;
    e.code = 'INVALID_JSON';
    throw e;
  }
}

function calculateQuote(state, rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    const e = new Error('购物车不能为空');
    e.status = 400;
    e.code = 'EMPTY_CART';
    throw e;
  }

  const byId = new Map(state.products.map((product) => [product.id, product]));
  const seen = new Set();
  const items = rawItems.map((raw) => {
    const id = String(raw?.productId ?? raw?.id ?? '');
    const quantity = Number(raw?.quantity ?? raw?.count);
    const product = byId.get(id);
    if (!product) {
      const e = new Error(`商品不存在：${id || '未提供商品 ID'}`);
      e.status = 400;
      e.code = 'PRODUCT_NOT_FOUND';
      throw e;
    }
    if (!product.available) {
      const e = new Error(`商品暂不可售：${product.name}`);
      e.status = 409;
      e.code = 'PRODUCT_UNAVAILABLE';
      throw e;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      const e = new Error(`商品数量必须是 1-99 的整数：${product.name}`);
      e.status = 400;
      e.code = 'INVALID_QUANTITY';
      throw e;
    }
    if (seen.has(id)) {
      const e = new Error(`商品不能重复传入：${id}`);
      e.status = 400;
      e.code = 'DUPLICATE_PRODUCT';
      throw e;
    }
    seen.add(id);
    const lineTotal = roundMoney(product.price * quantity);
    return {
      productId: product.id,
      name: product.name,
      unitPrice: product.price,
      quantity,
      lineTotal,
    };
  });

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  // A deterministic demo discount keeps local checkout behaviour realistic;
  // replace with a real member/coupon rule in production.
  const discount = subtotal > 0 ? 0.76 : 0;
  const total = roundMoney(Math.max(0, subtotal - discount));
  return { items, subtotal, discount, total };
}

function parseItemsFromCart(cart) {
  if (!cart || typeof cart !== 'object' || Array.isArray(cart)) return [];
  return Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity }));
}

export function createApp({ state = createState(), logger = console, wechatAuth = createWechatAuth({ state, logger }) } = {}) {
  return http.createServer(async (req, res) => {
    // Browser and mini-program WebView preflight.
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'Content-Type, Authorization',
      });
      res.end();
      return;
    }

    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = requestUrl.pathname.replace(/\/$/, '') || '/';

    try {
      if (req.method === 'GET' && pathname === '/api/health') {
        json(res, 200, {
          ok: true,
          service: 'ruyi-local-api',
          version: '0.1.0',
          auth: wechatAuth.publicConfig(),
          now: new Date().toISOString(),
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/auth/config') {
        json(res, 200, { ok: true, auth: wechatAuth.publicConfig() });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/auth/login') {
        const body = await readJson(req);
        const session = await wechatAuth.login(body.code);
        json(res, 200, { ok: true, session: { token: session.token, expiresAt: session.expiresAt }, user: publicUser(session.user) });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/auth/phone') {
        const body = await readJson(req);
        const session = await wechatAuth.bindPhone(wechatAuth.sessionFromRequest(req)?.token, body.code);
        Object.assign(state.user, session.user);
        json(res, 200, { ok: true, session: { token: session.token }, user: publicUser(session.user) });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/bootstrap') {
        const session = wechatAuth.sessionFromRequest(req);
        json(res, 200, {
          ok: true,
          store: { ...state.store, categories: state.categories.map((category) => ({ ...category })) },
          categories: state.categories.map((category) => ({ ...category })),
          products: state.products.map(publicProduct),
          user: publicUser(session?.user || state.user),
          cart: {},
          orders: state.orders.map(publicOrder),
          config: {
            currency: 'CNY',
            checkoutRequiresRegistration: true,
            mockPayment: true,
            auth: wechatAuth.publicConfig(),
          },
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/products') {
        const category = requestUrl.searchParams.get('category');
        const query = (requestUrl.searchParams.get('q') || '').trim().toLowerCase();
        const products = state.products.filter((product) => {
          const categoryMatches = !category || category === 'recommend' || product.categoryId === category;
          const queryMatches = !query || `${product.name} ${product.description}`.toLowerCase().includes(query);
          return categoryMatches && queryMatches;
        });
        json(res, 200, { ok: true, products: products.map(publicProduct), total: products.length });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/me') {
        const session = wechatAuth.sessionFromRequest(req);
        json(res, 200, { ok: true, user: publicUser(session?.user || state.user), authenticated: Boolean(session) });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/orders') {
        const status = requestUrl.searchParams.get('status');
        const orders = state.orders.filter((order) => !status || order.status === status).map(publicOrder);
        json(res, 200, { ok: true, orders, total: orders.length });
        return;
      }

      const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
      if (req.method === 'GET' && orderMatch) {
        const order = state.orders.find((candidate) => candidate.id === decodeURIComponent(orderMatch[1]));
        if (!order) {
          error(res, 404, 'ORDER_NOT_FOUND', '订单不存在');
          return;
        }
        json(res, 200, { ok: true, order: publicOrder(order) });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/cart/quote') {
        const body = await readJson(req);
        const rawItems = Array.isArray(body.items) ? body.items : parseItemsFromCart(body.cart);
        const quote = calculateQuote(state, rawItems);
        json(res, 200, { ok: true, ...quote });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/session/register') {
        const body = await readJson(req);
        const nickname = String(body.nickname || '').trim();
        if (!nickname || nickname.length > 30) {
          error(res, 400, 'INVALID_NICKNAME', '昵称不能为空且不超过 30 个字符');
          return;
        }
        state.user.nickname = nickname;
        state.user.registered = true;
        json(res, 200, { ok: true, user: publicUser(state.user) });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/orders') {
        const body = await readJson(req);
        const rawItems = Array.isArray(body.items) ? body.items : parseItemsFromCart(body.cart);
        const quote = calculateQuote(state, rawItems);
        const session = wechatAuth.sessionFromRequest(req);
        if (wechatAuth.mode === 'wechat' && !session) {
          error(res, 401, 'AUTH_REQUIRED', '正式环境创建订单前必须完成微信登录');
          return;
        }
        const customerBody = body.customer && typeof body.customer === 'object' ? body.customer : {};
        const sessionUser = session?.user || state.user;
        const phone = String(customerBody.phone || sessionUser.phone || '').trim();
        const nickname = String(customerBody.nickname || sessionUser.nickname || '').trim();
        if (!/^1\d{10}$/.test(phone)) {
          error(res, 400, 'INVALID_PHONE', '请提供有效的 11 位手机号');
          return;
        }
        const order = {
          id: `RY${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 6).toUpperCase()}`,
          status: 'pending_payment',
          fulfillment: body.fulfillment === 'pickup' ? 'pickup' : 'delivery',
          note: String(body.note || '').trim().slice(0, 200),
          createdAt: new Date().toISOString(),
          customer: { phone, nickname },
          items: quote.items,
          totals: {
            subtotal: quote.subtotal,
            discount: quote.discount,
            total: quote.total,
          },
        };
        state.orders.unshift(order);
        json(res, 201, { ok: true, order: publicOrder(order) });
        return;
      }

      error(res, 404, 'NOT_FOUND', `接口不存在：${req.method} ${pathname}`);
    } catch (cause) {
      const status = Number(cause?.status) || 500;
      const code = cause?.code || 'INTERNAL_ERROR';
      if (status >= 500) logger.error?.('[ruyi-local-api]', cause);
      error(res, status, code, cause?.message || '服务器内部错误');
    }
  });
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const port = Number(process.env.RUYI_API_PORT || process.env.PORT || DEFAULT_PORT);
  const app = createApp();
  app.listen(port, '127.0.0.1', () => {
    console.log(`[ruyi-local-api] listening on http://127.0.0.1:${port}`);
  });
}

