const { request } = require('../../utils/request');
const { money, maskPhone, toast } = require('../../utils/format');
const { getBootstrap, invalidateBootstrap } = require('../../utils/bootstrap');

const SCHEDULES = ['尽快送达', '11:30', '12:00', '12:30', '17:30', '18:00'];

function cartEmpty() {
  return !Object.keys(getApp().globalData.cart || {}).length;
}

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
    empty: cartEmpty(),
    submitLabel: '确认下单',
  },

  onLoad() {
    const user = getApp().globalData.user || {};
    this.setData({ phone: user.phone || '', empty: cartEmpty() });
    getBootstrap().then((data) => this.setData({ store: data.store })).catch(() => {});
    request('/api/coupons').then((data) => {
      this.setData({ coupons: data.coupons.filter((c) => c.status === 'available') });
      this.updateCouponText();
    }).catch(() => {});
  },

  onShow() {
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
    const { addresses } = this.data;
    if (!addresses.length) return wx.navigateTo({ url: '/pages/addresses/addresses' });
    wx.showActionSheet({
      itemList: addresses.map((a) => `${a.name} ${a.detail}`.slice(0, 30)).concat('+ 新增地址', '从微信导入地址'),
      success: ({ tapIndex }) => {
        if (tapIndex === addresses.length) wx.navigateTo({ url: '/pages/addresses/addresses' });
        else if (tapIndex === addresses.length + 1) this.importWechatAddress();
        else this.pickAddress(addresses[tapIndex].id);
      },
    });
  },

  importWechatAddress() {
    wx.chooseAddress({
      success: async (res) => {
        try {
          const detail = [res.provinceName, res.cityName, res.countyName, res.detailInfo].filter(Boolean).join('');
          const data = await request('/api/addresses', {
            method: 'POST',
            data: { name: res.userName, phone: res.telNumber, detail },
          });
          const list = await request('/api/addresses');
          this.setData({ addresses: list.addresses });
          const created = data.address || list.addresses.find((a) => a.detail === detail) || list.addresses[0];
          if (created) this.pickAddress(created.id);
          toast('已导入微信地址');
        } catch (error) {
          toast(error.message || '导入失败');
        }
      },
      fail: (err) => {
        if (err && /cancel|deny|auth/i.test(err.errMsg || '')) return;
        toast('无法打开微信地址');
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
    const { quote, phone, submitting, addressId, addresses } = this.data;
    if (!quote || submitting) return;
    if (!/^1\d{10}$/.test(phone)) return toast('请填写有效的 11 位手机号');
    if (!addressId) {
      toast(addresses.length ? '请选择收货地址' : '请先添加收货地址');
      if (!addresses.length) wx.navigateTo({ url: '/pages/addresses/addresses' });
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
