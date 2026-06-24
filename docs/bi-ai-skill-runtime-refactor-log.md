# BI AI Skill Runtime 重构记录

## 2026-06-20

### 计划

本次重构限定在 BI 查询模块的 AI 编排层：

- 不改 UI、CSS、布局。
- 不改主查询、BI 查询面板、指标详解业务查询服务。
- 不改工具 schema。
- 不接入智聊全局 skill center，避免跨模块耦合。
- 只为 BI 内部新增轻量 skill runtime。

### 架构讨论结论

多位只读审查代理结论一致：

1. 当前 BI AI 已有工具循环和执行骨架。
2. `bi-query-skill` 文档结构合理，但没有进入运行时。
3. 同环比应作为“时间对比方法 skill”，不应接管主体识别和工具选择。
4. 最小改造应放在 `gongn/yunying/zx/ai/*`，不动根加载链。

### 已执行

- 新增 `gongn/yunying/zx/ai/skill.js`。
- 新增 `gongn/yunying/skill/bi-query-skill/references/09-运行时编排.md`。
- 新增本计划文档和记录文档。
- 更新 `SKILL.md` 读取顺序，明确所有场景挂载在通用工作流下。
- 在 `gongn/yunying/app.js` 的 BI AI 内部加载链中加入 `zx/ai/skill.js`。
- 更新 `zx/ai/ty/gz.js`，统一 BI AI 系统提示词改为 skill runtime 组合，保留 fallback prompt。
- 更新 `zx/ai/ty/yw.js`，发送前并行准备 skill prompt 和智聊模型网关。
- 更新 `zx/ai/ty/app.js`，全局 AI 适配器直接复用统一系统提示词入口，并透传调用选项。
- 根据独立审查意见，`zx/ai/skill.js` 的 skill 文档目录改为优先基于当前脚本 URL 推导，回退到原相对路径，降低二级目录和 `base href` 部署下的文档 404 风险。

### 验证

- `node --check` 已通过：
  - `gongn/yunying/zx/ai/skill.js`
  - `gongn/yunying/zx/ai/ty/gz.js`
  - `gongn/yunying/zx/ai/ty/yw.js`
  - `gongn/yunying/zx/ai/ty/app.js`
  - `gongn/yunying/app.js`
- 乱码扫描未发现 Unicode replacement character、mojibake marker 或常见 UTF-8 错显片段。
- Node VM 模拟已通过：问题“分析刘蕊成同环比情况”在模板快照存在“刘蕊成”时命中 `同环比分析` 与 `模板查询`，并注入通用工作流、主查询协议、BI 查询参考和模板路线规则。
- 浏览器式脚本路径模拟已通过：从 `gongn/yunying/zx/ai/skill.js` 可推导到同级业务目录下的 `gongn/yunying/skill/bi-query-skill/`。

### 审查

- 独立架构审查代理 Rawls 结论：建议交付，不建议打回重做。
- Rawls 提出的中等风险为 skill 文档相对路径在二级路径或 `base href` 部署下可能 404。已通过“基于 `skill.js` 自身 URL 推导文档目录”的方式收敛。
- Rawls 确认：UI/CSS 未被本轮链路改造触碰，工具 schema 和执行分发保持原样，异步提示词链路未发现阻断竞态，整体符合“通用工作流 + 按需 skill”。

## 2026-06-20 追踪修正：模板索引未展开导致主体误判

### 问题

用户在主查询页未展开模板下拉时询问“分析刘蕊成同环比情况”，AI 回复当前快照没有名为“刘蕊成”的模板并要求用户确认主体。

根因是 `YejiMainAiGuize.buildTemplateSnapshot()` 只读取 `state.templates`。模板列表通常在模板下拉、BI 查询面板或目标模板等场景中按需加载；用户只停留在主查询页时，`state.templates` 可能为空且 `templatesLoaded` 为 false，导致 AI 缺少模板索引证据。

### 修正

- 在 `YejiBiAiYewu.requestBiAiAnswer()` 构造 snapshot 前静默调用 `loadTemplates()`，不打开模板面板，不修改筛选、字段、分页、表格或 UI 状态。
- `YejiMainAiGuize.buildTemplateSnapshot()` 增加 `loaded` 和 `count`，让 AI 区分“模板索引未加载”和“模板索引已加载但为空”。
- 通用工作流补充规则：不能因为名称像人员姓名就排除模板候选；模板可能用人员、区域或项目命名。
- 同环比 skill 补充规则：缺少模板索引时，先用 `templateName` 做只读验证；不要直接要求用户确认。

### 验证

- `node --check` 已通过：
  - `gongn/yunying/zx/ai/ty/yw.js`
  - `gongn/yunying/zx/ai/main/gz.js`
  - `gongn/yunying/zx/ai/skill.js`
- 乱码扫描未发现异常。
- Node VM 模拟已通过：模板索引加载后，`buildTemplateSnapshot()` 输出 `loaded:true`、`count:1`、`availableTemplates:[刘蕊成]`，问题“分析刘蕊成同环比情况”命中 `同环比分析` 与 `模板查询`。

### 审查

- 独立审查代理 Cicero 结论：未发现阻塞性问题，建议交付。
- Cicero 确认：`loadTemplates()` 只读加载模板并写入缓存，不会静默展开模板面板，不改变 UI、样式或工具 schema。
- Cicero 确认：取消或新请求场景下，模板缓存写入属于可接受的只读预加载副作用；后续模型调用仍受 `seq` 检查保护。

## 2026-06-20 追踪优化：运行时 prompt 精简

### 问题

运行时 prompt 已具备通用工作流和按需 skill 能力，但仍存在文档级重复：

- 早期 `SKILL.md`、全局边界和工作流长文同时注入，部分规则重复。
- 同环比场景文档像操作手册，包含长 JSON 示例和逐步 SOP，token 成本高。
- 工具协议会因为“查询/分析”等泛词被加载，导致不必要的 prompt 膨胀。

### 修正

- 新增 `references/09-运行时编排.md`，作为模型运行时精简执行契约。
- `YejiBiSkillRuntime` 常驻注入改为 `09-运行时编排`、回答规范和错误处理；`SKILL.md` 保留为人工维护入口，不再默认全量注入。
- `references/00-全局边界.md` 和 `references/08-工作流.md` 的规则已由 `09-运行时编排`、回答规范和错误处理吸收，移出最小 skill 集。
- 同环比场景改为方法卡结构：触发、主体路由、日期口径、查询策略、计算复核、输出和禁区，保留核心规则，移除长示例。
- 工具协议按需加载条件收紧，只在用户涉及参数、工具、queries、分页、排序、字段、筛选、聚合等语义时加载。

### 验证

- `node --check gongn/yunying/zx/ai/skill.js` 通过。
- 乱码扫描未发现异常。
- “分析刘蕊成同环比情况”仍命中 `同环比分析` 与 `模板查询`，并保留模板路线规则；prompt 长度约 8.8K 字符。
- “按客户名称筛选张三，查含税金额并分页排序”命中 `客户查询`，加载字段字典、工具协议和主查询参考。
- “分析目标达成情况”命中 `目标达成`，加载 BI 查询和指标详解参考。
- “多维度看看当前数据”没有强命中场景，仅保留运行时编排，prompt 长度约 3.2K 字符。

## 2026-06-20 追踪清理：移除过时 references

### 修正

- 删除 `references/00-全局边界.md`。
- 删除 `references/08-工作流.md`。
- 更新 `SKILL.md` 的读取顺序，当前最小 skill 集以 `references/09-运行时编排.md` 为总流程入口。

### 原因

`00-全局边界.md` 的只读边界、禁止访问后台、不能编造、字段真实存在、queries 和分页限制，已由 `09-运行时编排.md`、`06-回答规范.md`、`07-错误处理.md` 和 `02-工具协议.md` 覆盖。

`08-工作流.md` 的理解、主体识别、工具选择、内部计划、执行补查、证据复核和回答流程，已由 `09-运行时编排.md` 精简吸收。

### 前置流程一致性修正

- `loadTemplates()` 改为 provider 感知缓存：只有拿到当前 BI 登录 provider 后，才把模板索引标记为已加载。
- 如果 provider 不存在或 Firebase 模板服务不可用，不再把空模板列表标记为有效加载结果，避免 AI 在登录恢复前缓存“已加载但为空”的错误模板索引。
- `ensureBiAiTemplateIndex()` 不再自行判断 `templatesLoaded`，统一调用 `loadTemplates()`，由模板加载入口负责 provider、缓存和刷新判断，避免 AI 前置流程和模板缓存规则分叉。
