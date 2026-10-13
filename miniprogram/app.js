const env = require('./config/env');

App({
  globalData: {
    apiBase: env.apiBase,
    authMode: env.mode,
    token: '',
    user: null,
  },

  onLaunch() {
    this.globalData.token = wx.getStorageSync('ruyiToken') || '';
    this.globalData.user = wx.getStorageSync('ruyiUser') || null;
  },
});
