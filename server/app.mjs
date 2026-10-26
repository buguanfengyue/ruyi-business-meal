import http from 'node:http';
import { URL } from 'node:url';
import { openDatabase } from './db.mjs';
import { seedDatabase } from './data.mjs';
import { createServices } from './services.mjs';
import { createWechatAuth } from './wechat-auth.mjs';
import { createPayments } from './wechat-pay.mjs';
import { registerPublicRoutes } from './routes-public.mjs';
import { registerAdminRoutes, createAdmin, refundIfNeeded } from './admin.mjs';
import { clientIp, createRateLimiter, createRouter, json, sendError } from './http.mjs';

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
};

/**
 * Build the HTTP server. Returns a node http.Server with extra members:
 * `db`, `services`, `runJobs()` (also run on an interval) and `shutdown()`.
 */
export function createApp({ config, db = openDatabase(config.databasePath), logger = console } = {}) {
  const services = createServices({ db, config });
  seedDatabase(db, { demo: config.seedDemo, issueCoupon: services.issueCoupon });
  const auth = createWechatAuth({ config, db, services, logger });
  const payments = createPayments({ config, services, logger });
  const limiter = createRateLimiter({ limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 30), windowMs: 60_000 });
  const ip = (req) => clientIp(req, config.trustProxy);

  if (config.admin.username && config.admin.password && !db.one('SELECT 1 AS x FROM admins WHERE username = :u', { u: config.admin.username })) {
    createAdmin(db, config.admin.username, config.admin.password);
    logger.log?.(`[ruyi-api] created admin "${config.admin.username}" from ADMIN_USERNAME/ADMIN_PASSWORD`);
  }
  if (!db.one('SELECT 1 AS x FROM admins LIMIT 1')) {
    logger.warn?.('[ruyi-api] no merchant admin yet: run `npm run admin:create -- <username>` or set ADMIN_USERNAME/ADMIN_PASSWORD');
  }

  const router = createRouter();
  const deps = { db, config, services, auth, payments, limiter, ip };
  registerPublicRoutes(router, deps);
  registerAdminRoutes(router, deps);

  function corsHeaders(req) {
    const origin = req.headers.origin;
    const base = { 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'access-control-allow-headers': 'Content-Type, Authorization', 'access-control-max-age': '600' };
    if (!config.allowedOrigins.length) return config.production ? {} : { ...base, 'access-control-allow-origin': '*' };
    return origin && config.allowedOrigins.includes(origin) ? { ...base, 'access-control-allow-origin': origin, vary: 'Origin' } : {};
  }

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname.replace(/\/$/, '') || '/';
    for (const [key, value] of Object.entries({ ...SECURITY_HEADERS, ...corsHeaders(req) })) res.setHeader(key, value);
    res.on('finish', () => {
      // Path only: query strings may contain search terms or codes.
      logger.log?.(`${new Date().toISOString()} ${req.method} ${pathname} ${res.statusCode} ${Date.now() - started}ms`);
    });

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    try {
      const found = router.match(req.method, pathname);
      if (!found) return sendError(res, 404, 'NOT_FOUND', `接口不存在：${req.method} ${pathname}`);
      if (found.methodNotAllowed) return sendError(res, 405, 'METHOD_NOT_ALLOWED', `不支持的请求方法：${req.method}`);
      const result = await found.handler({ req, res, params: found.params, query: url.searchParams });
      if (res.writableEnded || res.headersSent) return;
      const { status = 200, ...payload } = result || {};
      json(res, status, { ok: true, ...payload });
    } catch (cause) {
      // Only errors raised with httpError() carry a status and a safe message;
      // anything else is unexpected and must not leak internals.
      const known = Number.isInteger(cause?.status);
      const status = known ? cause.status : 500;
      if (status >= 500) logger.error?.('[ruyi-api]', req.method, pathname, cause);
      if (res.headersSent) return res.end();
      if (status === 429 && cause.details?.retryAfterSeconds) res.setHeader('retry-after', String(cause.details.retryAfterSeconds));
      if (!known) return sendError(res, 500, 'INTERNAL_ERROR', '服务器内部错误');
      sendError(res, status, cause.code || 'ERROR', cause.message, status < 500 ? cause.details : undefined);
    }
  });

  /** Periodic housekeeping: expire unpaid orders, retry refunds, purge sessions. */
  async function runJobs() {
    for (const row of services.expiredUnpaidOrders(config.orderPayTimeoutMinutes)) {
      try {
        await payments.closeOrder(row);
        // A last check: the customer may have paid right before the timeout.
        const fresh = await payments.syncOrder(row);
        if (fresh.status === 'pending_payment') {
          services.cancelOrder(row.id, { by: 'system', reason: '超时未支付，系统自动取消' });
          services.audit('system', 'order.auto_cancel', row.id);
        }
      } catch (error) {
        logger.error?.('[jobs] expire order failed', row.id, error.message);
      }
    }
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    for (const row of db.all("SELECT * FROM orders WHERE refund_status = 'pending' AND updated_at < :cutoff", { cutoff })) {
      await refundIfNeeded(row, payments, services);
    }
    auth.purgeExpired();
    db.run('DELETE FROM admin_sessions WHERE expires_at <= :now', { now: Date.now() });
  }

  let timer = null;
  server.on('listening', () => {
    timer = setInterval(() => runJobs().catch((error) => logger.error?.('[jobs]', error)), config.jobIntervalSeconds * 1000);
    timer.unref();
  });
  server.on('close', () => clearInterval(timer));

  server.db = db;
  server.services = services;
  server.runJobs = runJobs;
  server.shutdown = () => new Promise((resolve) => {
    clearInterval(timer);
    server.close(() => {
      db.close();
      resolve();
    });
    server.closeIdleConnections?.();
  });
  return server;
}
