const { request } = require('../../utils/request');
const { money, maskPhone, toast } = require('../../utils/format');
const { getBootstrap, invalidateBootstrap } = require('../../utils/bootstrap');
const { isLoggedOutError, goLogin, isMobilePhone } = require('../../utils/auth');

const SCHEDULES = ['尽快送达', '11:30', '12:00', '12:30', '17:30', '18:00'];

function cartEmpty() {
  return !Object.keys(getApp().globalData.cart || {}).length;
}

Page({
  data: {
    store: null,
    storeError: '',
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
    empty: cartEmpty(),
    submitLabel: '确认下单',
    showCoupons: false,
  },

  onLoad() {
    const user = getApp().globalData.user || {};
    this.setData({ phone: user.phone || '', empty: cartEmpty() });
    getBootstrap()
      .then((data) => this.setData({ store: data.store, storeError: '' }))
      .catch((error) => {
        if (isLoggedOutError(error)) {
          this.setData({ storeError: '请先登录' });
          goLogin();
          return;
        }
        this.setData({ storeError: error.message || '门店信息加载失败' });
      });
    request('/api/coupons').then((data) => {
      this.setData({ coupons: data.coupons.filter((c) => c.status === 'available') });
      this.updateCouponText();
    }).catch(() => {});
  },

  onShow() {
    if (this._skipAddressRefresh) {
      this._skipAddressRefresh = false;
    } else {
      this.refreshAddresses();
    }
    this.quote();
  },

  refreshAddresses(preferredId) {
    return request('/api/addresses').then((data) => {
      const keepId = preferredId || this.data.addressId;
      const keep = data.addresses.find((a) => a.id === keepId);
      this.setData({ addresses: data.addresses });
      this.pickAddress((keep || data.addresses[0] || {}).id || '');
    }).catch((error) => {
      if (isLoggedOutError(error)) goLogin();
    });
  },

  cartItems() {
    const cart = getApp().globalData.cart;
    return Object.keys(cart).map((productId) => ({ productId, quantity: cart[productId] }));
  },

  async quote() {
    const items = this.cartItems();
    if (!items.length) {
      this.setData({ items: [], quote: null, empty: true, submitLabel: '确认下单' });
      return;
    }
    this.setData({ quote: null, quoteError: '', empty: false });
    try {
      const data = await request('/api/cart/quote', { method: 'POST', data: { items, couponId: this.data.couponId || undefined } });
      const total = Number(data.total) || 0;
      this.setData({
        quote: Object.assign({}, data, { totalText: money(data.total), discountText: money(data.discount), payable: data.subtotal - data.discount }),
        items: data.items.map((i) => Object.assign({}, i, { lineText: money(i.lineTotal) })),
        submitLabel: total === 0 ? '提交订单' : '确认下单',
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
    const subtotal = quote ? quote.payable : 0;
    const usable = coupons.filter((c) => subtotal >= c.threshold).length;
    this.setData({ couponText: coupon ? `${coupon.title} -¥${money(coupon.amount)}` : usable ? `${usable}张可用` : '无可用券' });
  },

  pickAddress(id) {
    const address = this.data.addresses.find((a) => a.id === id);
    this.setData({ addressId: id, addressText: address ? `${address.name} ${maskPhone(address.phone)} ${address.detail}` : (this.data.addresses.length ? '选择收货地址' : '去添加收货地址') });
  },

  chooseAddress() {
    this._skipAddressRefresh = true;
    wx.navigateTo({
      url: '/pages/addresses/addresses?select=1',
      events: {
        selectAddress: ({ id }) => {
          this.refreshAddresses(id).then(() => this.pickAddress(id));
        },
      },
      fail: () => { this._skipAddressRefresh = false; },
    });
  },

  chooseCoupon() {
    this.setData({ showCoupons: true });
  },

  closeCoupons() { this.setData({ showCoupons: false }); },
  noop() {},

  pickCoupon(e) {
    const id = e.currentTarget.dataset.id || '';
    const coupon = this.data.coupons.find((c) => c.id === id);
    const subtotal = this.data.quote ? this.data.quote.payable : 0;
    if (coupon && subtotal < coupon.threshold) return toast('未满足使用门槛');
    this.setData({ couponId: id, showCoupons: false });
    this.quote();
  },

  onSchedule(e) { this.setData({ scheduleIndex: Number(e.detail.value) }); },
  onPhone(e) { this.setData({ phone: e.detail.value }); },
  onNote(e) { this.setData({ note: e.detail.value }); },

  async submit() {
    const { quote, phone, submitting, addressId, addresses } = this.data;
    if (!quote || submitting) return;
    if (!isMobilePhone(phone)) return toast('请填写有效的 11 位手机号');
    if (!addressId) {
      toast(addresses.length ? '请选择收货地址' : '请先添加收货地址');
      if (!addresses.length) this.chooseAddress();
      return;
    }
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
          addressId,
        },
      });
      app.clearCart();
      invalidateBootstrap();
      wx.redirectTo({ url: `/pages/order-detail/order-detail?id=${data.order.id}` });
    } catch (error) {
      this.setData({ submitting: false });
      toast(`下单失败：${error.message}`);
    }
  },

  goMenu() { wx.navigateBack({ fail: () => wx.redirectTo({ url: '/pages/menu/menu' }) }); },
});
