const { request, login: wxLogin } = require('../../utils/request');

Page({
  data: { loading: false, message: '', user: null, loggedIn: false },

  onLoad() {
    const app = getApp();
    if (app.globalData.token && app.globalData.user) this.setData({ loggedIn: true, user: app.globalData.user });
  },

  async login() {
    this.setData({ loading: true, message: '' });
    try {
      const data = await wxLogin();
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
    try {
      const data = await request('/api/auth/phone', { method: 'POST', data: { code } });
      getApp().setUser(data.user);
      this.setData({ user: data.user, message: '手机号绑定成功' });
    } catch (error) {
      this.setData({ message: error.message || '手机号绑定失败' });
    }
  },
});
