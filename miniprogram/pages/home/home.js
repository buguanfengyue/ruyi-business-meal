const { maskPhone } = require('../../utils/format');
const { getBootstrap } = require('../../utils/bootstrap');
const { inviteShareMessage, storeShareMessage } = require('../../utils/share');

Page({
  data: {
    loading: true,
    error: '',
    user: getApp().globalData.user || null,
    store: null,
    phoneText: '未绑定手机号',
  },

  onShow() { this.load(); },

  onPullDownRefresh() {
    this.load(true).finally(() => wx.stopPullDownRefresh());
  },

  onShareAppMessage(e) {
    if (e.from === 'button' && e.target && e.target.dataset && e.target.dataset.share === 'invite') {
      return inviteShareMessage();
    }
    return storeShareMessage();
  },

  async load(force) {
    this.setData({ error: '' });
    try {
      const data = await getBootstrap({ force: Boolean(force), allowGuest: true });
      const loggedOut = Boolean(wx.getStorageSync('ruyiLoggedOut'));
      this.setData({
        loading: false,
        user: loggedOut ? null : data.user,
        store: data.store,
        phoneText: loggedOut
          ? '未登录'
          : (data.user && data.user.phone ? maskPhone(data.user.phone) : '未绑定手机号'),
      });
    } catch (error) {
      this.setData({ loading: false, error: error.message || '网络异常，请重试' });
    }
  },

  goMenu() { wx.navigateTo({ url: '/pages/menu/menu' }); },
  goMe() { wx.switchTab({ url: '/pages/me/me' }); },
  goInfo(e) { wx.navigateTo({ url: `/pages/info/info?kind=${e.currentTarget.dataset.kind}` }); },
  goPage(e) { wx.navigateTo({ url: e.currentTarget.dataset.url }); },
  goInvitePage() { wx.navigateTo({ url: '/pages/invite/invite' }); },
  callStore() { getApp().callStore(); },
});
