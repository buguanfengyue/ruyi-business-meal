const { request } = require('../../utils/request');
const { toast } = require('../../utils/format');
const { isLoggedOutError, goLogin, isMobilePhone } = require('../../utils/auth');

Page({
  data: {
    addresses: [],
    loading: true,
    editing: false,
    form: { name: '', phone: '', detail: '' },
    saving: false,
    selectMode: false,
    needLogin: false,
  },

  onLoad(query) {
    this.selectMode = query.select === '1';
    this.setData({ selectMode: this.selectMode });
    if (this.selectMode) wx.setNavigationBarTitle({ title: '选择收货地址' });
  },

  onShow() { this.load(); },

  async load() {
    try {
      const data = await request('/api/addresses');
      this.setData({ addresses: data.addresses, loading: false, needLogin: false });
    } catch (error) {
      if (isLoggedOutError(error)) {
        this.setData({ loading: false, needLogin: true, addresses: [] });
        return;
      }
      this.setData({ loading: false });
      toast(error.message);
    }
  },

  goAuth() { goLogin(); },

  pick(e) {
    if (!this.data.selectMode) return;
    const id = e.currentTarget.dataset.id;
    try {
      const channel = this.getOpenerEventChannel && this.getOpenerEventChannel();
      if (channel) channel.emit('selectAddress', { id });
    } catch (_) { /* opened without event channel */ }
    wx.navigateBack();
  },

  startAdd() { this.setData({ editing: true, form: { name: '', phone: '', detail: '' } }); },
  cancelAdd() { this.setData({ editing: false }); },
  onInput(e) { this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value }); },

  importWechat() {
    wx.chooseAddress({
      success: (res) => {
        const detail = [res.provinceName, res.cityName, res.countyName, res.detailInfo].filter(Boolean).join('');
        const phone = String(res.telNumber || '').trim();
        this.setData({
          editing: true,
          form: { name: res.userName || '', phone: isMobilePhone(phone) ? phone : '', detail },
        });
        toast(isMobilePhone(phone) ? '已填入微信地址，请确认后保存' : '已填入地址，请补全 11 位手机号后保存');
      },
      fail: (err) => {
        if (err && /cancel|deny|auth/i.test(err.errMsg || '')) return;
        toast('无法打开微信地址，请确认已在隐私指引中声明「地址」');
      },
    });
  },

  async save() {
    if (!isMobilePhone(this.data.form.phone)) return toast('请提供有效的 11 位手机号');
    this.setData({ saving: true });
    try {
      const data = await request('/api/addresses', { method: 'POST', data: this.data.form });
      this.setData({ editing: false, saving: false });
      toast('地址已保存');
      await this.load();
      if (this.data.selectMode && data.address) {
        try {
          const channel = this.getOpenerEventChannel && this.getOpenerEventChannel();
          if (channel) channel.emit('selectAddress', { id: data.address.id });
        } catch (_) { /* ignore */ }
        wx.navigateBack();
      }
    } catch (error) {
      this.setData({ saving: false });
      if (isLoggedOutError(error)) {
        this.setData({ needLogin: true });
        goLogin();
        return;
      }
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
