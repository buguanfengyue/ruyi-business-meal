const { request } = require('../../utils/request');
const { money, formatTime, toast } = require('../../utils/format');

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

  // The "邀请好友" button uses open-type="share"; the new user opens the
  // home page with ?inviter=<id> and the server rewards both on first login.
  onShareAppMessage() {
    const inviterId = this.data.data ? this.data.data.inviterId : '';
    return {
      title: '送你一张10元邀新券，来如一商务餐点餐吧',
      path: `/pages/home/home?inviter=${encodeURIComponent(inviterId)}`,
    };
  },
});
