# 指标详解 AI 私有工具

## 设计目标

指标详解 AI 工具服务指标详解业务壳。AI 可以传入业务壳支持的模板、筛选、日期、指标字段和目标参数，由面板服务完成查询、值模型或率模型计算、目标达成、节奏诊断和快照构造。

工具只读，不修改当前弹窗表格、筛选、目标或页面状态。

## 文件结构

- `gz.js`：工具定义、入参规则、字段说明。
- `cx.js`：只读查询入口，调用 `runTrendQueryService`。
- `app.js`：工具执行入口。
- `xq.md`：模块说明。

## 当前工具

### yeji_trend_query_panel

支持入参：

```json
{
  "templateKey": "",
  "templateName": "",
  "templateKeys": [],
  "templateNames": [],
  "filters": {},
  "excludeMode": {},
  "dateField": "出库日期",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "metricField": "",
  "targetKey": "",
  "autoTarget": true,
  "queries": []
}
```

工具行为：

1. 解析并校验动态参数。
2. 未传模板、指标或目标时，优先沿用当前指标详解面板口径。
3. 构造临时指标详解 context。
4. 复用面板查询计划、率字段依赖、目标值和节奏算法。
5. 并发查询模板按日序列。
6. 返回指标详解快照。

## 并发

- `queries` 最多 31 组。
- 多组查询并发执行。
- 单组失败会记录在对应结果里，不影响其它组。

## 边界

- 不接入全局工具中心。
- 不修改当前弹窗表格和布局。
- 不允许绕过当前 BI 面板支持字段。
- 不允许 AI 自己计算目标、达成率、率模型或趋势预测。
- 日期字段只支持出库日期或支付日期。
