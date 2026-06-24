# 业务接入审计清单

## 已接入统一登录

- `gongn/chaxun/gongju.js`
- `gongn/yhquan/gongju.js`
- `gongn/yhquan/app.js`
- `gongn/yhquan/zcaidan/*`
- `zhiliao/gongju/jiekou/yhquan/app.js`
- `zhiliao/gongju/jiekou/gongjuzx/service.js`
- `zhiliao/gongju/jiekou/jishiben/service.js`

这些模块当前主要通过 `LoginModule` 获取 SCM 凭证。

## 仍需统一的绕行点

### BI 运营模块

- `gongn/yunying/gongju.js`
- `gongn/yunying/zx/cx.js`
- `gongn/yunying/zx/mb.js`
- `gongn/yunying/zx/plcx/mb/yw.js`

问题：

- 直接读取 `bi_login`
- 直接检查 `bi_proxy_url`
- 直接调用 `YejiGongju.isTokenValid()`

计划：

- 改为 `LoginModule.requireCredentials('bi')`
- 代理连接和 token 校验全部收口进登录模块内部

### 商品查询模块

- `gongn/chaxun/gongju.js`

问题：

- 还保留 `getPmsCredentials()` 中转
- 有直接读取 `pms_login` 的失效标记逻辑

计划：

- 统一改为 `LoginModule.requireCredentials('pms')`
- 失效标记由登录模块返回结果后统一处理

### 工具中心

- `gongn/gongjuzx/gongju.js`

问题：

- 只依赖 SCM，但调用链里仍有多个中转层

计划：

- 收口为统一 `requireCredentials('scm')`

## 需要检查的残留引用

- `getScmCredentials`
- `getPmsCredentials`
- `getBiCredentials`
- `localStorage.getItem('scm_login')`
- `localStorage.getItem('pms_login')`
- `localStorage.getItem('bi_login')`
- `YejiGongju.isTokenValid()`
- `LoginModule.open('bi')` 之外的 BI 直接恢复逻辑

