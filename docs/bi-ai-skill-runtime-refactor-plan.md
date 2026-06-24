# BI AI Skill Runtime 重构计划

## 目标

让 BI 查询模块的统一 AI 助手从“大段 JS 提示词驱动”升级为“通用工作流 + 按需 skill 驱动”。

本次只调整 AI 提示词编排和 skill 接入方式，不改 BI 页面 DOM、CSS、主查询、BI 查询面板、指标详解业务壳和工具执行协议。

## 原则

1. 所有行为、功能、布局、样式保持不变。
2. 不引入乱码、语法错误、编码风险。
3. 不把业务分析流程写死；业务场景通过 skill 提供专业规则。
4. 通用流程负责理解、规划、执行、复核；场景 skill 只负责增强。
5. 文件结构保持简单，新增模块只承担单一职责。
6. 工具 schema 和查询服务继续以现有 JS 业务壳为准。

## 当前问题

BI 通用 AI 已有快照、工具 schema、工具循环和多轮补查基础，但 `bi-query-skill` Markdown 文档没有进入运行时。实际运行仍依赖 `zx/ai/ty/gz.js` 中硬编码的大段系统提示词。

这会带来三个问题：

- 新增业务 skill 需要改 JS，扩展成本高。
- 同环比等场景规则容易变成固定流程，压过通用理解。
- 文档规则和运行时规则会漂移。

## 目标架构

保留现有执行链：

- `zx/ai/app.js`：AI runtime facade。
- `zx/ai/ty/*`：统一 BI AI 助手。
- `zx/ai/main/gj/*`：主查询工具。
- `zx/plcx/ai/gj/*`：BI 查询面板工具。
- `zx/plcx/qs/ai/gj/*`：指标详解工具。

新增：

- `zx/ai/skill.js`：BI skill runtime，加载和缓存 skill 文档，解析 manifest，按用户问题选择场景和参考文档，输出 prompt 片段。
- `skill/bi-query-skill/references/09-运行时编排.md`：运行时精简执行契约，定义理解、规划、执行、复核和回答流程。

## 加载方案

在 `gongn/yunying/app.js` 的 `getBiAiScriptList()` 中，将 `gongn/yunying/zx/ai/skill.js` 放在统一助手 `ty/gz.js` 之前。

不修改 `index.html` 和根 `script.js` 的 BI 懒加载列表。

`zx/ai/skill.js` 优先基于自身脚本 URL 推导 `skill/bi-query-skill/` 文档目录，避免部署路径变化时依赖页面相对路径；无 DOM 或推导失败时回退到原项目相对路径。

## Prompt 方案

`zx/ai/ty/gz.js` 只保留短通用身份、权限、工具边界和输出格式。业务细节通过 `YejiBiSkillRuntime` 注入：

- 常驻：`references/09-运行时编排.md`、`references/06-回答规范.md`、`references/07-错误处理.md`。
- 按需：`manifest.md` 命中的 `scenarios/*.md`。
- 按需：字段、工具协议、主查询、BI 查询、指标详解 references。

`SKILL.md` 保留为人工维护入口，不默认全量注入运行时 prompt。旧版 `references/00-全局边界.md` 和 `references/08-工作流.md` 已由 `references/09-运行时编排.md`、回答规范和错误处理吸收，移出最小 skill 集。

## 主体识别依赖

BI AI 在构造统一快照前应静默加载模板索引。模板索引属于只读上下文，不改变页面筛选、字段、分页、表格或模板面板展开状态。

裸名称识别时，模板、客户、商品、区域、活动和单据都是候选主体。不能因为名称像人员姓名就跳过模板候选；若模板索引已加载且命中模板，优先按模板路线规划。若模板索引不可用，应先通过只读查询能力验证模板候选，再决定是否澄清。

## 实施步骤

1. 新增计划和记录文档。
2. 新增 `zx/ai/skill.js`。
3. 新增 `references/09-运行时编排.md`。
4. 更新 `SKILL.md` 的读取顺序。
5. 在 `app.js` 中加载 skill runtime。
6. 修改 `ty/gz.js`，让系统提示词由 skill runtime 组合。
7. 修改 `ty/yw.js`，发送前预加载 skill 文档，并确保智聊模型网关按需就绪。
8. 修改 `ty/app.js`，让全局 AI 适配器复用统一系统提示词入口。
9. 运行语法检查和静态扫描。
10. 请架构审查代理复核。

## 验收标准

- BI 页面布局和样式没有修改。
- 三个 BI 工具 schema 和查询服务没有修改。
- AI 面板仍能打开、发送、流式回复、调用工具和展示状态。
- skill 文档加载失败时仍有基础 fallback prompt。
- 新增 JS 文件通过语法检查。
- 新增/修改 Markdown 为 UTF-8 正常中文。
- 审查代理无阻断问题。
