const { request } = require('../../utils/request');
const { money, toast } = require('../../utils/format');

const CROWNS = ['#c9d1dc', '#f3c64b', '#8fd14f'];

Page({
  data: { loading: true, levels: [], current: 0, member: null, phoneBound: false, pointsRule: '', view: null },

  onShow() { this.load(); },

  async load() {
    try {
      const data = await request('/api/membership');
      const { member } = data;
      const levels = data.levels.map((l, i) => Object.assign({}, l, {
        crown: CROWNS[i],
        stateText: member.level === l.level ? '当前等级' : member.level > l.level ? '已达到该等级' : '未达到该等级',
        footText: member.level >= l.level ? '已开通此VIP特权' : '暂未开通此VIP特权',
        reached: member.level >= l.level,
        gapText: money(Math.max(0, l.minSpent - member.totalSpent)),
      }));
      const current = this.data.loading ? Math.max(0, member.level - 1) : this.data.current;
      this.setData({ loading: false, levels, member, phoneBound: data.phoneBound, pointsRule: data.pointsRule, spentText: money(member.totalSpent), current });
      this.pick(current);
    } catch (error) {
      toast(error.message);
    }
  },

  pick(index) { this.setData({ current: index, view: this.data.levels[index] }); },
  onSwipe(e) { this.pick(e.detail.current); },

  showRule(e) {
    const level = this.data.levels[e.currentTarget.dataset.index];
    wx.showModal({ title: `${level.name}升级说明`, content: level.rule, showCancel: false });
  },

  // 白银会员 = bound phone; the auth page hosts the getPhoneNumber button.
  bindPhone() { wx.navigateTo({ url: '/pages/auth/auth' }); },
});
