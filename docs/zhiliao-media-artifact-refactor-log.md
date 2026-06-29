# 智聊媒体产物链路重构记录

## 2026-06-21

- 开始重构图片、视频、图表统一媒体产物链路。
- 目标是支持 `card_only` 与 `await_then_reply` 两种交付模式。
- 首轮只读梳理确认：
  - 图片/视频已有后台任务卡片。
  - 图表仍是同步工具结果卡片。
  - 展示层已基本复用图片/视频卡片渲染。
  - 编排层存在多处分支，适合抽象为媒体策略层与产物仓库。

## 设计决策

- 不改现有卡片样式。
- 不把真实媒体 URL 交给 AI 最终回复。
- AI 需要插入媒体时使用 `[[media:artifact_id]]` 占位符。
- 图表纳入统一媒体任务层，但保留原 ECharts 生成实现。

## 实施记录

- 新增 `zhiliao/zjg/yewu/meiti_celue.js`：统一识别图片、视频、图表媒体工具，并归一 `card_only` / `await_then_reply` 策略。
- 新增 `zhiliao/zjg/yewu/meiti_chengguo.js`：登记媒体产物，前端内存保存真实 URL，对 AI 只暴露 `artifact_id` 与 `[[media:...]]` 占位符。
- 调整 `zhiliao/loader.js` 与 `zhiliao/zjg/app.js`：把媒体策略层、产物仓库层放在媒体资源与任务队列之前加载。
- 重构 `zhiliao/zjg/yewu/meiti_renwu.js`：图片、视频、图表统一进入媒体任务队列，统一等待卡片、计时、完成态与失败态。
- 重构 `zhiliao/zjg/yewu/liaocheng.js`：媒体工具统一分流，纯生成直接移除空流式消息，等待续写模式等待产物完成后再把安全摘要写入 tool result 并继续 AI 回复。
- 调整 `zhiliao/zjg/yewu/yasuo.js`：净化媒体工具的 `tool_call.arguments`，避免原始 URL、data URL、base64 或过大图表数据长期进入 AI 历史。
- 调整 `zhiliao/zjg/jiemian/xianshi.js`：结果卡片仍复用原渲染函数，仅让任务卡支持 `chart` 标题与图标，并在最终消息渲染后替换媒体占位符。
- 调整图片、视频、图表工具 schema：新增可选 `delivery_mode`，不改变工具后端执行逻辑。
- 调整全局调度与三类媒体 skill 提示：统一说明纯生成使用 `card_only`，生成后分析/编排使用 `await_then_reply`，并禁止输出原始链接、data URL、base64。
- 调整新会话初始化：清理媒体任务队列、媒体产物仓库与媒体资源池，避免旧会话产物跨会话引用。
- 二次收口审查移除旧媒体分流 API `isMediaToolName()` 与未使用的 `shouldAwaitMediaTask()`，避免残留兼容层。
- 媒体任务完成态增加会话边界校验：任务所属会话已切换时不再渲染结果卡或触发 AI 续写。
- 终审修正工具流会话边界：`handleToolCalls()` 固定入口会话 ID，普通工具、媒体任务、媒体等待、历史写入、AI 续写均在关键 await 后校验会话仍然有效。
- 终审修正媒体任务 runner：增加 active task/id，`startNewSession()` 会 resolve 并移除 pending/running 媒体任务；旧 runner 的 finally 不再影响新会话队列、不再持久化新会话快照。
- 终审收敛媒体类型事实源：图片、视频、图表类型判断统一回到 `getMediaArtifactKind()`，避免 `MEDIA_TOOLS` 与多处字符串判断双重维护。
- 终审安全化媒体卡渲染：`renderImageResultCard()` / `renderVideoResultCard()` 保持原样式字符串和插入位置，改为 DOM API 设置媒体节点，并校验媒体 URL 协议。
- 终审安全化显示快照：保存与恢复 HTML 前接入 `sanitizeDisplayElement()` / `sanitizeDisplayHtml()`，清除危险节点、事件属性和危险协议，同时保留历史恢复所需的安全媒体源、class 与 style。
- 终审统一历史脱敏：生成媒体、图表与商品图片进入 API history 时不保留真实 `http/https` 媒体 URL、data URL 或 base64。
- 终审补充媒体任务异常文案换行：只给 `.media-task-title` / `.media-task-subtitle` 增加长串换行能力，正常布局和视觉不变。
- 终审补齐显示快照 generation 守卫：快照保存捕获会话 ID 与 generation，采集、blob 转换和写入 IndexedDB 前均校验；新会话会递增 generation 并等待旧快照链自然退出，避免旧 DOM 在清库后回写。

## 审查响应

- 已响应 Gibbs 审查提出的核心风险：`tool_call.arguments` 原样入历史的问题已通过 `compactToolCallArgumentsForHistory()` 处理。
- 已响应 Gibbs 审查提出的链路分散问题：图片、视频、图表统一走 `MediaTask -> Artifact -> Card/AI Followup`。
- 已保持卡片 DOM/CSS 主体不变：结果展示仍调用 `renderImageResultCard()` / `renderVideoResultCard()`。
- Kant 终审指出 `await_then_reply` 自动推断存在编码/正则风险。已将 `meiti_celue.js` 中的中文意图词与正则改为 ASCII-safe Unicode escape，并用 Node VM 覆盖测试确认：
  - `生成趋势图并分析原因` -> `await_then_reply`
  - `生成销售柱状图` -> `card_only`
  - `生成海报后写一段文案` -> `await_then_reply`
  - 显式 `delivery_mode` 优先级高于启发式推断。
- Laplace 终审指出跨会话污染、媒体 runner 竞态、显示快照安全、旧快照链回写和旧链路重复风险。已按“统一会话守卫 + 媒体任务生命周期 + 快照 generation + 显示快照净化 + 单事实源”处理。
- 非生成类工具返回 `image_url` / `video_url` 的直接卡片展示分支保留，用于商品图片、媒体理解等既有工具结果展示；生成媒体工具已由 `isMediaArtifactToolName()` 提前接管，不会绕过 `delivery_mode`。

## 2026-06-29 视频后台卡片审查

- 发现视频纯生成时，`card_only` 队列结果仍包含任务文案与任务号；一旦混合工具场景没有命中“纯媒体任务”分支，AI 可能把该结果复述为普通文本。
- 收敛 `buildQueuedMediaToolResult()`：`card_only` 只保留媒体类型、交付模式、队列状态与 `suppress_followup`，不再向 AI 历史暴露任务文案或任务号。
- 收敛 `handleToolCalls()` 的续写判定：按“是否已由前端卡片接管”判断是否跳过 AI 续写，而不是依赖媒体任务数量与工具调用数量完全一致。
- 未调整 `renderImageResultCard()` / `renderVideoResultCard()` / `createMediaTaskCard()` 的 DOM 结构和样式字符串，结果卡片布局保持不变。
- 取消视频工具默认 300 秒等待上限：视频工具不再向 AI 暴露 `timeout_ms`，内部固定不设置前端/网关等待上限；视频轮询会一直持续到上游返回可播放链接、明确失败或网络请求失败。
- 为无限轮询补充媒体任务生命周期检查：同一会话内不限制等待时间；切换会话或任务被清理后，旧视频轮询会自然退出，避免后台请求无限残留。
- 对齐 Agnes 官方异步视频语义：创建任务阶段遇到 `503`、`Queue is full`、`ServiceUnavailable` 等上游队列繁忙错误时，直接以“上游队列已满，请稍后重试。”结束当前卡片，避免用户误以为视频任务已创建并正在生成。
- 后端 Agnes 结果查询默认只传 `video_id`，仅在非默认模型时追加 `model_name`，贴合官方推荐查询方式。

## 验证记录

- `node --check` 已通过以下文件：
  - `zhiliao/app.js`
  - `zhiliao/loader.js`
  - `zhiliao/jiemian/message_renderer.js`
  - `zhiliao/jiemian/buju.js`
  - `zhiliao/zjg/app.js`
  - `zhiliao/zjg/yewu/meiti_celue.js`
  - `zhiliao/zjg/yewu/meiti_chengguo.js`
  - `zhiliao/zjg/yewu/meiti_renwu.js`
  - `zhiliao/zjg/yewu/liaocheng.js`
  - `zhiliao/zjg/yewu/yasuo.js`
  - `zhiliao/zjg/jiemian/xianshi.js`
  - `zhiliao/zjg/jiemian/jiaohu.js`
  - `zhiliao/zjg/huihua/kuaizhao.js`
  - `zhiliao/zjg/huihua/qidong.js`
  - 图片、视频、图表工具 schema 与相关 skill 文件。
- Node VM 覆盖测试已通过：
  - `delivery_mode` 显式优先级与中文意图推断。
  - 媒体工具参数压缩不泄露真实 URL / data URL。
  - 商品图片 URL 历史压缩为 `[image-url]`。
  - 图表结果摘要不泄露 `data:image`。
  - artifact summary 只暴露 `artifact_id` 与 `[[media:...]]`。
- 乱码扫描未发现本轮新增文件/改动区域中的常见乱码标记。
- 旧 API / 旧分支残留扫描未发现：`isMediaToolName()`、`shouldAwaitMediaTask()`、`onlyImageToolCalls`、`onlyVideoToolCalls`、`onlyChartToolCalls`、`hasSuccessfulVideoResult`、`AWAIT_HINT_RE`、`renderMarkdown()`、`renderMarkdownPartial()`、`setLoadingMessage()`。
- `git diff --check` 通过，仅提示仓库换行符策略会在 Git 触碰时把 LF 转 CRLF。
