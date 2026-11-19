const { request } = require('../../utils/request');
const { money, formatTime, toast } = require('../../utils/format');
const { inviteShareMessage } = require('../../utils/share');
const { isLoggedOutError, goLogin } = require('../../utils/auth');

const present = (rows) => rows.map((r) => Object.assign({}, r, { commissionText: money(r.commission), timeText: formatTime(r.invitedAt) }));
const reward = (r) => Object.assign({}, r, { amountText: money(r.amount), thresholdText: money(r.threshold) });

Page({
  data: { data: null, tab: 0, rows: [], needLogin: false, loading: true },

  async onShow() {
    try {
      const data = await request('/api/invite');
      data.newUserReward = reward(data.newUserReward);
      data.inviterReward = reward(data.inviterReward);
      data.invited = present(data.invited);
      data.invalid = present(data.invalid);
      this.setData({ data, rows: this.data.tab === 0 ? data.invited : data.invalid, needLogin: false, loading: false });
    } catch (error) {
      if (isLoggedOutError(error)) {
        this.setData({ needLogin: true, data: null, loading: false });
        return;
      }
      this.setData({ loading: false });
      toast(error.message);
    }
  },

  goAuth() { goLogin(); },

  pickTab(e) {
    const tab = Number(e.currentTarget.dataset.tab);
    this.setData({ tab, rows: tab === 0 ? this.data.data.invited : this.data.data.invalid });
  },

  onShareAppMessage() {
    return inviteShareMessage(this.data.data && this.data.data.inviterId);
  },
});
