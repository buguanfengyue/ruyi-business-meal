/**
 * Runtime configuration from environment variables.
 *
 * Secrets (AppSecret, WeChat Pay keys, admin password) are only read here on
 * the server and must never be exposed through VITE_* variables.
 */

const list = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
const int = (value, fallback, min = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= min ? Math.floor(number) : fallback;
};

export function loadConfig(env = process.env) {
  const production = (env.NODE_ENV || 'development') === 'production';
  const authMode = String(env.WECHAT_AUTH_MODE || 'mock').trim().toLowerCase();
  const payMode = String(env.PAYMENT_MODE || 'mock').trim().toLowerCase();

  const config = {
    production,
    host: env.HOST || '127.0.0.1',
    port: int(env.RUYI_API_PORT || env.PORT, 8787, 1),
    databasePath: env.DATABASE_PATH || 'data/ruyi.db',
    timezone: env.STORE_TIMEZONE || 'Asia/Shanghai',
    // Browser origins allowed to call the API (e.g. a separately hosted admin
    // site). Empty: any origin in development, same-origin only in production.
    // The mini-program's wx.request is not subject to CORS.
    allowedOrigins: list(env.ALLOWED_ORIGINS),
    trustProxy: env.TRUST_PROXY === '1',
    seedDemo: env.SEED_DEMO ? env.SEED_DEMO === '1' : authMode === 'mock',
    orderPayTimeoutMinutes: int(env.ORDER_PAY_TIMEOUT_MINUTES, 15, 1),
    jobIntervalSeconds: int(env.JOB_INTERVAL_SECONDS, 60, 1),
    admin: {
      username: String(env.ADMIN_USERNAME || '').trim(),
      password: String(env.ADMIN_PASSWORD || ''),
      sessionTtlSeconds: int(env.ADMIN_SESSION_TTL_SECONDS, 12 * 3600, 300),
    },
    auth: {
      mode: authMode,
      appId: String(env.WECHAT_APPID || '').trim(),
      appSecret: String(env.WECHAT_APPSECRET || '').trim(),
      apiBase: String(env.WECHAT_API_BASE_URL || 'https://api.weixin.qq.com').replace(/\/$/, ''),
      ttlSeconds: int(env.WECHAT_AUTH_TTL_SECONDS, 7 * 24 * 3600, 300),
      mockPhone: String(env.MOCK_WECHAT_PHONE || '15805320100'),
    },
    pay: {
      mode: payMode,
      appId: String(env.WECHAT_APPID || '').trim(),
      mchId: String(env.WECHATPAY_MCHID || '').trim(),
      certSerialNo: String(env.WECHATPAY_CERT_SERIAL || '').trim(),
      privateKeyPath: String(env.WECHATPAY_PRIVATE_KEY_PATH || '').trim(),
      apiV3Key: String(env.WECHATPAY_APIV3_KEY || ''),
      // "微信支付公钥" mode (recommended by WeChat Pay for new merchants).
      publicKeyId: String(env.WECHATPAY_PUBLIC_KEY_ID || '').trim(),
      publicKeyPath: String(env.WECHATPAY_PUBLIC_KEY_PATH || '').trim(),
      notifyUrl: String(env.WECHATPAY_NOTIFY_URL || '').trim(),
      refundNotifyUrl: String(env.WECHATPAY_REFUND_NOTIFY_URL || env.WECHATPAY_NOTIFY_URL || '').trim(),
      apiBase: String(env.WECHATPAY_API_BASE_URL || 'https://api.mch.weixin.qq.com').replace(/\/$/, ''),
    },
  };

  validateConfig(config, env);
  return config;
}

function fail(message) {
  const error = new Error(`[config] ${message}`);
  error.code = 'INVALID_CONFIG';
  throw error;
}

function validateConfig(config, env) {
  if (!['mock', 'wechat'].includes(config.auth.mode)) fail('WECHAT_AUTH_MODE 必须是 mock 或 wechat');
  if (!['mock', 'wechat'].includes(config.pay.mode)) fail('PAYMENT_MODE 必须是 mock 或 wechat');

  // Fail closed: a production deployment must never silently run with fake
  // login or fake payment.
  if (config.production && env.ALLOW_MOCK_IN_PRODUCTION !== '1') {
    if (config.auth.mode !== 'wechat') fail('生产环境必须设置 WECHAT_AUTH_MODE=wechat');
    if (config.pay.mode !== 'wechat') fail('生产环境必须设置 PAYMENT_MODE=wechat');
  }
  if (config.auth.mode === 'wechat' && (!config.auth.appId || !config.auth.appSecret)) {
    fail('WECHAT_AUTH_MODE=wechat 需要 WECHAT_APPID 和 WECHAT_APPSECRET');
  }
  if (config.pay.mode === 'wechat') {
    const p = config.pay;
    const missing = [
      ['WECHAT_APPID', p.appId], ['WECHATPAY_MCHID', p.mchId], ['WECHATPAY_CERT_SERIAL', p.certSerialNo],
      ['WECHATPAY_PRIVATE_KEY_PATH', p.privateKeyPath], ['WECHATPAY_APIV3_KEY', p.apiV3Key],
      ['WECHATPAY_PUBLIC_KEY_ID', p.publicKeyId], ['WECHATPAY_PUBLIC_KEY_PATH', p.publicKeyPath],
      ['WECHATPAY_NOTIFY_URL', p.notifyUrl],
    ].filter(([, value]) => !value).map(([name]) => name);
    if (missing.length) fail(`PAYMENT_MODE=wechat 缺少：${missing.join(', ')}`);
    if (Buffer.byteLength(p.apiV3Key) !== 32) fail('WECHATPAY_APIV3_KEY 必须是 32 字节');
    if (!/^https:\/\//.test(p.notifyUrl)) fail('WECHATPAY_NOTIFY_URL 必须是 https 地址');
  }
  if (config.admin.password && config.admin.password.length < 10) fail('ADMIN_PASSWORD 至少 10 位');
}
