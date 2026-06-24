# 登录凭证认证判断重构计划

## 目标

- 保持现有登录恢复流程、登录弹窗布局、业务页面行为不变。
- 新增 `denglu/auth/pzrz.js` 作为 SCM/PMS/BI 凭证认证与错误分类的唯一入口。
- 移除恢复链中散落的 `true/false` 凭证判断，避免网络、数据库、代理、配置、超时等前置问题被误判为账号失效。
- 后续判断标准只需要修改 `pzrz.js`，其它登录恢复模块只消费结构化结果。

## 分层

### `denglu/auth/pzrz.js`

- 负责检查候选凭证是否完整。
- 负责发起 SCM/PMS/BI 的最小认证请求。
- 负责统一识别登录类错误、临时错误、代理错误和权限错误。
- 负责返回结构化认证结果。
- 不直接写 Firebase，不直接清 localStorage，不直接改 UI。

### `denglu/auth/app.js`

- 负责本地缓存、设备索引、供应商共享账号的恢复编排。
- 根据 `pzrz.js` 的结构化结果决定是否继续尝试下一个候选。
- 只有 `canMarkInvalid` 为真时才调用 Firebase 标记失效。
- 只有 `canClearLocal` 为真时才清理本地缓存。

### `denglu/app.js`

- 负责加载登录依赖、弹窗 UI、手动切换账号和统一凭证接口。
- `validateAccountCredentials()` 全新改为转发 `LoginCredentialVerifier.verify()`，不保留旧判断逻辑。
- 手动切换账号同样依据结构化结果决定是否标记失效。

## 结构化结果

```js
{
  ok: false,
  system: 'scm',
  status: 'temporary',
  reason: 'NETWORK_ERROR',
  message: '网络异常，暂时无法验证凭证。',
  canMarkInvalid: false,
  canClearLocal: false,
  canRetry: true,
  detail: {}
}
```

## 标记原则

- 明确账号不可用才允许标记 Firebase invalid，例如账号不存在、账号被禁用、账号停用。
- token/cookie/session 过期只代表当前凭证不可用，允许按来源清本地缓存，但不标记共享账号 invalid。
- 网络失败、接口超时、API 未配置、Firebase 问题、BI 代理不可用、验证码问题均不允许标记失效。
- BI token 过期只代表 token 不可用，不代表 BI 账号失效。
- 普通业务错误、HTTP 403 和权限不足不等于凭证失效。

## 当前执行链

1. `denglu/app.js` 按顺序加载 `denglu/auth/pzrz.js` 和 `denglu/auth/app.js`。
2. `LoginAuthModule` 按本地缓存、设备索引、同供应商共享账号恢复。
3. 每个候选账号统一调用 `LoginCredentialVerifier.verify()`。
4. `ok: true` 时应用登录态；`canClearLocal: true` 且来源允许时清本地；`canMarkInvalid: true` 时才写 Firebase invalid。
5. 手动切换账号也走同一个验证结果，不再自行判断 `true/false`。

## 本轮不做

- 不改登录弹窗 DOM 和 CSS。
- 不改 SCM/PMS/BI 手动登录流程。
- 不新增全库共享扫描。
- 不改变设备码生成和 Firebase 存储结构。
