const { request, ensureLogin } = require('../../utils/request');
const { money } = require('../../utils/format');

Page({
  data: { loading: true, error: '', user: null, store: null, balanceText: '0.00', avatarText: '未' },

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
      this.setData({ loading: false, user: data.user, store: data.store, balanceText: money(data.user.balance), avatarText: data.user.registered ? data.user.nickname.slice(0, 1) : '未' });
    } catch (error) {
      this.setData({ loading: false, error: error.message || '本地 API 未连接' });
    }
  },

  goMenu() { wx.navigateTo({ url: '/pages/menu/menu' }); },
  goMe() { wx.switchTab({ url: '/pages/me/me' }); },
  goInfo(e) { wx.navigateTo({ url: `/pages/info/info?kind=${e.currentTarget.dataset.kind}` }); },
  goPage(e) { wx.navigateTo({ url: e.currentTarget.dataset.url }); },
  callStore() { getApp().callStore(); },
});
