const { request } = require('../../utils/request');
const { money, formatDateTime, toast } = require('../../utils/format');

const TABS = [{ id: 'available', label: '可使用' }, { id: 'used', label: '已使用' }, { id: 'unavailable', label: '不可用' }, { id: 'gifted', label: '已赠送' }];

Page({
  data: { tabs: TABS, tab: 'available', all: [], list: [], loading: true, open: {}, redeeming: false, code: '', giftCode: '' },

  onLoad(query) {
    // Opened from a friend's gift share card: claim it automatically.
    if (query.claim) this.claimCode = query.claim;
  },

  async onShow() {
    await this.load();
    if (this.claimCode) {
      const code = this.claimCode;
      this.claimCode = '';
      this.redeem(code);
    }
  },

  async load() {
    try {
      const data = await request('/api/coupons');
      const all = data.coupons.map((c) => Object.assign({}, c, {
        amountText: money(c.amount),
        thresholdText: money(c.threshold),
        range: `${formatDateTime(c.validFrom)} - ${formatDateTime(c.validTo)}`,
      }));
      this.setData({ all, loading: false });
      this.filter();
    } catch (error) {
      this.setData({ loading: false });
      toast(error.message);
    }
  },

  filter() { this.setData({ list: this.data.all.filter((c) => c.status === this.data.tab) }); },
  pickTab(e) { this.setData({ tab: e.currentTarget.dataset.id }); this.filter(); },
  toggleRule(e) { const id = e.currentTarget.dataset.id; this.setData({ [`open.${id}`]: !this.data.open[id] }); },
  use() { wx.navigateTo({ url: '/pages/menu/menu' }); },

  gift() {
    const available = this.data.all.filter((c) => c.status === 'available');
    if (!available.length) return toast('没有可转赠的优惠券');
    wx.showActionSheet({
      itemList: available.map((c) => `${c.title}（满${c.threshold}减${c.amount}）`),
      success: async ({ tapIndex }) => {
        try {
          const data = await request(`/api/coupons/${available[tapIndex].id}/gift`, { method: 'POST' });
          this.setData({ giftCode: data.giftCode });
          await this.load();
        } catch (error) {
          toast(error.message);
        }
      },
    });
  },
  closeGift() { this.setData({ giftCode: '' }); },
  copyGift() { wx.setClipboardData({ data: this.data.giftCode }); },

  // Share card for a gifted coupon; the friend's coupons page claims it.
  onShareAppMessage(e) {
    const code = (e.target && e.target.dataset.code) || this.data.giftCode;
    return { title: '送你一张如一商务餐优惠券', path: `/pages/coupons/coupons?claim=${code}` };
  },

  openRedeem() { this.setData({ redeeming: true, code: '' }); },
  closeRedeem() { this.setData({ redeeming: false }); },
  onCode(e) { this.setData({ code: e.detail.value }); },
  noop() {},
  async redeem(codeArg) {
    const code = (typeof codeArg === 'string' ? codeArg : this.data.code).trim();
    if (!code) return toast('请输入兑换码');
    try {
      await request('/api/coupons/redeem', { method: 'POST', data: { code } });
      this.setData({ redeeming: false, tab: 'available' });
      await this.load();
      toast('领取成功');
    } catch (error) {
      toast(error.message);
    }
  },
});
