const MAX_BODY_BYTES = 1024 * 1024;

export function httpError(status, code, message, details) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  if (details) error.details = details;
  return error;
}

export function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

export function sendError(res, status, code, message, details) {
  json(res, status, { ok: false, error: { code, message, ...(details ? { details } : {}) } });
}

/** Read the raw request body (needed verbatim for WeChat Pay signatures). */
export async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw httpError(413, 'PAYLOAD_TOO_LARGE', '请求体过大');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function readJson(req) {
  if (req.bodyCache === undefined) req.bodyCache = await readBody(req);
  if (!req.bodyCache) return {};
  try {
    const value = JSON.parse(req.bodyCache);
    return value && typeof value === 'object' ? value : {};
  } catch {
    throw httpError(400, 'INVALID_JSON', '请求体必须是合法 JSON');
  }
}

/**
 * Minimal router: `add('GET', '/api/orders/:id', handler)`. Handlers get
 * ({ req, res, params, query, body }) and return a payload (sent as 200 JSON
 * unless it carries `status`) or handle the response themselves.
 */
export function createRouter() {
  const routes = [];
  const add = (method, pattern, handler) => {
    const keys = [];
    const regex = new RegExp(`^${pattern.replace(/\/:([A-Za-z]+)/g, (_, key) => { keys.push(key); return '/([^/]+)'; })}$`);
    routes.push({ method, regex, keys, handler });
  };
  const match = (method, pathname) => {
    let pathMatched = false;
    for (const route of routes) {
      const found = pathname.match(route.regex);
      if (!found) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      const params = Object.fromEntries(route.keys.map((key, index) => [key, decodeURIComponent(found[index + 1])]));
      return { handler: route.handler, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  };
  return { add, match, get: (p, h) => add('GET', p, h), post: (p, h) => add('POST', p, h), put: (p, h) => add('PUT', p, h), del: (p, h) => add('DELETE', p, h) };
}

export function clientIp(req, trustProxy) {
  if (trustProxy) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress || 'unknown';
}

/** Fixed-window limiter, e.g. 10 login attempts per IP per minute. */
export function createRateLimiter({ limit, windowMs }) {
  const hits = new Map();
  return {
    check(key) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        if (hits.size > 10000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
        return;
      }
      entry.count += 1;
      if (entry.count > limit) {
        throw httpError(429, 'RATE_LIMITED', '操作过于频繁，请稍后再试', { retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) });
      }
    },
  };
}

export const str = (value, max = 200) => String(value ?? '').trim().slice(0, max);
export const validPhone = (value) => (/^1\d{10}$/.test(String(value || '').trim()) ? String(value).trim() : '');
