/** Shared invite / store share card for open-type="share" buttons. */
function inviteShareMessage(inviterId) {
  const id = inviterId || (getApp().globalData.user && getApp().globalData.user.id) || '';
  return {
    title: '送你一张优惠券，来如一商务餐点餐吧',
    path: `/pages/home/home?inviter=${encodeURIComponent(id)}`,
    imageUrl: '/images/ui/invite-banner.jpg',
  };
}

function storeShareMessage() {
  const id = (getApp().globalData.user && getApp().globalData.user.id) || '';
  return {
    title: '如一商务餐 · 营养商务套餐，欢迎点餐',
    path: id ? `/pages/home/home?inviter=${encodeURIComponent(id)}` : '/pages/home/home',
    imageUrl: '/images/ui/logo.png',
  };
}

module.exports = { inviteShareMessage, storeShareMessage };
