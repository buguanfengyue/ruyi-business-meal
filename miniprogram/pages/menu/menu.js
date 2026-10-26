const { request, ensureLogin } = require('../../utils/request');
const { money, toast } = require('../../utils/format');

Page({
  data: {
    store: null,
    categories: [],
    products: [],
    list: [],
    cat: 'recommend',
    keyword: '',
    title: '推荐',
    cart: {},
    count: 0,
    totalText: '0.00',
    bagItems: [],
    showBag: false,
    showStore: false,
    detail: null,
    showRegister: false,
    nickname: '',
    registering: false,
  },

  async onLoad() {
    try {
      await ensureLogin();
      const data = await request('/api/bootstrap');
      getApp().setUser(data.user);
      if (data.store && data.store.phone) getApp().globalData.storePhone = data.store.phone;
      const products = data.products.map((p) => Object.assign({}, p, { priceText: money(p.price) }));
      this.setData({ store: data.store, categories: data.categories, products });
      this.refresh();
    } catch (error) {
      toast(error.message);
    }
  },

  onShow() {
    // The cart may have been cleared by checkout or refilled by "再来一单".
    if (this.data.products.length) this.refresh();
  },

  refresh(patch = {}) {
    const state = Object.assign({}, this.data, patch);
    const cart = getApp().globalData.cart;
    const products = state.products;
    const keyword = state.keyword.trim();
    const list = products
      .filter((p) => (keyword ? `${p.name}${p.description}`.includes(keyword) : state.cat === 'recommend' || p.categoryId === state.cat))
      .map((p) => Object.assign({}, p, { qty: cart[p.id] || 0 }));
    const bagItems = products.filter((p) => cart[p.id]).map((p) => Object.assign({}, p, { qty: cart[p.id] }));
    const count = bagItems.reduce((s, p) => s + p.qty, 0);
    const total = bagItems.reduce((s, p) => s + p.qty * p.price, 0);
    const category = state.categories.find((c) => c.id === state.cat);
    const detail = state.detail ? Object.assign({}, state.detail, { qty: cart[state.detail.id] || 0 }) : null;
    this.setData(Object.assign(patch, {
      cart, list, bagItems, count, detail,
      totalText: money(total),
      title: keyword ? `搜索“${keyword}”` : (category ? category.label : '推荐'),
      showBag: state.showBag && count > 0,
    }));
  },

  pickCat(e) { this.refresh({ cat: e.currentTarget.dataset.id, keyword: '' }); },
  onSearch(e) { this.refresh({ keyword: e.detail.value }); },
  toggleStore() { this.setData({ showStore: !this.data.showStore }); },

  add(e) { getApp().updateCart(e.currentTarget.dataset.id, 1); this.refresh(); },
  remove(e) { getApp().updateCart(e.currentTarget.dataset.id, -1); this.refresh(); },

  openDetail(e) {
    const product = this.data.products.find((p) => p.id === e.currentTarget.dataset.id);
    this.refresh({ detail: product });
  },
  closeDetail() { this.setData({ detail: null }); },
  addFromDetail() {
    getApp().updateCart(this.data.detail.id, 1);
    this.refresh({ detail: null });
  },

  openBag() { this.refresh({ showBag: true }); },
  closeBag() { this.setData({ showBag: false }); },
  clearBag() { getApp().clearCart(); this.refresh({ showBag: false }); },
  noop() {},

  goCheckout() {
    if (!this.data.count) return;
    const user = getApp().globalData.user;
    if (!user || !user.registered) {
      this.setData({ showBag: false, showRegister: true });
      return;
    }
    this.setData({ showBag: false });
    wx.navigateTo({ url: '/pages/checkout/checkout' });
  },

  onNickname(e) { this.setData({ nickname: e.detail.value }); },
  skipRegister() { this.setData({ showRegister: false }); },
  async register() {
    const nickname = this.data.nickname.trim();
    if (!nickname) return toast('请输入昵称');
    this.setData({ registering: true });
    try {
      const data = await request('/api/session/register', { method: 'POST', data: { nickname } });
      getApp().setUser(data.user);
      this.setData({ showRegister: false, registering: false });
      wx.navigateTo({ url: '/pages/checkout/checkout' });
    } catch (error) {
      this.setData({ registering: false });
      toast(error.message);
    }
  },

  callStore() { getApp().callStore(); },
});
