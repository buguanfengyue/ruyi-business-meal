const { request } = require('../../utils/request');
const { toast } = require('../../utils/format');

Page({
  data: { addresses: [], loading: true, editing: false, form: { name: '', phone: '', detail: '' }, saving: false },

  onShow() { this.load(); },

  async load() {
    try {
      const data = await request('/api/addresses');
      this.setData({ addresses: data.addresses, loading: false });
    } catch (error) {
      this.setData({ loading: false });
      toast(error.message);
    }
  },

  startAdd() { this.setData({ editing: true, form: { name: '', phone: '', detail: '' } }); },
  cancelAdd() { this.setData({ editing: false }); },
  onInput(e) { this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value }); },

  importWechat() {
    wx.chooseAddress({
      success: async (res) => {
        const detail = [res.provinceName, res.cityName, res.countyName, res.detailInfo].filter(Boolean).join('');
        this.setData({
          editing: true,
          form: { name: res.userName || '', phone: res.telNumber || '', detail },
        });
        toast('已填入微信地址，请确认后保存');
      },
      fail: (err) => {
        if (err && /cancel|deny|auth/i.test(err.errMsg || '')) return;
        toast('无法打开微信地址');
      },
    });
  },

  async save() {
    this.setData({ saving: true });
    try {
      await request('/api/addresses', { method: 'POST', data: this.data.form });
      this.setData({ editing: false, saving: false });
      toast('地址已保存');
      this.load();
    } catch (error) {
      this.setData({ saving: false });
      toast(error.message);
    }
  },

  remove(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除地址',
      content: '确定删除该地址吗？',
      success: async ({ confirm }) => {
        if (!confirm) return;
        try {
          await request(`/api/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' });
          this.load();
        } catch (error) {
          toast(error.message);
        }
      },
    });
  },
});
