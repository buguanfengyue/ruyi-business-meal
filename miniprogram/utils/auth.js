/** Shared logged-out handling for pages that need a session. */

function isLoggedOutError(error) {
  return Boolean(error && (error.code === 'LOGGED_OUT' || error.message === '请先登录'));
}

function goLogin() {
  wx.navigateTo({ url: '/pages/auth/auth' });
}

function isMobilePhone(phone) {
  return /^1\d{10}$/.test(String(phone || '').trim());
}

/** showActionSheet with cancel vs oversize fail distinction. Max itemList is 6. */
function showActionSheet(itemList) {
  return new Promise((resolve, reject) => {
    wx.showActionSheet({
      itemList,
      success: resolve,
      fail(err) {
        const msg = (err && err.errMsg) || '';
        if (/cancel/i.test(msg)) {
          reject(Object.assign(new Error('cancel'), { cancelled: true }));
          return;
        }
        if (itemList.length > 6) {
          const { toast } = require('./format');
          toast('选项过多，请到列表页选择');
        }
        reject(err || new Error(msg || '操作失败'));
      },
    });
  });
}

module.exports = { isLoggedOutError, goLogin, isMobilePhone, showActionSheet };
