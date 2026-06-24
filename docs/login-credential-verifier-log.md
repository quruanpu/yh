# 登录凭证认证判断重构记录

## 2026-06-21

### 审查结论

- 当前 `LoginAuthModule.tryLocal()` 和 `tryAccounts()` 使用 `validateAccountCredentials()` 的布尔结果决定清本地缓存和标记 Firebase invalid。
- 当前 SCM 校验在 API 缺失、网络异常、请求失败等情况下可能返回 `false`，存在误标失效风险。
- 当前 PMS 校验对非登录类错误区分不足。
- 当前 BI token 校验将代理不可用、网络失败、token 过期都压缩为 `false`，不能直接用于账号失效判断。

### 计划

- 新增 `denglu/auth/pzrz.js`。
- 将登录依赖加载顺序调整为 `pzrz.js` 先于 `auth/app.js`。
- 将 `LoginAuthModule` 改为消费结构化认证结果。
- 将 `LoginModule.validateAccountCredentials()` 全新改为统一认证入口。
- 将手动账户切换验证改为只在明确失效时标记 invalid。

### 实施记录

- 已新增 `denglu/auth/pzrz.js`，统一输出 `ok/status/reason/canMarkInvalid/canClearLocal/canRetry`。
- 已让 `denglu/app.js` 在 `denglu/auth/app.js` 前加载 `denglu/auth/pzrz.js`。
- 已移除 `LoginModule.validateAccountCredentials()` 中 SCM/PMS/BI 分散 fetch 校验逻辑，改为直接转发 `LoginCredentialVerifier.verify()`。
- 已将本地账户列表、手动切换账号和自动恢复链路统一改为消费结构化结果。
- 已移除 `denglu/app.js` 中不可达的 `_validateCurrentBiToken()`，避免 BI token 校验绕过统一入口。
- 已将账户列表打开登录视图的重复分支收敛为 `openAccountLoginView()`，不改变原有 DOM、class、CSS 和渲染入口。
- 已收窄认证失败口径：网络、代理、HTTP 403、权限不足、普通业务错误不标 invalid；token/session 过期只按来源清本地，不标共享账号 invalid。
- 已优化 SCM 本地清理策略：完整 token 凭证过期时，如果仍保存 `account_secret`，保留可回填账号信息，只移除失效完整凭证。
- 已修复 PMS 恢复校验口径：PMS 扫码登录保存的凭证不一定包含业务查询接口要求的 `auth.token`，因此无 token 的 PMS 凭证不再调用 `pmsUrl` 硬验；非登录类业务响应也不阻断恢复。

### 审查记录

- Galileo 只读审查指出旧风险集中在 `tryLocal()`、`tryAccounts()`、`validateAndSwitch()` 三处 false 判断。
- 本轮已消除这些旧 boolean 决策点，只保留 `LoginAuthModule.markInvalid()` 作为 Firebase invalid 的唯一写入口。

### 验证记录

- `node --check denglu/auth/pzrz.js` 通过。
- `node --check denglu/auth/app.js` 通过。
- `node --check denglu/app.js` 通过。
- 残留扫描确认没有旧 `validateAccountCredentials()` boolean 条件、没有 `_validateCurrentBiToken()` 调用、没有散落的 `FirebaseModule.markAccountInvalid()` 调用。
- 针对 `PMS凭证未恢复: BUSINESS_ERROR 缺少auth.token` 做了专项修复，PMS tokenless credentials 现在归为可恢复凭证结构，而不是业务查询失败。
