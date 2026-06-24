# 智聊 Markdown 表格能力计划

> 后续状态：本专项能力已被 `zhiliao/jiemian/message_renderer.js` 统一承接。表格仍是消息最终渲染能力的一部分，但底层模块已从“Markdown 表格模块”升级为“智聊底层消息渲染器”。新的结构性计划见 `docs/zhiliao-message-renderer-refactor-plan.md`。

## 目标

让主界面智聊自然支持 AI 回复中的 Markdown 表格，并保持现有文字、图片、视频、图表、思考区、历史快照和复制按钮行为稳定。

## 原则

1. 不改变智聊消息外壳、头像、操作按钮、输入区和媒体卡片布局。
2. 不引入外部 Markdown 依赖，避免启动链变重。
3. 不把表格做成新的业务工具协议；表格只是消息渲染能力。
4. 流式中间态继续使用轻量文本渲染，最终完成时再渲染完整表格，避免半截表格抖动。
5. 复制按钮保留原位置和交互，同时支持纯文本和富文本表格剪贴板。
6. 表格宽度超出时横向滚动，不撑破聊天布局。

## 架构方案

新增 `zhiliao/jiemian/markdown.js`：

- 负责 Markdown 文本渲染。
- 支持段落、代码块、行内代码、链接、加粗、斜体和 Markdown pipe table。
- 提供 `render()`、`renderPartial()`、`buildClipboardHtml()`。
- 代码块内的表格语法不参与表格解析。

调整 `zhiliao/jiemian/buju.js`：

- `renderMarkdown()` 委托 `ZhiLiaoMarkdownModule.render()`。
- `renderMarkdownPartial()` 委托 `ZhiLiaoMarkdownModule.renderPartial()`。
- 保留原有 fallback，防止模块加载异常时消息仍可显示。

调整 `zhiliao/jiemian/jiaohu.js`：

- 复制时继续优先使用 `data-full-text` 作为纯文本。
- 浏览器支持时写入 `text/html` 和 `text/plain`。
- 不支持富文本剪贴板时降级为当前 `writeText()` 行为。

调整 `zhiliao/loader.js`：

- 在 `buju.js` 前加载 `markdown.js`。
- 将 `ZhiLiaoMarkdownModule` 纳入核心 required globals。

调整 `zhiliao/jiemian/yangshi/gg.css`：

- 增加 `.zhiliao-md-table-wrap` 和 `.zhiliao-md-table` 样式。
- 样式只作用于智聊系统消息中的 Markdown 表格，不影响业务表格。

## 验收标准

1. 普通文字回复显示不变。
2. Markdown 表格最终渲染为真实 HTML 表格。
3. 表格在手机端和窄宽度下可横向滚动，不撑破页面。
4. 代码块里的表格符号保持代码块，不被误解析。
5. 点击现有复制按钮时，纯文本保留原始 Markdown；支持富文本的目标应用可粘贴为表格。
6. 图片、视频、图表卡片和文字可继续混合显示。
7. 修改文件通过 JS 语法检查和乱码扫描。
