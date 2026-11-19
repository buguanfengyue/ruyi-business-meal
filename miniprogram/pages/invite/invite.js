const { request } = require('../../utils/request');
const { money, formatTime, toast } = require('../../utils/format');
const { inviteShareMessage } = require('../../utils/share');

const present = (rows) => rows.map((r) => Object.assign({}, r, { commissionText: money(r.commission), timeText: formatTime(r.invitedAt) }));
const reward = (r) => Object.assign({}, r, { amountText: money(r.amount), thresholdText: money(r.threshold) });

Page({
  data: { data: null, tab: 0, rows: [] },

  async onShow() {
    try {
      const data = await request('/api/invite');
      data.newUserReward = reward(data.newUserReward);
      data.inviterReward = reward(data.inviterReward);
      data.invited = present(data.invited);
      data.invalid = present(data.invalid);
      this.setData({ data, rows: this.data.tab === 0 ? data.invited : data.invalid });
    } catch (error) {
      toast(error.message);
    }
  },

  pickTab(e) {
    const tab = Number(e.currentTarget.dataset.tab);
    this.setData({ tab, rows: tab === 0 ? this.data.data.invited : this.data.data.invalid });
  },

  // open-type="share" 会打开微信原生「选择发送给谁」面板。
  onShareAppMessage() {
    return inviteShareMessage(this.data.data && this.data.data.inviterId);
  },
});
