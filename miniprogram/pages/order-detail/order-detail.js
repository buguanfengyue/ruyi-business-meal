const { request } = require('../../utils/request');
const { money, formatTime, toast } = require('../../utils/format');

const HINTS = {
  pending_payment: '请尽快完成支付（本地为模拟支付）',
  paid: '商家正在备餐，请耐心等待',
  completed: '感谢您的光临',
  cancelled: '订单已取消，优惠券已退回',
};

Page({
  data: { order: null, error: '', busy: false },

  onLoad(query) {
    this.id = query.id;
    this.load();
  },

  async load() {
    try {
      const data = await request(`/api/orders/${encodeURIComponent(this.id)}`);
      this.present(data.order);
    } catch (error) {
      this.setData({ error: error.message });
    }
  },

  present(order) {
    this.setData({
      order: Object.assign({}, order, {
        hint: HINTS[order.status] || '',
        timeText: formatTime(order.createdAt),
        items: order.items.map((i) => Object.assign({}, i, { lineText: money(i.lineTotal) })),
        t: {
          subtotal: money(order.totals.subtotal),
          discount: money(order.totals.discount),
          coupon: money(order.totals.couponDiscount),
          total: money(order.totals.total),
        },
        canCancel: ['pending_payment', 'paid'].includes(order.status),
        canPay: order.status === 'pending_payment',
      }),
    });
  },

  async act(action, message) {
    this.setData({ busy: true });
    try {
      const data = await request(`/api/orders/${encodeURIComponent(this.id)}/${action}`, { method: 'POST' });
      this.present(data.order);
      toast(message);
    } catch (error) {
      toast(error.message);
    }
    this.setData({ busy: false });
  },

  /**
   * Mock mode: the server marks the order paid directly.
   * WeChat Pay mode: the server returns `payment` params for
   * wx.requestPayment; the order only becomes paid after the server verifies
   * WeChat Pay, so we poll with ?sync=1 until it flips.
   */
  async pay() {
    this.setData({ busy: true });
    try {
      const data = await request(`/api/orders/${encodeURIComponent(this.id)}/pay`, { method: 'POST' });
      if (!data.payment) {
        this.present(data.order);
        toast('支付成功（模拟）');
        return;
      }
      await new Promise((resolve, reject) => wx.requestPayment({ ...data.payment, success: resolve, fail: reject }));
      for (let i = 0; i < 6; i += 1) {
        const synced = await request(`/api/orders/${encodeURIComponent(this.id)}?sync=1`);
        this.present(synced.order);
        if (synced.order.status !== 'pending_payment') { toast('支付成功'); return; }
        await new Promise((r) => setTimeout(r, 1500));
      }
      toast('支付结果确认中，请稍后刷新');
    } catch (error) {
      const cancelled = /cancel/.test((error && error.errMsg) || '');
      toast(cancelled ? '已取消支付' : (error.message || error.errMsg || '支付失败'));
    } finally {
      this.setData({ busy: false });
    }
  },

  cancel() {
    wx.showModal({
      title: '取消订单',
      content: '确定取消该订单吗？',
      success: ({ confirm }) => confirm && this.act('cancel', '订单已取消'),
    });
  },

  reorder() {
    const app = getApp();
    this.data.order.items.forEach((i) => app.updateCart(i.productId, i.quantity));
    wx.navigateTo({ url: '/pages/menu/menu' });
  },

  callStore() { getApp().callStore(); },

  goOrders() { wx.switchTab({ url: '/pages/orders/orders' }); },
});
