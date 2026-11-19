const { request } = require('../../utils/request');
const { formatTime, toast } = require('../../utils/format');
const { isLoggedOutError, goLogin } = require('../../utils/auth');

Page({
  data: { data: null, needLogin: false, loading: true },
  async onShow() {
    try {
      const data = await request('/api/points');
      data.records = data.records.map((r) => Object.assign({}, r, { timeText: formatTime(r.at) }));
      this.setData({ data, needLogin: false, loading: false });
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
  open(e) { wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` }); },
});
