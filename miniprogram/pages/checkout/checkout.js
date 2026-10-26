const { request } = require('../../utils/request');
const { money, maskPhone, toast } = require('../../utils/format');

const SCHEDULES = ['立即取单', '11:30', '12:00', '12:30', '17:30', '18:00'];

Page({
  data: {
    store: null,
    items: [],
    quote: null,
    quoteError: '',
    phone: '',
    note: '',
    schedules: SCHEDULES,
    scheduleIndex: 0,
    coupons: [],
    couponId: '',
    couponText: '无可用券',
    addresses: [],
    addressId: '',
    addressText: '选择收货地址',
    submitting: false,
    empty: false,
  },

  onLoad() {
    const user = getApp().globalData.user || {};
    this.setData({ phone: user.phone || '' });
    request('/api/bootstrap').then((data) => this.setData({ store: data.store })).catch(() => {});
    request('/api/coupons').then((data) => {
      this.setData({ coupons: data.coupons.filter((c) => c.status === 'available') });
      this.updateCouponText();
    }).catch(() => {});
  },

  onShow() {
    // Returning from the address page should pick up a newly added address.
    request('/api/addresses').then((data) => {
      const keep = data.addresses.find((a) => a.id === this.data.addressId);
      this.setData({ addresses: data.addresses });
      this.pickAddress((keep || data.addresses[0] || {}).id || '');
    }).catch(() => {});
    this.quote();
  },

  cartItems() {
    const cart = getApp().globalData.cart;
    return Object.keys(cart).map((productId) => ({ productId, quantity: cart[productId] }));
  },

  async quote() {
    const items = this.cartItems();
    if (!items.length) {
      this.setData({ items: [], quote: null, empty: true });
      return;
    }
    this.setData({ quote: null, quoteError: '', empty: false });
    try {
      const data = await request('/api/cart/quote', { method: 'POST', data: { items, couponId: this.data.couponId || undefined } });
      this.setData({
        quote: Object.assign({}, data, { totalText: money(data.total), discountText: money(data.discount), payable: data.subtotal - data.discount }),
        items: data.items.map((i) => Object.assign({}, i, { lineText: money(i.lineTotal) })),
      });
      this.updateCouponText();
    } catch (error) {
      if (this.data.couponId) {
        this.setData({ couponId: '' });
        toast(error.message);
        this.quote();
      } else {
        this.setData({ quoteError: error.message });
      }
    }
  },

  updateCouponText() {
    const { coupons, couponId, quote } = this.data;
    const coupon = coupons.find((c) => c.id === couponId);
    // Coupon thresholds apply to the amount after the member discount.
    const subtotal = quote ? quote.payable : 0;
    const usable = coupons.filter((c) => subtotal >= c.threshold).length;
    this.setData({ couponText: coupon ? `${coupon.title} -¥${money(coupon.amount)}` : usable ? `${usable}张可用` : '无可用券' });
  },

  pickAddress(id) {
    const address = this.data.addresses.find((a) => a.id === id);
    this.setData({ addressId: id, addressText: address ? `${address.name} ${maskPhone(address.phone)} ${address.detail}` : (this.data.addresses.length ? '选择收货地址' : '去添加收货地址') });
  },

  chooseAddress() {
    const { addresses } = this.data;
    if (!addresses.length) return wx.navigateTo({ url: '/pages/addresses/addresses' });
    wx.showActionSheet({
      itemList: addresses.map((a) => `${a.name} ${a.detail}`.slice(0, 30)).concat('+ 新增地址'),
      success: ({ tapIndex }) => {
        if (tapIndex === addresses.length) wx.navigateTo({ url: '/pages/addresses/addresses' });
        else this.pickAddress(addresses[tapIndex].id);
      },
    });
  },

  chooseCoupon() {
    const subtotal = this.data.quote ? this.data.quote.payable : 0;
    const coupons = this.data.coupons;
    wx.showActionSheet({
      itemList: ['不使用优惠券'].concat(coupons.map((c) => (subtotal >= c.threshold ? c.title : `${c.title}（还差¥${money(c.threshold - subtotal)}）`))),
      success: ({ tapIndex }) => {
        const coupon = coupons[tapIndex - 1];
        if (coupon && subtotal < coupon.threshold) return toast('未满足使用门槛');
        this.setData({ couponId: coupon ? coupon.id : '' });
        this.quote();
      },
    });
  },

  onSchedule(e) { this.setData({ scheduleIndex: Number(e.detail.value) }); },
  onPhone(e) { this.setData({ phone: e.detail.value }); },
  onNote(e) { this.setData({ note: e.detail.value }); },

  async submit() {
    const { quote, phone, submitting } = this.data;
    if (!quote || submitting) return;
    if (!/^1\d{10}$/.test(phone)) return toast('请填写有效的 11 位手机号');
    this.setData({ submitting: true });
    try {
      const app = getApp();
      const data = await request('/api/orders', {
        method: 'POST',
        data: {
          items: this.cartItems(),
          customer: { phone, nickname: (app.globalData.user || {}).nickname },
          fulfillment: 'delivery',
          schedule: SCHEDULES[this.data.scheduleIndex],
          note: this.data.note,
          couponId: this.data.couponId || undefined,
          addressId: this.data.addressId || undefined,
        },
      });
      app.clearCart();
      wx.redirectTo({ url: `/pages/order-detail/order-detail?id=${data.order.id}` });
    } catch (error) {
      this.setData({ submitting: false });
      toast(`下单失败：${error.message}`);
    }
  },

  goMenu() { wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/menu/menu' }) }); },
});
