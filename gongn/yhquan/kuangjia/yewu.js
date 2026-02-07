/**
 * 优惠券模块 - 主框架业务
 *
 * 职责：
 * 1. 页面渲染和布局
 * 2. 搜索交互和状态管理
 * 3. 协调卡片和子菜单模块
 */
const KuangjiaYewu = {
    // 配置
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

    /**
     * 初始化
     */
    init() {
        this.render();
        this.bindEvents();
    },

    /**
     * 渲染页面结构
     */
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

    /**
     * 绑定事件
     */
    bindEvents() {
        const searchInput = document.getElementById('yhquan-search-input');
        const searchBtn = document.getElementById('yhquan-search-btn');
        const searchClear = document.getElementById('yhquan-search-clear');
        const contentArea = document.getElementById('yhquan-content');

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
    },

    /**
     * 处理搜索
     */
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

    /**
     * 加载优惠券
     */
    async loadCoupons(keyword = '') {
        this.state.isSearching = true;

        try {
            const result = await window.YhquanGongju.searchCoupons(keyword);

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

    /**
     * 设置共享状态实时监听
     */
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

    /**
     * 清理共享状态监听器
     */
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

    /**
     * 更新单个卡片的状态图标
     */
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

    /**
     * 显示优惠券列表
     */
    displayCoupons() {
        const container = document.getElementById('yhquan-cards-container');
        if (!container || this.state.allCoupons.length === 0) return;

        container.innerHTML = window.KapianYewu.generateCards(this.state.allCoupons, 1);
        this.state.displayedCount = this.state.allCoupons.length;
    },

    /**
     * 显示加载状态
     */
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

    /**
     * 显示空状态
     */
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

    /**
     * 显示登录提示
     */
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

    /**
     * 更新搜索按钮状态
     */
    updateSearchButton(isLoading) {
        const searchBtn = document.getElementById('yhquan-search-btn');
        if (!searchBtn) return;

        searchBtn.disabled = isLoading;
        searchBtn.style.opacity = isLoading ? '0.6' : '1';
        searchBtn.style.cursor = isLoading ? 'not-allowed' : 'pointer';
    },

    /**
     * 格式化描述文本
     */
    formatDescriptionText(text) {
        if (!text) return '';
        const lines = [];
        for (let i = 0; i < text.length; i += 20) {
            lines.push(text.slice(i, i + 20));
        }
        return lines.join('\n');
    },

    /**
     * 显示描述浮窗
     */
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

    /**
     * 隐藏描述浮窗
     */
    hideDescriptionTooltip() {
        document.getElementById('yhquan-active-tooltip')?.remove();
    },

    /**
     * 处理操作按钮点击
     */
    handleAction(action, couponId) {
        const coupon = this.state.allCoupons.find(c => String(c.id) === String(couponId));
        if (!coupon) {
            console.error('未找到优惠券:', couponId);
            return;
        }

        if (action === 'gift') {
            if (window.ZsYewu) {
                window.ZsYewu.show(coupon);
            }
        } else if (action === 'share') {
            if (window.GxYewu) {
                window.GxYewu.show(coupon);
            }
        } else if (action === 'validity') {
            if (window.XqYewu) {
                window.XqYewu.show(coupon);
            }
        } else if (action === 'invalid') {
            if (window.ZfYewu) {
                window.ZfYewu.show(coupon);
            }
        }
    },

    /**
     * 处理GMV小眼睛点击事件
     */
    async handleGmvClick(couponId) {
        const gmvValue = document.querySelector(`.yhquan-gmv-value[data-id="${couponId}"]`);
        const gmvEye = document.querySelector(`.yhquan-gmv-eye[data-id="${couponId}"]`);

        if (!gmvValue || !gmvEye) return;

        gmvEye.className = 'fa-solid fa-spinner fa-spin yhquan-gmv-eye';

        try {
            const salesAmount = await window.YhquanGongju?.getSalesVolume(couponId);
            gmvValue.textContent = salesAmount || '-';
            gmvEye.style.display = 'none';
        } catch (error) {
            console.error('获取GMV失败:', error);
            gmvValue.textContent = '-';
            gmvEye.style.display = 'none';
        }
    },

    /**
     * 显示模块
     */
    async show() {
        this.state.isVisible = true;
        const page = document.getElementById('page-yhquan');
        if (page) page.style.display = 'flex';

        if (!this.state.hasAutoSearched) {
            this.state.hasAutoSearched = true;
            this.handleSearch();
        }
    },

    /**
     * 隐藏模块
     */
    hide() {
        this.state.isVisible = false;
        this.cleanupSharingListener();
        const page = document.getElementById('page-yhquan');
        if (page) page.style.display = 'none';
    }
};

window.KuangjiaYewu = KuangjiaYewu;
