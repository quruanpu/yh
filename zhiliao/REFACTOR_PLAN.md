# 智聊模块重构计划（保持布局样式不变）

## 目标
- 减少冗余代码，提升可维护性与稳定性。
- 不改动任何布局样式：不修改 HTML 结构与 CSS 规则。
- 保持云函数流式、思考开关、工具调用能力可用。
- 联网能力改为“工具常驻 + 原生联网参数默认开启”的统一策略。

## 边界
- 仅改 `zhiliao` 模块 JS 逻辑层。
- 不改 `index.html` 布局结构（仅允许新增脚本引用，不改可视布局）。
- 不改 `zhiliao/jiemian/yangshi/*.css`。

## 分阶段计划

### Phase 1（低风险减冗余，已执行）
1. 移除重复工具注册，避免重复遍历与潜在重复 side-effect。
2. 分组流程下避免不必要的多模态内容构建（减少无效 DB 读取/拼装）。
3. 清理死代码变量（`fileDataMap`）。
4. 修复分组提示索引逻辑（传入真实分组序号）。
5. 增加文件标签预览 URL 回收（减少临时 object URL 泄漏）。
6. 修复本文件内异常编码导致的语法不稳定字符串，确保可编译。

### Phase 2（性能与可读性，进行中）
1. 拆分 `sendMessage` 为多个小函数（输入校验、历史入栈、文件分支、请求分支）。- 已完成
2. 优化流式渲染策略：减少重复 `innerHTML` 全量重刷。- 已完成（调度器合帧/合并中间帧）
3. 统一错误文案与日志层级（debug/info/warn/error）。- 已完成

### Phase 3（解耦，待执行）
1. 将 `app.js` 按职责拆分为：消息编排、流式处理、工具执行。
2. 收敛 `window.*` 全局依赖，改为集中 facade 注入。

## 验收标准
- 语法检查：`zhiliao` 全部 JS 文件 `node --check` 通过。
- 功能检查：发送消息、文件上传、分组分析、工具调用流程无报错。
- UI 约束：页面布局和样式无变更。
- 编码稳定：无新增乱码，关键交互文案可读。

## 测试矩阵
- 静态：语法检查、关键引用检查、冗余项清除检查。
- 行为：
  - 普通消息流式回复。
  - 文件上传后单组/多组分析。
  - 思考开关（默认关闭、开启后传参）。
  - 联网工具调用链路（`search_web` / `fetch_web_page`）。

## 本轮结果
- 已完成 Phase 1。
- 已完成 Phase 2 全部 3 项（`sendMessage` 拆分、流式调度优化、日志与错误文案统一）。
- 修复了 `app.js` 中确定性字符串问题：模板插值失效（`?{}`）、关键用户文案乱码、`systemPrompt` getter 返回值被注释吞掉等。
- 新增统一辅助方法：`pushUserHistory`、`setWaitingState`、`showAIError`、分级日志方法。
- 增加思考显示闸门：仅在前端开启思考时渲染 reasoning 流，默认关闭不展示思考内容。
- 修复 `Claude` 流解析工具参数拼接问题（`input:{}` + `input_json_delta` 导致 JSON 失效）。
- 重写 `jiemian/jiaohu.js` 交互层实现（保持原接口），清除异常编码导致的事件绑定/提示文案风险。
- 已通过 `zhiliao` 全量 JS 语法检查。
- 未改动任何 CSS/HTML 布局文件。
- 新增联网工具模块：`zhiliao/gongju/jiekou/network/app.js`，接入独立 `Server_api` 云函数。
- 前端不再依赖“联网开关”状态，默认向网关传递 `network=true`，由模型自主决策是否联网。
- 为 Claude 兼容服务增加 `thinkingMode=disabled` 优先策略与工具续写兼容字段透传（`reasoning_content` / `reasoning_signature`）。
