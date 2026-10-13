const { request } = require('../../utils/request');

Page({
  data: {
    loading: true,
    error: '',
    authMode: '',
    user: null,
    products: [],
  },

  onLoad() { this.loadBootstrap(); },

  onPullDownRefresh() {
    this.loadBootstrap().finally(() => wx.stopPullDownRefresh());
  },

  async loadBootstrap() {
    this.setData({ loading: true, error: '' });
    try {
      const data = await request('/api/bootstrap');
      this.setData({ loading: false, authMode: data.config?.auth?.mode || 'mock', user: data.user, products: data.products || [] });
    } catch (error) {
      this.setData({ loading: false, error: error.message || '本地 API 未连接' });
    }
  },

  goAuth() { wx.navigateTo({ url: '/pages/auth/auth' }); },
});
