# BI AI 动态查询结构级重构计划

## 目标

让 BI 查询面板和指标详解面板成为真正独立的“业务壳”：

- UI 默认打开时，使用固定的当前页面参数，结果交给 UI 渲染。
- AI 查询时，传入面板支持的动态参数，仍由同一个业务壳查询和计算，结果返回 AI。
- AI 不直接计算业务指标，不绕过面板，不访问数据库后台，不修改页面状态。
- 保持现有 UI、布局、样式、按钮、弹窗和默认功能不变。

## 历史问题

重构前 AI 工具只做了保守封装：

- BI 查询工具参数范围过窄，主要依赖当前面板上下文。
- 指标详解工具参数范围过窄，主要依赖当前指标详解上下文。
- UI 业务和查询状态混在 `plcx.js`、`qs/yw.js` 中。
- AI 动态参数没有统一的白名单解析、临时上下文构造和返回快照标准。

当前这些问题已通过 `zx/plcx/fw/*` 服务层、统一 AI 工具入口和动态参数白名单落地解决。文档保留历史问题用于说明本次重构来源。

## 核心原则

1. UI 和业务分离。
2. 默认查询和 AI 查询共用同一业务服务。
3. 动态参数只允许传入当前面板本来支持的字段。
4. 动态查询使用临时 context，不改页面 state。
5. 目标、达成率、合并模板、率字段依赖、指标详解算法全部复用现有面板能力。
6. 旧的不适用 AI 工具逻辑要收敛到新服务，不继续堆叠补丁。

## BI 查询面板服务

已落地服务职责：

- 解析模板参数：`templateKeys`、`templateNames`、默认全部模板。
- 解析筛选参数：只允许当前筛选器存在的字段。
- 解析日期参数：`dateField`、`startDate`、`endDate`。
- 解析聚合字段：`metricFields`。
- 解析目标参数：`targetKey` 或自动匹配目标。
- 构造每个模板的查询计划。
- 发起 BI 查询。
- 复用合并模板和目标达成率计算。
- 返回标准快照。

允许 AI 参数：

```js
{
  templateKeys: [],
  templateNames: [],
  filters: {},
  excludeMode: {},
  dateField: '出库日期',
  startDate: 'YYYY-MM-DD',
  endDate: 'YYYY-MM-DD',
  metricFields: [],
  targetKey: '',
  autoTarget: true,
  includeChildren: true
}
```

不开放：

- 临时写目标。
- 自定义计算公式。
- 绕过模板直接查任意分组明细。

## 指标详解服务

已落地服务职责：

- 解析模板参数。
- 解析筛选和日期参数。
- 解析指标字段。
- 解析目标范围并提取目标值。
- 自动判断值模型或率模型。
- 构造指标详解 context。
- 复用现有 `runBatchTrendNodes` 相关计算能力。
- 返回标准快照。

允许 AI 参数：

```js
{
  templateKey: '',
  templateName: '',
  templateKeys: [],
  templateNames: [],
  filters: {},
  excludeMode: {},
  dateField: '出库日期',
  startDate: 'YYYY-MM-DD',
  endDate: 'YYYY-MM-DD',
  metricField: '',
  targetKey: '',
  autoTarget: true
}
```

强约束：

- 必须有模板。
- 必须有聚合字段。
- 必须有目标值。
- 率字段必须能解析依赖字段。
- 日期字段只允许当前页面存在的日期筛选字段。

## 文件结构

已新增：

- `gongn/yunying/zx/plcx/fw/gz.js`：BI 查询/指标详解参数规则和白名单校验。
- `gongn/yunying/zx/plcx/fw/plcx.js`：BI 查询面板动态查询服务。
- `gongn/yunying/zx/plcx/fw/qs.js`：指标详解动态查询服务。
- `gongn/yunying/zx/plcx/fw/yw.js`：服务聚合导出，保持 `app.js` mixin 稳定。

已改造：

- `gongn/yunying/zx/plcx.js`：UI 默认查询改为调用服务，再把结果写入 state 并渲染。
- `gongn/yunying/zx/plcx/ai/gj/gz.js`：开放 BI 查询动态参数。
- `gongn/yunying/zx/plcx/ai/gj/cx.js`：调用服务，不再自己拼查询。
- `gongn/yunying/zx/plcx/qs/ai/gj/gz.js`：开放指标详解动态参数。
- `gongn/yunying/zx/plcx/qs/ai/gj/cx.js`：调用服务，不再自己拼查询。
- `index.html`：加入新增服务文件，保证加载顺序在 `plcx.js` 和 AI 工具前。

## 审查清单

- 默认打开 BI 查询弹窗行为不变。
- 刷新、下载、目标选择、目标上传、合并行、指标详解入口不变。
- AI 查询不修改页面 state。
- AI 查询失败不影响当前面板。
- 所有动态字段都经过白名单解析。
- 所有 JS 文件通过 `node --check`。
- 不改 CSS，不改 UI 结构。

## 当前审查结论

当前迁移已经完成。BI 查询面板和指标详解面板均通过业务壳服务支持 UI 默认查询和 AI 动态只读查询；AI 只传参数和读取快照，不直接计算目标、达成率、合并模板、值模型、率模型或预测结果。

旧的独立 AI 弹窗入口文件已从实际文件树删除，`index.html` 和 BI 模块内没有继续引用旧入口或旧工具名。`fw/yw.js` 只是当前全局 mixin 架构下的聚合导出层，不承担旧逻辑兼容。
