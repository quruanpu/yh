# BI 通用 AI 接口契约

## 设计目标

通用 AI 内核只负责消息、流式回复、工具循环和状态展示。

所有业务能力都通过适配器注入，不直接耦合具体面板。

## 通用核心接口

### `YejiAiCore.registerAdapter(adapter)`

注册一个面板适配器。

#### 必要字段

- `panelId`
- `name`
- `getSnapshot()`
- `buildSystemPrompt(snapshot)`
- `getTools(snapshot)`
- `executeTool(toolName, rawArgs, context)`

#### 约束

- `panelId` 必须唯一。
- `getSnapshot()` 必须只读，不得修改页面状态。
- `executeTool()` 必须只读，不得改变当前表格和筛选。
- 适配器只能返回自己面板可见的数据。

### `YejiAiCore.open(panelId, options = {})`

打开指定面板的 AI。

#### 入参

- `panelId`：面板标识
- `options.anchor`：按钮锚点，可选
- `options.forceOpen`：是否强制展开

#### 行为

- 如果面板不存在，返回失败。
- 如果面板已存在，只刷新当前面板内容，不重建无关 DOM。
- 不改变页面布局。

### `YejiAiCore.close(panelId)`

关闭指定面板 AI。

#### 行为

- 只关闭当前面板对应会话。
- 不影响其它面板。
- 必要时清理临时工具状态。

### `YejiAiCore.send(panelId, question)`

发送用户问题。

#### 行为

- 读取适配器快照。
- 生成系统提示词。
- 进入流式回复。
- 如需工具，循环执行工具直到模型结束或被打断。

## 适配器接口

### `getSnapshot()`

返回当前面板只读快照。

#### 必须包含

- `panelId`
- `scope`
- `title`
- `data`
- `queryContext`
- `permissions`

#### 约束

- 只包含当前面板可见数据。
- 不返回 DOM 对象。
- 不返回可变引用。

### `buildSystemPrompt(snapshot)`

返回系统提示词字符串。

#### 约束

- 必须根据面板类型调整权限描述。
- 必须明确数据边界。
- 必须明确回复风格。
- 必须明确工具调用规则。

### `getTools(snapshot)`

返回工具定义数组。

#### 规则

- 指标详解只返回时间补查工具。
- BI 查询面板可返回时间补查工具和模板限定工具。
- 主查询页面可返回分页和筛选查询工具。

### `executeTool(toolName, rawArgs, context)`

执行工具。

#### 规则

- 只能执行当前适配器声明过的工具。
- 必须验证参数合法。
- 必须在当前面板仍然存在时执行。
- 执行结果必须是纯数据对象。

## 面板快照建议结构

### 指标详解

```js
{
  panelId: 'trend-detail',
  scope: 'qs-trend',
  title: '指标详解',
  queryContext: {},
  data: {
    rows: [],
    summary: {},
    trendModel: 'value' | 'rate'
  },
  permissions: {
    tools: ['query-by-time']
  }
}
```

### BI 查询面板

```js
{
  panelId: 'batch-query',
  scope: 'bi-batch',
  title: 'BI查询',
  queryContext: {},
  data: {
    rows: [],
    templates: [],
    targets: {},
    dateValues: {}
  },
  permissions: {
    tools: ['query-by-time', 'query-by-template']
  }
}
```

### BI 主查询

```js
{
  panelId: 'main-query',
  scope: 'bi-main',
  title: 'BI主查询',
  queryContext: {},
  data: {
    rows: [],
    page: 1,
    pageSize: 20,
    totalCount: 0
  },
  permissions: {
    tools: ['query-page', 'query-filter']
  }
}
```

## 私有工具契约

### 指标详解工具

- 只允许传 `startDate`、`endDate`
- 单轮并发最多 31 个
- 只查当前上下文同口径数据

### BI 查询面板工具

- 允许传 `startDate`、`endDate`
- 可选传 `templateKeys`
- 模板不传时默认全模板
- 不得传入接口路径或原始请求体

### 主查询工具

- 允许传筛选参数、字段列表、聚合字段、分页参数
- 必须限制默认分页大小
- 必须遵守当前面板权限

## 消息状态契约

### 查询中状态

当工具正在执行时，聊天界面显示状态消息，例如：

`数据查询中（已耗时xx秒）......`

### 校验中状态

当后台继续校验预测结果时，显示：

`校验中（已耗时xx秒）......`

### 移除时机

- 一旦正式内容开始流出，移除查询状态。
- 工具完成但尚未流式输出时，状态仍可保留。
- 不允许状态一直挂到整段回复结束。

## 返回错误码建议

- `NO_PERMISSION`
- `NO_CONTEXT`
- `NO_DATA`
- `TOOL_LIMIT_EXCEEDED`
- `INVALID_ARGUMENT`
- `PANEL_CLOSED`
- `NETWORK_ERROR`
- `MODEL_ERROR`

