# 业务模块加载链优化记录

## 2026-06-21

### 审查结论

- 优惠券、商品查询、BI 运营查询、工具中心均存在点击后空白窗口，根因是 `switchModule()` 在目标模块未就绪前隐藏当前模块。
- 智聊无同类问题，因为 `zhiliao/loader.js` 已提前注册轻量壳并创建聊天布局。
- `XLSX` 当前被 BI 汇总导出、目标模板下载/上传、智聊 Excel 解析使用；首屏移除 Excel 库后，BI 链路没有按需加载入口。
- 启动期业务初始化应执行模块 `init()` 创建隐藏页面 DOM，但不能触发 `show()` 中的搜索、订阅、BI 查询等业务动作。

### 计划

- 新增系统级外部依赖加载入口，优先加载本地 `buju/wb/xlsx/xlsx.full.min.js`。
- 将 BI Excel 导出/模板下载/模板读取改为使用统一依赖入口。
- 将智聊 Excel 解析改为复用统一依赖入口，保留原有 CDN 兜底。
- 调整主框架切换时序，目标模块未就绪时不提前隐藏当前模块。
- 增加业务模块启动期初始化队列，优惠券、商品查询、BI、工具中心与智聊首屏链路并发推进。

### 实施记录

- `script.js` 新增 `ensureExternalDependency('xlsx')`，本地 `buju/wb/xlsx/xlsx.full.min.js` 优先，CDN 仅兜底。
- `script.js` 调整 `switchModule()`：目标模块加载和显示前，当前可见模块保持可见；目标切换失败时恢复当前可见模块的导航状态。
- `script.js` 新增启动期业务模块初始化队列，在智聊首屏链路启动后并发执行优惠券、商品查询、BI、工具中心的 `loadModule()`，只完成模块脚本和隐藏 DOM 初始化，不调用 `show()`。
- `gongn/yunying/zx/plgj.js`、`gongn/yunying/zx/plcx.js` 已将 BI 汇总 Excel 导出改为按需等待 Excel 库。
- `gongn/yunying/zx/plcx/mb/gj.js`、`gongn/yunying/zx/plcx/mb/yw.js` 已将目标模板下载和上传读取改为按需等待 Excel 库。
- `zhiliao/yewu/jiexi.js` 已将 Excel 文件解析改为复用系统级 Excel 依赖入口。
- `package.json`、`package-lock.json` 增加 `xlsx@0.18.5` 开发依赖，用于生成和追溯本地运行时文件。

### 审查与验证

- 现有架构审查结论确认四个业务模块的空白根因是切换时序，而不是业务页面 DOM/CSS 本身。
- 审查确认业务模块 `init()` 主要创建隐藏 DOM 和绑定事件，查询、订阅、BI 连接等业务动作仍集中在 `show()` 或用户操作阶段。
- 已执行 `node --check` 覆盖本轮改动 JS 文件，未发现语法错误。
- 已执行 `git diff --check`，未发现空白错误。
- `rg` 扫描确认 BI 汇总导出、目标模板下载/读取、智聊 Excel 解析均已存在按需依赖入口。
