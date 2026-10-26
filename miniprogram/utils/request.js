let loginPromise = null;

function rawRequest(path, options = {}) {
  const app = getApp();
  const header = Object.assign({ 'content-type': 'application/json' }, options.header || {});
  if (app.globalData.token) header.Authorization = `Bearer ${app.globalData.token}`;
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBase}${path}`,
      method: options.method || 'GET',
      data: options.data,
      header,
      success(res) {
        const body = res.data || {};
        if (res.statusCode >= 200 && res.statusCode < 300 && body.ok !== false) return resolve(body);
        const error = new Error(body?.error?.message || `请求失败（${res.statusCode}）`);
        error.status = res.statusCode;
        error.code = body?.error?.code;
        reject(error);
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络请求失败，请确认 API 已启动'));
      },
    });
  });
}

/** wx.login -> /api/auth/login. Concurrent callers share one login. */
function login() {
  if (!loginPromise) {
    loginPromise = new Promise((resolve, reject) => wx.login({ success: resolve, fail: reject }))
      .then((result) => rawRequest('/api/auth/login', { method: 'POST', data: { code: result.code, inviterId: getApp().globalData.inviterId || undefined } }))
      .then((data) => {
        getApp().setSession(data.session.token, data.user);
        getApp().globalData.inviterId = '';
        return data;
      })
      .finally(() => { loginPromise = null; });
  }
  return loginPromise;
}

/** Make sure a server session exists (token may be missing or expired). */
async function ensureLogin() {
  const app = getApp();
  if (app.globalData.token) {
    try {
      const me = await rawRequest('/api/me');
      if (me.authenticated) {
        app.setUser(me.user);
        return me.user;
      }
    } catch (error) {
      if (error.status && error.status !== 401) throw error;
    }
  }
  const data = await login();
  return data.user;
}

/** Request with one automatic re-login when the session has expired. */
async function request(path, options = {}) {
  try {
    return await rawRequest(path, options);
  } catch (error) {
    if (error.status !== 401 || options._retried) throw error;
    await login();
    return rawRequest(path, Object.assign({}, options, { _retried: true }));
  }
}

module.exports = { request, ensureLogin, login };
