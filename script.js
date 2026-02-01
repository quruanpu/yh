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

    // 自动登录检查
    async checkAutoLogin() {
        try {
            // 等待Firebase模块加载
            if (!window.FirebaseModule) {
                console.log('Firebase模块未加载，跳过自动登录');
                return;
            }

            // 初始化Firebase
            await window.FirebaseModule.init();

            // 获取当前设备的登录账户
            const deviceLogins = await window.FirebaseModule.getDeviceLogins();

            // 优先使用SCM账户
            if (deviceLogins.scm && deviceLogins.scm.length > 0) {
                // 按登录时间排序，获取最近的
                const latestScm = deviceLogins.scm.sort((a, b) =>
                    b.login_time - a.login_time
                )[0];

                // 获取完整登录信息
                const loginInfo = await window.FirebaseModule.getScmLogin(latestScm.username);

                if (loginInfo && loginInfo.credentials) {
                    // 检查是否过期
                    if (this.isLoginValid(loginInfo)) {
                        // 使用与登录成功相同的字段优先级
                        const displayName = loginInfo.provider_info?.username ||
                                          loginInfo.credentials?.username ||
                                          loginInfo.username || '';
                        this.setLoginUsername(displayName);
                        console.log('自动登录成功 (SCM):', displayName);
                        return;
                    }
                }
            }

            // 如果没有SCM或SCM已过期，尝试PMS
            if (deviceLogins.pms && deviceLogins.pms.length > 0) {
                // 按登录时间排序，获取最近的
                const latestPms = deviceLogins.pms.sort((a, b) =>
                    b.login_time - a.login_time
                )[0];

                // 获取完整登录信息
                const loginInfo = await window.FirebaseModule.getPmsLogin(latestPms.account);

                if (loginInfo && loginInfo.credentials) {
                    // 检查是否过期
                    if (this.isLoginValid(loginInfo)) {
                        // 使用与登录成功相同的字段
                        const displayName = loginInfo.user_info?.account || loginInfo.account || '';
                        this.setLoginUsername(displayName);
                        console.log('自动登录成功 (PMS):', displayName);
                        return;
                    }
                }
            }

            console.log('没有有效的登录信息');
        } catch (error) {
            console.error('自动登录检查失败:', error);
        }
    },

    // 检查登录信息是否有效
    isLoginValid(loginInfo) {
        // 检查是否有过期时间
        if (loginInfo.expire_time) {
            const expireTime = new Date(loginInfo.expire_time);
            const now = new Date();

            if (now > expireTime) {
                console.log('登录信息已过期');
                return false;
            }
        }

        // 检查登录时间是否超过7天
        if (loginInfo.login_time) {
            const loginTime = new Date(loginInfo.login_time);
            const now = new Date();
            const daysDiff = (now - loginTime) / (1000 * 60 * 60 * 24);

            if (daysDiff > 7) {
                console.log('登录时间超过7天');
                return false;
            }
        }

        return true;
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
