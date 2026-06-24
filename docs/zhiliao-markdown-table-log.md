# 智聊 Markdown 表格能力记录

> 后续状态：本记录中的表格渲染能力已并入 `zhiliao/jiemian/message_renderer.js`。后续维护以 `docs/zhiliao-message-renderer-refactor-log.md` 为准，本文件保留为表格能力落地的历史记录。

## 2026-06-20

### 范围

本轮只处理主界面智聊消息渲染和复制能力：

- 不改模型调用链。
- 不改工具 schema。
- 不改智聊布局外壳。
- 不改 BI 查询模块。
- 不改图片、视频、图表卡片生成逻辑。

### 初始分析

当前最终消息通过 `ZhiLiaoBujuModule.renderMarkdown()` 渲染，流式中间态通过 `renderMarkdownPartial()` 渲染。

当前复制按钮位于消息左下角操作区，复制逻辑读取 `data-full-text` 或 `.system-text.innerText`，并调用 `navigator.clipboard.writeText()`。因此当前只能复制纯文本，不能写入富文本表格。

当前系统已经支持文字与媒体卡片混排。表格能力应作为 Markdown 渲染能力接入，不应新增独立业务组件。

### 已实施

- 新增 `zhiliao/jiemian/markdown.js`，作为智聊消息 Markdown 渲染模块。
- `markdown.js` 支持最终态 Markdown 表格、Markdown 图片、代码块、行内代码、链接、加粗和斜体。
- 表格解析在代码块保护之后执行，避免代码块中的 `| a | b |` 被误渲染为表格。
- 链接和图片 URL 增加协议过滤，禁止 `javascript:`、`data:`、`vbscript:`、`file:` 等危险协议。
- `zhiliao/loader.js` 在 `buju.js` 前加载 `markdown.js`，并把 `ZhiLiaoMarkdownModule` 纳入核心全局检查。
- `zhiliao/jiemian/buju.js` 的 `renderMarkdown()` 和 `renderMarkdownPartial()` 改为委托 `ZhiLiaoMarkdownModule`，保留 fallback。
- `zhiliao/jiemian/jiaohu.js` 的复制逻辑增强为优先写入 `text/plain` 和 `text/html`，失败时降级到纯文本复制。
- `zhiliao/jiemian/yangshi/gg.css` 增加局部表格和 Markdown 图片样式，宽表只在表格区域横向滚动。

### 设计取舍

流式中间态仍使用 `renderMarkdownPartial()`，只做转义和换行。最终回复完成后才渲染完整表格，避免半截表格在流式输出过程中反复重排。

工具生成图片、视频和图表继续走原有卡片机制。Markdown 图片只处理 AI 文本中明确返回的 `![描述](url)`，两条链路不混用。

### 独立审查

渲染架构审查结论：

- 推荐新增独立 Markdown 渲染模块，不继续扩写 `buju.js`。
- 表格样式应限制在 `.system-text` 内，使用横向滚动容器，避免影响消息外壳。
- 流式中间态不解析表格，最终态再完整渲染。
- 工具生成媒体卡片继续走原机制，Markdown 图片只处理文本内图片。

剪贴板审查结论：

- 复制按钮 DOM 不应改变。
- 复制应保留 `text/plain` Markdown 原文，并在浏览器支持时增加 `text/html`。
- 双格式复制失败后应降级为纯文本复制。
- 富文本 HTML 需要过滤危险协议、危险标签和事件属性。

### 验证

- `node --check` 通过：
  - `zhiliao/jiemian/markdown.js`
  - `zhiliao/jiemian/buju.js`
  - `zhiliao/jiemian/jiaohu.js`
  - `zhiliao/loader.js`
- 乱码扫描未发现异常标记。
- 渲染模拟通过：
  - Markdown pipe table 渲染为真实 `<table>`。
  - `---:` 对齐语法渲染为右对齐 class。
  - 代码块中的表格语法不会被误解析。
  - `javascript:` 链接不会进入 HTML。
  - `文字 -> 表格 -> Markdown 图片 -> 文字` 顺序保持。
  - 剪贴板 HTML 可由 Markdown 表格生成真实 `<table>`。

### 追加诊断

用户截图中的回复内容已经是标准 Markdown pipe table，但界面仍显示原始 `| ... |` 文本，说明问题不在模型输出，而在前端最终渲染链路。

复核后确认：流式中间态仍按纯文本显示是预期行为，最终完成后应由 `finalizeMessage()` 走 `renderMarkdown()` 渲染为表格。为避免核心消息层只通过布局层转发而拿到旧渲染器，本轮将 `zhiliao/zjg/jiemian/jiaohu.js` 的 `renderMarkdown()` 和 `renderMarkdownPartial()` 改为优先直接调用 `ZhiLiaoMarkdownModule`，再降级到 `ZhiLiaoBujuModule`。

验证结果：

- `ZhiLiaoModule.renderMarkdown()` 入口模拟 Markdown 表格，输出真实 `<table class="zhiliao-md-table">`。
- `node --check` 通过：
  - `zhiliao/zjg/jiemian/jiaohu.js`
  - `zhiliao/zjg/jiemian/xianshi.js`
  - `zhiliao/jiemian/markdown.js`
  - `zhiliao/jiemian/buju.js`
  - `zhiliao/loader.js`
