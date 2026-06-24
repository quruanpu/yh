# BI字段配置模块需求记录

## 模块职责

- `gj.js`：字段配置纯工具，负责字段 key 去重、默认配置归一化、key 到完整字段对象解析。
- `zd.js`：字段配置业务，负责字段配置按钮、弹窗、勾选交互、确认应用，以及为主查询和 BI 汇总查询提供当前字段配置。
- `sj.js`：出库统计 Ultra 字段快照，内置 49 个查询字段和 26 个聚合字段，作为 BI 元数据未加载时的完整兜底字段池。

## 字段配置模型

字段配置是主查询协议的一部分，不是筛选项。

```js
fieldConfig: {
  version: 1,
  rowKeys: [],
  metricKeys: []
}
```

- `rowKeys` 对应观远 `zoneFilter.zoneData.row`。
- `metricKeys` 对应观远 `zoneFilter.zoneData.metric`。
- 查询时必须通过 key 还原完整字段对象，不能只传 `fdId`。
- 未配置时使用 `config.js` 中 `defaultRowKeys/defaultMetricKeys`。

## 状态模型

```js
availableRowFields: [],
availableMetricFields: [],
fieldConfig: {},
fieldConfigDraft: null
```

- `availableRowFields/availableMetricFields` 保存观远元数据中的全部可选字段。
- 线上元数据优先；内置 `sj.js` 完整字段快照兜底；不会被只包含默认字段的元数据覆盖变少。
- `fieldConfig` 保存当前选中的字段 key。
- 不再维护 `state.rowFields/state.metricFields` 作为派生缓存，查询时实时按配置解析。

## 模板规则

模板仍保存在原节点：

```text
moban/yeji/{providerId}/{templateKey}
```

- 模板只保存筛选项、快捷搜索、排除模式、排序等模板自身信息。
- 模板不保存 `fieldConfig`，避免字段配置被模板锁死。
- 应用模板时只恢复筛选、快捷搜索和排除模式；查询字段与聚合字段始终使用当前用户配置。

## BI汇总查询规则

- BI 汇总查询不使用主界面的查询字段；普通模板不传查询字段，合并模板也不传查询字段，只按查询计划补齐必要聚合字段。
- BI 汇总查询实际请求固定补齐底层聚合字段，再追加当前用户选择的显示聚合字段。
- BI 汇总表头只展示当前用户选择的聚合字段；固定底层字段未被选择时只参与请求和合并计算，不展示。
- 模板只提供筛选条件；所有模板使用同一套当前字段配置进行汇总查询。
- 导出 Excel 使用原始数值，未配置字段导出为空。

## 布局规则

- 字段配置图标按钮悬浮在表格区域右下角、BI汇总查询按钮上方，不挤占表格布局。
- 字段配置弹窗上半部分为查询字段列表，下半部分为聚合字段列表。
- 桌面端字段列表一行 4 个，手机端一行 2 个。
- 查询字段允许为空；聚合字段至少选择 1 个。
