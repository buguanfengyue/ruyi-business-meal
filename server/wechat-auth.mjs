import { randomUUID } from 'node:crypto';

const DEFAULT_WECHAT_API = 'https://api.weixin.qq.com';

function authError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function bearerToken(req) {
  const value = String(req.headers.authorization || '');
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function normalizePhone(value) {
  const phone = String(value || '').trim();
  return /^1\d{10}$/.test(phone) ? phone : '';
}

/**
 * Server-side WeChat auth adapter.
 *
 * Local development intentionally defaults to mock mode. In production set
 * WECHAT_AUTH_MODE=wechat, WECHAT_APPID and WECHAT_APPSECRET on the server
 * only. Never put WECHAT_APPSECRET in Vite or mini-program client code.
 */
export function createWechatAuth({ env = process.env, state, logger = console } = {}) {
  const mode = String(env.WECHAT_AUTH_MODE || 'mock').toLowerCase() === 'wechat' ? 'wechat' : 'mock';
  const appId = String(env.WECHAT_APPID || '').trim();
  const appSecret = String(env.WECHAT_APPSECRET || '').trim();
  const apiBase = String(env.WECHAT_API_BASE_URL || DEFAULT_WECHAT_API).replace(/\/$/, '');
  const ttlSeconds = Math.max(300, Number(env.WECHAT_AUTH_TTL_SECONDS || 7200));
  const sessions = new Map();
  let accessTokenCache = null;

  function assertWechatConfig() {
    if (!appId || !appSecret) {
      throw authError(503, 'WECHAT_CONFIG_MISSING', '正式微信授权尚未配置 WECHAT_APPID/WECHAT_APPSECRET');
    }
  }

  function issueSession(user) {
    const token = `ruyi_${randomUUID().replaceAll('-', '')}`;
    const expiresAt = Date.now() + ttlSeconds * 1000;
    sessions.set(token, { user: { ...user }, expiresAt });
    return { token, expiresAt: new Date(expiresAt).toISOString(), user: { ...user } };
  }

  function getSession(token) {
    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      sessions.delete(token);
      return null;
    }
    return { ...session, token };
  }

  async function wechatJson(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || Number(payload.errcode || 0) !== 0) {
      const code = Number(payload.errcode || response.status || 500);
      throw authError(502, 'WECHAT_API_ERROR', `微信接口调用失败（${code}）`);
    }
    return payload;
  }

  async function getAccessToken() {
    assertWechatConfig();
    if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 30_000) {
      return accessTokenCache.value;
    }
    const query = new URLSearchParams({ grant_type: 'client_credential', appid: appId, secret: appSecret });
    const payload = await wechatJson(`/cgi-bin/token?${query}`);
    accessTokenCache = { value: payload.access_token, expiresAt: Date.now() + Number(payload.expires_in || 7200) * 1000 };
    return accessTokenCache.value;
  }

  async function login(code) {
    const loginCode = String(code || '').trim();
    if (!loginCode || loginCode.length > 512) {
      throw authError(400, 'INVALID_LOGIN_CODE', 'wx.login 返回的 code 无效');
    }

    if (mode === 'mock') {
      return issueSession({
        id: state.user.id,
        nickname: state.user.nickname,
        phone: state.user.phone,
        registered: state.user.registered,
        balance: state.user.balance,
        points: state.user.points,
        availableCoupons: state.user.availableCoupons,
        authMode: 'mock',
      });
    }

    assertWechatConfig();
    const query = new URLSearchParams({
      appid: appId,
      secret: appSecret,
      js_code: loginCode,
      grant_type: 'authorization_code',
    });
    const payload = await wechatJson(`/sns/jscode2session?${query}`);
    // Keep openid/unionid server-side in the session. Do not expose them to
    // the browser UI or write them to logs.
    return issueSession({
      id: `wx_${randomUUID().slice(0, 12)}`,
      nickname: state.user.nickname,
      phone: '',
      registered: false,
      balance: 0,
      points: 0,
      availableCoupons: 0,
      authMode: 'wechat',
      _openid: payload.openid,
      _unionid: payload.unionid || '',
    });
  }

  async function bindPhone(token, code) {
    const session = getSession(token);
    if (!session) throw authError(401, 'AUTH_REQUIRED', '登录会话已失效，请重新登录');
    const phoneCode = String(code || '').trim();
    if (!phoneCode || phoneCode.length > 512) throw authError(400, 'INVALID_PHONE_CODE', '手机号授权 code 无效');

    if (mode === 'mock') {
      const phone = normalizePhone(env.MOCK_WECHAT_PHONE || state.user.phone);
      session.user.phone = phone;
      return { token, user: { ...session.user, authMode: 'mock' } };
    }

    const accessToken = await getAccessToken();
    const payload = await wechatJson(`/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(accessToken)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: phoneCode }),
    });
    const phone = normalizePhone(payload.phone_info?.phoneNumber);
    if (!phone) throw authError(502, 'WECHAT_PHONE_MISSING', '微信未返回有效手机号');
    session.user.phone = phone;
    return { token, user: { ...session.user, authMode: 'wechat' } };
  }

  function publicConfig() {
    return {
      mode,
      appId: appId || null,
      mock: mode === 'mock',
      login: true,
      phoneNumber: mode === 'mock' || Boolean(appId && appSecret),
      ttlSeconds,
    };
  }

  function sessionFromRequest(req) {
    return getSession(bearerToken(req));
  }

  return {
    mode,
    publicConfig,
    login,
    bindPhone,
    getSession,
    sessionFromRequest,
    logger,
  };
}

export { bearerToken };
