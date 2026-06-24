# 智聊媒体产物链路重构计划

## 目标

统一图片、视频、图表三类“媒体产物”的生成、展示、历史摘要与 AI 续写链路，支持两种交付模式：

- `card_only`：工具提交后展示等待卡片，完成后直接替换为结果卡片，不再让 AI 续写。
- `await_then_reply`：工具提交后展示等待卡片，完成后登记媒体产物，AI 可在后续文字中用产物占位符插入结果卡片；AI 不接触原始链接、data URL 或 base64。

普通消息、代码块、表格继续走现有消息渲染器，不纳入本次重构。

## 约束

1. 保持现有卡片布局、样式、图片预览、视频播放行为不变。
2. 不把 `image_url`、`video_url`、data URL、base64 暴露给最终 AI 文本回复。
3. 不改变图片/视频工具自身生成逻辑，不改变 ECharts 图表生成样式。
4. 不新增复杂兼容层，以原生模块职责划分实现。
5. 所有新增文件使用 UTF-8，避免乱码与语法错误。

## 现状

- 图片/视频生成：`handleToolCalls()` 检测 `generate_or_edit_image` / `generate_video` 后进入后台任务队列，完成后更新媒体任务卡片。
- 图表生成：`generate_chart_from_statistics` 同步执行，成功后直接插入图表卡片。
- 卡片渲染：图片和图表共用 `renderImageResultCard()`，视频使用 `renderVideoResultCard()`。
- 历史压缩：图表已去除原始图片链接；图片/视频也压缩了大部分链接，但后台任务完成后的真实产物没有统一回写为“媒体产物摘要”。

## 设计

### 1. 媒体策略层

新增 `zhiliao/zjg/yewu/meiti_celue.js`。

职责：

- 判断工具是否为媒体产物工具。
- 归一媒体类型：`image`、`video`、`chart`。
- 归一交付模式：`card_only`、`await_then_reply`。
- 根据工具参数、用户意图和默认策略决定是否等待续写。

默认策略：

- 明确包含“并分析/并说明/解读/总结/生成后/然后/再回复”等意图时使用 `await_then_reply`。
- 图表若用户要求分析趋势、原因、结论，使用 `await_then_reply`。
- 其它纯生成默认 `card_only`。

### 2. 媒体产物仓库

新增 `zhiliao/zjg/yewu/meiti_chengguo.js`。

职责：

- 登记完成产物，生成 `artifact_id`，如 `media_1`。
- 只在内存持有真实 URL，传给 AI 的摘要不包含 URL。
- 提供占位符：`[[media:media_1]]`。
- 在最终 AI 文本渲染后，把占位符替换为原有结果卡片。

### 3. 任务层统一

扩展 `zhiliao/zjg/yewu/meiti_renwu.js`。

职责：

- 支持 `image`、`video`、`chart` 三类媒体任务。
- `card_only`：完成后任务卡片替换为结果卡片。
- `await_then_reply`：完成后移除等待卡片，登记产物，把安全摘要交回编排层继续 AI 续写。

图表也进入同一任务层，但执行函数仍调用原 `generate_chart_from_statistics`，不改变 ECharts 生成逻辑。

### 4. 编排层收敛

调整 `zhiliao/zjg/yewu/liaocheng.js`。

职责：

- 媒体工具统一交给任务层执行。
- 如果全部媒体任务为 `card_only`，直接结束。
- 如果存在 `await_then_reply`，等待任务完成后把安全摘要作为 tool result 注入历史，再调用后续 AI 回复。
- 非媒体工具保持现有逻辑。

### 5. 工具协议与提示词

调整工具 schema 与 skill：

- 图片、视频、图表工具增加可选参数 `delivery_mode`，枚举 `card_only` / `await_then_reply`。
- Skill 提示 AI：
  - 纯生成默认 `card_only`。
  - 生成并分析/说明/总结时使用 `await_then_reply`。
  - 续写时如需插入结果，只输出 `[[media:artifact_id]]` 占位符，不输出链接。

## 风险控制

- 不改卡片 CSS，不改 `renderImageResultCard()` / `renderVideoResultCard()` 的现有视觉规则。
- 不删除旧同步分支，除非终轮验证确认不可达；本次先收敛主链路。
- 对混合工具场景保守处理：只有媒体任务可安全等待后才续写，非媒体继续原流程。
- 文本渲染器继续禁止相对图片路径和 data URL 正文图片。

## 验证

1. `node --check` 检查新增与修改 JS 文件。
2. `rg` 检查乱码风险。
3. `rg` 检查原始链接是否进入图表/媒体历史摘要。
4. 手工审查三类链路：
   - 纯图片/视频/图表生成只出结果卡片。
   - 生成并分析时卡片可出现在 AI 指定位置。
   - 普通文字、表格、代码块渲染不变。
