// 主框架模块加载器
const AppFramework = {
    modules: {},
    currentModule: null,
    loginUsername: null, // 保存登录的用户名
    initialized: false,
    switchSeq: 0,
    businessInitStarted: false,
    businessInitPromise: null,
    externalDependencyPromises: {},
    externalDependencies: {
        xlsx: {
            urls: [
                'buju/wb/xlsx/xlsx.full.min.js',
                'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
                'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
            ],
            ready: () => typeof window.XLSX !== 'undefined'
        }
    },

    // 使用媒体查询判断是否为手机端
    get isMobile() {
        return window.matchMedia('(max-width: 768px)').matches;
    },

    // 注册模块
    register(config) {
        const { id, name, icon, path, order = 100, children } = config;
        if (!id) return;

        if (children) {
            // 带子菜单的模块
            const group = this.modules[id] || {};
            Object.assign(group, {
                id, name, icon, order,
                isGroup: true,
                expanded: group.expanded !== false,
                children: children.map(child => ({
                    ...child,
                    parentId: id,
                    order: child.order || 100,
                    loaded: this.modules[child.id]?.loaded || false,
                    instance: this.modules[child.id]?.instance || null,
                    loader: child.loader || this.modules[child.id]?.loader || null,
                    styles: child.styles || this.modules[child.id]?.styles || null,
                    scripts: child.scripts || this.modules[child.id]?.scripts || null,
                    waitForInstance: child.waitForInstance !== undefined
                        ? child.waitForInstance
                        : this.modules[child.id]?.waitForInstance,
                    instanceTimeout: child.instanceTimeout || this.modules[child.id]?.instanceTimeout || 30000
                }))
            });
            this.modules[id] = group;
            // 将子模块注册到 modules 中
            children.forEach(child => {
                const existingChild = this.modules[child.id] || {};
                Object.assign(existingChild, {
                    ...child,
                    parentId: id,
                    loaded: existingChild.loaded || false,
                    instance: existingChild.instance || null,
                    loader: child.loader || existingChild.loader || null,
                    styles: child.styles || existingChild.styles || null,
                    scripts: child.scripts || existingChild.scripts || null,
                    waitForInstance: child.waitForInstance !== undefined
                        ? child.waitForInstance
                        : existingChild.waitForInstance,
                    instanceTimeout: child.instanceTimeout || existingChild.instanceTimeout || 30000
                });
                this.modules[child.id] = existingChild;
            });
        } else {
            // 普通模块
            const existing = this.modules[id] || {};
            Object.assign(existing, {
                id,
                name,
                icon,
                path,
                order,
                loaded: existing.loaded || false,
                instance: existing.instance || null,
                loader: config.loader || existing.loader || null,
                styles: config.styles || existing.styles || null,
                scripts: config.scripts || existing.scripts || null,
                waitForInstance: config.waitForInstance !== undefined
                    ? config.waitForInstance
                    : existing.waitForInstance,
                instanceTimeout: config.instanceTimeout || existing.instanceTimeout || 30000,
                loadingPromise: existing.loadingPromise || null
            });
            this.modules[id] = existing;
        }

        this.renderNavMenu();
    },

    registerLazy(config) {
        this.register({ ...config, lazy: true });
    },

    // 渲染导航菜单
    renderNavMenu() {
        const navMenu = document.getElementById('nav-menu');
        if (!navMenu) return;

        const sortedModules = Object.values(this.modules)
            .filter(m => !m.parentId)
            .sort((a, b) => a.order - b.order);

        navMenu.innerHTML = sortedModules.map(m => {
            if (m.isGroup) {
                const isExpanded = m.expanded !== false;
                const childrenHtml = m.children.map(child => `
                    <div class="sidebar-subitem${child.id === this.currentModule ? ' active' : ''}" data-module="${child.id}">
                        <i class="${child.icon}"></i>
                        <span>${child.name}</span>
                    </div>
                `).join('');

                return `
                    <div class="sidebar-item${isExpanded ? ' expanded' : ''}" data-group="${m.id}">
                        <i class="${m.icon}"></i>
                        <span>${m.name}</span>
                        <i class="fa-solid fa-chevron-down sidebar-arrow"></i>
                    </div>
                    <div class="sidebar-submenu${isExpanded ? ' show' : ''}" data-group-children="${m.id}">
                        ${childrenHtml}
                    </div>
                `;
            } else {
                return `
                    <div class="sidebar-item${m.id === this.currentModule ? ' active' : ''}" data-module="${m.id}">
                        <i class="${m.icon}"></i>
                        <span>${m.name}</span>
                    </div>
                `;
            }
        }).join('');

        navMenu.querySelectorAll('.sidebar-item[data-group]').forEach(item => {
            item.addEventListener('click', () => {
                const groupId = item.dataset.group;
                const group = this.modules[groupId];
                group.expanded = !group.expanded;
                this.renderNavMenu();
            });
        });

        navMenu.querySelectorAll('.sidebar-item[data-module], .sidebar-subitem[data-module]').forEach(item => {
            item.addEventListener('click', () => {
                this.switchModule(item.dataset.module);
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
        const switchSeq = ++this.switchSeq;
        const currentVisibleModuleId = this.currentModule;
        const currentVisibleModule = currentVisibleModuleId ? this.modules[currentVisibleModuleId] : null;

        this.currentModule = moduleId;
        this.renderNavMenu();

        try {
            // 加载模块
            if (!module.loaded) {
                await this.loadModule(module);
                if (switchSeq !== this.switchSeq || this.currentModule !== moduleId) return;
            }

            // 显示模块
            const latestModule = this.modules[moduleId] || module;
            if (switchSeq !== this.switchSeq || this.currentModule !== moduleId) return;
            if (currentVisibleModuleId && currentVisibleModuleId !== moduleId && currentVisibleModule?.instance) {
                currentVisibleModule.instance.hide?.();
            }
            await latestModule.instance?.show?.();
        } catch (error) {
            console.error(`[AppFramework] 模块切换失败：${moduleId}`, error);
            if (switchSeq !== this.switchSeq) return;
            this.currentModule = currentVisibleModuleId;
            this.renderNavMenu();
            if (currentVisibleModuleId && currentVisibleModuleId !== moduleId) {
                currentVisibleModule?.instance?.show?.();
            }
            if (window.Tongzhi?.error) {
                window.Tongzhi.error(`模块加载失败：${module.name || moduleId}`);
            }
        }
    },

    // 加载模块
    async loadModule(module) {
        if (!module) return;
        if (module.loadingPromise) return module.loadingPromise;

        module.loadingPromise = (async () => {
            // 加载模块样式
            await this.loadStyles(module.path, module.styles);

            if (typeof module.loader === 'function') {
                await module.loader(module);
            } else if (Array.isArray(module.scripts) && module.scripts.length > 0) {
                await this.loadScripts(module.scripts);
            } else {
                // 加载模块脚本
                await this.loadScript(`${module.path}/app.js`);
            }

            if (module.waitForInstance !== false) {
                await this.waitForModuleInstance(module.id, module.instanceTimeout);
            }

            const latestModule = this.modules[module.id] || module;
            latestModule.loaded = true;
        })().finally(() => {
            module.loadingPromise = null;
        });

        return module.loadingPromise;
    },

    // 加载样式文件
    async loadStyles(basePath, styles = null) {
        if (Array.isArray(styles) && styles.length > 0) {
            styles.forEach(item => {
                if (typeof item === 'string') {
                    this.addStylesheet(item);
                } else {
                    this.addStylesheet(item.href, item.media || null);
                }
            });
            return;
        }

        // 智聊模块样式由智聊 loader 接管，避免主框架重复注入
        if (basePath === 'zhiliao') {
            return;
        } else if (basePath === 'gongn/chaxun' || basePath === 'gongn/yhquan' || basePath === 'gongn/gongjuzx') {
            // 优惠券、商品查询、工具中心模块共用框架样式
            this.addStylesheet(`${basePath}/kuangjia/yangshi.css`);
        } else if (basePath === 'gongn/yunying') {
            // 运营模块样式
            this.addStylesheet(`${basePath}/ys/kuangjia.css`);
        } else {
            // 其他模块使用传统路径结构
            this.addStylesheet(`${basePath}/gg.css`);
            this.addStylesheet(`${basePath}/buju/sj.css`, '(max-width: 768px)');
            this.addStylesheet(`${basePath}/buju/zm.css`, '(min-width: 769px)');
        }
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
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                if (existing.dataset.loaded === '1' || existing.dataset.loaded === 'true' || existing.readyState === 'loaded' || existing.readyState === 'complete') {
                    resolve();
                    return;
                }
                if (existing.dataset.loading === '1' && existing.dataset.loaded !== '1') {
                    existing.addEventListener('load', resolve, { once: true });
                    existing.addEventListener('error', () => reject(new Error(`脚本加载失败：${src}`)), { once: true });
                    return;
                }
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.dataset.loading = '1';
            script.onload = () => {
                script.dataset.loaded = '1';
                delete script.dataset.loading;
                resolve();
            };
            script.onerror = () => reject(new Error(`脚本加载失败：${src}`));
            document.body.appendChild(script);
        });
    },

    async loadScripts(scripts = []) {
        for (let i = 0; i < scripts.length; i += 1) {
            await this.loadScript(scripts[i]);
        }
    },

    loadExternalScript(src, isReady) {
        return new Promise((resolve, reject) => {
            if (typeof isReady === 'function' && isReady()) {
                resolve();
                return;
            }

            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                if (existing.dataset.loaded === '1' || existing.dataset.loaded === 'true' || existing.readyState === 'loaded' || existing.readyState === 'complete') {
                    resolve();
                    return;
                }
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', () => reject(new Error(`资源加载失败：${src}`)), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.dataset.loading = '1';
            script.onload = () => {
                script.dataset.loaded = '1';
                delete script.dataset.loading;
                resolve();
            };
            script.onerror = () => reject(new Error(`资源加载失败：${src}`));
            document.head.appendChild(script);
        });
    },

    async ensureExternalDependency(name) {
        const dependency = this.externalDependencies[name];
        if (!dependency) throw new Error(`未配置外部依赖：${name}`);

        const isReady = () => !dependency.ready || dependency.ready();
        if (isReady()) return true;
        if (this.externalDependencyPromises[name]) return this.externalDependencyPromises[name];

        this.externalDependencyPromises[name] = (async () => {
            let lastError = null;
            for (const src of dependency.urls || []) {
                try {
                    await this.loadExternalScript(src, isReady);
                    if (isReady()) return true;
                    throw new Error(`外部依赖未就绪：${name}`);
                } catch (error) {
                    lastError = error;
                }
            }
            throw lastError || new Error(`外部依赖加载失败：${name}`);
        })().catch(error => {
            delete this.externalDependencyPromises[name];
            throw error;
        });

        return this.externalDependencyPromises[name];
    },

    waitForModuleInstance(moduleId, timeout = 30000) {
        const startedAt = Date.now();
        return new Promise((resolve, reject) => {
            const check = () => {
                const module = this.modules[moduleId];
                if (module?.instance) {
                    resolve(module.instance);
                    return;
                }
                if (Date.now() - startedAt >= timeout) {
                    reject(new Error(`模块实例初始化超时：${moduleId}`));
                    return;
                }
                setTimeout(check, 50);
            };
            check();
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

        menuButton?.addEventListener('click', () => this.toggleSidebar());
        sidebarClose?.addEventListener('click', () => this.closeSidebar());
        sidebarOverlay?.addEventListener('click', () => {
            if (this.isMobile) {
                this.closeSidebar();
            }
        });

        this.createLoginSubnav();

        userInfo?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleLoginSubnav();
        });

        document.addEventListener('click', (e) => {
            const subnav = document.getElementById('login-subnav');
            if (subnav && subnav.classList.contains('expanded')) {
                if (!subnav.contains(e.target) && e.target !== userInfo && !userInfo.contains(e.target)) {
                    this.closeLoginSubnav();
                }
            }
        });
    },

    createLoginSubnav() {
        const sidebarFooter = document.querySelector('.sidebar-footer');
        if (!sidebarFooter || document.getElementById('login-subnav')) return;

        const subnav = document.createElement('div');
        subnav.className = 'login-subnav';
        subnav.id = 'login-subnav';

        const createItem = (icon, label, system) => {
            const item = document.createElement('div');
            item.className = 'sidebar-subitem';
            item.innerHTML = `<i class="${icon}"></i><span>${label}</span>`;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openLogin(system);
            });
            return item;
        };

        subnav.appendChild(createItem('fas fa-cube', 'SCM系统', 'scm'));
        subnav.appendChild(createItem('fas fa-chart-line', 'PMS系统', 'pms'));
        subnav.appendChild(createItem('fas fa-chart-pie', 'BI系统', 'bi'));
        sidebarFooter.appendChild(subnav);
    },

    toggleLoginSubnav() {
        const subnav = document.getElementById('login-subnav');
        const userText = document.getElementById('user-text');
        if (!subnav || !userText) return;

        const isExpanded = subnav.classList.toggle('expanded');
        userText.textContent = isExpanded ? '请选择' : (this.loginUsername || '登录账户');
    },

    closeLoginSubnav() {
        const subnav = document.getElementById('login-subnav');
        const userText = document.getElementById('user-text');
        if (!subnav || !userText) return;

        subnav.classList.remove('expanded');
        userText.textContent = this.loginUsername || '登录账户';
    },

    openLogin(system) {
        if (window.LoginModule) {
            LoginModule.open(system);
        } else {
            console.warn('登录模块未加载');
        }

        this.closeLoginSubnav();
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

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        if (sidebar.classList.contains('active')) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    },

    setLoginUsername(username) {
        this.loginUsername = username;
        const userText = document.getElementById('user-text');
        if (userText) {
            userText.textContent = username || '登录账户';
            userText.title = username || '';
        }
    },

    updateDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const weekday = weekdays[now.getDay()];
        document.getElementById('current-date').textContent = `${year}/${month}/${day} ${weekday}`;
    },

    async waitForLoginModule(timeout = 10000) {
        const startedAt = Date.now();
        while (!window.LoginModule?.getDeviceCode && Date.now() - startedAt < timeout) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return window.LoginModule || null;
    },

    async initDeviceCode() {
        const el = document.getElementById('device-code');
        if (!el) return;

        try {
            await this.waitForLoginModule();
            if (!window.LoginModule?.getDeviceCode) {
                throw new Error('登录设备模块未就绪');
            }
            const shortCode = await window.LoginModule.getDeviceCode();
            el.textContent = shortCode || '------';
        } catch (error) {
            console.error('获取设备码失败:', error);
            el.textContent = '------';
        }
    },

    initLocation() {
        const el = document.getElementById('location-text');
        if (!el) return;
        this.locationCity = '';
        this.locationReady = new Promise((resolve) => {
            this._resolveLocation = resolve;
        });
        const cb = '_qqMapCb_' + Date.now();
        const script = document.createElement('script');

        window[cb] = (res) => {
            delete window[cb];
            script.remove();
            if (res.status === 0 && res.result?.ad_info) {
                const province = res.result.ad_info.province || '';
                const city = res.result.ad_info.city || '';
                this.locationCity = city;
                if (province || city) {
                    el.textContent = (province === city ? city : province + city) + ' · ';
                }
            }
            this._resolveLocation(this.locationCity);
        };

        script.src = `https://apis.map.qq.com/ws/location/v1/ip?key=HITBZ-I5IC3-4QR3L-RXGCF-SYSQ7-GSFBA&output=jsonp&callback=${cb}`;
        script.onerror = () => {
            delete window[cb];
            script.remove();
            this._resolveLocation('');
        };
        document.head.appendChild(script);
    },

    init() {
        if (this.initialized) return;
        this.initialized = true;
        this.updateDate();
        this.initDeviceCode();
        this.initLocation();
        this.initSidebar();
        this.loadDefaultModule();
        this.scheduleBusinessModuleInitialization();
        if (!this.isMobile) {
            this.openSidebar();
        }
    },

    loadDefaultModule() {
        const sortedModules = Object.values(this.modules).sort((a, b) => a.order - b.order);
        if (sortedModules.length > 0) {
            this.switchModule(sortedModules[0].id);
        }
    },

    scheduleBusinessModuleInitialization() {
        if (this.businessInitStarted) return;
        setTimeout(() => this.startBusinessModuleInitialization(), 0);
    },

    async startBusinessModuleInitialization() {
        if (this.businessInitStarted) return this.businessInitPromise;
        this.businessInitStarted = true;
        const order = ['yhquan', 'chaxun', 'yunying', 'gongjuzx'];
        this.businessInitPromise = Promise.allSettled(
            order.map(async moduleId => {
                const module = this.modules[moduleId];
                if (!module || module.loaded) return;
                await this.loadModule(module);
            })
        ).then(results => {
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    const moduleId = order[index];
                    const module = this.modules[moduleId];
                    console.warn(`[启动链] ${module?.name || moduleId}后台初始化失败`, result.reason);
                }
            });
        });
        return this.businessInitPromise;
    }
};

window.AppFramework = AppFramework;

AppFramework.registerLazy({
    id: 'yhquan',
    name: '优惠券',
    icon: 'fa-solid fa-ticket',
    path: 'gongn/yhquan',
    order: 2,
    scripts: [
        'gongn/yhquan/gongju.js',
        'gongn/yhquan/app.js'
    ]
});

AppFramework.registerLazy({
    id: 'chaxun',
    name: '商品查询',
    icon: 'fa-solid fa-box',
    path: 'gongn/chaxun',
    order: 3,
    scripts: [
        'gongn/chaxun/gongju.js',
        'gongn/chaxun/app.js'
    ]
});

AppFramework.registerLazy({
    id: 'yunying',
    name: 'BI运营查询',
    icon: 'fa-solid fa-chart-line',
    path: 'gongn/yunying',
    order: 3,
    instanceTimeout: 120000,
    scripts: [
        'gongn/yunying/zx/sx.js',
        'gongn/yunying/zx/pz/sj.js',
        'gongn/yunying/zx/pz/gj.js',
        'gongn/yunying/zx/pz/zd.js',
        'gongn/yunying/zx/mb.js',
        'gongn/yunying/zx/hd/app.js',
        'gongn/yunying/zx/plgj.js',
        'gongn/yunying/zx/plcx/mb/gj.js',
        'gongn/yunying/zx/plcx/mb/gz.js',
        'gongn/yunying/zx/plcx/mb/yw.js',
        'gongn/yunying/zx/plcx/hb/gz.js',
        'gongn/yunying/zx/plcx/jh/gz.js',
        'gongn/yunying/zx/plcx/jh/yw.js',
        'gongn/yunying/zx/plcx/hb/yw.js',
        'gongn/yunying/zx/plcx/qs/gz.js',
        'gongn/yunying/zx/plcx/qs/zfx/gz.js',
        'gongn/yunying/zx/plcx/qs/lfx/gz.js',
        'gongn/yunying/zx/plcx/qs/sf/gz.js',
        'gongn/yunying/zx/plcx/qs/sf/yw.js',
        'gongn/yunying/zx/plcx/qs/zfx/yw.js',
        'gongn/yunying/zx/plcx/qs/lfx/yw.js',
        'gongn/yunying/zx/plcx/qs/yw.js',
        'gongn/yunying/zx/plcx/fw/gz.js',
        'gongn/yunying/zx/plcx/fw/plcx.js',
        'gongn/yunying/zx/plcx/fw/qs.js',
        'gongn/yunying/zx/plcx/fw/yw.js',
        'gongn/yunying/zx/cx/fw/gz.js',
        'gongn/yunying/zx/cx/fw/yw.js',
        'gongn/yunying/zx/plcx.js',
        'gongn/yunying/zx/cx.js',
        'gongn/yunying/zx/jg.js',
        'gongn/yunying/app.js'
    ]
});

AppFramework.registerLazy({
    id: 'gongjuzx',
    name: '工具中心',
    icon: 'fa-solid fa-toolbox',
    path: 'gongn/gongjuzx',
    order: 4,
    scripts: [
        'gongn/gongjuzx/app.js'
    ]
});

function startAppFramework() {
    window.LoginModule?.init?.();
    AppFramework.init();
}

// 页面加载初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAppFramework, { once: true });
} else {
    startAppFramework();
}
