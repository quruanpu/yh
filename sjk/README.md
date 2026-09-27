# sjk —— 数据中控接口速查

全站唯一数据库入口。业务模块只使用 `window.SjkModule` 的以下方法；更换数据库只改本文件夹。

## 初始化
```js
await SjkModule.init();   // 匿名登录 + 打开数据库连接（内部幂等，各 API 也会自动触发）
```

## 通用文档 API
```js
await SjkModule.get(collection, docId)                 // → 文档对象 | null
await SjkModule.getWhere(collection, field, op, value) // → [文档...]（恒为数组）
await SjkModule.add(collection, data)                  // → 自动生成的 _id
await SjkModule.set(collection, docId, data)           // 整文档覆盖（可新建）
await SjkModule.update(collection, docId, patch)       // 局部更新，支持 'a.b' 点路径；不存在自动转为整写
await SjkModule.remove(collection, docId)
```

## 实时监听
```js
const unwatch = SjkModule.watchDoc(collection, docId, cb)
const unwatch = SjkModule.watchWhere(collection, field, value, cb)
// cb({ docs: [{...字段, _id}], type })；unwatch() 取消监听
```

## 集合清单
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
- 匿名登录态本地保持，失败不阻断读流程。
