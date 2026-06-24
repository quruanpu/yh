# 登录统一接入需求说明

## 目标

将当前系统的登录能力收口为一套独立、完整、唯一的登录模块。

对外只提供一件事：
返回已验证的登录凭证，供其它业务模块直接使用。

如果验证失败，返回明确、可处理的错误信息。

## 适用范围

- SCM 登录
- PMS 登录
- BI 登录
- 登录后的共享凭证刷新
- BI 代理连接后的登录态恢复

## 非目标

- 不改业务页面布局
- 不改弹窗样式
- 不改现有业务页面交互外观
- 不保留旧接口的薄封装
- 不新增第二套登录链路

## 总体原则

1. 登录模块是唯一入口。
2. 业务模块不直接读 `localStorage` 中的登录键。
3. 业务模块不直接校验 token 或账号密码。
4. 业务模块只向登录模块索取凭证。
5. 登录模块内部可以自由拆分子模块，但外部不可见。
6. HTML 只加载一个登录入口脚本，其余登录子模块由登录模块内部动态加载。
7. 登录模块必须最先可用，后续模块都依赖它。

## 登录模块职责

- 动态加载自身依赖
- 统一恢复 SCM / PMS / BI 登录态
- 统一验证凭证有效性
- 统一返回凭证对象
- 统一返回失败原因
- 统一维护共享凭证刷新

## 统一对外接口

建议最终只保留一个核心接口：

`LoginModule.requireCredentials(system, options)`

返回成功时：

```js
{
  ok: true,
  system: 'scm' | 'pms' | 'bi',
  credentials: {},
  local: {},
  provider: {},
  source: 'local' | 'device' | 'shared'
}
```

返回失败时：

```js
{
  ok: false,
  system: 'scm' | 'pms' | 'bi',
  code: 'NO_LOGIN' | 'PROXY_UNAVAILABLE' | 'TOKEN_EXPIRED' | 'VALIDATION_FAILED' | 'NO_PROVIDER' | 'NETWORK_ERROR',
  message: '可直接展示或转交业务层处理的中文描述',
  detail: {}
}
```

## 业务接入规则

- 业务模块只接收登录模块返回结果。
- 业务模块不得自行回退到 `localStorage` 读取登录态。
- 业务模块不得自行补救登录状态。
- 业务模块若拿不到凭证，只处理登录模块返回的错误。

## BI 特殊规则

- 必须先完成代理连接。
- 代理成功后，才允许检查 token。
- token 无效时，才允许静默恢复登录态。
- 恢复成功后再继续查询。
- 恢复失败则返回标准错误。

## 手动登录规则

- 本地登录或原登录流程手动登录成功后，如对应账号已有共享凭证节点，只刷新该共享节点。
- 如果没有共享节点，不自动创建。
- 已经共享来源的账号，不允许继续共享或取消共享。

## 现状审查结论

当前仍存在少量绕行点：

- `gongn/yunying/gongju.js`
- `gongn/yunying/zx/cx.js`
- `gongn/yunying/zx/mb.js`
- `gongn/yunying/zx/plcx/mb/yw.js`
- `gongn/chaxun/gongju.js`
- `gongn/gongjuzx/gongju.js`
- `zhiliao/gongju/jiekou/gongjuzx/service.js`
- `zhiliao/gongju/jiekou/jishiben/service.js`
- `zhiliao/gongju/jiekou/yhquan/app.js`
- `gongn/yhquan/app.js`
- `gongn/yhquan/gongju.js`

这些模块后续都要收口到统一登录模块。
