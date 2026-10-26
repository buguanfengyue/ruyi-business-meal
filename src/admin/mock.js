// Demo data for the phase-1 admin front end. All customer records are
// synthetic; replace every export with API calls when wiring the backend.

export const STORE = {name: '如一商务餐', branch: '主店', expire: '2027-04-17', phone: '15805320100'};

export const CATEGORIES = [
  {id: 831611, name: '推荐', icon: ''},
  {id: 831612, name: '了解我们', icon: ''},
  {id: 831613, name: '38元A套餐', icon: '🍱'},
  {id: 831614, name: '38元B套餐', icon: '🍱'},
  {id: 831615, name: '58元套餐', icon: '🍱'},
  {id: 831616, name: '例汤', icon: '🍲'},
  {id: 831617, name: '水果沙拉', icon: '🥗'},
  {id: 831618, name: '安慕希', icon: '🥛'},
];

export const PRODUCTS = [
  {id: 8039593, name: '安慕希', price: 10, category: '安慕希', emoji: '🥛', desc: '', sales: 0, on: true},
  {id: 8039592, name: '水果沙拉', price: 18, category: '水果沙拉', emoji: '🥗', desc: '', sales: 0, on: true},
  {id: 8039591, name: '招牌水果捞', price: 28, category: '水果沙拉', emoji: '🍉', desc: '', sales: 0, on: true},
  {id: 8039589, name: '例汤（原价6元，现3元特惠，5份以上随套餐起购）', price: 3, category: '例汤', emoji: '🍲', desc: '', sales: 0, on: true},
  {id: 8039588, name: '58元套餐：三荤三素+一汤+两主食', price: 58, category: '58元套餐', emoji: '🍱', desc: '我们的服务目标：为白衣天使提供营养、健康、安全、多样的美食和优质的服务', sales: 0, on: true},
  {id: 8039587, name: '38元B套餐：三荤三素+两主食', price: 38, category: '38元B套餐', emoji: '🍱', desc: '我们的服务目标：为白衣天使提供营养、健康、安全、多样的美食和优质的服务', sales: 0, on: true},
  {id: 8039586, name: '38元A套餐：三荤三素+两主食', price: 38, category: '38元A套餐', emoji: '🍱', desc: '我们的服务目标：为白衣天使提供营养、健康、安全、多样的美食和优质的服务', sales: 0, on: true},
  {id: 8039585, name: '我们的服务目标', price: 0, category: '了解我们', emoji: '📄', desc: '', sales: 0, on: true},
  {id: 8039584, name: '我们的资质', price: 0, category: '了解我们', emoji: '📄', desc: '', sales: 0, on: true},
  {id: 8039583, name: '松茸鸡汤', price: 28, category: '例汤', emoji: '🥣', desc: '每日现熬例汤，暖胃又营养', sales: 0, on: true},
];

const names = ['微信用户', '张先生', '李女士', '王同学', '赵医生', '陈护士', '刘老师', '周女士', '吴先生', '郑先生'];
export const USERS = Array.from({length: 10}, (_, i) => ({
  id: 198434456 - i * 236711,
  nickname: names[i],
  gender: '未知',
  balance: 0,
  points: i === 2 ? 20 : 0,
  phone: i === 2 || i === 5 ? `1380000${String(1000 + i).slice(-4)}` : '',
  member: i === 2 || i === 5 ? '白银会员' : '',
  coupons: i % 3 === 1 ? 1 : 0,
  spent: 0,
  monthSpent: 0,
  stamps: 0,
  created: `2026-${String(10 - Math.floor(i / 3)).padStart(2, '0')}-${String(14 - i).padStart(2, '0')} 1${i}:2${i}:00`,
  expire: i === 2 || i === 5 ? '永久有效' : '非会员',
  version: '7.8.9',
}));

export const ORDERS = [
  {id: 'RY20261014A1B2C3D4', items: [['38元A套餐：三荤三素+两主食', 38, 2], ['松茸鸡汤', 28, 1]], pickup: 1, table: '-', total: 101.92, discount: 2.08, info: '外卖 · 预约 12:00', type: '外卖', source: '小程序', status: '支付成功', user: '张先生', time: '2026-10-14 12:21:05'},
  {id: 'RY20261014E5F6A7B8', items: [['58元套餐：三荤三素+一汤+两主食', 58, 1]], pickup: 2, table: '儿科1', total: 56.84, discount: 1.16, info: '堂食', type: '堂食', source: '扫码点餐', status: '待完成', user: '李女士', time: '2026-10-14 11:48:30'},
  {id: 'RY20261013C9D0E1F2', items: [['水果沙拉', 18, 1]], pickup: 5, table: '-', total: 18, discount: 0, info: '自取', type: '自取', source: '小程序', status: '已取消/撤单', user: '王同学', time: '2026-10-13 18:02:11'},
];

export const AREAS = ['市立医院（本部）', '市立医院（东院）', '青医附院（崂山院区）', '青医附院（西海岸）', '中心医院（本部）', '其他', '测试桌不做'];
export const TABLES = [
  ['内分泌科1', 0], ['儿科1', 0], ['内科2', 1], ['儿科2', 1], ['内分泌科3', 2], ['儿科3', 2], ['中医科4', 3], ['儿科5', 4], ['测试桌不做', 6],
].map(([name, area], i) => ({id: i + 1, name, area: AREAS[area], seats: 1, used: 0}));

export const UNITS = ['件', '包', '公斤', '斤', '千克', '杯', '瓶', '个', '份', '袋'].map((name, i) => ({id: 185572 + i, name}));

export const COUPONS = [
  {id: 240193, name: '18元充值券', rule: '满200.00元减18.00元', type: '店铺领取可用', expire: '领券后365天过期', way: '无', stock: '10000/10000', got: 0, used: 0},
  {id: 240191, name: '10元邀新券', rule: '满100.00元减10.00元', type: '店铺领取可用', expire: '领券后30天过期', way: '无', stock: '9992/10000', got: 8, used: 1},
  {id: 240190, name: '10元新人券', rule: '满100.00元减10.00元', type: '店铺领取可用', expire: '领券后7天过期', way: 'auto', stock: '9994/10000', got: 6, used: 0},
];

export const TOPUP = [[86751, 200, 20, 2], [86752, 500, 60, 4], [86753, 800, 100, 6], [86754, 1000, 200, 8]].map(([id, amount, bonus, coupons]) => ({id, amount, bonus, coupons}));

// Report columns copied in order from the original 营业报表 header.
export const REPORT_COLUMNS = '总访客 新访客 总收款 微信实际到账 支付宝实际到账 线下实际到账 余额实际到账(包含赠送) 余额实际到账(不包含赠送) 赠送余额到账 订单实收 订单总数 订单总额 订单微信支付额 订单支付宝支付额 订单余额支付额 订单线下支付额 促销活动优惠金额 京东秒送丨营业额 京东秒送丨订单笔数 京东秒送丨订单实付 京东秒送丨退款金额 京东秒送丨优惠金额 京东秒送丨订单实收 京东秒送丨配送费 美团退款金额 美团团购|营业额 美团团购|实收金额 美团团购|订单数 美团代金券总金额 美团代金券实收净额 美团买单实收金额 美团商品券总金额 美团商品券实收净额 抖音团购|团购实付 抖音团购|核销总数 抖音团购|核销减免 抖音团购|小程序核销量 抖音团购|小程序兑换余额 抖音团购|小程序兑换优惠券(张) 支付宝团购笔数 支付宝团购营业额 支付宝团购实收金额 支付宝团购减免金额 订单退款成功数 订单退款成功额 微信退款金额 支付宝退款金额 余额退款金额 线下退款金额 堂食订单数 堂食订单额 自取订单数 自取订单额 外卖订单数 外卖订单额 快递订单数 快递订单额 满减金额 积分抵扣金额 优惠券抵扣金额 会员抵扣金额 堂食退款金额 堂食实际收入 外卖实际收入 外卖退款金额 自取退款金额 自取实际收入 配送费收入 配送费退款金额 配送费实际收入 挂账金额 挂账退款 挂账还款金额 挂账还款数 包装费收入 商家减免金额 开通会员数 开通会员收入 用户充值数 用户充值额 用户充值赠送额 用户充值退款金额 微信充值额 支付宝充值额 代客充值额 代客充值赠送额 代客充值数 后台充值数 后台充值额 后台充值赠送额 后台余额扣款 收银笔数 收银金额 微信收银金额 余额收银金额 支付宝收银金额 线下收银金额 收银退款金额 收银微信退款金额 收银余额退款金额 收银支付宝退款金额 收银线下退款金额 积分商城收入 积分商城订单数 积分商城微信收入 积分商城余额收入 分销员开通收入 分销员开通订单数 礼品卡收入 退礼品卡金额 礼品卡订单数 预约订座收入 预约订座数 预约订座退款额 预约订座退款数'.split(' ');

export const DAYS = Array.from({length: 14}, (_, i) => {
  const day = String(14 - i).padStart(2, '0');
  return {date: `2026-10-${day}`, visitors: [3, 1, 0, 2, 1, 1, 0, 0, 0, 0, 1, 0, 1, 0][i], fresh: [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0][i]};
});

// Mini-program page paths shown on 开发配置 / 生成小程序码 (our own mini-program).
export const MP_PATHS = [
  ['首页', 'pages/home/home'], ['点餐(默认)', 'pages/menu/menu'], ['确认订单', 'pages/checkout/checkout'], ['我的订单', 'pages/orders/orders'],
  ['订单详情', 'pages/order-detail/order-detail?id=订单号'], ['个人中心', 'pages/me/me'], ['会员中心', 'pages/member/member'], ['我的优惠券', 'pages/coupons/coupons'],
  ['优惠券领取(可带兑换码)', 'pages/coupons/coupons?claim=兑换码'], ['我的积分', 'pages/points/points'], ['我的预约', 'pages/bookings/bookings'], ['我的地址', 'pages/addresses/addresses'],
  ['邀请奖励', 'pages/invite/invite'], ['共享合伙人', 'pages/partner/partner'], ['微信授权', 'pages/auth/auth'],
];
