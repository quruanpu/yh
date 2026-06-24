# 智聊底层消息渲染器重构记录

## 2026-06-20

### 已实施

- 将 `zhiliao/jiemian/markdown.js` 提升并迁移为 `zhiliao/jiemian/message_renderer.js`。
- 公开底层模块 `ZhiLiaoMessageRendererModule`。
- 将原 `render/renderPartial` 语义收敛为 `renderFinal/renderStreaming`。
- `zhiliao/loader.js` 改为加载 `message_renderer.js`，并把 `ZhiLiaoMessageRendererModule` 纳入核心全局检查。
- `zhiliao/jiemian/buju.js` 不再维护 Markdown fallback，系统消息和历史文本恢复直接走 `renderFinal()`。
- `zhiliao/zjg/jiemian/jiaohu.js` 提供上层生命周期语义：`renderFinalMessage()` 和 `renderStreamingMessage()`。
- `zhiliao/zjg/jiemian/xianshi.js` 的最终固化、流式正文、流式思考和最终思考区统一调用新入口。
- `zhiliao/zjg/yewu/liaocheng.js` 的普通工具提示文本改走 `renderFinalMessage()`。
- `zhiliao/jiemian/jiaohu.js` 的复制 HTML 生成改走 `ZhiLiaoMessageRendererModule.buildClipboardHtml()`。
- 附件图片 `alt` 改用 `escapeAttr()`，普通附件文件名继续使用文本转义。

### 保持不变

- 消息外壳 DOM 不变。
- 输入区、左侧导航、右侧智聊布局不变。
- 图片、视频、商品查询、优惠券等结构化业务卡片不改渲染路径。
- 流式阶段不完整解析 Markdown 表格，最终完成后再完整渲染。
- 复制按钮位置、图标、成功状态不变。

### 子代理审查处理

只读架构审查确认：

- 最小风险边界应是“统一文本渲染内核”，不接管消息 DOM 外壳和业务 HTML。
- 必须保留流式 partial、最终 full 的双态模型。
- 必须保留 `.system-message + .message-actions`、`data-full-text`、`.system-text` 和图片预览契约。
- 应统一文本转义和属性转义边界。

本轮已按上述意见处理：

- 只收口 AI 文本、系统文本和思考文本。
- 业务卡片和历史 `isHtml` 旁路保持原状。
- 新增并使用 `escapeAttr()` 处理附件图片属性场景。

### 验证项

- JS 语法检查覆盖：
  - `zhiliao/jiemian/message_renderer.js`
  - `zhiliao/jiemian/buju.js`
  - `zhiliao/jiemian/jiaohu.js`
  - `zhiliao/zjg/jiemian/jiaohu.js`
  - `zhiliao/zjg/jiemian/xianshi.js`
  - `zhiliao/zjg/yewu/liaocheng.js`
  - `zhiliao/loader.js`
- 乱码扫描覆盖本轮修改文件。
- 行为模拟覆盖：
  - Markdown 表格最终渲染。
  - 流式中间态不渲染表格。
  - 代码块内表格不被误解析。
  - 不安全链接不进入 HTML 链接。
  - 复制 HTML 能由 Markdown 表格生成真实表格。
