// Flip USE_LOCAL to false before uploading experience / release builds.
// True = DevTools against local API (also set project.config.json urlCheck=false).
// Production domain must be listed under 小程序后台 → 开发管理 → 开发设置 → 服务器域名 → request 合法域名.
// false = production / 体验版 / 真机（HTTPS 合法域名）；本地 DevTools 联调时临时改回 true。
const USE_LOCAL = false;

module.exports = USE_LOCAL
  ? {
      apiBase: 'http://127.0.0.1:8787',
      mode: 'local',
    }
  : {
      // Production / 真机 / 体验版：已备案 HTTPS 域名
      apiBase: 'https://aftwy007.com',
      mode: 'production',
    };
