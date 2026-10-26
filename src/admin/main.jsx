import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import Layout from './Layout';
import {ToastHost, ConfirmHost} from './ui';
import {api, session, onUnauthorized} from './api';
import {findMenu} from './menu';
import {useRoute, go} from './router';
import {Dashboard, Sale, Report, TableStatistics, BalanceStatistics, CommissionStatistics} from './pages/data';
import {Cashier, TableManage, Instead, ChargeAccount, ShiftHandover} from './pages/tools';
import {Classify, GoodsManage, GoodsAdd, InventoryAlert, OptionTemplate, GoodsMust, Stock, GoodsLabel, GoodsUnits} from './pages/goods';
import {OrderList, UserList} from './pages/orders';
import {MiniAuth, StoreSetting, Inform, Helper, NewHome, MiniGram, Delivery, PrintList, QrCodePage, Screen, Development} from './pages/setting';
import {Customer, Express, Derived, Applet, ShortLink, UrlLink, Domain} from './pages/assist';
import {WeChatPayBrand, AdTop, Market, MarketTicket, MarketTopup, MarketMember, MarketDistribution, MarketFeature, Application, AppDetail, Worker, Device, Login} from './pages/misc';
import './admin.css';

// path -> [component, page title used in the breadcrumb]
const ROUTES = {
  '/index': [Dashboard, '数据分析'], '/sale': [Sale, '销售汇总'], '/report': [Report, '营业报表'], '/tableStatistics': [TableStatistics, '桌台统计'],
  '/balanceStatistics': [BalanceStatistics, '余额统计'], '/commissionStatistics': [CommissionStatistics, '提成统计'],
  '/tool/cashier': [Cashier, '收银管理'], '/tool/table': [TableManage, '桌台管理'], '/tool/Instead': [Instead, '代客下单'], '/tool/charge_account': [ChargeAccount, '挂账管理'], '/tool/shift_handover': [ShiftHandover, '交接班'],
  '/goods/classify': [Classify, '分类设置'], '/goods/goodsManage': [GoodsManage, '商品列表'], '/goods/goodsAdd': [GoodsAdd, '添加商品'], '/goods/inventoryAlert': [InventoryAlert, '库存预警'],
  '/goods/option_template': [OptionTemplate, '规格模板'], '/goods/goodsMust': [GoodsMust, '必点商品'], '/goods/stock': [Stock, '进销存'], '/goods/goods_label': [GoodsLabel, '标签管理'], '/goods/goodsUnits': [GoodsUnits, '单位管理'],
  '/order/list': [OrderList, '订单列表'], '/user/userlist': [UserList, '用户列表'],
  '/setting/auth': [MiniAuth, '小程序管理'], '/setting/storeSetting': [StoreSetting, '门店设置'], '/setting/inform': [Inform, '订单提醒'], '/setting/helper': [Helper, '小程序助手'],
  '/setting/newhome': [NewHome, '界面设置'], '/setting/minigram': [MiniGram, '系统设置'], '/setting/threePartyDelivery/deliverySettings': [Delivery, '配送设置', ['第三方配送']],
  '/setting/printlist': [PrintList, '打印机设置'], '/setting/qrCode': [QrCodePage, '桌码生成'], '/setting/screen': [Screen, '大屏幕管理'], '/setting/development': [Development, '开发配置'],
  '/weChatPayBrand/index': [WeChatPayBrand, '微信支付品牌'], '/ad/adTop': [AdTop, '轮播广告'],
  '/market/index': [Market, '营销管理'], '/market/ticket': [MarketTicket, '优惠券'], '/market/topup': [MarketTopup, '充值设置'], '/market/member': [MarketMember, '会员'],
  '/market/distribution': [MarketDistribution, '分销功能'], '/market/feature': [MarketFeature, null],
  '/application/index': [Application, '应用中心'], '/application/app': [AppDetail, null, ['应用中心']], '/worker/list': [Worker, '员工管理'], '/device/index': [Device, '设备'],
  '/assist/customer': [Customer, '客服设置'], '/assist/express': [Express, '物流助手'], '/assist/derived': [Derived, '订单来源码'], '/assist/applet': [Applet, '生成小程序码'],
  '/assist/shortLink': [ShortLink, '生成Short Link'], '/assist/urlLike': [UrlLink, '生成Url Link'], '/assist/domain': [Domain, '外部业务域名'],
};

// Pages wired to the backend in phase 2; every other page still shows demo data.
const LIVE = new Set(['/index', '/sale', '/report', '/goods/classify', '/goods/goodsManage', '/goods/goodsAdd', '/goods/inventoryAlert', '/order/list', '/user/userlist',
  '/setting/storeSetting', '/setting/inform', '/setting/development', '/market/ticket', '/market/member', '/market/distribution']);

function crumbsFor(path, query, title, extra = []) {
  if (path === '/index') return [];
  const {group} = findMenu(path);
  const pageTitle = title ?? query.name ?? '';
  const groupLabel = group && group.children && group.crumb !== false ? [group.label] : path.startsWith('/market/') && path !== '/market/index' ? ['营销管理'] : path === '/market/index' ? ['营销管理'] : [];
  return [...groupLabel, ...extra, path === '/goods/goodsAdd' && query.action === 'edit' ? '编辑商品' : pageTitle];
}

function App() {
  const {path, query} = useRoute();
  const [user, setUser] = useState(() => (session.token() ? session.user() : null));
  useEffect(() => { document.title = '如一商务餐 - 商家管理'; onUnauthorized(() => setUser(null)); }, []);
  useEffect(() => {
    if (!user && path !== '/login') go('/login');
    if (user && path === '/login') go('/index');
  }, [user, path]);

  const login = async (username, password) => {
    const data = await api.login(username, password);
    session.set(data.token, data.admin.username);
    setUser(data.admin.username);
    go('/index');
  };
  const logout = async () => {
    await api.logout().catch(() => {});
    session.clear();
    setUser(null);
    go('/login');
  };

  if (!user || path === '/login') return <><Login onLogin={login} /><ToastHost /></>;
  const [Page, title, extra] = ROUTES[path] || [() => <div className="ad-card"><div className="empty">页面不存在：{path}</div></div>, '页面不存在'];
  return (
    <>
      <Layout path={path} crumbs={crumbsFor(path, query, title, extra)} onLogout={logout} user={user} demo={!LIVE.has(path) && !(path === '/market/feature' && query.name === '邀请裂变') && Boolean(ROUTES[path])}>
        <Page key={`${path}?${new URLSearchParams(query)}`} query={query} />
      </Layout>
      <ToastHost /><ConfirmHost />
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
