const { request } = require('../../utils/request');
const { money, formatTime, toast } = require('../../utils/format');
const { isLoggedOutError, goLogin } = require('../../utils/auth');

Page({
  data: { orders: [], loading: true, needLogin: false },
  onShow() { return this.load(); },

  async load() {
    try {
      const data = await request('/api/orders');
      const orders = data.orders
        .filter((o) => o.schedule && o.schedule !== '尽快送达' && o.schedule !== '立即取单' && o.status !== 'cancelled')
        .map((o) => Object.assign({}, o, { summary: o.items.map((i) => `${i.name}×${i.quantity}`).join('、'), totalText: money(o.totals.total), timeText: formatTime(o.createdAt) }));
      this.setData({ orders, loading: false, needLogin: false });
    } catch (error) {
      if (isLoggedOutError(error)) {
        this.setData({ loading: false, needLogin: true, orders: [] });
        return;
      }
      this.setData({ loading: false });
      toast(error.message);
    }
  },
  goAuth() { goLogin(); },
  open(e) { wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` }); },
  goMenu() { wx.navigateTo({ url: '/pages/menu/menu' }); },
});
