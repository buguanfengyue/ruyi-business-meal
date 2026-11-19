// Placeholder pages for entries whose business rules are not defined yet.
const PAGES = {
  wechat: {
    title: '老板微信',
    text: '扫码添加老板微信，咨询团餐、包月与发票事宜。',
    image: '/images/ui/boss-wechat-qr.jpg',
    imageMode: 'aspectFit',
  },
  mall: {
    title: '积分商城',
    text: '积分商城尚未上架商品，下单累计的积分会保留。',
    image: '/images/ui/feature-points.png',
    imageMode: 'aspectFit',
  },
  recharge: {
    title: '余额充值',
    text: '充值需要接入微信支付商户号，本地 mock 环境不支持真实充值。',
    image: '/images/ui/logo.png',
    imageMode: 'aspectFit',
  },
};

Page({
  data: { title: '', text: '', icon: '', image: '', imageMode: 'aspectFit' },
  onLoad(query) {
    const info = PAGES[query.kind] || {
      title: '功能建设中',
      text: '该功能暂未开放。',
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
