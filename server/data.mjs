/**
 * Initial data written into an empty database.
 *
 * Catalog entries are synthetic/demo values, not copied from the original
 * mini-program backend. The merchant replaces them through the admin API.
 */

export const DEFAULT_SETTINGS = {
  store: {
    id: 'ruyi-store',
    name: '如一商务餐',
    distanceText: '距离 1743.2km',
    phone: '15805320100',
    fulfillmentModes: ['delivery'],
    // Local store time (STORE_TIMEZONE). Open all day until the merchant
    // configures real hours.
    hours: { open: '00:00', close: '24:00' },
    accepting: true,
    notice: '',
  },
  memberLevels: [
    { level: 1, name: '白银会员', rate: 0.98, minSpent: 0, rule: '绑定手机号即成为白银会员，消费享98折' },
    { level: 2, name: '黄金会员', rate: 0.95, minSpent: 888, rule: '消费满888元成为黄金会员，消费享95折' },
    { level: 3, name: '钻石会员', rate: 0.9, minSpent: 2888, rule: '消费满2888元成为钻石会员，消费享90折' },
  ],
  pointsRule: '所有会员消费1元积1分，积分后期可换购商品、优惠券或抵扣现金',
  rewards: {
    newUser: { title: '10元邀新券', amount: 10, threshold: 100, validDays: 30, count: 1 },
    inviter: { title: '10元邀新券', amount: 10, threshold: 100, validDays: 30, count: 1 },
  },
  partner: {
    // Share of an invitee's completed order. 0 until the merchant sets it.
    commissionRate: 0,
    rules: '【赚钱方法】【如何成为共享合伙人】进入小程序或分享店铺给好友或群，即可成为“共享合伙人”，或者将已领到的【优惠券】转发给微信好友或微信群，新用户领券后，凭此券在本店消费，你都可以赚到Ta消费产生的佣金，可直接提现到微信零钱，在家即可轻松躺赚！【如已是合作伙伴，可提现佣金及绑定的好友下方可见】详情可咨询店内人员。',
  },
};

export const DEFAULT_CATEGORIES = [
  { id: 'recommend', label: '推荐', emoji: '', sort: 0 },
  { id: 'a', label: '38元A套餐', emoji: '🍕', sort: 1 },
  { id: 'soup', label: '例汤', emoji: '🍲', sort: 2 },
];

// price = 白银会员价 shown on the menu; listPrice = 原价 used for checkout.
export const DEFAULT_PRODUCTS = [
  { id: 'a', categoryId: 'a', name: '38元A套餐：三荤三素+两主食', price: 37.24, listPrice: 38, description: '我们的服务目标：为白衣天使提供营养、健康、美味', emoji: '🍕' },
  { id: 'b', categoryId: 'a', name: '58元套餐：三荤三素+一汤+两主食', price: 56.84, listPrice: 58, description: '我们的服务目标：为白衣天使提供营养、健康、美味', emoji: '🍲' },
  { id: 'c', categoryId: 'a', name: '38元A套餐：三荤三素+两主食', price: 37.24, listPrice: 38, description: '我们的服务目标：为白衣天使提供营养、健康、美味', emoji: '🍖' },
  { id: 'd', categoryId: 'soup', name: '松茸鸡汤', price: 27.44, listPrice: 28, description: '每日现熬例汤，暖胃又营养', emoji: '🥣' },
];

export const DEMO_USER = { id: 'demo-user', nickname: '未授权', phone: '15805320100' };

/** Seed an empty database. Safe to call on every start. */
export function seedDatabase(db, { demo = false, issueCoupon } = {}) {
  const now = new Date().toISOString();
  db.tx(() => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      db.run('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (:key, :value, :now)', { key, value: JSON.stringify(value), now });
    }
    if (!db.one('SELECT 1 AS x FROM categories LIMIT 1')) {
      for (const c of DEFAULT_CATEGORIES) {
        db.run('INSERT INTO categories (id, label, emoji, sort, created_at) VALUES (:id, :label, :emoji, :sort, :now)', { ...c, now });
      }
      DEFAULT_PRODUCTS.forEach((p, index) => {
        db.run(`INSERT INTO products (id, category_id, name, price_fen, list_price_fen, description, emoji, available, sort, created_at, updated_at)
          VALUES (:id, :categoryId, :name, :price, :listPrice, :description, :emoji, 1, :sort, :now, :now)`,
        { ...p, price: Math.round(p.price * 100), listPrice: Math.round(p.listPrice * 100), sort: index, now });
      });
    }
    if (demo && !db.one('SELECT 1 AS x FROM users WHERE id = :id', { id: DEMO_USER.id })) {
      db.run(`INSERT INTO users (id, nickname, phone, registered, auth_mode, created_at)
        VALUES (:id, :nickname, :phone, 0, 'mock', :now)`, { ...DEMO_USER, now });
      issueCoupon(DEMO_USER.id, DEFAULT_SETTINGS.rewards.newUser, 'invite');
      issueCoupon(DEMO_USER.id, DEFAULT_SETTINGS.rewards.newUser, 'invite');
    }
  });
}
