/**
 * Seed data for the local 如一商务餐 API.
 *
 * This deliberately contains only synthetic/demo data. It is not copied from
 * the original mini-program backend and must be replaced by an authorised
 * data source before any public deployment.
 */

export const seedData = {
  store: {
    id: 'ruyi-demo-store',
    name: '如一商务餐',
    distanceText: '距离 1743.2km',
    fulfillmentModes: ['delivery'],
    phone: '15805320100',
  },
  categories: [
    { id: 'recommend', label: '推荐', emoji: '' },
    { id: 'a', label: '38元A套餐', emoji: '🍕' },
    { id: 'soup', label: '例汤', emoji: '🍲' },
  ],
  products: [
    {
      id: 'a',
      categoryId: 'a',
      name: '38元A套餐：三荤三素+两主食',
      price: 37.24,
      oldPrice: 38,
      description: '我们的服务目标：为白衣天使提供营养、健康、美味',
      emoji: '🍕',
      available: true,
    },
    {
      id: 'b',
      categoryId: 'a',
      name: '58元套餐：三荤三素+一汤+两主食',
      price: 56.84,
      oldPrice: 58,
      description: '我们的服务目标：为白衣天使提供营养、健康、美味',
      emoji: '🍲',
      available: true,
    },
    {
      id: 'c',
      categoryId: 'a',
      name: '38元A套餐：三荤三素+两主食',
      price: 37.24,
      oldPrice: 38,
      description: '我们的服务目标：为白衣天使提供营养、健康、美味',
      emoji: '🍖',
      available: true,
    },
    {
      id: 'd',
      categoryId: 'soup',
      name: '松茸鸡汤',
      price: 27.44,
      oldPrice: 28,
      description: '每日现熬例汤，暖胃又营养',
      emoji: '🥣',
      available: true,
    },
  ],
  user: {
    id: 'demo-user',
    nickname: '未授权',
    phone: '15805320100',
    registered: false,
    balance: 0,
    points: 0,
    availableCoupons: 2,
  },
  orders: [],
};

/** Make a fresh in-memory state for every server instance/test process. */
export function createState() {
  return structuredClone(seedData);
}

