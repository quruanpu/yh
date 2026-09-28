# sjk —— 数据中控接口速查

全站唯一数据库入口。业务模块只使用 `window.SjkModule` 的以下方法；更换数据库只改 zhongxin/（dy + sjk + worker）。

## 初始化
```js
await SjkModule.init();   // 网关健康检查（GET yhsjk.cfdaili.top，内部幂等，各 API 也会自动触发；失败不阻断、标记 degraded）
```

## 数据 API（9 个，全部走 CF Worker HTTP 网关）
```js
await SjkModule.get(collection, docId)                 // → 文档对象 | null
await SjkModule.getWhere(collection, field, op, value) // → [文档...]（恒为数组，字段值全等匹配）
await SjkModule.getAll(collection)                     // → [文档...]
await SjkModule.add(collection, data)                  // → 自动生成的 _id
await SjkModule.set(collection, docId, data)           // 整文档覆盖（可新建）
await SjkModule.update(collection, docId, patch)       // 顶层键合并；文档不存在抛错（严格语义）
await SjkModule.upsert(collection, docId, patch)       // 存在→update，不存在→set
await SjkModule.remove(collection, docId)
await SjkModule.updateWhere(collection, docId, patch, wherePath, whereValue)
                                                       // 原子条件更新：仅当 json_extract(data, wherePath)==whereValue
                                                       // 时以 json_patch 深合并写入；返回 { changed: true|false }
```

## 实时订阅（委托 zhongxin/dy/realtime.js）
```js
const unwatch = SjkModule.watchWhere(collection, field, value, cb)
const unwatch = SjkModule.watchCollection(collection, cb)
// cb({ docs: [{...字段, _id}], type: 'push'|'poll' })；unwatch() 取消监听
// 链路：WS 推送（通知→即时拉取）+ 60s 兜底轮询 + 失败自愈退避（5s→60s）+ WS 断线降级轮询
```

## 集合清单（Worker 白名单一致）
| 集合 | 用途 | 文档 ID 规则 |
|---|---|---|
| login_accounts | 三系统登录账户库 | `{sys}::{pidKey}::{accKey}` |
| device_logins | 设备→账号索引 | `{sys}::{devKey}::{idxKey}` |
| yeji_templates | BI 查询模板 | `{pidKey}::{key}` |
| yeji_targets | 批量查询目标 | `{pidKey}` |
| coupons | 优惠券（tasks 内嵌） | `{pidKey}::{couponId}` |
| coupon_index | 券索引 | `{pidKey}` |
| notebooks | 记事本（整树内嵌） | `{pidKey}` |
| gongju_items | 工具中心 | `{itemId}` |
| model_configs | 模型配置仓库 | `{configId}` |

## 字段类型契约（★ 写入/查询前必读）

存储层为 SQLite `json_extract` 全等匹配——**跨类型永不相等**（数字 ≠ 字符串）。同一概念在不同业务链路类型不同，写入与查询必须同型：

| 集合.字段（或键） | 类型 | 来源链路 | 实测依据 |
|---|---|---|---|
| coupons.provider_id | **数字** | SCM（药师帮）凭证 `provider_id` 原样 | 写入端 Int32 + 数字查询 12/6 命中（2026-09-27）|
| coupons.couponId | 数字 | SCM 券 ID 原样 | 写入端实测；读取端 fallback `_id::` 拆分兼容 |
| yeji_templates.pid | **字符串** | BI（观远）登录态 `provider_id` 原样 | 字符串查询 21 命中（2026-09-28）|
| login_accounts.provider_id | 字符串 | zhanghu `_text()` 惯例 | 存量文档实测 |
| device_logins.device_id | 字符串 | 设备指纹 `device_XXXXXX` | 37 条实测 |
| coupon_index 文档键 | 字符串 | `_normalizeId(pid)` | 2 条实测（落地页 getAll 驱动）|
| yeji_targets / notebooks 文档键 | 字符串 | `String(pid)` | 实测 |
| gongju_items / model_configs 文档键 | 字符串 | RTDB push 键原样（`-Oxxx`）| 56+6 条实测 |

**三条纪律**（2026-09-28 类型事故固化）：
1. 同一供应商 ID **跨系统类型不同**：SCM（药师帮）=数字、BI（观远）=字符串——**禁止同源推断**。
2. 新增集合/字段：先实测查询端类型，再定写入类型；验收 = 用「前端同类型查询实测命中」。
3. 类型对齐类变更必须经用户可感知行为验证后，方可视为完成。

## 内建保证
- 所有读写 **10 秒超时**（超时抛错，绝不永久挂起）；
- 统一错误日志前缀 `[sjk]`；
- 令牌内嵌（`x-yh-token` 头），Origin 白名单双层鉴权（ly.cqytyy.top / *.cqytyy.top / localhost）。
