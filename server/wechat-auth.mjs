import { createHash, randomBytes } from 'node:crypto';
import { httpError } from './http.mjs';

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

function bearerToken(req) {
  const value = String(req.headers.authorization || '');
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

const normalizePhone = (value) => (/^1\d{10}$/.test(String(value || '').trim()) ? String(value).trim() : '');

/**
 * Server-side WeChat login. Sessions are random tokens; only their SHA-256
 * hash is stored, so a leaked database cannot be replayed as logins.
 *
 * mock mode: any code logs in as the demo user; `mock:<name>` simulates a
 * distinct WeChat user. wechat mode: code -> jscode2session -> openid, and
 * the same openid always maps to the same user row.
 */
export function createWechatAuth({ config, db, services, logger = console }) {
  const { mode, appId, appSecret, apiBase, ttlSeconds, mockPhone } = config.auth;
  let accessTokenCache = null;

  function issueSession(user, created = false) {
    const token = `ruyi_${randomBytes(24).toString('hex')}`;
    const expiresAt = Date.now() + ttlSeconds * 1000;
    db.run('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (:hash, :userId, :expiresAt, :now)', {
      hash: hashToken(token), userId: user.id, expiresAt, now: new Date().toISOString(),
    });
    return { token, expiresAt: new Date(expiresAt).toISOString(), user, created };
  }

  function getSession(token) {
    if (!token) return null;
    const row = db.one('SELECT * FROM sessions WHERE token_hash = :hash', { hash: hashToken(token) });
    if (!row) return null;
    const user = services.getUser(row.user_id);
    if (row.expires_at <= Date.now() || !user) {
      db.run('DELETE FROM sessions WHERE token_hash = :hash', { hash: row.token_hash });
      return null;
    }
    return { token, user, expiresAt: row.expires_at };
  }

  async function wechatJson(path, options = {}) {
    let response;
    try {
      response = await fetch(`${apiBase}${path}`, { ...options, signal: AbortSignal.timeout(8000) });
    } catch (cause) {
      logger.error?.('[wechat-auth] request failed', cause.message);
      throw httpError(502, 'WECHAT_API_UNREACHABLE', '微信接口暂时无法访问，请稍后重试');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || Number(payload.errcode || 0) !== 0) {
      const code = Number(payload.errcode || response.status || 500);
      throw httpError(502, 'WECHAT_API_ERROR', `微信接口调用失败（${code}）`);
    }
    return payload;
  }

  async function getAccessToken() {
    if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60_000) return accessTokenCache.value;
    const query = new URLSearchParams({ grant_type: 'client_credential', appid: appId, secret: appSecret });
    const payload = await wechatJson(`/cgi-bin/token?${query}`);
    accessTokenCache = { value: payload.access_token, expiresAt: Date.now() + Number(payload.expires_in || 7200) * 1000 };
    return accessTokenCache.value;
  }

  async function login(code) {
    const loginCode = String(code || '').trim();
    if (!loginCode || loginCode.length > 512) throw httpError(400, 'INVALID_LOGIN_CODE', 'wx.login 返回的 code 无效');

    if (mode === 'mock') {
      const named = loginCode.match(/^mock:([A-Za-z0-9_-]{1,32})$/);
      const id = named ? `mock_${named[1]}` : 'demo-user';
      const existing = services.getUser(id);
      if (existing) return issueSession(existing, false);
      return issueSession(services.createUser({ id, authMode: 'mock', phone: named ? '' : mockPhone }), true);
    }

    const query = new URLSearchParams({ appid: appId, secret: appSecret, js_code: loginCode, grant_type: 'authorization_code' });
    const payload = await wechatJson(`/sns/jscode2session?${query}`);
    // openid/unionid stay server-side; never returned to clients or logged.
    const existing = db.one('SELECT * FROM users WHERE openid = :openid AND deleted_at IS NULL', { openid: payload.openid });
    if (existing) return issueSession(existing, false);
    return issueSession(services.createUser({ openid: payload.openid, unionid: payload.unionid || null, authMode: 'wechat' }), true);
  }

  async function bindPhone(token, code) {
    const session = getSession(token);
    if (!session) throw httpError(401, 'AUTH_REQUIRED', '登录会话已失效，请重新登录');
    const phoneCode = String(code || '').trim();
    if (!phoneCode || phoneCode.length > 512) throw httpError(400, 'INVALID_PHONE_CODE', '手机号授权 code 无效');

    let phone;
    if (mode === 'mock') {
      phone = normalizePhone(mockPhone);
    } else {
      const accessToken = await getAccessToken();
      const payload = await wechatJson(`/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(accessToken)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: phoneCode }),
      });
      phone = normalizePhone(payload.phone_info?.phoneNumber);
      if (!phone) throw httpError(502, 'WECHAT_PHONE_MISSING', '微信未返回有效手机号');
    }
    return { token, user: services.updateUser(session.user.id, { phone }) };
  }

  function logout(token) {
    if (token) db.run('DELETE FROM sessions WHERE token_hash = :hash', { hash: hashToken(token) });
  }

  const purgeExpired = () => db.run('DELETE FROM sessions WHERE expires_at <= :now', { now: Date.now() }).changes;

  function publicConfig() {
    return { mode, appId: appId || null, mock: mode === 'mock', login: true, phoneNumber: true, ttlSeconds };
  }

  return {
    mode,
    publicConfig,
    login,
    bindPhone,
    logout,
    getSession,
    purgeExpired,
    sessionFromRequest: (req) => getSession(bearerToken(req)),
    bearerToken,
  };
}
