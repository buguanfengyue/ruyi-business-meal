const { request } = require('../../utils/request');
const { formatTime } = require('../../utils/format');
const { isLoggedOutError, goLogin } = require('../../utils/auth');

Page({
  data: { data: null, needLogin: false, loading: true, error: '' },
  onShow() { return this.load(); },
  async load() {
    if (!this.data.data) this.setData({ loading: true, error: '' });
    else this.setData({ error: '' });
    try {
      const data = await request('/api/points');
      data.records = data.records.map((r) => Object.assign({}, r, { timeText: formatTime(r.at) }));
      this.setData({ data, needLogin: false, loading: false, error: '' });
    } catch (error) {
      if (isLoggedOutError(error)) {
        this.setData({ needLogin: true, data: null, loading: false, error: '' });
        return;
      }
      this.setData({ loading: false, error: error.message || '网络异常，请重试' });
    }
  },
  goAuth() { goLogin(); },
  open(e) { wx.navigateTo({ url: `/pages/order-detail/order-detail?id=${e.currentTarget.dataset.id}` }); },
});
