const { request, ensureLogin } = require('../../utils/request');
const { money, maskPhone, toast } = require('../../utils/format');

Page({
  data: {
    user: null,
    avatarText: '未',
    phoneText: '',
    balanceText: '0.00',
    rows: [],
    showRegister: false,
    nickname: '',
    registering: false,
  },

  onShow() { this.load(); },

  async load() {
    try {
      await ensureLogin();
      const { user } = await request('/api/me');
      getApp().setUser(user);
      this.present(user);
    } catch (error) {
      toast(error.message);
    }
  },

  present(user) {
    this.setData({
      user,
      avatarText: user.registered ? user.nickname.slice(0, 1) : '未',
      phoneText: maskPhone(user.phone),
      memberName: (user.member && user.member.name) || '会员中心',
      storePhone: getApp().globalData.storePhone,
      balanceText: money(user.balance),
      rows: [
        { title: '我的积分', value: `${user.points || 0}分`, url: '/pages/points/points' },
        { title: '我的订单', value: '', url: '/pages/orders/orders', tab: true },
        { title: '我的券包', value: user.availableCoupons ? `${user.availableCoupons}张可用` : '', url: '/pages/coupons/coupons' },
        { title: '我的预约', value: '', url: '/pages/bookings/bookings' },
        { title: '我的地址', value: '', url: '/pages/addresses/addresses' },
        { title: '我的分销', value: '', url: '/pages/partner/partner' },
        { title: '微信授权 / 手机号', value: user.phone ? '' : '未绑定', url: '/pages/auth/auth' },
      ],
    });
  },

  go(e) {
    const { url, tab } = e.currentTarget.dataset;
    if (tab) wx.switchTab({ url });
    else wx.navigateTo({ url });
  },

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
});
