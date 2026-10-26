const { request, ensureLogin } = require('../../utils/request');
const { money, formatTime } = require('../../utils/format');

Page({
  data: { tabs: ['点单', '商城', '会员', '拼团', '礼品卡'], active: 0, orders: [], loading: true, error: '' },

  onShow() { this.load(); },

  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },

  async load() {
    try {
      await ensureLogin();
      const data = await request('/api/orders');
      const orders = data.orders.map((o) => Object.assign({}, o, {
        summary: o.items.map((i) => `${i.name}×${i.quantity}`).join('、'),
        count: o.items.reduce((s, i) => s + i.quantity, 0),
        totalText: money(o.totals.total),
        timeText: formatTime(o.createdAt),
      }));
      this.setData({ orders, loading: false, error: '' });
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  pickTab(e) { this.setData({ active: Number(e.currentTarget.dataset.index) }); },
  open(e) { wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` }); },
  goMenu() { wx.navigateTo({ url: '/pages/menu/menu' }); },
});
