# 如一商务餐 · 第四轮复核（提交 `eac06bf`）

复核时间：2026-11-20
代码版本：HEAD `eac06bf` `fix(miniprogram): close round-3 review gaps`
测试结果：

- `npm test` 六组冒烟全部通过。
- `STORE_TIMEZONE=Pacific/Kiritimati npm test` 同样全部通过。
- WXML 标签配对、`bindtap/catchtap` 处理函数存在性、页面引用与 `app.json` 一致性均通过脚本校验（15 个页面，0 处异常）。

---

## 一、第三轮问题确认修复

| 第三轮问题 | 验证结果 |
|---|---|
| P2-1 订单 tab 退出态无登录入口 | 已修。`orders.js` 捕获 `LOGGED_OUT` 后置 `needLogin`，WXML 顶部渲染「登录后查看订单 + 去登录」，标签区包在 `wx:else` 内；同时补了错误态 + 点击重试 |
| P2-2 登录后菜单仍是原价 | 已修。新增 `userKey(user)`（id + phone + registered + member.level），`load()` 成功后记录 `_userKey`；`onShow` 发现 key 变化即整页重载。去授权前还设置了 `_reloadOnShow`，即使登录被取消也会刷新，代价只是一次请求 |
| P3-1 缓存回归测试假通过 | 已修。测试在 logout 后先加载游客首页并断言 `bootstrapCache` 存在、`user` 为 `null`，登录后再断言缓存被清空——现在真正覆盖「游客缓存 → 登录」 |
| P3-2 无效兑换码每次进页面重试 | 已修。仅对 401 保留券码，`status < 500` 的确定性失败清空 `claimCode` |
| P3-3 网络错误停在「加载中…」 | 基本修完。`points` / `invite` / `member` / `coupons` 均增加 `error` 状态与「点击重试」，WXML 条件从 `loading \|\| !data` 拆成 `loading` / `error` / `data` 三段 |
| P3-4 `STORE_HOURS` 生产风险 | 部分修复。`assertStoreOpen` 在 `NODE_ENV=production` 下改为忽略 env 并告警；`parseStoreHours` 增加正则与回退告警。**但种子数据仍会读取 env，见 P2-1** |
| P3-5 清理项 | 已修。`showActionSheet` 死代码删除；`pages/partner/*` 四个文件删除，`app.json`、README、冒烟页面列表同步移除；`goLogin` 增加「已在授权页则 return」防重入；`上线前检查清单.md` 顶部改为当前状态，旧内容归档到「历史记录」并标注「仅供追溯」 |

另外确认这轮没有破坏既有行为：`npm test` 在极端时区仍全绿，说明 `STORE_HOURS` 的测试注入仍然有效；订单页下拉刷新、菜单购物袋、券包兑换的原有路径都保留。

---

## 二、本轮新发现

### P2-1 生产环境首次建库仍会把 `STORE_HOURS` 永久写进营业时间

第三轮要求「生产忽略 `STORE_HOURS`」，`services.mjs:322` 的运行期判断确实加了，但种子数据这一层没跟上：

```js
// server/data.mjs:71
const payload = key === 'store' ? { ...value, hours: parseStoreHours() } : value;
```

`parseStoreHours()` 默认参数直接读 `process.env.STORE_HOURS`，完全不看 `NODE_ENV`。我在 `NODE_ENV=production`、`STORE_HOURS=00:00-24:00` 下对空库执行 `seedDatabase`，实测结果：

```
seeded store.hours = { open: '00:00', close: '24:00' }
```

也就是说：如果部署时 `.env` 里残留了本地调试用的 `STORE_HOURS`，第一次启动建库就会把它写进 `settings.store.hours`。此后 `assertStoreOpen` 虽然「忽略 env」，但读到的数据库值就是 24 小时营业——门店实际营业时间被永久绕过，而且运行期告警会让人误以为已经安全。`INSERT OR IGNORE` 意味着后续即便删掉 env 也不会自动纠正，只能去商户后台手动改。

同时别忘了 `server/data.mjs:30` 的 `DEFAULT_SETTINGS.store.hours` 也是 `parseStoreHours()`，导入模块时就会执行一次。

建议（二选一，推荐前者）：

```js
// 种子只写固定默认值，env 覆盖仅限运行期（且仅非生产）
const SEEDED_STORE_HOURS = { open: '10:00', close: '20:00' };
...
hours: SEEDED_STORE_HOURS,
...
// seedDatabase 里
const payload = key === 'store' ? { ...value, hours: SEEDED_STORE_HOURS } : value;
```

这样 `DEFAULT_SETTINGS` 与种子都不再依赖环境变量，`STORE_HOURS` 只保留「非生产运行期覆盖」这一个用途，语义就一致了。如果希望本地 mock 建库也带上 24 小时，可在 `seedDatabase` 的调用方按 `config.auth.mode === 'mock'` 传入。

### P3-1 `parseStoreHours` 只校验格式，不校验时间范围

正则 `/^\d{2}:\d{2}-\d{2}:\d{2}$/` 会放过 `99:99-88:88`，而营业判断是字符串比较：

```js
const inHours = open <= close ? time >= open && time < close : time >= open || time < close;
```

`open='99:99'`、`close='88:88'` 时 `open <= close` 为假，退化为 `time >= '99:99' || time < '88:88'`，任何时刻都 `< '88:88'`——门店变成**全天营业**。写成 `08:00-25:00` 则相反，可能变成永远未营业。两种都不会告警。

建议把校验收紧到合法时间，并区分「营业时段必须在同一天」还是允许跨夜：

```js
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const CLOSE = /^(24:00|([01]\d|2[0-3]):[0-5]\d)$/;
```

`server/admin.mjs:76-78` 后台保存用的是 `HHMM`，格式没问题，但同样没有校验 `open < close`；后台入口也可以顺手加一条范围校验，避免商家把 `20:00-10:00` 当成笔误保存。

### P3-2 每次 `onShow` 都重置 `loading`，页面会闪一下「加载中…」

`points.js:9`、`invite.js:15`、`member.js:13` 在 `load()` 开头无条件 `setData({ loading: true })`。这三个页面会从后台切回、从分享/客服返回时触发 `onShow`，已有内容会被整屏「加载中…」替换，随后再渲染——比上一版「保留旧数据静默刷新」更闪。

建议只在没有数据时展示加载态：

```js
if (!this.data.data) this.setData({ loading: true, error: '' });
else this.setData({ error: '' });
```

`member` 另有一个副作用：`member.js:24` 用 `this.data.loading` 判断「是否首次加载」，但现在执行到这行时 `loading` 一定为 `true`，于是每次 `load` 都会把 swiper 强制拉回会员当前等级，用户手动滑到钻石卡后离开再回来会被重置。若这不是有意为之，改成显式记录首次加载标志即可。

### P3-3 `bookings` 仍是旧版 toast 错误处理（第三轮漏列）

同期页面都补了 `error` 状态，但 `pages/bookings/bookings.js:22` 仍是：

```js
this.setData({ loading: false });
toast(error.message);
```

网络失败后 `orders` 为空，WXML 落到「暂无预约，下单时可在『预约时间』中选择取餐时段」——把请求失败误报成「没有预约」。建议照 `points` 的写法补 `error` 段和重试按钮。

### P3-4 订单页重试按钮缺少样式类（小）

`orders.wxml:12` 是 `<button bindtap="load">点击重试</button>`，其他页面都是 `class="btn-red"`。视觉不一致，顺手补上即可。

### P3-5 服务端 partner 接口与设置仍保留

客户端 `pages/partner` 已删、`app.json` 已移除，但 `server/routes-public.mjs` 的 `/api/partner*`、`DEFAULT_SETTINGS.partner`、后台 `settings/partner` 校验和 `smoke-flow` / `smoke-admin` 的断言都还在。如果分销短期不做，这些是纯维护成本；如果打算以后恢复，建议在 README 里写明「服务端保留、客户端已下线」，避免下次审计时又当成悬空代码。

---

## 三、建议处理顺序

| 顺序 | 事项 | 工作量 |
|---|---|---|
| 1 | 种子数据不再读取 `STORE_HOURS`（P2-1） | 10 分钟 |
| 2 | 营业时间范围校验（P3-1） | 10 分钟 |
| 3 | `points`/`invite`/`member` 加载态只在首屏展示（P3-2） | 15 分钟 |
| 4 | `bookings` 错误态 + 订单页按钮样式（P3-3/4） | 15 分钟 |
| 5 | partner 服务端去留决策（P3-5） | 需产品确认 |

以上都不影响当前演示，属于上线前最后一轮收尾。

---

## 四、仍需人工完成（与第三轮一致）

`miniprogram/config/env.js` 的 `USE_LOCAL` 改为 `false`（当前仍为 `true`）、`miniprogram/project.config.json` 的 `urlCheck` 改为 `true`（当前仍为 `false`）、生产 `.env` 密钥与支付回调公网可达、小程序备案 / ICP / 微信认证 / 食品经营许可证、request 合法域名 `aftwy007.com`、公众平台隐私保护指引（手机号、地址）、真机 0.01 元支付、真实菜品图。

两条仍然成立的运维提醒：

- 首次部署后到商户后台确认**营业时间**；种子默认 10:00–20:00。
- 生产环境确认**没有** `STORE_HOURS`。在 P2-1 修掉之前，这条是硬性要求，不只是「建议」。

---

## 五、结论

第三轮列出的 P2 全部闭环，P3 除 `bookings` 外均已处理，测试也补到了真正能防回退的程度。这轮唯一需要认真对待的是 P2-1：运行期门禁加了，但种子路径还在读 env，两者语义不一致，会在「生产误设 `STORE_HOURS`」时静默把营业时间改成 24 小时。修掉这一条，代码侧就没有新的阻断项了；剩下的都是文档里已经列明的外部资质与真机联调。
