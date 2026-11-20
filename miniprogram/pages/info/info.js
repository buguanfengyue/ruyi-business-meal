const PAGES = {
  wechat: {
    title: '老板微信',
    text: '点击预览或长按识别二维码，添加老板微信。',
    image: '/images/ui/boss-wechat-qr.jpg',
    imageMode: 'aspectFit',
  },
};

Page({
  data: { title: '', text: '', icon: '', image: '', imageMode: 'aspectFit' },
  onLoad(query) {
    const info = PAGES[query.kind] || {
      title: '功能暂未开放',
      text: '该功能暂未开放，如有需要请联系商家。',
      image: '/images/empty/content.png',
      imageMode: 'aspectFit',
    };
    wx.setNavigationBarTitle({ title: info.title });
    this.setData({
      title: info.title,
      text: info.text,
      icon: info.icon || '',
      image: info.image || '',
      imageMode: info.imageMode || 'aspectFit',
    });
  },

  previewQr() {
    if (!this.data.image) return;
    wx.previewImage({ urls: [this.data.image], current: this.data.image });
  },
});
