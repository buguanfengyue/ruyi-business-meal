# 如一商务餐 · 本地前端复刻

这是根据当前微信小程序运行界面制作的本地前端原型，包含：首页、底部导航、点餐分类、商品详情、加购/减购、购物袋抽屉、确认订单和“我的”页面。

## 运行

```bash
npm install
# 终端 1：启动本地 mock API（默认 8787 端口）
npm run api

# 终端 2：启动前端（默认 5173 端口，/api 会被 Vite 代理到 8787）
npm run dev
```

浏览器打开终端输出的本地地址即可。生产构建：`npm run build`。

## 本地 API

本地 API 使用 Node.js 原生 HTTP，无需额外后端依赖。接口返回的数据均为合成 mock 数据，服务重启后会重置，不会读取微信登录态、支付凭证或原小程序接口。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/bootstrap` | 首页、分类、商品、用户、订单和运行配置的一次性数据 |
| GET | `/api/products?category=a&q=套餐` | 商品筛选 |
| GET | `/api/me` | 当前本地用户 |
| GET | `/api/orders` | 本地订单列表 |
| GET | `/api/orders/:id` | 本地订单详情 |
| GET | `/api/auth/config` | 当前授权模式（不返回 AppSecret） |
| POST | `/api/auth/login` | 接收 `wx.login` code，开发环境返回 mock session |
| POST | `/api/auth/phone` | 接收手机号授权 code，开发环境绑定 mock 手机号 |
| POST | `/api/cart/quote` | 校验购物袋并计算金额 |
| POST | `/api/session/register` | 本地注册（仅更新 mock 用户） |
| POST | `/api/orders` | 创建本地模拟订单 |

创建订单示例：

```json
{
  "items": [{"productId": "a", "quantity": 1}],
  "customer": {"phone": "15805320100", "nickname": "本地用户"},
  "fulfillment": "delivery",
  "note": "少放餐具"
}
```

接口契约和校验逻辑位于 `server/mock-server.mjs`。可运行冒烟测试：

```bash
npm run test:api
npm run test:auth
```

微信授权适配层位于 `server/wechat-auth.mjs`。本地默认 `WECHAT_AUTH_MODE=mock`，可以用任意非空测试 code 验证流程；正式环境设置服务器端 `WECHAT_AUTH_MODE=wechat`、`WECHAT_APPID` 和 `WECHAT_APPSECRET`，再由原生小程序调用 `wx.login` 和手机号授权接口，把 code 交给服务端。AppSecret 永远不要写入 `VITE_*` 变量或提交到 GitHub。

若要让浏览器访问已部署的后端，复制 `.env.example` 为 `.env.local`，填写 `VITE_API_BASE_URL`；本地开发保持为空即可使用 Vite 代理。

当前订单、用户、支付、定位和商品数据均为本地 mock；未复用微信登录态、支付凭证或接口密钥。真实业务接入前，需要合法的后端接口、商品图和微信开发者工具项目配置。
