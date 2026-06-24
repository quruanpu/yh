# BI Skill 方法路由重构记录

## 2026-06-21

- 建立本轮重构计划和记录。
- 目标范围限定为 BI skill 文档和运行时 prompt 路由。
- 不改 BI 查询工具协议，不改 UI、布局和样式。
- 重写 `SKILL.md` 和 `manifest.md`，将同环比从场景迁移为方法。
- 删除旧 `scenarios/同环比分析.md`，新增 `methods/同环比分析` 下的方法索引、主查询分支、BI 查询分支和指标详解分支。
- `gz.js` 快照新增 `activeContext`，表达当前默认上下文和优先工具。
- `skill.js` 支持 `methods` 清单，按当前上下文加载同环比分支，不再命中同环比就无条件加载主查询引用。
- 根据独立审查意见修正 BI 查询面板同环比路由：面板打开时先加载 BI 查询同环比分支，趋势/诊断仅作为辅助分支追加。
- `skill.js` 的方法入口改为先从 `manifest.md` 选中 method 项，再展开同环比方法分支，降低后续新增方法时的运行时同步成本。
- `buildFallbackSystemPrompt()` 同步当前面板优先规则，避免 skill runtime 不可用时兜底提示偏离主路径。
