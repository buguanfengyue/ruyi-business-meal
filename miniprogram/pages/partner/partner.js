const { request } = require('../../utils/request');
const { money, formatTime, toast } = require('../../utils/format');

const present = (rows) => rows.map((r) => Object.assign({}, r, { commissionText: money(r.commission), timeText: formatTime(r.invitedAt) }));

Page({
  data: { data: null, tab: 0, rows: [] },

  async onShow() {
    try {
      const data = await request('/api/partner');
      data.invited = present(data.invited);
      data.invalid = present(data.invalid);
      data.text = { withdrawable: money(data.withdrawable), total: money(data.totalIncome), pending: money(data.pending) };
      this.setData({ data, rows: this.data.tab === 0 ? data.invited : data.invalid });
    } catch (error) {
      toast(error.message);
    }
  },

  pickTab(e) {
    const tab = Number(e.currentTarget.dataset.tab);
    this.setData({ tab, rows: tab === 0 ? this.data.data.invited : this.data.data.invalid });
  },

  showRules() {
    const { rules, commissionRate } = this.data.data;
    wx.showModal({ title: '共享合伙人规则', content: commissionRate ? rules : `${rules}\n\n（佣金比例尚未配置，当前暂不产生佣金）`, showCancel: false });
  },

  invite() { wx.navigateTo({ url: '/pages/invite/invite' }); },

  async withdraw() {
    try {
      await request('/api/partner/withdraw', { method: 'POST' });
    } catch (error) {
      toast(error.message);
    }
  },

  income() { toast(this.data.data.totalIncome > 0 ? '收入明细见下方粉丝列表' : '暂无收入明细'); },
});
