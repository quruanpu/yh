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

## 内建保证
- 所有读写 **10 秒超时**（超时抛错，绝不永久挂起）；
- 统一错误日志前缀 `[sjk]`；
- 令牌内嵌（`x-yh-token` 头），Origin 白名单双层鉴权（ly.cqytyy.top / *.cqytyy.top / localhost）。
