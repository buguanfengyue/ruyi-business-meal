const { request } = require('../../utils/request');
const { formatTime, toast } = require('../../utils/format');

Page({
  data: { data: null },
  async onShow() {
    try {
      const data = await request('/api/points');
      data.records = data.records.map((r) => Object.assign({}, r, { timeText: formatTime(r.at) }));
      this.setData({ data });
    } catch (error) {
      toast(error.message);
    }
  },
  open(e) { wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` }); },
});
