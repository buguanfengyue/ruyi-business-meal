const { request, ensureLogin } = require('../../utils/request');
const { money, formatTime } = require('../../utils/format');

Page({
  data: {
    tabs: [
      { id: 'all', label: '全部' },
      { id: 'pending_payment', label: '待支付' },
      { id: 'paid', label: '待接单' },
      { id: 'preparing', label: '备餐中' },
      { id: 'completed', label: '已完成' },
      { id: 'cancelled', label: '已取消' },
    ],
    active: 0,
    orders: [],
    filtered: [],
    loading: true,
    error: '',
  },

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
      this.applyFilter();
    } catch (error) {
      this.setData({ loading: false, error: error.message });
    }
  },

  applyFilter() {
    const tab = this.data.tabs[this.data.active];
    const filtered = tab.id === 'all' ? this.data.orders : this.data.orders.filter((o) => o.status === tab.id);
    this.setData({ filtered });
  },

  pickTab(e) {
    this.setData({ active: Number(e.currentTarget.dataset.index) });
    this.applyFilter();
  },
  open(e) { wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` }); },
  goMenu() { wx.navigateTo({ url: '/pages/menu/menu' }); },
});
