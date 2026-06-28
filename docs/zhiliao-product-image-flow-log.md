# 智聊商品图生图链路重构记录

## 2026-06-28

### 结构设计

- 建立三层职责：
  - AI/skill 负责意图规划。
  - 商品查询负责把商品图片登记为会话图片资源。
  - 生图工具负责执行前资源校验和高置信度补齐。
- 不修改商品卡片、图片卡片、消息卡片样式。
- 不新增独立生图工具或商品查询工具。
- 不硬编码具体商品名、价格或品牌。

### 前端链路

- `a_skill/app.js` 统一商品关键词候选抽取与清洗。
- `spcx.js` 改为使用统一关键词抽取。
- `chaxun/app.js` 在商品查询成功后登记商品图到图片资源池，并返回 `image_ref`。
- `yasuo.js` 在商品工具历史中保留图片引用，不暴露原始 URL。
- `tpsc.js` 优先使用商品图片引用；只有高置信度商品图生图意图才尝试补商品图。
- `liaocheng.js` 让媒体任务入队前经过 skill 参数准备，队列执行时跳过重复 skill。
- `ToolSkillCenterModule.beforeExecute()` 支持返回执行产物 `artifacts`，用于展示补查商品卡片。

### 后端统一网关

- OpenAI 图片 provider：
  - 文生图走 `/v1/images/generations`。
  - 带参考图时优先走 `generations + image[]`，保留 `/v1/images/edits` 作为支持官方 edits 服务的回退。
  - 成功响应必须包含图片，否则直接失败。
- Agnes 图片 provider：
  - 参考图放在顶层 `image` 数组。
  - `extra_body` 只保留响应格式、质量、背景等选项。
  - 成功响应必须包含图片，否则直接失败。

### 本轮收敛

- 前端 `shengtu/http.js` 不再递归扫描供应商原始结构、文本、Markdown 或任意 base64 字段。
- 前端只读取统一输出字段：`image_url`、`image_urls`、`images[].url`、`images[].image_url`。
- 如果后端返回 `success:false`，前端直接按失败处理并展示后端错误。
- Agnes provider 解析文件中的历史乱码正则已替换为干净 ASCII 实现。

### 审查结论

- 请求链路已统一到 `generate_or_edit_image -> requestImage -> postJson`。
- 展示层继续复用原来的图片卡片渲染，不改变 UI 布局样式。
- 供应商差异保留在后端 provider 子模块，前端只消费统一 DTO。
