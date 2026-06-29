# BI 通用 AI 业务接入审计清单

## 当前保留模块

- `gongn/yunying/zx/ai/gz.js`
- `gongn/yunying/zx/ai/yw.js`
- `gongn/yunying/zx/ai/app.js`
- `gongn/yunying/zx/ai/ty/gz.js`
- `gongn/yunying/zx/ai/ty/yw.js`
- `gongn/yunying/zx/ai/ty/app.js`
- `gongn/yunying/zx/ai/main/gz.js`
- `gongn/yunying/zx/ai/main/gj/gz.js`
- `gongn/yunying/zx/ai/main/gj/cx.js`
- `gongn/yunying/zx/ai/main/gj/app.js`
- `gongn/yunying/zx/plcx/ai/gz.js`
- `gongn/yunying/zx/plcx/ai/gj/gz.js`
- `gongn/yunying/zx/plcx/ai/gj/cx.js`
- `gongn/yunying/zx/plcx/ai/gj/app.js`
- `gongn/yunying/zx/plcx/qs/ai/gz.js`
- `gongn/yunying/zx/plcx/qs/ai/gj/gz.js`
- `gongn/yunying/zx/plcx/qs/ai/gj/cx.js`
- `gongn/yunying/zx/plcx/qs/ai/gj/app.js`

## 已移除旧入口

- 主查询局部 AI UI 与适配器。
- BI 查询弹窗局部 AI UI 与适配器。
- 指标详解弹窗局部 AI UI 与适配器。

## 验收清单

- [x] 只有一个 BI 通用 AI 悬浮入口。
- [x] BI 查询弹窗不再渲染自己的 AI 图标。
- [x] 指标详解弹窗不再渲染自己的 AI 图标。
- [x] 主查询工具支持分页、筛选、字段、聚合字段和模板查询。
- [x] BI 查询弹窗打开时动态增加 BI 查询面板工具权限。
- [x] 指标详解弹窗打开时动态增加指标详解工具权限。
- [x] 工具查询不修改当前页面状态。
- [x] 子模块内部动态加载，`index.html` 不追加 AI 子脚本。
- [x] 完成语法检查。
- [x] 完成乱码扫描。
- [x] 完成旧引用扫描。
