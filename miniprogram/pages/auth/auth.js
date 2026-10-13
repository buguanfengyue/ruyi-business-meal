const { request } = require('../../utils/request');

Page({
  data: { loading: false, message: '', user: null, loggedIn: false },

  async login() {
    this.setData({ loading: true, message: '' });
    try {
      const loginResult = await new Promise((resolve, reject) => wx.login({ success: resolve, fail: reject }));
      const data = await request('/api/auth/login', { method: 'POST', data: { code: loginResult.code } });
      const app = getApp();
      app.globalData.token = data.session.token;
      app.globalData.user = data.user;
      wx.setStorageSync('ruyiToken', data.session.token);
      wx.setStorageSync('ruyiUser', data.user);
      this.setData({ loading: false, loggedIn: true, user: data.user, message: '微信登录成功' });
    } catch (error) {
      this.setData({ loading: false, message: error.message || '微信登录失败' });
    }
  },

  async onGetPhoneNumber(event) {
    const code = event.detail && event.detail.code;
    if (!code) {
      this.setData({ message: '未获得手机号授权，请重试' });
      return;
    }
    const app = getApp();
    try {
      const data = await request('/api/auth/phone', { method: 'POST', data: { code } });
      app.globalData.user = data.user;
      wx.setStorageSync('ruyiUser', data.user);
      this.setData({ user: data.user, message: '手机号绑定成功' });
    } catch (error) {
      this.setData({ message: error.message || '手机号绑定失败' });
    }
  },
});
