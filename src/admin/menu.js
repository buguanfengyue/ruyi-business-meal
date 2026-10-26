import {BarChart3, Briefcase, ShoppingBag, FileText, UserRoundSearch, LayoutPanelLeft, MessageCircle, Image, LayoutGrid, Box, UserCog, Lightbulb, Network} from 'lucide-react';

// Sidebar groups in the same order as the original merchant console.
// `crumb: false` means the group name is not shown in the breadcrumb.
export const MENU = [
  {key: 'data', label: '运营数据', icon: BarChart3, crumb: false, children: [
    ['数据分析', '/index'], ['销售汇总', '/sale'], ['营业报表', '/report'], ['桌台统计', '/tableStatistics'], ['余额统计', '/balanceStatistics'], ['提成统计', '/commissionStatistics'],
  ]},
  {key: 'tool', label: '经营工具', icon: Briefcase, children: [
    ['收银管理', '/tool/cashier'], ['桌台管理', '/tool/table'], ['代客下单', '/tool/Instead'], ['挂账管理', '/tool/charge_account'], ['交接班', '/tool/shift_handover'],
  ]},
  {key: 'goods', label: '商品管理', icon: ShoppingBag, children: [
    ['分类设置', '/goods/classify'], ['商品列表', '/goods/goodsManage'], ['库存预警', '/goods/inventoryAlert'], ['规格模板', '/goods/option_template'],
    ['必点商品', '/goods/goodsMust'], ['进销存', '/goods/stock'], ['标签管理', '/goods/goods_label'], ['单位管理', '/goods/goodsUnits'],
  ]},
  {key: 'order', label: '订单列表', icon: FileText, path: '/order/list'},
  {key: 'user', label: '用户列表', icon: UserRoundSearch, path: '/user/userlist'},
  {key: 'setting', label: '配置管理', icon: LayoutPanelLeft, children: [
    ['小程序管理', '/setting/auth'], ['门店设置', '/setting/storeSetting'], ['订单提醒', '/setting/inform'], ['小程序助手', '/setting/helper'],
    ['界面设置', '/setting/newhome'], ['系统设置', '/setting/minigram'], ['第三方配送', '/setting/threePartyDelivery/deliverySettings'],
    ['打印机设置', '/setting/printlist'], ['桌码生成', '/setting/qrCode'], ['大屏幕管理', '/setting/screen'], ['开发配置', '/setting/development'],
  ]},
  {key: 'brand', label: '微信支付品牌', icon: MessageCircle, path: '/weChatPayBrand/index', color: '#2bad5b'},
  {key: 'ad', label: '轮播广告', icon: Image, path: '/ad/adTop'},
  {key: 'market', label: '营销管理', icon: LayoutGrid, path: '/market/index', color: '#e6a23c'},
  {key: 'app', label: '应用中心', icon: Box, path: '/application/index'},
  {key: 'worker', label: '员工管理', icon: UserCog, path: '/worker/list'},
  {key: 'assist', label: '辅助功能', icon: Lightbulb, children: [
    ['客服设置', '/assist/customer'], ['物流助手', '/assist/express'], ['订单来源码', '/assist/derived'], ['生成小程序码', '/assist/applet'],
    ['生成Short Link', '/assist/shortLink'], ['生成Url Link', '/assist/urlLike'], ['外部业务域名', '/assist/domain'],
  ]},
  {key: 'device', label: '设备', icon: Network, path: '/device/index'},
];

/** Which menu group a path belongs to (for highlighting and breadcrumbs). */
export function findMenu(path) {
  for (const group of MENU) {
    if (group.path === path) return {group, item: null};
    const item = group.children?.find(([, p]) => p === path);
    if (item) return {group, item};
  }
  if (path.startsWith('/market/')) return {group: MENU.find((g) => g.key === 'market'), item: null};
  if (path.startsWith('/goods/')) return {group: MENU.find((g) => g.key === 'goods'), item: null};
  return {group: null, item: null};
}
