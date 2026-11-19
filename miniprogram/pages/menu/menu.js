const { money, toast } = require('../../utils/format');
const { getBootstrap } = require('../../utils/bootstrap');
const { storeShareMessage } = require('../../utils/share');

Page({
  data: {
    loading: true,
    error: '',
    store: null,
    categories: [],
    products: [],
    list: [],
    qtyMap: {},
    cat: 'recommend',
    keyword: '',
    title: '推荐',
    count: 0,
    totalText: '0.00',
    bagItems: [],
    showBag: false,
    showStore: false,
    detail: null,
    showRegister: false,
    nickname: '',
    registering: false,
    isMember: false,
    memberLabel: '',
    hoursText: '',
    storeClosed: false,
  },

  onLoad() { return this.load(); },

  onShow() {
    if (!this.data.loading && !this.data.error && this.data.products.length) this.syncCart();
  },

  onShareAppMessage() { return storeShareMessage(); },

  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const data = await getBootstrap({ force: true, allowGuest: true });
      const loggedOut = Boolean(wx.getStorageSync('ruyiLoggedOut'));
      const user = loggedOut ? null : data.user;
      const rate = Number(user?.member?.rate) || 1;
      const isMember = Boolean(user?.phone && user?.member?.level);
      const memberLabel = isMember ? (user.member.name || '会员') : '';
      const hours = data.store?.hours || {};
      const hoursText = hours.open && hours.close ? `${hours.open} - ${hours.close}` : '';
      const products = data.products.map((p) => {
        const listPrice = Number(p.oldPrice);
        const unitPrice = Math.round(listPrice * rate * 100) / 100;
        return Object.assign({}, p, {
          isMember,
          unitPrice,
          priceText: money(unitPrice),
          listPriceText: money(listPrice),
          showListStrike: isMember && unitPrice < listPrice,
          showMemberHint: !isMember,
          memberHintText: '绑定手机号享会员价',
          cover: (p.imageUrl && String(p.imageUrl).trim()) || '/images/empty/goods.png',
        });
      });
      this.setData({
        loading: false,
        store: data.store,
        categories: data.categories,
        products,
        isMember,
        memberLabel,
        hoursText,
        storeClosed: data.store && data.store.accepting === false,
      });
      this.refreshList();
      this.syncCart();
    } catch (error) {
      this.setData({ loading: false, error: error.message || '网络异常，请重试' });
    }
  },

  refreshList(patch = {}) {
    const state = Object.assign({}, this.data, patch);
    const keyword = state.keyword.trim();
    const list = state.products.filter((p) => (
      keyword ? `${p.name}${p.description}`.includes(keyword) : state.cat === 'recommend' || p.categoryId === state.cat
    ));
    const category = state.categories.find((c) => c.id === state.cat);
    this.setData(Object.assign(patch, {
      list,
      title: keyword ? `搜索“${keyword}”` : (category ? category.label : '推荐'),
    }));
  },

  syncCart() {
    const cart = getApp().globalData.cart;
    const qtyMap = Object.assign({}, cart);
    const bagItems = this.data.products.filter((p) => qtyMap[p.id]).map((p) => Object.assign({}, p, { qty: qtyMap[p.id] }));
    const count = bagItems.reduce((s, p) => s + p.qty, 0);
    const total = bagItems.reduce((s, p) => s + p.qty * p.unitPrice, 0);
    const detail = this.data.detail
      ? Object.assign({}, this.data.detail, { qty: qtyMap[this.data.detail.id] || 0 })
      : null;
    this.setData({
      qtyMap,
      bagItems,
      count,
      detail,
      totalText: money(total),
      showBag: this.data.showBag && count > 0,
    });
  },

  pickCat(e) { this.refreshList({ cat: e.currentTarget.dataset.id, keyword: '' }); },

  onSearch(e) {
    const keyword = e.detail.value;
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.refreshList({ keyword }), 150);
  },

  toggleStore() { this.setData({ showStore: !this.data.showStore }); },

  add(e) { getApp().updateCart(e.currentTarget.dataset.id, 1); this.syncCart(); },
  remove(e) { getApp().updateCart(e.currentTarget.dataset.id, -1); this.syncCart(); },

  openDetail(e) {
    const product = this.data.products.find((p) => p.id === e.currentTarget.dataset.id);
    this.setData({ detail: Object.assign({}, product, { qty: this.data.qtyMap[product.id] || 0 }) });
  },
  closeDetail() { this.setData({ detail: null }); },
  addFromDetail() {
    getApp().updateCart(this.data.detail.id, 1);
    this.setData({ detail: null });
    this.syncCart();
  },

  openBag() { this.syncCart(); this.setData({ showBag: true }); },
  closeBag() { this.setData({ showBag: false }); },
  clearBag() { getApp().clearCart(); this.syncCart(); this.setData({ showBag: false }); },
  noop() {},

  goCheckout() {
    if (!this.data.count) return;
    if (this.data.storeClosed) return toast(this.data.store.notice || '门店暂停接单');
    if (wx.getStorageSync('ruyiLoggedOut') || !getApp().globalData.token) {
      this.setData({ showBag: false });
      wx.navigateTo({ url: '/pages/auth/auth' });
      return;
    }
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
    const { request } = require('../../utils/request');
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
