# 上线部署指南（如一商务餐）

## 一、推荐架构

```text
微信小程序 ──HTTPS──▶ nginx (api.example.com, 已备案) ──▶ Node API :8787 ──▶ SQLite 文件 data/ruyi.db
商户后台网页 ─HTTPS─▶ 同一 nginx（同域名，免跨域）              └─ 每日备份 data/backups/
微信支付 ──回调──▶ https://api.example.com/api/pay/notify
```

- **开发**：在自己电脑上运行，`WECHAT_AUTH_MODE=mock`、`PAYMENT_MODE=mock`，数据写入 `data/ruyi.db`。
- **正式**：放到国内云服务器（例如腾讯云轻量应用服务器 2核2G，Ubuntu 22.04+）。不要用家用电脑对外服务：没有固定公网 IP、80/443 常被封、无法备案、断电/休眠会丢单和漏收支付回调。
- **数据库**：单店规模 SQLite 足够（单文件、零运维）。需要多台服务器或多门店时再迁移到 MySQL/PostgreSQL（数据访问集中在 `server/services.mjs`、`server/admin.mjs`）。

## 二、上线前需要准备（只能由你本人办理）

| 事项 | 用途 | 对应配置 |
| --- | --- | --- |
| 小程序 AppID + AppSecret（你有管理员权限） | 微信登录、手机号授权 | `WECHAT_APPID` `WECHAT_APPSECRET` |
| 云服务器 + 域名 + ICP 备案 + HTTPS 证书 | 小程序只能访问已备案 HTTPS 域名 | `deploy/nginx.conf` |
| 小程序后台「request 合法域名」填 `https://api.example.com` | 允许小程序请求 API | 小程序后台 |
| 微信支付商户号，并与小程序 AppID 关联 | 收款、退款 | `WECHATPAY_MCHID` |
| 商户 API 证书私钥 `apiclient_key.pem` 和证书序列号 | 请求签名 | `WECHATPAY_PRIVATE_KEY_PATH` `WECHATPAY_CERT_SERIAL` |
| APIv3 密钥（32 位） | 回调解密 | `WECHATPAY_APIV3_KEY` |
| 微信支付公钥 + 公钥 ID（PUB_KEY_ID_…） | 验证微信支付响应与回调 | `WECHATPAY_PUBLIC_KEY_PATH` `WECHATPAY_PUBLIC_KEY_ID` |
| 小程序隐私保护指引（手机号、地址、位置等） | 审核要求 | 小程序后台 |
| 营业执照、食品经营许可证 | 小程序类目与商户号审核 | 微信后台 |

## 三、服务器部署步骤

```bash
# 1. 安装 Node.js 22.13+ 与 nginx，创建运行用户和目录
sudo useradd --system --home /srv/ruyi ruyi
sudo mkdir -p /srv/ruyi /etc/ruyi && sudo chown ruyi /srv/ruyi

# 2. 上传代码（不要上传 data/、.env、证书），安装依赖并构建前端
cd /srv/ruyi && npm ci && npm run build

# 3. 配置环境变量（参考 .env.example），证书放在只有 ruyi 用户可读的位置
sudo cp .env.example /etc/ruyi/ruyi.env && sudo chmod 600 /etc/ruyi/ruyi.env
#    NODE_ENV=production  WECHAT_AUTH_MODE=wechat  PAYMENT_MODE=wechat  TRUST_PROXY=1 ...

# 4. 创建商户管理员（会提示输入密码；商户后台地址为 https://api.example.com/admin.html）
sudo -u ruyi env $(cat /etc/ruyi/ruyi.env | xargs) node scripts/admin.mjs create boss

# 5. 启动服务和每日备份
sudo cp deploy/ruyi-api.service deploy/ruyi-backup.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ruyi-api ruyi-backup.timer

# 6. 配置 nginx 与 HTTPS 证书
sudo cp deploy/nginx.conf /etc/nginx/sites-enabled/ruyi.conf && sudo nginx -t && sudo systemctl reload nginx
curl https://api.example.com/api/health
```

生产环境下若仍是 mock 登录或 mock 支付，服务会**拒绝启动**（防止误上线）；内部测试确需时设置 `ALLOW_MOCK_IN_PRODUCTION=1`。

## 四、数据与备份

- 所有数据在 `DATABASE_PATH`（默认 `data/ruyi.db`）。金额以“分”整数存储。
- `npm run db:backup`：在线备份到 `data/backups/`，自动做完整性校验，保留最近 14 份（`BACKUP_KEEP`）。
- **务必把备份再复制到服务器之外**（如腾讯云 COS 对象存储或你的电脑），服务器损坏时才能恢复。
- 恢复：停服务 → 用备份文件替换 `data/ruyi.db`（同时删除 `ruyi.db-wal`、`ruyi.db-shm`）→ 启动。
- 商户后台也可调用 `POST /api/admin/backup` 立即备份。

## 五、订单与支付流程

1. 顾客下单 → `pending_payment`（待支付），生成当天取餐号。
2. `POST /api/orders/:id/pay`：mock 模式直接支付成功；wechat 模式返回 `payment` 参数，小程序调用 `wx.requestPayment(payment)`。
3. 微信支付回调 `/api/pay/notify` 验签、解密、核对金额后才标记为 `paid`（待接单）。小程序支付完成后请求 `GET /api/orders/:id?sync=1`，回调延迟时服务端主动查单。
4. 商户后台：接单 → `preparing`（备餐中）→ 完成 → `completed`。
5. 未支付超过 `ORDER_PAY_TIMEOUT_MINUTES` 自动关单取消；顾客在接单前可取消，商户可取消任意未完成订单，已支付订单自动发起退款，失败的退款每分钟重试并可在后台手动重试。

## 六、上线前检查清单

- [ ] `npm test` 全部通过
- [ ] 服务器 `NODE_ENV=production`，`/api/health` 显示 `auth.mode=wechat`、`payment=wechat`
- [ ] 小程序真机：登录、手机号授权、下单、支付 0.01 元测试商品、退款均成功
- [ ] 商户后台能看到新订单并完成接单/出餐/退款
- [ ] 每日备份已生成，且已同步到服务器之外
- [ ] 小程序隐私协议、用户协议、账号注销入口（`DELETE /api/me`）已配置

## 七、尚未实现（需要业务确认后再做）

- 共享合伙人佣金提现：需开通「商家转账到零钱」，目前接口返回未配置；佣金比例默认 0。
- 余额充值、积分商城、订阅消息通知（需申请模板）、配送范围与配送费、库存。
- 商户后台中标注“演示数据”的页面（见 src/admin/README.md）。
