# 如一商务餐 · 本地前端复刻

这是根据当前微信小程序运行界面制作的本地前端原型，包含：首页、底部导航、点餐分类、商品详情、加购/减购、购物袋抽屉、确认订单和“我的”页面。

## 运行

```bash
npm install
# 终端 1：启动 API（默认 8787 端口，数据写入 data/ruyi.db）
npm run api

# 终端 2：启动前端（默认 5173 端口，/api 会被 Vite 代理到 8787）
npm run dev
```

浏览器打开终端输出的本地地址即可。商户后台（电脑端）在 `http://127.0.0.1:5173/admin.html`，说明见 [src/admin/README.md](src/admin/README.md)。生产构建：`npm run build`。

## 后端（Node.js + SQLite）

需要 Node.js 22.13+（使用内置 `node:sqlite`，无需额外数据库或依赖）。数据保存在 `data/ruyi.db`，重启不丢失；部署与备份见 [DEPLOYMENT.md](DEPLOYMENT.md)。

| 命令 | 作用 |
| --- | --- |
| `npm run api` | 启动 API（自动读取 `.env`） |
| `npm run admin:create -- boss` | 创建商户管理员（提示输入密码） |
| `npm run admin:password -- boss` | 重置管理员密码 |
| `npm run db:backup` | 在线备份数据库到 `data/backups/` |
| `npm test` | 全部冒烟测试（顾客链路、商户端、持久化、微信登录与支付 v3） |

代码结构：`server/config.mjs` 配置校验 · `db.mjs` 表结构与迁移 · `services.mjs` 业务逻辑 · `routes-public.mjs` 顾客接口 · `admin.mjs` 商户接口 · `wechat-auth.mjs` 微信登录 · `wechat-pay.mjs` 微信支付 v3 · `app.mjs` 组装、安全头、定时任务。

### 顾客接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查（含数据库） |
| GET | `/api/bootstrap` | 门店、分类、商品、当前用户、订单 |
| GET | `/api/products?category=&q=` | 商品筛选（仅上架商品） |
| POST | `/api/auth/login` | `wx.login` code 换会话，可带 `inviterId`；mock 下 `mock:<名字>` 模拟不同用户 |
| POST | `/api/auth/phone` | 手机号授权 code 绑定手机号 |
| POST | `/api/auth/logout` | 退出登录 |
| GET / DELETE | `/api/me` | 当前用户 / 注销账号（匿名化，订单保留用于对账） |
| POST | `/api/session/register` | 注册昵称 |
| POST | `/api/cart/quote` | 询价（会员折扣、优惠券） |
| GET / POST | `/api/orders` | 我的订单 / 下单 |
| GET | `/api/orders/:id?sync=1` | 订单详情；`sync=1` 时向微信支付查单 |
| POST | `/api/orders/:id/pay` | 支付：mock 直接成功；wechat 返回 `payment`（传给 `wx.requestPayment`） |
| POST | `/api/orders/:id/cancel` | 顾客取消（商家接单前），已支付自动退款 |
| POST | `/api/pay/notify` | 微信支付 / 退款回调（验签 + 解密） |
| GET | `/api/coupons?status=` | 券包 |
| POST | `/api/coupons/:id/gift` · `/api/coupons/redeem` | 转赠 / 兑换码领取 |
| GET | `/api/membership` · `/api/points` | 会员等级 · 积分明细 |
| GET | `/api/invite` · `/api/partner` | 推荐朋友 · 共享合伙人 |
| GET / POST / DELETE | `/api/addresses[/:id]` | 收货地址 |

### 商户接口（`Authorization: Bearer <管理员 token>`）

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/admin/login` · `/logout` · `/password` | 登录（限流防爆破）/ 退出 / 改密码 |
| GET | `/api/admin/dashboard` | 今日订单数、营业额、待接单、近 7 天趋势 |
| GET | `/api/admin/orders?status=&date=&q=&since=&page=` | 全店订单；用上次返回的 `serverTime` 作 `since` 轮询新订单 |
| GET | `/api/admin/orders/:id` | 订单详情与支付事件 |
| POST | `/api/admin/orders/:id/accept` · `/complete` · `/cancel` · `/refund` | 接单 / 出餐完成 / 取消并退款 / 重试退款 |
| GET | `/api/admin/orders/export.csv?from=&to=` | 导出对账 CSV（Excel 可直接打开） |
| GET / POST / PUT / DELETE | `/api/admin/products[/:id]` | 商品管理（价格、上下架、排序） |
| GET / POST / PUT / DELETE | `/api/admin/categories[/:id]` | 分类管理 |
| GET · PUT | `/api/admin/settings` · `/api/admin/settings/:key` | 门店（电话、营业时间、暂停接单）、会员等级、积分规则、邀新奖励、合伙人佣金 |
| GET | `/api/admin/customers?q=` · `/api/admin/customers/:id` | 顾客列表 / 详情 |
| POST | `/api/admin/customers/:id/coupons` | 给顾客发券 |
| GET | `/api/admin/audit` | 操作日志 |
| POST | `/api/admin/backup` | 立即备份数据库 |

订单状态：`pending_payment` 待支付 → `paid` 待接单 → `preparing` 备餐中 → `completed` 已完成；`cancelled` 已取消（`refundStatus`：待退款 / 退款中 / 已退款 / 退款失败）。

会员与价格：商品 `oldPrice` 为原价，结算按会员等级折扣（绑定手机号=白银 98 折，累计实付满 888=黄金 95 折，满 2888=钻石 9 折），满减券门槛按会员价计算。等级、积分由已支付订单实时计算，取消后自动回退。

微信授权适配层位于 `server/wechat-auth.mjs`。本地默认 `WECHAT_AUTH_MODE=mock`，可以用任意非空测试 code 验证流程；正式环境设置服务器端 `WECHAT_AUTH_MODE=wechat`、`WECHAT_APPID` 和 `WECHAT_APPSECRET`，再由原生小程序调用 `wx.login` 和手机号授权接口，把 code 交给服务端。AppSecret 永远不要写入 `VITE_*` 变量或提交到 GitHub。

若要让浏览器访问已部署的后端，复制 `.env.example` 为 `.env.local`，填写 `VITE_API_BASE_URL`；本地开发保持为空即可使用 Vite 代理。

本地默认使用 mock 登录与 mock 支付，数据为演示数据；正式上线需要的 AppID、商户号、证书与服务器配置见 [DEPLOYMENT.md](DEPLOYMENT.md)。
