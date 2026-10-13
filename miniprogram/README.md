# 原生微信小程序联调壳

这个目录可以直接作为微信开发者工具的小程序项目根目录打开。它不是对原小程序加密包的源码导出，而是自写的最小原生壳，用来验证真实 AppID、`wx.login`、手机号授权和正式 API 连接。

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
