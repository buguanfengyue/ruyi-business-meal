const { request, ensureLogin } = require('../../utils/request');
const { money, maskPhone, toast } = require('../../utils/format');

Page({
  data: {
    user: getApp().globalData.user || null,
    phoneText: '',
    rows: [],
    loggedOut: false,
    error: '',
    showRegister: false,
    nickname: '',
    registering: false,
    memberName: '会员中心',
    storePhone: getApp().globalData.storePhone,
  },

  onShow() { this.load(); },

  async load() {
    this.setData({ error: '' });
    try {
      await ensureLogin();
      const { user } = await request('/api/me');
      getApp().setUser(user);
      this.present(user);
      this.setData({ loggedOut: false });
    } catch (error) {
      if (error.code === 'LOGGED_OUT') {
        this.setData({
          loggedOut: true,
          user: null,
          phoneText: '未登录',
          rows: [],
          memberName: '会员中心',
        });
        return;
      }
      this.setData({ error: error.message || '网络异常' });
      toast(error.message);
    }
  },

  present(user) {
    this.setData({
      user,
      phoneText: maskPhone(user.phone),
      memberName: (user.member && user.member.name) || '会员中心',
      storePhone: getApp().globalData.storePhone,
      rows: [
        { title: '我的积分', value: `${user.points || 0}分`, url: '/pages/points/points', icon: '/images/ui/points.png' },
        { title: '我的订单', value: '', url: '/pages/orders/orders', tab: true, icon: '/images/tab/orders.png' },
        { title: '我的券包', value: user.availableCoupons ? `${user.availableCoupons}张可用` : '', url: '/pages/coupons/coupons', icon: '/images/ui/quan.png' },
        { title: '我的预约', value: '', url: '/pages/bookings/bookings', icon: '/images/ui/location.png' },
        { title: '我的地址', value: '', url: '/pages/addresses/addresses', icon: '/images/ui/location.png' },
        { title: '微信授权 / 手机号', value: user.phone ? '' : '未绑定', url: '/pages/auth/auth', icon: '/images/ui/phone.png' },
      ],
    });
  },

  go(e) {
    const { url, tab } = e.currentTarget.dataset;
    if (tab) wx.switchTab({ url });
    else wx.navigateTo({ url });
  },

  goAuth() { wx.navigateTo({ url: '/pages/auth/auth' }); },

  callStore() { getApp().callStore(); },

  tapProfile() { if (!this.data.user?.registered) this.setData({ showRegister: true }); },
  onNickname(e) { this.setData({ nickname: e.detail.value }); },
  skipRegister() { this.setData({ showRegister: false }); },
  noop() {},

  async register() {
    const nickname = this.data.nickname.trim();
    if (!nickname) return toast('请输入昵称');
    this.setData({ registering: true });
    try {
      const data = await request('/api/session/register', { method: 'POST', data: { nickname } });
      getApp().setUser(data.user);
      this.present(data.user);
      this.setData({ showRegister: false, registering: false });
      toast('注册成功');
    } catch (error) {
      this.setData({ registering: false });
      toast(error.message);
    }
  },

  async logout() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch (_) { /* local clear still needed */ }
    getApp().clearSession();
    getApp().clearCart();
    wx.setStorageSync('ruyiLoggedOut', 1);
    toast('已退出登录');
    this.setData({ user: null, phoneText: '未登录', rows: [], loggedOut: true });
    wx.switchTab({ url: '/pages/home/home' });
  },

  deleteAccount() {
    wx.showModal({
      title: '注销账号',
      content: '注销后将匿名化您的个人信息并清空地址。有未完成订单时无法注销。此操作不可撤销。',
      confirmText: '确认注销',
      confirmColor: '#d91e26',
      success: async ({ confirm }) => {
        if (!confirm) return;
        try {
          await request('/api/me', { method: 'DELETE' });
          getApp().clearSession();
          getApp().clearCart();
          wx.removeStorageSync('ruyiLoggedOut');
          toast('账号已注销');
          wx.switchTab({ url: '/pages/home/home' });
        } catch (error) {
          toast(error.message);
        }
      },
    });
  },
});
