/**
 * 优惠券管理模块 - 入口文件
 * 作为唯一对外接口，负责加载子模块和注册到主框架
 */
const YhquanModule = {
    // 配置（从 YhquanConfig 读取）
    config: {
        get pageSize() { return window.YhquanConfig?.pagination?.pageSize || 9999; }
    },

    // 模块状态
    state: {
        isVisible: false,
        isSearching: false,
        allCoupons: [],
        hasAutoSearched: false,
        sharingListener: null,
        providerId: null
    },

    async init() {
        console.log('优惠券模块初始化');
        this.loadSubModules();
        this.render();
        this.bindEvents();
        // 轮询注入样式，避免首次未缓存时脚本未加载完
        this._injectStylesWhenReady();
        AppFramework.setModuleInstance('yhquan', this);
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
                <div class="yhquan-login-text">当前未登录或登录信息失效！请重新登录。</div>
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
                this.showLoginRequired();
                return;
            }

            const statusOrder = { '有效': 0, '已过期': 1, '已作废': 2 };
            this.state.allCoupons = (result.data || []).sort((a, b) => {
                const sa = statusOrder[YhquanGongju.getCouponStatus(a).text] ?? 9;
                const sb = statusOrder[YhquanGongju.getCouponStatus(b).text] ?? 9;
                if (sa !== sb) return sa - sb;
                return new Date(b.ctime || 0) - new Date(a.ctime || 0);
            });

            await this.setupSharingListener();

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

            // 获取当前供应商ID
            const creds = await window.LoginModule?.getScmCredentials();
            this.state.providerId = creds?.provider_id || null;
            if (!this.state.providerId) {
                console.warn('无法获取供应商ID，跳过共享状态监听');
                return;
            }

            let isFirstCallback = true;

            this.state.sharingListener = db.ref(`yhq_gx/${this.state.providerId}`).on('value', (snapshot) => {
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

                // 首次回调时，清理无效的共享优惠券
                if (isFirstCallback) {
                    isFirstCallback = false;
                    this.cleanupInvalidSharedCoupons(sharingData);
                }
            });
        } catch (error) {
            console.error('设置共享状态监听失败:', error);
        }
    },

    updateCardStatusIcon(couponId, isSharing) {
        const card = document.querySelector(`.yhquan-card[data-id="${couponId}"]`);
        if (!card) return;

        const coupon = this.state.allCoupons.find(c => String(c.id) === String(couponId));

        // 更新状态图标
        const statusIcon = card.querySelector('.yhquan-status-icon');
        if (statusIcon) {
            if (coupon) {
                coupon.isSharing = isSharing;
                statusIcon.textContent = YhquanGongju.getStatusIcon(coupon);
            } else {
                statusIcon.textContent = isSharing ? '🌎️' : '💡';
            }
        }

        // 更新二维码图标显示/隐藏
        const tagsRow = card.querySelector('.yhquan-card-tags');
        if (!tagsRow) return;
        const existingEwm = tagsRow.querySelector('.yhquan-tag-ewm');
        const isValid = coupon ? YhquanGongju.getCouponStatus(coupon).valid : false;

        if (isSharing && isValid) {
            if (!existingEwm) {
                tagsRow.insertAdjacentHTML('beforeend',
                    `<span class="yhquan-tag yhquan-tag-ewm" data-id="${couponId}" title="生成二维码链接"><i class="fa-solid fa-qrcode"></i></span>`
                );
            }
        } else {
            if (existingEwm) existingEwm.remove();
        }
    },

    // 清理无效的共享优惠券（过期/作废但仍标记为共享的）
    async cleanupInvalidSharedCoupons(sharingData) {
        try {
            if (!sharingData || !this.state.allCoupons.length) return;

            // 找出所有标记为共享但优惠券已无效的ID
            const invalidIds = [];
            for (const [couponId, info] of Object.entries(sharingData)) {
                if (!info?.shifenggongxiang) continue;
                const coupon = this.state.allCoupons.find(c => String(c.id) === String(couponId));
                if (!coupon) continue;
                const status = YhquanGongju.getCouponStatus(coupon);
                if (!status.valid) {
                    invalidIds.push(couponId);
                }
            }

            if (invalidIds.length === 0) return;
            console.log('发现无效共享优惠券，开始清理:', invalidIds);

            const db = window.FirebaseModule?.state?.database;
            if (!db) return;

            // 并发清理所有无效的共享优惠券
            await Promise.all(invalidIds.map(async (couponId) => {
                try {
                    // 1. Firebase 关闭共享状态
                    await db.ref(`yhq_gx/${this.state.providerId}/${couponId}`).update({
                        shifenggongxiang: false
                    });

                    // 2. 禁用并删除抢券活动
                    if (window.EwmYewu) {
                        try {
                            const queryResult = await EwmYewu.queryByCouponId(couponId);
                            if (queryResult && queryResult.activityId) {
                                await EwmYewu.disableActivity(queryResult.activityId, [-1]);
                                await EwmYewu.deleteActivity(queryResult.activityId);
                            }
                        } catch (apiErr) {
                            console.error(`清理活动失败 [${couponId}]:`, apiErr);
                        }
                    }

                    // 3. 更新UI
                    this.updateCardStatusIcon(couponId, false);
                } catch (err) {
                    console.error(`清理共享状态失败 [${couponId}]:`, err);
                }
            }));

            console.log('无效共享优惠券清理完成');
        } catch (error) {
            console.error('清理无效共享优惠券失败:', error);
        }
    },

    cleanupSharingListener() {
        if (this.state.sharingListener) {
            try {
                const db = window.FirebaseModule?.state?.database;
                if (db && this.state.providerId) {
                    db.ref(`yhq_gx/${this.state.providerId}`).off('value', this.state.sharingListener);
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

        // 加载抢券模块 - 二维码链接生成（共享功能）
        this._loadScript(basePath + 'zcaidan/gx/qq/yangshi.js');
        this._loadScript(basePath + 'zcaidan/gx/qq/ewm.js');
    },

    _loadScript(src) {
        if (!document.querySelector(`script[src="${src}"]`)) {
            const script = document.createElement('script');
            script.src = src;
            document.head.appendChild(script);
        }
    },

    _injectStylesWhenReady(retries = 20) {
        const tryInject = () => {
            let allReady = true;
            if (window.CjYangshi) { CjYangshi.inject(); } else { allReady = false; }
            if (window.KapianYangshi) { KapianYangshi.inject(); } else { allReady = false; }
            if (!allReady && retries-- > 0) {
                setTimeout(tryInject, 150);
            }
        };
        setTimeout(tryInject, 50);
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

        if (window.KapianYangshi) KapianYangshi.inject();

        container.innerHTML = this.state.allCoupons.map((coupon, i) =>
            KapianYewu.renderCard(coupon, i + 1)
        ).join('');
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

        const actionMap = {
            gift:     ['ZsYangshi', 'ZsYewu'],
            validity: ['XqYangshi', 'XqYewu'],
            invalid:  ['ZfYangshi', 'ZfYewu'],
            share:    ['GxYangshi', 'GxYewu']
        };
        const modules = actionMap[action];
        if (modules) {
            if (window[modules[0]]) window[modules[0]].inject();
            if (window[modules[1]]) window[modules[1]].show(coupon);
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
