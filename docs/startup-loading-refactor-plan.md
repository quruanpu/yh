# 启动加载链重构计划

## 目标

- 登录链优先启动，保证 SCM 强制登录检测、设备码、凭证恢复不被业务模块阻塞。
- 智聊作为默认首屏模块优先可见，左侧导航和右侧完整聊天布局先出现。
- 优惠券、商品查询、BI 运营查询、工具中心按需加载，避免首屏解析和执行非关键业务代码。
- 保持现有行为、功能、布局样式不变；只调整加载时机、认证门禁和后台服务边界。
- 所有脚本加载顺序显式可追溯，必须串行的依赖保持串行，可延后的模块不参与首屏竞争。
- 第二阶段在不改变业务表现的前提下收敛重复加载器、重复数据库清理逻辑和不再需要的轮询等待。

## 第一性原则

1. 首屏只承担系统壳、登录入口、智聊可见布局。
2. 已有全局对象契约保持不变，业务模块仍通过 `AppFramework.setModuleInstance()` 托管。
3. 懒加载不是兼容补丁，而是主框架原生能力：模块注册与模块装载解耦，脚本加载状态由主框架统一维护。
4. 数据库写入、监听、清理等副作用按业务真实依赖分层：真实 SCM 认证后必须自动维护的轻量后台任务前置到后台运行时，页面 UI 副作用仍留在页面首次打开。
5. 文档解析库按文件类型加载，上传 PDF、Excel、Word 时再加载对应第三方库。

## 现有问题

- `index.html` 预加载优惠券、商品查询、工具中心、BI 运营查询和智聊完整链路。
- BI 运营脚本依赖多、体积大，但不是首屏必需。
- 智聊 loader 直接加载完整工具链，用户看到聊天布局前需要等待大量脚本。
- `pdf.js`、`xlsx`、`mammoth` 在 `head` 中加载，但只有上传对应文件时才需要。
- `AppFramework.init()` 与 `LoginModule.init()` 均挂在 `load`，登录启动容易被首屏资源拖慢。

## 目标加载分层

### L0 系统壳

- `buju/wb/tailwind.css`
- `buju/wb/fontawesome/css/all.min.css`
- `styles.css`
- `buju/sj.css`
- `buju/zm.css`
- `script.js`
- `tongzhi/yangshi.js`
- `tongzhi/app.js`
- `denglu/gg.css`

### 外部样式归档

- 运行时外部样式统一放入 `buju/wb`。
- Tailwind 生产 CSS 由 `npm run build:tailwind` 直接输出到 `buju/wb/tailwind.css`。
- Font Awesome 固定使用 `@fortawesome/fontawesome-free@6.4.0`，运行时文件放在 `buju/wb/fontawesome/css` 与 `buju/wb/fontawesome/webfonts`，保持与原 CDN 6.4.0 一致的 class 与字体资源。
- `tailwind.input.css` 是构建源文件，不进入运行时外部样式目录。

### L1 登录链

- `denglu/app.js`
- `gongn/yhquan/config.js` 与 `gongn/chaxun/config.js` 为 SCM/PMS 凭证校验提供 API 地址。
- `gongn/yunying/config.js` 与 `gongn/yunying/gongju.js` 为 BI 代理发现和 BI token 校验提供基础能力。
- 由 `LoginModule.ensureDeviceModule()` 串行加载设备模块。
- 由 `LoginModule.ensureDependencies()` 串行加载 Firebase、SCM、PMS、BI、统一认证模块。
- 登录检测仍由 `LoginModule.checkAndForceLogin()` 触发。
- `loginReady` 只表示启动登录检测完成一次判定；`scmAuthenticated` 才表示 SCM 凭证已验证并写入会话/本地状态。
- SCM 凭证校验不再失败开放：缺少校验 API、缺少 token、校验请求异常或接口明确失败时，均不会触发 `scmAuthenticated`。

### L2 智聊首屏壳

- `zhiliao/loader.js` 先注册 `zhiliao` 模块并渲染完整聊天布局。
- 智聊样式由 loader 注入。
- 真实智聊核心只在 `scmAuthenticated` 后按原顺序串行加载；等待超时或未认证时保持壳布局，不加载核心。

### L3 业务懒加载

- 优惠券：首屏已有 `config.js`，进入模块时加载 `gongju.js` -> `app.js`。
- 商品查询：首屏已有 `config.js`，进入模块时加载 `gongju.js` -> `app.js`。
- BI 运营查询：首屏已有 `config.js` 与 `gongju.js`，进入模块时保持原 `index.html` 后续顺序，最后加载 `app.js`。
- 工具中心：加载 `app.js`，由模块内部继续加载子模块。

### L4 按需第三方库

- PDF：上传 PDF 时加载 `pdf.js`。
- Excel：上传 xlsx/xls 时加载 `xlsx`。
- Word：上传 docx 时加载 `mammoth`。

## 依赖顺序约束

- BI 运营 `app.js` 必须最后加载，因为其对象字面量展开依赖多个 `window.Yeji*` mixin。
- 智聊 `zhiliao/app.js` 必须在 `zjg/app.js` 后加载。
- 智聊 `zjg/app.js` 必须在所有 `ZhiLiaoZjg*Module` 后加载。
- 模型仓库仍通过 `LoginModule.ensureDependencies()` 等待 Firebase。
- 优惠券入口必须等待卡片、弹窗、活动、赠券、二维码等关键子模块执行完成后再注册实例，避免首次打开时卡片/弹窗模块未定义。
- BI 运营入口允许更长的模块级实例等待窗口，避免首次冷缓存加载样式与 AI 核心时被全局短超时误判失败。
- 优惠券共享节点清理算法只保留在 `YhquanBackgroundRuntime`，页面模块只负责当前页面监听和卡片状态同步。
- 优惠券后台自助赠券监听只加载 `gongju.js` 与监听器，不加载 `ZsYewu` 页面业务对象。
- 抢券时间刷新依赖 `EwmYewu` 和真实活动编辑接口，保留在优惠券页面首次打开后的原业务链路，不进入首屏后台。

## 风险控制

- 保持业务入口 DOM、CSS、API 行为不改；只改加载时机和入口等待契约。
- 智聊壳 HTML 与真实 `ZhiLiaoBujuModule.render()` 保持一致，避免核心接管后状态差异。
- 智聊壳在核心未完成接管前拦截按钮、回车、上传、粘贴和拖拽文件交互；只有 SCM 认证后才触发核心加载并在就绪后交给真实模块处理，避免“可点但无响应”。
- 懒加载脚本统一由 `AppFramework.loadScript()` 处理，已有脚本不重复加载；智聊 loader、优惠券页面和优惠券后台运行时不再维护重复脚本加载状态。
- 业务模块实例通过 `waitForModuleInstance()` 确认，避免点击后空白。
- 主框架用切换序号守卫异步模块显示，慢模块加载完成后不得覆盖用户最后选择的模块。
- 智聊真实 `show()` 内置当前模块守卫，异步初始化完成后如果用户已切走，不得反向显示智聊。
- 语法检查覆盖所有改动 JS。

## 数据副作用保护

- 登录恢复、共享凭证回写、设备索引写入仍统一收口在 `LoginModule` 与 `LoginAuthModule`。
- 依赖真实登录态的业务核心统一等待 `scmAuthenticated`，不再把 `loginReady` 当成认证信号。
- BI 代理发现依赖的 `YejiConfig` 与 `YejiGongju` 保留在首屏登录链，BI 查询 UI 与查询脚本延后。
- 优惠券页面 UI 监听仍在进入优惠券并完成首次搜索后启动。
- 优惠券登录后必须自动维护的后台任务由 `YhquanBackgroundRuntime` 承载：共享节点清理、自助赠券任务监听。它等待 `scmAuthenticated` 后启动，不渲染优惠券页面，不接管优惠券 UI。
- 优惠券共享清理会保留 `pending`、`processing` 等未终态任务，避免清理过期共享快照时误删待处理赠券任务。
- 智聊会话恢复、模型仓库读取/迁移仍保持原核心触发点，但核心触发点已被 `scmAuthenticated` 门禁保护。
- 优惠券页面隐藏时只清理页面自己的 Firebase 状态监听，不停止后台运行时拥有的登录后任务。
