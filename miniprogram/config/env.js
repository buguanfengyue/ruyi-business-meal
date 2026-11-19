// Flip USE_LOCAL to false before uploading experience / release builds.
// True = DevTools against local API (also set project.config.json urlCheck=false).
const USE_LOCAL = true;

module.exports = USE_LOCAL
  ? {
      apiBase: 'http://127.0.0.1:8787',
      mode: 'local',
    }
  : {
      // Production / 真机 / 体验版：已备案 HTTPS 域名（须加入 request 合法域名）
      apiBase: 'https://aftwy007.com',
      mode: 'production',
    };
