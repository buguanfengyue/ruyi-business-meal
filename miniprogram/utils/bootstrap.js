const { request, ensureLogin } = require('./request');

const TTL_MS = 45_000;

/** Shared short-lived bootstrap cache for home / menu / checkout. */
async function getBootstrap({ force = false, allowGuest = false } = {}) {
  const app = getApp();
  const loggedOut = Boolean(wx.getStorageSync('ruyiLoggedOut'));
  if (loggedOut && !allowGuest) {
    const error = new Error('请先登录');
    error.code = 'LOGGED_OUT';
    error.status = 401;
    throw error;
  }
  if (!loggedOut) await ensureLogin();
  const cached = app.globalData.bootstrapCache;
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.data;
  const data = await request('/api/bootstrap', { allowLoggedOut: loggedOut || allowGuest });
  // Sync user before writing cache so setUser's invalidation cannot wipe a fresh entry.
  if (data.user && !loggedOut) app.setUser(data.user);
  app.globalData.bootstrapCache = { data, at: Date.now() };
  if (data.store && data.store.phone) app.globalData.storePhone = data.store.phone;
  return data;
}

function invalidateBootstrap() {
  const app = getApp();
  if (app) app.globalData.bootstrapCache = null;
}

module.exports = { getBootstrap, invalidateBootstrap };
