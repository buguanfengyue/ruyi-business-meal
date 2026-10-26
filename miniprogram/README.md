# 原生微信小程序联调壳

这个目录可以直接作为微信开发者工具的小程序项目根目录打开。它不是对原小程序加密包的源码导出，而是自写的原生实现，与 Web 复刻版共用同一套 API。

## 页面

| 页面 | 说明 |
| --- | --- |
| `pages/home` | 首页（tabBar），账户卡、外卖订餐入口、功能宫格 |
| `pages/menu` | 点单：分类、搜索、门店信息、商品详情、购物袋、注册弹层 |
| `pages/checkout` | 确认订单：地址、电话、预约时间、备注、优惠券、实时询价 |
| `pages/orders` | 订单列表（tabBar） |
| `pages/order-detail` | 订单详情：模拟支付、取消、再来一单 |
| `pages/me` | 我的（tabBar）：注册、会员、余额、各入口、联系商家 |
| `pages/member` | 会员中心：白银/黄金/钻石等级卡、权益、开通条件、会员说明 |
| `pages/partner` | 共享合伙人（我的分销 / 首页共享股东）：佣金、提现、邀请列表 |
| `pages/invite` | 推荐朋友：邀新券说明，`open-type="share"` 分享带 `inviter` 参数 |
| `pages/coupons` | 券包：可使用/已使用/不可用/已赠送，转赠（分享或兑换码）、兑换码领取 |
| `pages/points` / `pages/bookings` | 我的积分、我的预约 |
| `pages/addresses` | 收货地址管理 |
| `pages/info` | 尚未定义业务规则的入口占位页 |
| `pages/auth` | 微信登录 / 手机号授权调试页 |

「联系商家」统一调用 `app.callStore()` → `wx.makePhoneCall`，真机会直接拉起系统拨号界面并填好号码（微信规定需用户在拨号界面确认拨出）。号码来自 `/api/bootstrap` 的 `store.phone`。

启动时 `utils/request.js` 的 `ensureLogin()` 自动 `wx.login` 换取服务端会话；token 过期时请求会自动重新登录一次。

## 打开方式

1. 安装微信开发者工具。
2. 导入本目录：`outputs/ruyi-replica/miniprogram`。
3. 在 `project.config.json` 填入你拥有权限的 AppID；不能由代码自动生成新的 AppID，需要在微信公众平台/小程序后台创建或绑定。
4. 本地模拟器测试时，`config/env.js` 默认请求 `http://127.0.0.1:8787`，并在开发者工具中关闭“校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书”。
5. 真机或体验版测试必须改成已备案/可访问的 HTTPS API 域名，并把域名加入小程序后台的 request 合法域名；不能依赖手机上的 `127.0.0.1`。

## 授权流程

- `pages/auth/auth.js` 调用 `wx.login`，把临时 code 发给 `/api/auth/login`。
- 用户点击手机号按钮后，`event.detail.code` 发给 `/api/auth/phone`，服务端再调用微信手机号接口。
- 服务端 session token 保存在小程序本地 storage；AppSecret 只存在云端环境变量。

## 当前本地 API

```text
http://127.0.0.1:8787/api/health
http://127.0.0.1:8787/api/auth/config
```

正式环境切换在 API 服务端设置 `WECHAT_AUTH_MODE=wechat`、`WECHAT_APPID` 和 `WECHAT_APPSECRET`；小程序端只需要更新 `config/env.js` 的 `apiBase`。
