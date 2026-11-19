const PAGES = {
  wechat: {
    title: '老板微信',
    text: '扫码添加老板微信，咨询团餐、包月与发票事宜。',
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
});
