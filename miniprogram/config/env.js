// Production API (nginx → Node on the cloud server). The domain must be listed
// under 小程序后台 → 开发管理 → 开发设置 → 服务器域名 → request 合法域名.
// For local development against `npm run api`, temporarily switch to
// 'http://127.0.0.1:8787' and disable domain checks in DevTools.
module.exports = {
  apiBase: 'https://aftwy007.com',
  mode: 'wechat',
};
