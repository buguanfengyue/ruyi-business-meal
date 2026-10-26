const env = require('./config/env');

App({
  globalData: {
    apiBase: env.apiBase,
    authMode: env.mode,
    token: '',
    user: null,
    // { [productId]: quantity }, shared by menu/checkout and persisted.
    cart: {},
    // Set when the app is opened from a friend's invite share.
    inviterId: '',
    storePhone: '15805320100',
  },

  onLaunch(options) {
    this.globalData.inviterId = (options && options.query && options.query.inviter) || '';
    this.globalData.token = wx.getStorageSync('ruyiToken') || '';
    this.globalData.user = wx.getStorageSync('ruyiUser') || null;
    this.globalData.cart = wx.getStorageSync('ruyiCart') || {};
  },

  onShow(options) {
    // Hot start from a share card: remember the inviter for the next login.
    const inviter = options && options.query && options.query.inviter;
    if (inviter) this.globalData.inviterId = inviter;
  },

  setSession(token, user) {
    this.globalData.token = token || '';
    wx.setStorageSync('ruyiToken', this.globalData.token);
    if (user) this.setUser(user);
  },

  setUser(user) {
    this.globalData.user = user;
    wx.setStorageSync('ruyiUser', user);
  },

  updateCart(productId, delta) {
    const cart = Object.assign({}, this.globalData.cart);
    const next = Math.min(99, Math.max(0, (cart[productId] || 0) + delta));
    if (next) cart[productId] = next;
    else delete cart[productId];
    this.globalData.cart = cart;
    wx.setStorageSync('ruyiCart', cart);
    return cart;
  },

  /** 联系商家: opens the system dialer with the store number pre-filled. */
  callStore() {
    const phoneNumber = this.globalData.storePhone;
    wx.makePhoneCall({
      phoneNumber,
      fail(err) {
        // User tapped cancel in the dialer sheet: nothing to do.
        if (err && /cancel/.test(err.errMsg || '')) return;
        wx.setClipboardData({ data: phoneNumber });
      },
    });
  },

  clearCart() {
    this.globalData.cart = {};
    wx.setStorageSync('ruyiCart', {});
  },
});
