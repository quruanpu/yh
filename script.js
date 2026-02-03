// 主框架核心 - 模块加载器
const AppFramework = {
    modules: {},
    currentModule: null,
    loginUsername: null, // 保存登录的用户名

    // 使用媒体查询判断是否为手机端
    get isMobile() {
        return window.matchMedia('(max-width: 768px)').matches;
    },

    // 注册模块
    register(config) {
        const { id, name, icon, path, order = 100 } = config;
        this.modules[id] = { id, name, icon, path, order, loaded: false, instance: null };
        this.renderNavMenu();
    },

    // 渲染导航菜单
    renderNavMenu() {
        const navMenu = document.getElementById('nav-menu');
        if (!navMenu) return;

        const sortedModules = Object.values(this.modules).sort((a, b) => a.order - b.order);

        navMenu.innerHTML = sortedModules.map(m => `
            <div class="sidebar-item${m.id === this.currentModule ? ' active' : ''}" data-module="${m.id}">
                <i class="${m.icon}"></i>
                <span>${m.name}</span>
            </div>
        `).join('');

        navMenu.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', () => {
                this.switchModule(item.dataset.module);
                // 仅手机端点击导航项后关闭侧边栏
                if (this.isMobile) {
                    this.closeSidebar();
                }
            });
        });
    },

    // 切换模块
    async switchModule(moduleId) {
        const module = this.modules[moduleId];
        if (!module) return;

        // 隐藏当前模块
        if (this.currentModule && this.modules[this.currentModule].instance) {
            this.modules[this.currentModule].instance.hide?.();
        }

        this.currentModule = moduleId;
        this.renderNavMenu();

        // 加载模块
        if (!module.loaded) {
            await this.loadModule(module);
        }

        // 显示模块
        module.instance?.show?.();
    },

    // 加载模块
    async loadModule(module) {
        // 加载模块样式
        await this.loadStyles(module.path);

        // 加载模块脚本
        await this.loadScript(`${module.path}/app.js`);

        module.loaded = true;
    },

    // 加载样式文件
    async loadStyles(basePath) {
        const isMobile = this.isMobile || window.innerWidth <= 768;

        // 加载公共样式
        this.addStylesheet(`${basePath}/gg.css`);

        // 加载响应式样式
        this.addStylesheet(`${basePath}/buju/sj.css`, '(max-width: 768px)');
        this.addStylesheet(`${basePath}/buju/zm.css`, '(min-width: 769px)');
    },

    // 添加样式表
    addStylesheet(href, media = null) {
        if (document.querySelector(`link[href="${href}"]`)) return;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        if (media) link.media = media;
        document.head.appendChild(link);
    },

    // 加载脚本
    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    },

    // 设置模块实例
    setModuleInstance(moduleId, instance) {
        if (this.modules[moduleId]) {
            this.modules[moduleId].instance = instance;
            this.modules[moduleId].loaded = true;
            // 加载模块样式
            this.loadStyles(this.modules[moduleId].path);
        }
    },

    // 侧边栏功能
    initSidebar() {
        const menuButton = document.getElementById('menu-button');
        const sidebarClose = document.getElementById('sidebar-close');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        const userInfo = document.getElementById('user-info');

        menuButton?.addEventListener('click', () => this.openSidebar());
        sidebarClose?.addEventListener('click', () => this.closeSidebar());
        // 仅手机端点击遮罩关闭侧边栏
        sidebarOverlay?.addEventListener('click', () => {
            if (this.isMobile) {
                this.closeSidebar();
            }
        });

        // 创建登录子导航
        this.createLoginSubnav();

        // 登录账户点击事件 - 展开/收起子导航
        userInfo?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleLoginSubnav();
        });

        // 点击其他地方收起子导航
        document.addEventListener('click', (e) => {
            const subnav = document.getElementById('login-subnav');
            if (subnav && subnav.classList.contains('expanded')) {
                // 如果点击的不是子导航内部，则收起
                if (!subnav.contains(e.target) && e.target !== userInfo && !userInfo.contains(e.target)) {
                    this.closeLoginSubnav();
                }
            }
        });
    },

    // 创建登录子导航
    createLoginSubnav() {
        const sidebarFooter = document.querySelector('.sidebar-footer');
        if (!sidebarFooter) return;

        // 创建子导航容器
        const subnav = document.createElement('div');
        subnav.className = 'login-subnav';
        subnav.id = 'login-subnav';

        // 创建SCM选项
        const scmItem = document.createElement('div');
        scmItem.className = 'sidebar-subitem';
        scmItem.innerHTML = '<i class="fas fa-cube"></i><span>SCM系统</span>';
        scmItem.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openLogin('scm');
        });

        // 创建PMS选项
        const pmsItem = document.createElement('div');
        pmsItem.className = 'sidebar-subitem';
        pmsItem.innerHTML = '<i class="fas fa-chart-line"></i><span>PMS系统</span>';
        pmsItem.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openLogin('pms');
        });

        subnav.appendChild(scmItem);
        subnav.appendChild(pmsItem);

        // 添加到sidebar-footer内部
        sidebarFooter.appendChild(subnav);
    },

    // 切换登录子导航
    toggleLoginSubnav() {
        const subnav = document.getElementById('login-subnav');
        const userText = document.getElementById('user-text');
        if (!subnav) return;

        const isExpanded = subnav.classList.toggle('expanded');

        // 切换文字
        if (isExpanded) {
            userText.textContent = '请选择↑';
        } else {
            // 恢复用户名或默认文字
            userText.textContent = this.loginUsername || '登录账户';
        }
    },

    // 关闭登录子导航
    closeLoginSubnav() {
        const subnav = document.getElementById('login-subnav');
        const userText = document.getElementById('user-text');
        if (!subnav) return;

        subnav.classList.remove('expanded');

        // 恢复用户名或默认文字
        userText.textContent = this.loginUsername || '登录账户';
    },

    // 打开登录弹窗
    openLogin(system) {
        if (window.LoginModule) {
            LoginModule.open(system);
        } else {
            console.warn('登录模块未加载');
        }

        // 收起子导航
        this.closeLoginSubnav();

        // 手机端点击后关闭侧边栏
        if (this.isMobile) {
            this.closeSidebar();
        }
    },

    openSidebar() {
        document.getElementById('sidebar')?.classList.add('active');
        document.getElementById('sidebar-overlay')?.classList.add('active');
    },

    closeSidebar() {
        document.getElementById('sidebar')?.classList.remove('active');
        document.getElementById('sidebar-overlay')?.classList.remove('active');
    },

    // 更新登录用户名
    setLoginUsername(username) {
        this.loginUsername = username;
        const userText = document.getElementById('user-text');
        if (userText) {
            userText.textContent = username || '登录账户';
            userText.title = username || '';
        }
    },

    // 更新日期
    updateDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const weekday = weekdays[now.getDay()];
        document.getElementById('current-date').textContent = `${year}/${month}/${day} ${weekday}`;
    },

    // 显示设备码后6位
    async initDeviceCode() {
        try {
            // 等待Firebase模块加载并初始化
            if (!window.FirebaseModule) {
                document.getElementById('device-code').textContent = '------';
                return;
            }
            await window.FirebaseModule.init();
            const deviceId = window.FirebaseModule.state.deviceId || '';
            // 取后6位
            const shortCode = deviceId.slice(-6).toUpperCase();
            document.getElementById('device-code').textContent = shortCode || '------';
        } catch (error) {
            console.error('获取设备码失败:', error);
            document.getElementById('device-code').textContent = '------';
        }
    },

    // 自动登录检查（使用登录模块统一接口）
    /**
     * 账户名称显示规则（由LoginModule.getDisplayUsername处理）：
     * - 只有当前设备有登录信息时才显示用户名
     * - 优先级：SCM → PMS → 不显示
     * - 不进行API验证，失效时由各模块调用时自动弹出登录弹窗
     */
    async checkAutoLogin() {
        try {
            // 等待登录模块加载
            if (!window.LoginModule) {
                console.log('登录模块未加载，跳过自动登录');
                return;
            }

            // 使用登录模块统一接口获取显示用户名
            const displayName = await window.LoginModule.getDisplayUsername();
            if (displayName) {
                this.setLoginUsername(displayName);
                console.log('显示登录用户名:', displayName);
            } else {
                console.log('当前设备没有登录信息');
            }
        } catch (error) {
            console.error('自动登录检查失败:', error);
        }
    },

    // 初始化框架
    init() {
        this.updateDate();
        this.initDeviceCode();
        this.initSidebar();
        this.loadDefaultModule();
        // 电脑端默认展开侧边栏
        if (!this.isMobile) {
            this.openSidebar();
        }
        // 执行自动登录检查
        this.checkAutoLogin();
    },

    // 加载默认模块
    loadDefaultModule() {
        const sortedModules = Object.values(this.modules).sort((a, b) => a.order - b.order);
        if (sortedModules.length > 0) {
            this.switchModule(sortedModules[0].id);
        }
    }
};

// 页面加载初始化
window.addEventListener('load', () => {
    AppFramework.init();
});
