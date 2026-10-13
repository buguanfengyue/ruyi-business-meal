function request(path, options = {}) {
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
        const message = body?.error?.message || `请求失败（${res.statusCode}）`;
        reject(new Error(message));
      },
      fail: reject,
    });
  });
}

module.exports = { request };
