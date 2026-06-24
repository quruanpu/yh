# 启动加载链实施记录

## 2026-06-20

### 已执行

- 新增 `AppFramework.registerLazy()`，将模块注册与真实脚本装载解耦。
- 新增 `AppFramework.loadScripts()`、`waitForModuleInstance()`、脚本加载状态标记与模块级 `instanceTimeout`。
- 将优惠券、商品查询、BI 运营查询、工具中心改为导航先注册、进入时按需加载。
- 精简 `index.html`：
  - 保留系统壳、通知、登录、智聊 loader。
  - 移除首屏业务脚本。
  - 移除首屏文档解析库。
  - 保留登录校验和 BI 代理发现所需的轻量配置/工具。
- 改造 `zhiliao/loader.js`：
  - 首先注册智聊模块并渲染完整聊天布局。
  - 不再页面解析阶段直接加载完整智聊链。
  - 进入智聊时立即显示壳布局，SCM 认证完成后才后台串行加载原智聊清单并 bootstrap。
  - 壳层拦截早期按钮、回车、上传、粘贴、拖拽文件交互，SCM 认证且核心就绪后交给真实智聊模块处理。
  - 核心接管前后检查当前模块仍为智聊，避免用户切走后反向显示。
- 改造 `zhiliao/yewu/jiexi.js`：
  - PDF、Excel、Word 解析库改为按需加载。
- 改造 `zhiliao/app.js`：
  - 真实 `show()` 增加当前模块守卫，异步初始化完成后不覆盖用户最新导航选择。
- 改造 `denglu/app.js`：
  - 登录模块初始化从 `window.load` 前移到 `DOMContentLoaded`。
  - 暴露 `loginReady` 事件，表示登录检测链已经完成一次启动判定。
  - 新增 `scmAuthenticated` 事件，作为智聊核心、优惠券后台等真实业务副作用的认证门禁。
  - SCM 凭证校验不再失败开放，缺少 token、缺少校验 API、网络异常或接口失败都不会放行业务核心。
- 改造 `AppFramework.switchModule()`：
  - 等待模块 `show()` 的异步初始化完成，避免异步模块显示过程竞态。
  - 使用切换序号守卫懒加载模块，慢模块加载完成后不会覆盖后续点击的模块。
- 新增 `gongn/yhquan/background.js`：
  - 等待 `scmAuthenticated` 后启动优惠券后台运行时，承载共享节点清理和自助赠券任务监听。
  - 后台运行时不渲染优惠券页面，不接管优惠券 UI。
  - 自助赠券监听只加载 `gongju.js` 与监听器，后台赠券调用由轻量服务提供，不再首屏后台加载 `ZsYewu` 页面业务。
  - 抢券时间刷新不再由后台启动，仍随优惠券页面业务链加载后按原页面逻辑启动。
- 改造 `gongn/yhquan/app.js`：
  - 首次进入优惠券时等待关键子模块串行执行完成后再注册实例。
  - 页面隐藏时不停止后台运行时拥有的赠券监听。
- BI 运营懒加载保留原脚本顺序，并配置更长实例等待窗口，避免首次冷缓存被误判失败。
- 第二阶段结构收敛：
  - `AppFramework.loadScript()` 补齐已加载/加载中/错误三态，作为业务懒加载唯一脚本等待原语。
  - `zhiliao/loader.js` 删除独立脚本缓存状态，统一复用主框架加载器。
  - `gongn/yhquan/app.js` 删除首次打开所需的轮询等待；关键子模块已在实例注册前串行加载完成。
  - `gongn/yhquan/app.js` 删除重复共享节点清理算法，页面只调用 `YhquanBackgroundRuntime.cleanupSharedData()` 并同步 UI 状态。
  - `gongn/yhquan/background.js` 删除额外 base 加载层，并将后台监听所有权接口命名为 `ownsGiftMonitor()`。
  - `gongn/yhquan/background.js` 清理过期共享快照时保护 `pending`、`processing` 等未终态任务。
- 外部样式归档：
  - Tailwind 运行时产物迁移到 `buju/wb/tailwind.css`，构建命令直接输出到该路径。
  - Font Awesome 从 CDN 引用改为本地 `buju/wb/fontawesome/css/all.min.css`，字体资源同步放入 `buju/wb/fontawesome/webfonts`。
  - `index.html` 与智聊共享页均改为引用本地 Font Awesome 6.4.0，保持图标 class 与渲染能力不变。

### 保持不变

- 业务模块入口、自初始化、内部 DOM 与 CSS 不变。
- 智聊真实核心脚本清单与顺序不变。
- BI 运营真实脚本顺序不变。
- 登录模块凭证恢复、强制登录、设备码、Firebase 依赖加载逻辑不变。
- 优惠券页面 DOM、卡片渲染、弹窗模块和业务 API 调用方式不变。
- 优惠券共享清理的数据库写入路径、触发条件和 UI 状态同步结果不变；只是算法实现统一收口到后台运行时。
- 抢券时间刷新、二维码活动编辑等真实页面业务仍留在优惠券页面首次打开后的加载链中。

### 已验证

- `node --check` 已覆盖 `script.js`、`denglu/app.js`、`denglu/auth/app.js`、`zhiliao/loader.js`、`zhiliao/app.js`、`zhiliao/yewu/jiexi.js`、`gongn/yhquan/background.js`、`gongn/yhquan/zcaidan/zs/qq/zizhu.js`、`gongn/yhquan/app.js`。
- `index.html` 已无完整业务入口脚本和文档解析库首屏加载。
- CDN 文档解析库仅保留在 `zhiliao/yewu/jiexi.js` 按需加载路径。
- `git diff --check` 仅提示工作区行尾转换，无新增空白错误。
- 子代理审查提出的切换竞态、智聊早期交互、优惠券后台副作用、优惠券子模块等待、BI 超时窗口已合并处理。
- 第二阶段收敛后重新通过 `node --check` 覆盖全部改动 JS。
- 残留扫描确认首屏入口不加载优惠券页面业务脚本、BI 查询大链路或文档解析库；优惠券后台不再加载 `ZsYewu`、`EwmYewu`、`YhquanHdTimeRefreshModule`。
- 浏览器冷启动验证通过：
  - 默认模块为智聊，左侧导航包含智聊、优惠券、商品查询、BI运营查询、工具中心。
  - 右侧智聊壳布局和输入区可见，登录遮罩可见且不可关闭。
  - 无 SCM 认证时 `ZhiLiaoModule` 未加载，优惠券后台未启动，智聊核心、优惠券页面业务、BI 大链路和文档解析库均未进入资源列表。
- 子代理复核结果：无 must-fix；后续 should-fix 已补齐，`ZhiLiaoLoader.load()` 自身也具备 SCM 门禁，认证成功后可自动继续核心加载。
- Tailwind CDN 运行时警告已消除；主入口不再请求 `cdn.tailwindcss.com` 或 Font Awesome CDN CSS。

### 待人工联调

- 冷缓存刷新：确认登录弹窗先触发，智聊首屏布局立即可见。
- 智聊核心加载中快速切换 BI/优惠券/智聊：确认不会反向显示旧模块。
- 智聊核心加载中发送、上传、粘贴文件、拖拽文件、模型按钮、新会话按钮：确认不会静默无效。
- 首次打开优惠券：确认搜索、卡片、创建、赠券、效期、作废、活动、二维码均可用。
- 首次打开 BI：确认样式、代理发现、token 校验、默认查询、AI 面板正常。
