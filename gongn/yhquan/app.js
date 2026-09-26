/**
 * 优惠券管理模块 - 入口文件
 * 作为唯一对外接口，负责加载子模块和注册到主框架
 */
const YhquanModule = {
    // 配置（从 YhquanConfig 读取）
    config: {
        get pageSize() { return window.YhquanConfig?.pagination?.pageSize || 9999; },
        get collectionShareUrl() {
            const shareConfig = window.YhquanConfig?.share || {};
            const overrideUrl = String(shareConfig.collectionUrl || '').trim();
            if (overrideUrl) return overrideUrl;

            const path = String(shareConfig.collectionPath || 'zhiliao/gongxiang.html').trim();
            if (!path) return '';

            try {
                return new URL(path, window.location.href).href;
            } catch {
                return path;
            }
        }
    },

    // 模块状态
    state: {
        isVisible: false,
        isSearching: false,
        allCoupons: [],
        hasAutoSearched: false,
        sharingListener: null,
        providerId: null,
        statusWatchTimer: null,
        statusWatchSnapshot: {}
    },

    async init() {
        console.log('优惠券模块初始化');
        await this.loadSubModules();
        this.render();
        this.bindEvents();
        this.injectReadyStyles();
        AppFramework.setModuleInstance('yhquan', this);
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
            this.resetCouponStatusWatchSnapshot();
            this.startCouponStatusWatcher();

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

    hasSharedActivities(shareInfo) {
        return Object.keys(this.getSharedActivities(shareInfo)).length > 0;
    },

    getSharedActivities(shareInfo) {
        const activities = shareInfo?.activities;
        if (!activities || typeof activities !== 'object') return {};

        const normalized = {};
        Object.entries(activities).forEach(([activityId, activity]) => {
            if (activity && typeof activity === 'object') {
                normalized[activityId] = activity;
            }
        });
        return normalized;
    },

    async setupSharingListener() {
        try {
            this.cleanupSharingListener();

            if (!window.FirebaseModule) return;
            await window.FirebaseModule.init();

            const db = window.FirebaseModule.state.database;
            if (!db) return;

            // 获取当前供应商ID
            const loginResult = await window.LoginModule?.requireCredentials?.('scm', { silent: true });
            const creds = loginResult?.ok ? loginResult.credentials : null;
            this.state.providerId = creds?.provider_id || null;
            if (!this.state.providerId) {
                console.warn('无法获取供应商ID，跳过共享状态监听');
                return;
            }
            window.ZsZizhuYewu?.start?.();

            let isFirstCallback = true;

            this.state.sharingListener = db.ref(`yhq_gx/${this.state.providerId}`).on('value', (snapshot) => {
                const sharingData = snapshot.val() || {};

                const changedCoupons = [];
                this.state.allCoupons.forEach(coupon => {
                    const shareInfo = sharingData[coupon.id];
                    const oldStatus = coupon.isSharing;
                    coupon.isSharing = this.hasSharedActivities(shareInfo);

                    if (oldStatus !== coupon.isSharing) {
                        changedCoupons.push({ id: coupon.id, isSharing: coupon.isSharing });
                    }
                });

                changedCoupons.forEach(({ id, isSharing }) => {
                    this.updateCardStatusIcon(id, isSharing);
                });

                // 首次回调时，只清理 Firebase 共享节点，不触碰真实业务系统。
                if (isFirstCallback) {
                    isFirstCallback = false;
                    this.cleanupStartupSharedData().catch(error => {
                        console.error('启动清理共享节点失败:', error);
                    });
                }
            });
        } catch (error) {
            console.error('设置共享状态监听失败:', error);
        }
    },

    updateCardStatusIcon(couponId, isSharing) {
        const coupon = this.state.allCoupons.find(c => String(c.id) === String(couponId));
        if (coupon) {
            coupon.isSharing = !!isSharing;
        }
        this.syncCouponCardState(couponId);
    },

    syncCouponCardState(couponId) {
        const card = document.querySelector(`.yhquan-card[data-id="${couponId}"]`);
        if (!card) return;

        const coupon = this.state.allCoupons.find(c => String(c.id) === String(couponId));
        if (!coupon) return;

        // 更新状态图标
        const statusIcon = card.querySelector('.yhquan-status-icon');
        if (statusIcon) {
            statusIcon.textContent = YhquanGongju.getStatusIcon(coupon);
        }

        // 更新二维码图标显示/隐藏
        const tagsRow = card.querySelector('.yhquan-card-tags');
        if (!tagsRow) return;
        const existingEwm = tagsRow.querySelector('.yhquan-tag-ewm');
        const isValid = YhquanGongju.getCouponStatus(coupon).valid;
        this.state.statusWatchSnapshot[String(couponId)] = isValid;

        if (isValid) {
            if (!existingEwm) {
                tagsRow.insertAdjacentHTML('beforeend',
                    `<span class="yhquan-tag yhquan-tag-ewm" data-id="${couponId}" title="生成二维码链接"><i class="fa-solid fa-qrcode"></i></span>`
                );
            }
        } else {
            if (existingEwm) existingEwm.remove();
        }
    },

    resetCouponStatusWatchSnapshot() {
        const snapshot = {};
        this.state.allCoupons.forEach(coupon => {
            snapshot[String(coupon.id)] = YhquanGongju.getCouponStatus(coupon).valid;
        });
        this.state.statusWatchSnapshot = snapshot;
    },

    startCouponStatusWatcher() {
        this.stopCouponStatusWatcher();
        this.state.statusWatchTimer = window.setInterval(() => {
            this.handleCouponStatusTransitions();
        }, 1000);
    },

    stopCouponStatusWatcher() {
        if (this.state.statusWatchTimer) {
            clearInterval(this.state.statusWatchTimer);
            this.state.statusWatchTimer = null;
        }
    },

    async handleCouponStatusTransitions() {
        if (!this.state.isVisible || !Array.isArray(this.state.allCoupons) || this.state.allCoupons.length === 0) {
            return;
        }

        const invalidTransitionIds = [];
        this.state.allCoupons.forEach(coupon => {
            const couponId = String(coupon.id);
            const currentValid = YhquanGongju.getCouponStatus(coupon).valid;
            const prevValid = this.state.statusWatchSnapshot[couponId];

            if (prevValid === true && !currentValid) {
                invalidTransitionIds.push(couponId);
            }
            this.state.statusWatchSnapshot[couponId] = currentValid;
        });

        if (invalidTransitionIds.length === 0) return;

        await Promise.all(invalidTransitionIds.map(async (couponId) => {
            try {
                await this.removeSharedCouponSnapshot(couponId);
            } catch (error) {
                console.error(`过期共享节点清理失败 [${couponId}]`, error);
            } finally {
                const coupon = this.state.allCoupons.find(c => String(c.id) === String(couponId));
                if (coupon) coupon.isSharing = false;
                this.syncCouponCardState(couponId);
            }
        }));
    },

    async getProviderId(credentials = null) {
        if (this.state.providerId) return this.state.providerId;

        const loginResult = credentials ? null : await window.LoginModule?.requireCredentials?.('scm', { silent: true });
        const creds = credentials || (loginResult?.ok ? loginResult.credentials : null);
        const providerId = creds?.provider_id || creds?.providerId || null;
        this.state.providerId = providerId;
        return providerId;
    },

    async removeSharedCouponSnapshot(couponId, credentials = null) {
        try {
            if (!couponId || !window.FirebaseModule) {
                return { removed: false, reason: 'SKIPPED' };
            }

            await window.FirebaseModule.init();
            const db = window.FirebaseModule.state?.database;
            if (!db) {
                return { removed: false, reason: 'NO_DB' };
            }

            const providerId = await this.getProviderId(credentials);
            if (!providerId) {
                return { removed: false, reason: 'NO_PROVIDER' };
            }

            const couponRef = db.ref(`yhq_gx/${providerId}/${couponId}`);
            const couponSnapshot = await couponRef.once('value');
            if (!couponSnapshot.exists()) {
                const coupon = this.state.allCoupons.find(c => String(c.id) === String(couponId));
                if (coupon) {
                    coupon.isSharing = false;
                    this.syncCouponCardState(couponId);
                }
                return { removed: false, reason: 'NOT_FOUND' };
            }

            await couponRef.remove();

            const providerSnapshot = await db.ref(`yhq_gx/${providerId}`).once('value');
            if (!providerSnapshot.exists()) {
                await db.ref(`yhq_gx_index/${providerId}`).remove();
            }

            const coupon = this.state.allCoupons.find(c => String(c.id) === String(couponId));
            if (coupon) {
                coupon.isSharing = false;
                this.syncCouponCardState(couponId);
            }

            return { removed: true, reason: 'REMOVED' };
        } catch (error) {
            console.error('清理共享快照失败:', error);
            return { removed: false, reason: 'ERROR', error };
        }
    },

    async cleanupStartupSharedData() {
        const db = window.FirebaseModule?.state?.database;
        if (!db || !this.state.providerId) return;

        await window.YhquanBackgroundRuntime?.cleanupSharedData?.({
            db,
            providerId: this.state.providerId,
            onCouponStatusChange: (couponId, isSharing) => this.updateCardStatusIcon(couponId, isSharing)
        });
        window.YhquanHdTimeRefreshModule?.start?.();
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
        if (window.ZsZizhuYewu?.stop) {
            window.YhquanBackgroundRuntime?.ownsGiftMonitor?.() || window.ZsZizhuYewu.stop();
        }
        this.stopCouponStatusWatcher();
    },

    async loadSubModules() {
        const basePath = 'gongn/yhquan/';

        this._loadStyle(basePath + 'kuangjia/yangshi.css');
        const scripts = [
            basePath + 'config.js',
            basePath + 'gongju.js',
            basePath + 'kapian/yangshi.js',
            basePath + 'kapian/yewu.js',
            basePath + 'zcaidan/zs/yangshi.js',
            basePath + 'zcaidan/zs/yewu.js',
            basePath + 'zcaidan/zs/qq/zizhu.js',
            basePath + 'zcaidan/xq/yangshi.js',
            basePath + 'zcaidan/xq/yewu.js',
            basePath + 'zcaidan/zf/yangshi.js',
            basePath + 'zcaidan/zf/yewu.js',
            basePath + 'zcaidan/hd/yangshi.js',
            basePath + 'zcaidan/hd/qq/jy.js',
            basePath + 'zcaidan/hd/qq/ewm.js',
            basePath + 'zcaidan/hd/qq/sx.js',
            basePath + 'zcaidan/hd/yewu.js',
            basePath + 'zcaidan/cj/yangshi.js',
            basePath + 'zcaidan/cj/yewu.js'
        ];

        for (let i = 0; i < scripts.length; i += 1) {
            await this.loadScript(scripts[i]);
        }
    },

    loadScript(src) {
        if (window.AppFramework?.loadScript) {
            return window.AppFramework.loadScript(src);
        }
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`脚本加载失败：${src}`));
            document.head.appendChild(script);
        });
    },

    injectReadyStyles() {
        window.CjYangshi?.inject?.();
        window.KapianYangshi?.inject?.();
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
                <button class="yhquan-share-fab" id="yhquan-share-fab" title="分享优惠券合集">
                    <i class="fa-solid fa-share-nodes"></i>
                </button>
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
        const shareFabBtn = document.getElementById('yhquan-share-fab');
        const fabBtn = document.getElementById('yhquan-cj-fab');

        shareFabBtn?.addEventListener('click', () => {
            this.handleCollectionShare();
        });

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
            activity: ['HdYangshi', 'HdYewu']
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

    async handleEwmClick(couponId) {
        const coupon = this.state.allCoupons.find(c => String(c.id) === String(couponId));
        if (!coupon) {
            console.error('未找到优惠券:', couponId);
            return;
        }

        const status = YhquanGongju.getCouponStatus(coupon);
        if (!status.valid) {
            this.syncCouponCardState(couponId);
            window.Tongzhi?.show?.('当前优惠券已失效，无法生成二维码。', 'warning');
            return;
        }

        if (!window.EwmYewu) {
            console.error('EwmYewu 模块未加载');
            return;
        }

        // 立即设置加载状态
        const icon = document.querySelector(`.yhquan-tag-ewm[data-id="${couponId}"] i`);
        if (icon) {
            icon.className = 'fa-solid fa-spinner fa-spin';
        }

        try {
            // 二维码是后台工具：具体查活动、建活动、生成二维码统一交给二维码模块处理。
            await EwmYewu.start(coupon);
            if (icon) icon.className = 'fa-solid fa-qrcode';
        } catch (err) {
            console.error('处理二维码点击失败:', err);
            if (window.Tongzhi) {
                Tongzhi.error('操作失败：' + (err.message || '未知错误。'));
            }
            if (icon) icon.className = 'fa-solid fa-qrcode';
        }
    },

    async handleCollectionShare() {
        const shareButtonIcon = document.querySelector('#yhquan-share-fab i');
        const shareUrl = String(this.config.collectionShareUrl || '').trim();

        if (!shareUrl) {
            window.Tongzhi?.error?.('合集分享地址未配置。');
            return;
        }

        if (!window.EwmYewu?.openCollectionSharePopup) {
            window.Tongzhi?.error?.('二维码模块未加载。');
            return;
        }

        if (shareButtonIcon) {
            shareButtonIcon.className = 'fa-solid fa-spinner fa-spin';
        }

        try {
            const providerId = await this.getProviderId();
            const url = new URL(shareUrl, window.location.href);
            url.searchParams.set('yxz', '1');
            if (providerId) {
                url.searchParams.set('pid', providerId);
            }
            await EwmYewu.openCollectionSharePopup({ url: url.href });
        } catch (error) {
            console.error('打开合集分享弹窗失败:', error);
            window.Tongzhi?.error?.(error?.message || '打开分享弹窗失败。');
        } finally {
            if (shareButtonIcon) {
                shareButtonIcon.className = 'fa-solid fa-share-nodes';
            }
        }
    },

    async show() {
        const page = document.getElementById('page-yhquan');
        if (page) {
            page.style.display = 'flex';
            this.state.isVisible = true;

            if (!this.state.hasAutoSearched) {
                if (window.YhquanGongju?.searchCoupons) {
                    this.state.hasAutoSearched = true;
                    this.handleSearch();
                } else {
                    console.error('YhquanGongju 未加载');
                    this.showEmpty('模块加载失败，请刷新重试');
                }
            } else {
                await this.setupSharingListener();
                this.resetCouponStatusWatchSnapshot();
                this.startCouponStatusWatcher();
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

