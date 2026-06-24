# 统一登录接口契约

## 设计目标

登录模块只对外提供一组稳定接口，业务模块只拿结果，不参与登录细节。

## 核心接口

### `LoginModule.requireCredentials(system, options = {})`

#### 入参

- `system`：`scm`、`pms`、`bi`
- `options.force`：是否强制重新验证
- `options.silent`：是否静默处理错误
- `options.timeout`：超时时间

#### 成功返回

```js
{
  ok: true,
  system: 'scm',
  source: 'local' | 'device' | 'shared',
  credentials: {},
  local: {},
  provider: {},
  meta: {
    checkedAt: 0,
    verifiedAt: 0
  }
}
```

#### 失败返回

```js
{
  ok: false,
  system: 'scm',
  code: 'NO_LOGIN',
  message: '请先登录SCM账户',
  detail: {}
}
```

## 错误码

- `NO_LOGIN`：没有可用登录态
- `NO_PROVIDER`：没有供应商信息
- `PROXY_UNAVAILABLE`：BI 代理不可用
- `TOKEN_EXPIRED`：BI token 失效
- `VALIDATION_FAILED`：凭证校验失败
- `NETWORK_ERROR`：网络请求失败
- `INVALID_SYSTEM`：系统参数非法

## 衍生接口

### `LoginModule.open(system)`

打开对应系统登录视图，仅用于 UI 交互。

### `LoginModule.getDisplayUsername()`

仅用于导航区用户名展示。

### `LoginModule.getProviderInfo(system)`

仅用于业务需要供应商信息时读取。

## 约束

- 业务模块不得直接读取 `scm_login`、`pms_login`、`bi_login`
- 业务模块不得自己判断 token 是否可用
- 业务模块不得自己做共享凭证修复
- BI 特殊逻辑必须由登录模块内部完成代理后置校验

## 返回语义

- `ok: true` 才能继续业务调用
- `ok: false` 时业务模块只展示错误，不自己补救

