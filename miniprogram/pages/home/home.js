const { request, ensureLogin } = require('../../utils/request');
const { maskPhone } = require('../../utils/format');

Page({
  data: { loading: true, error: '', user: null, store: null, phoneText: '未绑定手机号' },

  onShow() { this.load(); },

  onPullDownRefresh() {
    this.load().finally(() => wx.stopPullDownRefresh());
  },

  async load() {
    this.setData({ error: '' });
    try {
      await ensureLogin();
      const data = await request('/api/bootstrap');
      getApp().setUser(data.user);
      if (data.store && data.store.phone) getApp().globalData.storePhone = data.store.phone;
      this.setData({
        loading: false,
        user: data.user,
        store: data.store,
        phoneText: data.user.phone ? maskPhone(data.user.phone) : '未绑定手机号',
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message || '网络异常，请重试' });
    }
  },

  goMenu() { wx.navigateTo({ url: '/pages/menu/menu' }); },
  goMe() { wx.switchTab({ url: '/pages/me/me' }); },
  goInfo(e) { wx.navigateTo({ url: `/pages/info/info?kind=${e.currentTarget.dataset.kind}` }); },
  goPage(e) { wx.navigateTo({ url: e.currentTarget.dataset.url }); },
  callStore() { getApp().callStore(); },
});
