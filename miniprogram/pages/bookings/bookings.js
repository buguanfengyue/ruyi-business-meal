const { request } = require('../../utils/request');
const { money, formatTime, toast } = require('../../utils/format');

Page({
  data: { orders: [], loading: true },
  async onShow() {
    try {
      const data = await request('/api/orders');
      const orders = data.orders
        .filter((o) => o.schedule && o.schedule !== '立即取单' && o.status !== 'cancelled')
        .map((o) => Object.assign({}, o, { summary: o.items.map((i) => `${i.name}×${i.quantity}`).join('、'), totalText: money(o.totals.total), timeText: formatTime(o.createdAt) }));
      this.setData({ orders, loading: false });
    } catch (error) {
      this.setData({ loading: false });
      toast(error.message);
    }
  },
  open(e) { wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` }); },
  goMenu() { wx.navigateTo({ url: '/pages/menu/menu' }); },
});
