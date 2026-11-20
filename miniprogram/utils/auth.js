/** Shared logged-out handling for pages that need a session. */

function isLoggedOutError(error) {
  return Boolean(error && (error.code === 'LOGGED_OUT' || error.message === '请先登录'));
}

function goLogin() {
  try {
    const pages = getCurrentPages();
    const top = pages[pages.length - 1];
    if (top && top.route === 'pages/auth/auth') return;
  } catch (_) { /* harness / early boot */ }
  wx.navigateTo({ url: '/pages/auth/auth' });
}

function isMobilePhone(phone) {
  return /^1\d{10}$/.test(String(phone || '').trim());
}

module.exports = { isLoggedOutError, goLogin, isMobilePhone };
