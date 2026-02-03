// 优惠券管理模块
const YhquanModule = {
    // 配置（从 YhquanConfig 读取）
    config: {
        get pageSize() { return window.YhquanConfig?.pagination?.pageSize || 9999; },
        get initialDisplay() { return window.YhquanConfig?.display?.initialDisplay || 20; }
    },

    // 模块状态
    state: {
        isVisible: false,
        isSearching: false,
        allCoupons: [],
        displayedCount: 0,
        currentKeyword: '',
        hasAutoSearched: false,
        sharingListener: null
    },

    async init() {
        console.log('优惠券模块初始化');
        this.loadSubModules();
        this.render();
        this.bindEvents();
        AppFramework.setModuleInstance('yhquan', this);
        // 后台清理过期优惠券
        setTimeout(() => {
            if (window.YhquanGxModule) {
                window.YhquanGxModule.cleanExpiredCoupons();
            }
        }, 1000);
        setTimeout(() => {
            if (window.YhquanGxModule) {
                window.YhquanGxModule.backgroundCleanup();
            }
        }, 5000);
    },

    async waitForAPIModule(maxRetries = 20, delayMs = 100) {
        for (let i = 0; i < maxRetries; i++) {
            if (window.YhquanAPIModule?.searchCoupons) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        return false;
    },

    showLoginRequired() {
        const container = document.getElementById('yhquan-cards-container');
        if (!container) return;

        container.innerHTML = `
            <div class="yhquan-login-required">
                <div class="yhquan-login-icon">
                    <i class="fa-solid fa-user-lock"></i>
                </div>
                <div class="yhquan-login-text">请进行登录！</div>
                <div class="yhquan-login-hint">点击左下角"登录账户"进行登录</div>
            </div>
        `;
    },

    // 统一的数据加载方法
    async loadCoupons(keyword = '') {
        this.state.isSearching = true;

        try {
            const result = await window.YhquanAPIModule.searchCoupons(keyword);

            if (!result.success) {
                if (result.error === 'SEARCHING') {
                    console.log('检测到重复搜索请求，已忽略');
                    return;
                }
                if (result.error === 'NO_LOGIN') {
                    this.showLoginRequired();
                } else {
                    this.showEmpty(result.error || '加载失败');
                }
                return;
            }

            // 按创建时间降序排序
            this.state.allCoupons = (result.data || []).sort((a, b) =>
                new Date(b.ctime || 0) - new Date(a.ctime || 0)
            );

            // ✅ 设置共享状态实时监听
            await this.setupSharingListener();

            this.state.displayedCount = 0;

            if (this.state.allCoupons.length === 0) {
                this.showEmpty(keyword ? '未找到相关优惠券' : '暂无优惠券');
                return;
            }

            this.displayCoupons();

        } catch (error) {
            console.error('加载优惠券错误:', error);
            this.showEmpty('加载出错，请稍后重试');
        } finally {
            this.state.isSearching = false;
            this.updateSearchButton(false);
        }
    },

    // ✅ 设置共享状态实时监听
    async setupSharingListener() {
        try {
            // 先清理旧的监听器
            this.cleanupSharingListener();

            // 确保 Firebase 已初始化
            if (!window.FirebaseModule) return;
            await window.FirebaseModule.init();

            const db = window.FirebaseModule.state.database;
            if (!db) return;

            // 使用on('value')实时监听
            this.state.sharingListener = db.ref('yhq_gx').on('value', (snapshot) => {
                const sharingData = snapshot.val() || {};
                console.log('🔔 监听器触发，共享数据:', sharingData);

                // 更新所有优惠券的共享状态，并记录变更的优惠券
                const changedCoupons = [];
                this.state.allCoupons.forEach(coupon => {
                    const shareInfo = sharingData[coupon.id];
                    const oldStatus = coupon.isSharing;
                    coupon.isSharing = shareInfo?.shifenggongxiang || false;

                    if (oldStatus !== coupon.isSharing) {
                        changedCoupons.push({ id: coupon.id, isSharing: coupon.isSharing });
                        console.log(`📝 优惠券 ${coupon.id} 状态变更: ${oldStatus} → ${coupon.isSharing}`);
                    }
                });

                console.log(`✅ 共享状态已更新（${changedCoupons.length} 个优惠券状态变更）`);

                // 只更新变更的卡片状态图标，而不是重新渲染所有卡片
                changedCoupons.forEach(({ id, isSharing }) => {
                    this.updateCardStatusIcon(id, isSharing);
                });
            });

            console.log('共享状态监听器已设置');
        } catch (error) {
            console.error('设置共享状态监听失败:', error);
        }
    },

    // ✅ 更新单个卡片的状态图标（供监听器使用）
    updateCardStatusIcon(couponId, isSharing) {
        const card = document.querySelector(`.yhquan-card[data-id="${couponId}"]`);
        if (card) {
            const statusIcon = card.querySelector('.yhquan-status-icon');
            if (statusIcon) {
                // 先检查优惠券的实际状态（作废/过期优先级更高）
                const coupon = this.state.allCoupons.find(c => String(c.id) === String(couponId));
                if (coupon) {
                    coupon.isSharing = isSharing;
                    statusIcon.textContent = YhquanUtils.getStatusIcon(coupon);
                } else {
                    statusIcon.textContent = isSharing ? '🌎️' : '💡';
                }
                console.log(`卡片状态图标已更新: ${couponId} → ${statusIcon.textContent}`);
            }
        }
    },

    // ✅ 清理共享状态监听器
    cleanupSharingListener() {
        if (this.state.sharingListener) {
            try {
                const db = window.FirebaseModule?.state?.database;
                if (db) {
                    db.ref('yhq_gx').off('value', this.state.sharingListener);
                }
                this.state.sharingListener = null;
                console.log('共享状态监听器已清理');
            } catch (error) {
                console.error('清理共享状态监听失败:', error);
            }
        }
    },

    loadSubModules() {
        // 加载配置文件
        if (!document.querySelector('script[src="gongn/yhquan/config.js"]')) {
            const configScript = document.createElement('script');
            configScript.src = 'gongn/yhquan/config.js';
            document.head.appendChild(configScript);
        }

        // 加载其他模块
        const basePath = 'gongn/yhquan/gongj/';
        ['utils.js', 'api.js', 'card.js'].forEach(mod => {
            if (!document.querySelector(`script[src="${basePath}${mod}"]`)) {
                const script = document.createElement('script');
                script.src = basePath + mod;
                document.head.appendChild(script);
            }
        });

        // 加载赠送模块
        const zsBasePath = 'gongn/yhquan/caid/zs/';
        if (!document.querySelector(`link[href="${zsBasePath}zs.css"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = zsBasePath + 'zs.css';
            document.head.appendChild(link);
        }
        if (!document.querySelector(`script[src="${zsBasePath}zs.js"]`)) {
            const script = document.createElement('script');
            script.src = zsBasePath + 'zs.js';
            document.head.appendChild(script);
        }

        // 加载共享模块
        const gxBasePath = 'gongn/yhquan/caid/gx/';
        if (!document.querySelector(`link[href="${gxBasePath}gx.css"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = gxBasePath + 'gx.css';
            document.head.appendChild(link);
        }
        if (!document.querySelector(`script[src="${gxBasePath}gx.js"]`)) {
            const script = document.createElement('script');
            script.src = gxBasePath + 'gx.js';
            document.head.appendChild(script);
        }

        // 加载效期模块
        const xqBasePath = 'gongn/yhquan/caid/xq/';
        if (!document.querySelector(`link[href="${xqBasePath}xq.css"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = xqBasePath + 'xq.css';
            document.head.appendChild(link);
        }
        if (!document.querySelector(`script[src="${xqBasePath}xq.js"]`)) {
            const script = document.createElement('script');
            script.src = xqBasePath + 'xq.js';
            document.head.appendChild(script);
        }

        // 加载作废模块
        const zfBasePath = 'gongn/yhquan/caid/zf/';
        if (!document.querySelector(`link[href="${zfBasePath}zf.css"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = zfBasePath + 'zf.css';
            document.head.appendChild(link);
        }
        if (!document.querySelector(`script[src="${zfBasePath}zf.js"]`)) {
            const script = document.createElement('script');
            script.src = zfBasePath + 'zf.js';
            document.head.appendChild(script);
        }
    },

    render() {
        if (document.getElementById('page-yhquan')) return;

        const container = document.getElementById('module-container');
        container.insertAdjacentHTML('beforeend', `
            <main id="page-yhquan" class="yhquan-page" style="display: none;">
                <div class="yhquan-search-container">
                    <div class="yhquan-search-box">
                        <div class="yhquan-search-input-wrapper">
                            <input type="text" id="yhquan-search-input" class="yhquan-search-input"
                                placeholder="请输入优惠券名称、ID或关键词搜索..." autocomplete="off" />
                            <button id="yhquan-search-clear" class="yhquan-search-clear" style="display: none;">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <button id="yhquan-search-btn" class="yhquan-search-btn">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <span>搜索</span>
                        </button>
                    </div>
                </div>
                <div id="yhquan-content" class="yhquan-content">
                    <div id="yhquan-cards-container" class="yhquan-cards-container"></div>
                </div>
            </main>
        `);
    },

    bindEvents() {
        const searchInput = document.getElementById('yhquan-search-input');
        const searchBtn = document.getElementById('yhquan-search-btn');
        const searchClear = document.getElementById('yhquan-search-clear');
        const contentArea = document.getElementById('yhquan-content');

        searchBtn?.addEventListener('click', () => this.handleSearch());
        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        // ✅ 清除按钮功能
        searchInput?.addEventListener('input', (e) => {
            if (searchClear) {
                searchClear.style.display = e.target.value.trim() ? 'flex' : 'none';
            }
        });

        searchClear?.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
                searchClear.style.display = 'none';
            }
        });

        // 使用说明浮窗事件
        contentArea?.addEventListener('mouseenter', (e) => {
            const descElement = e.target.closest('.yhquan-card-desc');
            if (descElement && window.innerWidth > 768) {
                const description = descElement.getAttribute('data-desc');
                if (description) this.showDescriptionTooltip(descElement, description);
            }
        }, true);

        contentArea?.addEventListener('mouseleave', (e) => {
            if (e.target.closest('.yhquan-card-desc') && window.innerWidth > 768) {
                this.hideDescriptionTooltip();
            }
        }, true);

        contentArea?.addEventListener('click', (e) => {
            const descElement = e.target.closest('.yhquan-card-desc');
            if (descElement && window.innerWidth <= 768) {
                const description = descElement.getAttribute('data-desc');
                if (description) this.showDescriptionTooltip(descElement, description);
            }
        });

        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && !e.target.closest('.yhquan-card-desc')) {
                this.hideDescriptionTooltip();
            }
        });

        // 操作按钮事件
        contentArea?.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('.yhquan-action-btn');
            if (actionBtn) {
                e.stopPropagation();
                this.handleAction(
                    actionBtn.getAttribute('data-action'),
                    actionBtn.getAttribute('data-id')
                );
            }
        });

        // GMV小眼睛点击事件
        contentArea?.addEventListener('click', (e) => {
            const gmvEye = e.target.closest('.yhquan-gmv-eye');
            if (gmvEye) {
                e.stopPropagation();
                this.handleGmvClick(gmvEye.getAttribute('data-id'));
            }
        });
    },

    async handleSearch() {
        const searchInput = document.getElementById('yhquan-search-input');
        const keyword = searchInput?.value.trim() || '';

        if (this.state.isSearching) return;

        this.state.allCoupons = [];
        this.state.displayedCount = 0;
        this.state.currentKeyword = keyword;

        const container = document.getElementById('yhquan-cards-container');
        const contentArea = document.getElementById('yhquan-content');

        if (container) container.innerHTML = '';
        if (contentArea) contentArea.scrollTop = 0;

        this.updateSearchButton(true);
        this.showLoadingWithText('正在搜索中......');

        await this.loadCoupons(keyword);
    },

    displayCoupons() {
        const container = document.getElementById('yhquan-cards-container');
        if (!container || this.state.allCoupons.length === 0) return;

        container.innerHTML = window.YhquanCardModule.generateCards(this.state.allCoupons, 1);
        this.state.displayedCount = this.state.allCoupons.length;
        console.log(`已显示 ${this.state.displayedCount} 条优惠券`);
    },

    showLoadingWithText(text = '正在搜索中......') {
        const container = document.getElementById('yhquan-cards-container');
        if (!container) return;

        container.innerHTML = `
            <div class="yhquan-loading-full">
                <div class="yhquan-loading-spinner-large"></div>
                <div class="yhquan-loading-text-large">${text}</div>
            </div>
        `;
    },

    showEmpty(message = '暂无数据') {
        const container = document.getElementById('yhquan-cards-container');
        if (!container) return;

        container.innerHTML = `
            <div class="yhquan-empty">
                <i class="fa-solid fa-ticket"></i>
                <div class="yhquan-empty-text">${message}</div>
            </div>
        `;
    },

    updateSearchButton(isLoading) {
        const searchBtn = document.getElementById('yhquan-search-btn');
        if (!searchBtn) return;

        searchBtn.disabled = isLoading;
        searchBtn.style.opacity = isLoading ? '0.6' : '1';
        searchBtn.style.cursor = isLoading ? 'not-allowed' : 'pointer';
    },

    formatDescriptionText(text) {
        if (!text) return '';
        const lines = [];
        for (let i = 0; i < text.length; i += 20) {
            lines.push(text.slice(i, i + 20));
        }
        return lines.join('\n');
    },

    showDescriptionTooltip(element, description) {
        this.hideDescriptionTooltip();

        const tooltip = document.createElement('div');
        tooltip.className = 'yhquan-desc-tooltip';
        tooltip.textContent = this.formatDescriptionText(description);
        tooltip.id = 'yhquan-active-tooltip';
        document.body.appendChild(tooltip);

        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        let top = rect.bottom + 8;
        let left = Math.max(20, Math.min(rect.left, window.innerWidth - tooltipRect.width - 20));

        if (top + tooltipRect.height > window.innerHeight - 20) {
            top = rect.top - tooltipRect.height - 8;
        }

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    },

    hideDescriptionTooltip() {
        document.getElementById('yhquan-active-tooltip')?.remove();
    },

    handleAction(action, couponId) {
        const coupon = this.state.allCoupons.find(c => String(c.id) === String(couponId));
        if (!coupon) {
            console.error('未找到优惠券:', couponId);
            return;
        }

        if (action === 'gift') {
            if (window.YhquanZsModule) {
                window.YhquanZsModule.show(coupon);
            } else {
                console.error('赠送模块未加载');
            }
        } else if (action === 'share') {
            if (window.YhquanGxModule) {
                window.YhquanGxModule.show(coupon);
            } else {
                console.error('共享模块未加载');
            }
        } else if (action === 'validity') {
            if (window.YhquanXqModule) {
                window.YhquanXqModule.show(coupon);
            } else {
                console.error('效期模块未加载');
            }
        } else if (action === 'invalid') {
            if (window.YhquanZfModule) {
                window.YhquanZfModule.show(coupon);
            } else {
                console.error('作废模块未加载');
            }
        } else {
            console.warn('未知操作:', action);
        }
    },

    /**
     * 处理GMV小眼睛点击事件
     */
    async handleGmvClick(couponId) {
        const gmvValue = document.querySelector(`.yhquan-gmv-value[data-id="${couponId}"]`);
        const gmvEye = document.querySelector(`.yhquan-gmv-eye[data-id="${couponId}"]`);

        if (!gmvValue || !gmvEye) return;

        // 显示加载状态
        gmvEye.className = 'fa-solid fa-spinner fa-spin yhquan-gmv-eye';

        try {
            const salesAmount = await window.YhquanAPIModule?.getSalesVolume(couponId);
            gmvValue.textContent = salesAmount || '-';
            // 隐藏眼睛图标
            gmvEye.style.display = 'none';
        } catch (error) {
            console.error('获取GMV失败:', error);
            gmvValue.textContent = '-';
            gmvEye.style.display = 'none';
        }
    },

    async show() {
        this.state.isVisible = true;
        const page = document.getElementById('page-yhquan');
        if (page) page.style.display = 'flex';

        if (!this.state.hasAutoSearched) {
            this.state.hasAutoSearched = true;

            if (!await this.waitForAPIModule()) {
                this.showEmpty('系统初始化失败，请刷新页面');
                return;
            }

            // 首次进入自动搜索
            this.handleSearch();
        }
    },

    hide() {
        this.state.isVisible = false;
        this.cleanupSharingListener();  // ✅ 清理共享状态监听器
        const page = document.getElementById('page-yhquan');
        if (page) page.style.display = 'none';
    }
};

// 注册模块到主框架
AppFramework.register({
    id: 'yhquan',
    name: '优惠券',
    icon: 'fa-solid fa-ticket',
    path: 'gongn/yhquan',
    order: 2
});

YhquanModule.init();
AppFramework.setModuleInstance('yhquan', YhquanModule);
