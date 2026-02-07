/**
 * 优惠券管理模块 - 入口文件
 * 作为唯一对外接口，负责加载子模块和注册到主框架
 */
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
        // 提前注入创建按钮样式，避免fab按钮无样式
        setTimeout(() => {
            if (window.CjYangshi) CjYangshi.inject();
            if (window.KapianYangshi) KapianYangshi.inject();
        }, 200);
        AppFramework.setModuleInstance('yhquan', this);
        // 后台清理过期优惠券
        setTimeout(() => {
            if (window.GxYewu) {
                window.GxYewu.cleanExpiredCoupons?.();
            }
        }, 1000);
        setTimeout(() => {
            if (window.GxYewu) {
                window.GxYewu.backgroundCleanup?.();
            }
        }, 5000);
    },

    async waitForGongju(maxRetries = 20, delayMs = 100) {
        for (let i = 0; i < maxRetries; i++) {
            if (window.YhquanGongju?.searchCoupons) {
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
                <div class="yhquan-login-text">无有效登录，请重新登录并重新搜索！</div>
                <div class="yhquan-login-hint">点击左下角"登录账户"进行登录</div>
            </div>
        `;
    },

    async loadCoupons(keyword = '') {
        this.state.isSearching = true;

        try {
            const result = await YhquanGongju.searchCoupons(keyword);

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

            this.state.allCoupons = (result.data || []).sort((a, b) =>
                new Date(b.ctime || 0) - new Date(a.ctime || 0)
            );

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

    async setupSharingListener() {
        try {
            this.cleanupSharingListener();

            if (!window.FirebaseModule) return;
            await window.FirebaseModule.init();

            const db = window.FirebaseModule.state.database;
            if (!db) return;

            this.state.sharingListener = db.ref('yhq_gx').on('value', (snapshot) => {
                const sharingData = snapshot.val() || {};

                const changedCoupons = [];
                this.state.allCoupons.forEach(coupon => {
                    const shareInfo = sharingData[coupon.id];
                    const oldStatus = coupon.isSharing;
                    coupon.isSharing = shareInfo?.shifenggongxiang || false;

                    if (oldStatus !== coupon.isSharing) {
                        changedCoupons.push({ id: coupon.id, isSharing: coupon.isSharing });
                    }
                });

                changedCoupons.forEach(({ id, isSharing }) => {
                    this.updateCardStatusIcon(id, isSharing);
                });
            });
        } catch (error) {
            console.error('设置共享状态监听失败:', error);
        }
    },

    updateCardStatusIcon(couponId, isSharing) {
        const card = document.querySelector(`.yhquan-card[data-id="${couponId}"]`);
        if (card) {
            const statusIcon = card.querySelector('.yhquan-status-icon');
            if (statusIcon) {
                const coupon = this.state.allCoupons.find(c => String(c.id) === String(couponId));
                if (coupon) {
                    coupon.isSharing = isSharing;
                    statusIcon.textContent = YhquanGongju.getStatusIcon(coupon);
                } else {
                    statusIcon.textContent = isSharing ? '🌎️' : '💡';
                }
            }
        }
    },

    cleanupSharingListener() {
        if (this.state.sharingListener) {
            try {
                const db = window.FirebaseModule?.state?.database;
                if (db) {
                    db.ref('yhq_gx').off('value', this.state.sharingListener);
                }
                this.state.sharingListener = null;
            } catch (error) {
                console.error('清理共享状态监听失败:', error);
            }
        }
    },

    loadSubModules() {
        const basePath = 'gongn/yhquan/';

        // 加载配置文件
        this._loadScript(basePath + 'config.js');

        // 加载框架样式
        this._loadStyle(basePath + 'kuangjia/yangshi.css');

        // 加载工具模块
        this._loadScript(basePath + 'gongju.js');

        // 加载卡片模块
        this._loadScript(basePath + 'kapian/yangshi.js');
        this._loadScript(basePath + 'kapian/yewu.js');

        // 加载子菜单模块 - 赠送
        this._loadScript(basePath + 'zcaidan/zs/yangshi.js');
        this._loadScript(basePath + 'zcaidan/zs/yewu.js');

        // 加载子菜单模块 - 效期
        this._loadScript(basePath + 'zcaidan/xq/yangshi.js');
        this._loadScript(basePath + 'zcaidan/xq/yewu.js');

        // 加载子菜单模块 - 作废
        this._loadScript(basePath + 'zcaidan/zf/yangshi.js');
        this._loadScript(basePath + 'zcaidan/zf/yewu.js');

        // 加载子菜单模块 - 共享
        this._loadScript(basePath + 'zcaidan/gx/yangshi.js');
        this._loadScript(basePath + 'zcaidan/gx/yewu.js');

        // 加载子菜单模块 - 创建
        this._loadScript(basePath + 'zcaidan/cj/yangshi.js');
        this._loadScript(basePath + 'zcaidan/cj/yewu.js');

        // 加载抢券模块 - 二维码链接生成
        this._loadScript(basePath + 'zcaidan/cj/qq/yangshi.js');
        this._loadScript(basePath + 'zcaidan/cj/qq/ewm.js');
    },

    _loadScript(src) {
        if (!document.querySelector(`script[src="${src}"]`)) {
            const script = document.createElement('script');
            script.src = src;
            document.head.appendChild(script);
        }
    },

    _loadStyle(href) {
        if (!document.querySelector(`link[href="${href}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
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
                <button class="yhquan-cj-fab" id="yhquan-cj-fab" title="创建优惠券">
                    <i class="fa-solid fa-plus"></i>
                </button>
            </main>
        `);
    },

    bindEvents() {
        const searchInput = document.getElementById('yhquan-search-input');
        const searchBtn = document.getElementById('yhquan-search-btn');
        const searchClear = document.getElementById('yhquan-search-clear');
        const contentArea = document.getElementById('yhquan-content');
        const fabBtn = document.getElementById('yhquan-cj-fab');

        // 悬浮创建按钮
        fabBtn?.addEventListener('click', () => {
            if (window.CjYangshi) CjYangshi.inject();
            if (window.CjYewu) CjYewu.show();
        });

        searchBtn?.addEventListener('click', () => this.handleSearch());
        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

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

        // 二维码链接生成按钮点击事件
        contentArea?.addEventListener('click', (e) => {
            const ewmBtn = e.target.closest('.yhquan-tag-ewm');
            if (ewmBtn) {
                e.stopPropagation();
                this.handleEwmClick(ewmBtn.getAttribute('data-id'));
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
        if (!container) return;

        const coupons = this.state.allCoupons;
        const startIndex = this.state.displayedCount;
        const endIndex = Math.min(startIndex + this.config.initialDisplay, coupons.length);

        if (startIndex === 0) {
            container.innerHTML = '';
        }

        const fragment = document.createDocumentFragment();
        for (let i = startIndex; i < endIndex; i++) {
            const cardHtml = KapianYewu.renderCard(coupons[i], i + 1);
            const temp = document.createElement('div');
            temp.innerHTML = cardHtml;
            fragment.appendChild(temp.firstElementChild);
        }
        container.appendChild(fragment);

        this.state.displayedCount = endIndex;
    },

    showLoadingWithText(text) {
        const container = document.getElementById('yhquan-cards-container');
        if (!container) return;

        container.innerHTML = `
            <div class="yhquan-loading-full">
                <div class="yhquan-loading-spinner-large"></div>
                <div class="yhquan-loading-text-large">${text}</div>
            </div>
        `;
    },

    showEmpty(message) {
        const container = document.getElementById('yhquan-cards-container');
        if (!container) return;

        container.innerHTML = `
            <div class="yhquan-empty">
                <i class="fa-solid fa-box-open"></i>
                <span>${message}</span>
            </div>
        `;
    },

    updateSearchButton(isSearching) {
        const searchBtn = document.getElementById('yhquan-search-btn');
        if (!searchBtn) return;

        if (isSearching) {
            searchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>搜索中</span>';
            searchBtn.disabled = true;
        } else {
            searchBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i><span>搜索</span>';
            searchBtn.disabled = false;
        }
    },

    formatDescriptionText(text) {
        if (!text) return '';
        return text.replace(/\\n/g, '\n')
                   .replace(/(\d+)\./g, '\n$1.')
                   .replace(/^\n/, '')
                   .trim();
    },

    showDescriptionTooltip(element, description) {
        this.hideDescriptionTooltip();

        const tooltip = document.createElement('div');
        tooltip.className = 'yhquan-desc-tooltip';
        tooltip.innerHTML = `<div class="yhquan-desc-tooltip-content">${this.formatDescriptionText(description)}</div>`;
        document.body.appendChild(tooltip);

        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        let top = rect.bottom + 8;

        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }

        if (top + tooltipRect.height > window.innerHeight - 10) {
            top = rect.top - tooltipRect.height - 8;
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    },

    hideDescriptionTooltip() {
        const tooltip = document.querySelector('.yhquan-desc-tooltip');
        if (tooltip) tooltip.remove();
    },

    handleAction(action, couponId) {
        const coupon = this.state.allCoupons.find(c => String(c.id) === String(couponId));
        if (!coupon) {
            console.error('未找到优惠券:', couponId);
            return;
        }

        switch (action) {
            case 'gift':
            case 'zs':
                if (window.ZsYangshi) ZsYangshi.inject();
                if (window.ZsYewu) ZsYewu.show(coupon);
                break;
            case 'validity':
            case 'xq':
                if (window.XqYangshi) XqYangshi.inject();
                if (window.XqYewu) XqYewu.show(coupon);
                break;
            case 'invalid':
            case 'zf':
                if (window.ZfYangshi) ZfYangshi.inject();
                if (window.ZfYewu) ZfYewu.show(coupon);
                break;
            case 'share':
            case 'gx':
                if (window.GxYangshi) GxYangshi.inject();
                if (window.GxYewu) GxYewu.show(coupon);
                break;
            default:
                console.warn('未知操作:', action);
        }
    },

    async handleGmvClick(couponId) {
        const gmvValueEl = document.querySelector(`.yhquan-gmv-value[data-id="${couponId}"]`);
        const gmvEyeEl = document.querySelector(`.yhquan-gmv-eye[data-id="${couponId}"]`);

        if (!gmvValueEl || !gmvEyeEl) return;

        // 如果已经加载过，不重复请求
        if (gmvValueEl.textContent) return;

        // 显示旋转加载图标
        gmvEyeEl.classList.remove('fa-regular', 'fa-eye');
        gmvEyeEl.classList.add('fa-solid', 'fa-circle-notch', 'fa-spin');

        // 调用API获取实际销售金额
        const salesAmount = await YhquanGongju.getSalesVolume(couponId);

        // 隐藏图标，显示绿色金额
        gmvEyeEl.style.display = 'none';
        gmvValueEl.textContent = salesAmount;
        gmvValueEl.style.color = '#10b981';
    },

    handleEwmClick(couponId) {
        const coupon = this.state.allCoupons.find(c => String(c.id) === String(couponId));
        if (!coupon) {
            console.error('未找到优惠券:', couponId);
            return;
        }
        if (window.EwmYewu) {
            EwmYewu.start(coupon);
        } else {
            console.error('EwmYewu 模块未加载');
        }
    },

    async show() {
        const page = document.getElementById('page-yhquan');
        if (page) {
            page.style.display = 'flex';
            this.state.isVisible = true;

            if (!this.state.hasAutoSearched) {
                const ready = await this.waitForGongju();
                if (ready) {
                    this.state.hasAutoSearched = true;
                    this.handleSearch();
                } else {
                    console.error('YhquanGongju 加载超时');
                    this.showEmpty('模块加载失败，请刷新重试');
                }
            }
        }
    },

    hide() {
        const page = document.getElementById('page-yhquan');
        if (page) {
            page.style.display = 'none';
            this.state.isVisible = false;
        }
        this.hideDescriptionTooltip();
        this.cleanupSharingListener();
    }
};

// 注册模块到主框架导航
AppFramework.register({
    id: 'yhquan',
    name: '优惠券',
    icon: 'fa-solid fa-ticket',
    path: 'gongn/yhquan',
    order: 2
});

// 初始化模块
YhquanModule.init();

window.YhquanModule = YhquanModule;
