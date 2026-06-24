# 智聊底层消息渲染器重构计划

## 目标

把智聊中 AI 正常回复、流式中间态、思考区、普通系统提示、历史文本恢复和复制富文本统一收口到一个底层消息渲染器中。

本轮不接管图片/视频/商品/优惠券等业务卡片，它们仍按原有结构化结果渲染机制运行。

## 原则

1. 保持现有消息 DOM、布局 class、按钮位置和样式不变。
2. 保持“流式中间态轻量渲染、最终完成后完整渲染”的双态模型。
3. 卡片内容不进入 Markdown/消息文本渲染器，避免业务 UI 与文本渲染耦合。
4. 转义、安全 URL、复制 HTML 统一放在底层渲染器。
5. 上层模块只表达消息生命周期，不重复实现 Markdown 或转义 fallback。

## 统一接口

底层模块：`zhiliao/jiemian/message_renderer.js`

公开对象：`ZhiLiaoMessageRendererModule`

接口：

- `renderFinal(text)`：最终态完整渲染，支持段落、代码块、行内代码、链接、加粗、斜体、Markdown 表格和 Markdown 图片。
- `renderStreaming(text)`：流式态轻量渲染，只做安全转义和换行，避免半截表格/图片在输出中途重排。
- `renderInline(text)`：行内内容渲染，供表格单元格等内部场景复用。
- `escapeHtml(text)`：文本内容转义。
- `escapeAttr(text)`：HTML 属性转义。
- `buildClipboardHtml(element, plainText)`：复制时生成富文本 HTML，优先由原始 Markdown 文本渲染，保留纯文本复制来源。

## 调用边界

- `ZhiLiaoBujuModule` 继续负责消息外壳、用户消息、系统消息节点、历史恢复和滚动。
- `ZhiLiaoZjgXianshiModule` 继续负责流式更新、最终固化、思考区更新、`data-full-text` 写入和快照触发。
- `ZhiLiaoJiaohuModule` 继续负责复制按钮、剪贴板写入和按钮状态。
- `ZhiLiaoZjgLiaochengModule` 继续负责工具调用流程，普通文本提示走统一最终渲染，结构化卡片仍走原业务渲染器。

## 不动契约

- 不改变 `.system-message`、`.system-text`、`.message-actions`、`#message-container` 等 DOM 契约。
- 不改变 `.message-actions` 紧跟对应 `.system-message` 的复制定位逻辑。
- 不丢失 `data-full-text`，复制仍优先使用原始文本。
- 不改变 `.system-text` 下的表格/图片样式作用域。
- 不改变历史 `isHtml` 和业务卡片 HTML 的可信恢复路径。

## 验收标准

1. 普通文字最终回复显示不变。
2. Markdown 表格最终渲染为真实 `<table>`。
3. 流式中间态仍是安全文本，不提前解析表格。
4. 代码块中的表格符号不会被误解析。
5. 复制按钮继续复制纯文本，并在支持的浏览器中提供富文本 HTML。
6. 历史文本恢复走统一最终渲染，历史 `isHtml` 仍按原样恢复。
7. 图片/视频/商品/优惠券卡片不受影响。
8. 修改文件通过语法检查和乱码扫描。
