// 优惠券共享模块
const YhquanGxModule = {
    currentCoupon: null,
    shareData: null,
    shareListener: null,  // ✅ 新增：共享状态监听器

    async show(coupon) {
        this.currentCoupon = coupon;
        await this.loadShareData();  // 初始加载一次
        this.render();
        this.bindEvents();
        this.setupShareListener();  // ✅ 设置实时监听
    },

    // ✅ 设置共享状态实时监听
    setupShareListener() {
        try {
            // 先清理旧的监听器
            this.cleanupShareListener();

            if (!this.currentCoupon) return;

            const db = firebase.database();
            const couponRef = db.ref(`yhq_gx/${this.currentCoupon.id}`);

            // 使用on('value')实时监听
            this.shareListener = couponRef.on('value', (snapshot) => {
                this.shareData = snapshot.val();

                // 更新按钮状态（不需要完全重新渲染）
                this.updateButtonState();

                console.log('共享状态已更新（实时监听）:', this.currentCoupon.id);
            });

            console.log('共享状态监听器已设置:', this.currentCoupon.id);
        } catch (error) {
            console.error('设置共享状态监听失败:', error);
        }
    },

    // ✅ 清理共享状态监听器
    cleanupShareListener() {
        if (this.shareListener && this.currentCoupon) {
            try {
                const db = firebase.database();
                db.ref(`yhq_gx/${this.currentCoupon.id}`).off('value', this.shareListener);
                this.shareListener = null;
                console.log('共享状态监听器已清理');
            } catch (error) {
                console.error('清理共享状态监听失败:', error);
            }
        }
    },

    // ✅ 强制更新卡片状态图标（不依赖监听器）
    updateCardStatusIcon(couponId, isSharing) {
        try {
            // 1. 更新 YhquanModule 中的优惠券数据
            if (window.YhquanModule?.state?.allCoupons) {
                const coupon = window.YhquanModule.state.allCoupons.find(c => String(c.id) === String(couponId));
                if (coupon) {
                    coupon.isSharing = isSharing;
                }
            }

            // 2. 直接更新 DOM 中的状态图标
            const card = document.querySelector(`.yhquan-card[data-id="${couponId}"]`);
            if (card) {
                const statusIcon = card.querySelector('.yhquan-status-icon');
                if (statusIcon) {
                    // 根据共享状态更新图标
                    statusIcon.textContent = isSharing ? '🌎️' : '💡';
                    console.log(`卡片状态图标已更新: ${couponId} → ${isSharing ? '🌎️' : '💡'}`);
                }
            }
        } catch (error) {
            console.error('更新卡片状态图标失败:', error);
        }
    },

    // ✅ 更新按钮状态（不完全重新渲染）
    updateButtonState() {
        const toggleBtn = document.getElementById('yhquan-gx-toggle');
        if (!toggleBtn) return;

        const isSharing = this.shareData?.shifenggongxiang || false;
        const status = YhquanUtils.getCouponStatus(this.currentCoupon);
        const isValid = status.text === '有效';

        // 更新按钮样式和文本
        toggleBtn.className = `yhquan-gx-btn ${isSharing ? 'yhquan-gx-btn-danger' : 'yhquan-gx-btn-primary'}`;
        toggleBtn.textContent = isSharing ? '关闭' : '开启';
        toggleBtn.disabled = !isValid;

        // 移除loading状态
        toggleBtn.classList.remove('loading');

        // 更新输入框的值
        const keywordInput = document.getElementById('yhquan-gx-keyword');
        const storeInput = document.getElementById('yhquan-gx-store');
        const totalInput = document.getElementById('yhquan-gx-total');

        if (keywordInput) keywordInput.value = this.shareData?.guanjianzi || '';
        if (storeInput) storeInput.value = this.shareData?.dandianxianzhi || 10;
        if (totalInput) totalInput.value = this.shareData?.zengsongzongshu || 100;
    },

    // ✅ 后台异步清理：通过API验证优惠券有效性
    async backgroundCleanup() {
        try {
            console.log('开始后台清理无效共享优惠券...');

            const db = firebase.database();
            const snapshot = await db.ref('yhq_gx').once('value');
            const sharedCoupons = snapshot.val();

            if (!sharedCoupons) {
                console.log('没有共享优惠券需要清理');
                return;
            }

            // 只处理已开启共享的优惠券
            const activeCoupons = Object.entries(sharedCoupons)
                .filter(([_, data]) => data.shifenggongxiang === true);

            if (activeCoupons.length === 0) {
                console.log('没有开启共享的优惠券需要验证');
                return;
            }

            console.log(`发现 ${activeCoupons.length} 个开启共享的优惠券，开始验证...`);

            let closedCount = 0;

            // 逐个验证优惠券
            for (const [couponId, shareData] of activeCoupons) {
                try {
                    // 使用API验证优惠券是否有效
                    const isValid = await this.validateCouponViaAPI(couponId);

                    // null 表示无法验证（登录失败、网络错误等），跳过该优惠券
                    if (isValid === null) {
                        console.log(`无法验证优惠券 ${couponId}，跳过处理`);
                        continue;
                    }

                    // false 表示优惠券确实无效，关闭共享
                    if (isValid === false) {
                        await db.ref(`yhq_gx/${couponId}/shifenggongxiang`).set(false);
                        closedCount++;
                        console.log(`优惠券无效，已关闭共享: ${couponId}`);
                    }

                    // true 表示优惠券有效，不做任何操作

                    // 添加延迟，避免API请求过快
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    console.error(`验证优惠券 ${couponId} 失败:`, error);
                }
            }

            if (closedCount > 0) {
                console.log(`后台清理完成：共关闭 ${closedCount} 个无效优惠券的共享`);
            } else {
                console.log('后台清理完成：所有共享优惠券均有效');
            }
        } catch (error) {
            console.error('后台清理失败:', error);
        }
    },

    // ✅ 通过API验证优惠券是否有效
    // 返回值：true=有效, false=无效, null=无法验证（登录失败、网络错误等）
    async validateCouponViaAPI(couponId) {
        try {
            // 获取登录凭证
            if (!window.YhquanAPIModule) {
                console.warn('API模块未加载，无法验证优惠券');
                return null;  // 无法验证，不是优惠券无效
            }

            const credentials = await window.YhquanAPIModule.getCredentials();
            if (!credentials) {
                console.warn('没有有效的登录凭证，无法验证优惠券');
                return null;  // 无法验证，不是优惠券无效
            }

            // 使用API查询优惠券
            const apiUrl = window.YhquanAPIModule.config.apiUrl;
            const requestBody = {
                credentials: credentials,
                action: 'list',
                pageNo: 1,
                pageSize: 1,
                name: '',
                id: couponId,  // 精确查询优惠券ID
                type: '',
                is_valid: '',
                valid_type: '',
                ctime: '',
                chooseDay: ''
            };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'Accept': 'application/json; charset=UTF-8'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                console.log(`API请求失败 (HTTP ${response.status})，无法验证优惠券`);
                return null;  // 网络错误，无法验证
            }

            const result = await response.json();

            if (result.success === false) {
                console.log(`优惠券 ${couponId} 查询失败:`, result.message, '，无法验证');
                return null;  // API错误，无法验证
            }

            const coupons = result.data?.results || [];

            if (coupons.length === 0) {
                console.log(`优惠券 ${couponId} 不存在`);
                return false;
            }

            const coupon = coupons[0];

            // 检查优惠券状态（couponStatus !== 1 表示无效/已作废）
            if (String(coupon.couponStatus) !== '1') {
                console.log(`优惠券 ${couponId} 已作废`);
                return false;
            }

            // 检查是否过期
            if (coupon.endTime) {
                const now = new Date();
                const endTime = new Date(coupon.endTime);
                if (!isNaN(endTime.getTime()) && now > endTime) {
                    console.log(`优惠券 ${couponId} 已过期`);
                    return false;
                }
            }

            console.log(`优惠券 ${couponId} 有效`);
            return true;

        } catch (error) {
            console.error(`验证优惠券 ${couponId} 出错:`, error, '，无法验证');
            return null;  // 异常错误，无法验证
        }
    },

    async cleanExpiredCoupons() {
        try {
            const db = firebase.database();
            const snapshot = await db.ref('yhq_gx').once('value');
            const coupons = snapshot.val();

            if (!coupons) return;

            const now = new Date();
            const expireDays = 60;
            let deletedCount = 0;

            for (const [couponId, data] of Object.entries(coupons)) {
                // 检查更新时间是否超过60天
                if (data.gengxinshijian) {
                    const updateTime = new Date(data.gengxinshijian);
                    const daysDiff = (now - updateTime) / (1000 * 60 * 60 * 24);

                    if (daysDiff > expireDays) {
                        await db.ref(`yhq_gx/${couponId}`).remove();
                        deletedCount++;
                        console.log(`已删除过期共享优惠券: ${couponId}`);
                    }
                }
            }

            if (deletedCount > 0) {
                console.log(`共清理 ${deletedCount} 个过期共享优惠券`);
            }
        } catch (error) {
            console.error('清理过期优惠券失败:', error);
        }
    },

    hide() {
        this.cleanupShareListener();  // ✅ 清理监听器
        const modal = document.getElementById('yhquan-gx-modal');
        if (modal) modal.remove();
        this.currentCoupon = null;
        this.shareData = null;
    },

    async loadShareData() {
        // 从数据库加载共享数据
        try {
            const db = firebase.database();
            const snapshot = await db.ref(`yhq_gx/${this.currentCoupon.id}`).once('value');
            this.shareData = snapshot.val();
        } catch (error) {
            console.error('加载共享数据失败:', error);
            this.shareData = null;
        }
    },

    renderCouponInfo(coupon, status) {
        const escape = YhquanUtils.escapeHtml;
        return `
            <div class="yhquan-gx-section">
                <div class="yhquan-gx-section-title">1. 优惠券信息</div>
                <div class="yhquan-gx-info-grid">
                    <div class="yhquan-gx-info-row">
                        <span class="yhquan-gx-info-label">名称：</span>
                        <span class="yhquan-gx-info-value">${escape(coupon.name)}</span>
                    </div>
                    <div class="yhquan-gx-info-row">
                        <span class="yhquan-gx-info-label">详情：</span>
                        <span class="yhquan-gx-info-value">${escape(coupon.note || '暂无使用说明')}</span>
                    </div>
                    <div class="yhquan-gx-info-row">
                        <span class="yhquan-gx-info-label">有效期：</span>
                        <span class="yhquan-gx-info-value">${escape(YhquanUtils.getValidPeriod(coupon))}</span>
                    </div>
                    <div class="yhquan-gx-info-row">
                        <span class="yhquan-gx-info-label">状态：</span>
                        <span class="yhquan-gx-info-value" style="color: ${status.color};">${status.text}</span>
                    </div>
                </div>
            </div>
        `;
    },

    renderKeywordInput() {
        const escape = YhquanUtils.escapeHtml;
        const keyword = this.shareData?.guanjianzi || '';
        return `
            <div class="yhquan-gx-section">
                <div class="yhquan-gx-section-title">2. 触发关键字</div>
                <input type="text"
                       class="yhquan-gx-input"
                       id="yhquan-gx-keyword"
                       placeholder="留空则使用默认名称: ${escape(this.currentCoupon.name)}"
                       value="${escape(keyword)}">
            </div>
        `;
    },

    renderLimitSettings() {
        const storeLimit = this.shareData?.dandianxianzhi || 10;
        const totalLimit = this.shareData?.zengsongzongshu || 100;

        return `
            <div class="yhquan-gx-section">
                <div class="yhquan-gx-section-title">3. 单店赠送限制</div>
                <input type="number" class="yhquan-gx-input" id="yhquan-gx-store" value="${storeLimit}" min="1">
            </div>
            <div class="yhquan-gx-section">
                <div class="yhquan-gx-section-title">4. 赠送总限制</div>
                <input type="number" class="yhquan-gx-input" id="yhquan-gx-total" value="${totalLimit}" min="1">
            </div>
        `;
    },

    render() {
        const oldModal = document.getElementById('yhquan-gx-modal');
        if (oldModal) oldModal.remove();

        const coupon = this.currentCoupon;
        const status = YhquanUtils.getCouponStatus(coupon);
        const isSharing = this.shareData?.shifenggongxiang || false;
        const isValid = status.text === '有效';

        const toggleBtnClass = isSharing ? 'yhquan-gx-btn-danger' : 'yhquan-gx-btn-primary';
        const toggleBtnText = isSharing ? '关闭' : '开启';
        const toggleBtnDisabled = !isValid ? 'disabled' : '';

        const html = `
            <div id="yhquan-gx-modal" class="yhquan-gx-modal">
                <div class="yhquan-gx-overlay"></div>
                <div class="yhquan-gx-content">
                    <div class="yhquan-gx-header">
                        <span class="yhquan-gx-title">
                            <i class="fa-solid fa-share-nodes"></i> 共享 - ${YhquanUtils.escapeHtml(coupon.name)}
                        </span>
                        <button class="yhquan-gx-close"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="yhquan-gx-body">
                        ${this.renderCouponInfo(coupon, status)}
                        ${this.renderKeywordInput()}
                        ${this.renderLimitSettings()}
                    </div>
                    <div class="yhquan-gx-footer">
                        <button class="yhquan-gx-btn yhquan-gx-btn-danger" id="yhquan-gx-reset">重置</button>
                        <button class="yhquan-gx-btn ${toggleBtnClass}" id="yhquan-gx-toggle" ${toggleBtnDisabled}>
                            ${toggleBtnText}
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    async openSharing() {
        const keyword = document.getElementById('yhquan-gx-keyword')?.value.trim() || this.currentCoupon.name;
        const totalLimit = parseInt(document.getElementById('yhquan-gx-total')?.value) || 100;
        const storeLimit = parseInt(document.getElementById('yhquan-gx-store')?.value) || 10;

        const toggleBtn = document.getElementById('yhquan-gx-toggle');
        if (toggleBtn) {
            toggleBtn.classList.add('loading');
            toggleBtn.disabled = true;
        }

        try {
            const db = firebase.database();
            const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

            await db.ref(`yhq_gx/${this.currentCoupon.id}`).update({
                guanjianzi: keyword,
                mingcheng: keyword,
                gengxinshijian: now,
                shifenggongxiang: true,
                zengsongzongshu: totalLimit,
                dandianxianzhi: storeLimit,
                yifafangzongshu: this.shareData?.yifafangzongshu || 0
            });

            // 强制更新卡片状态图标
            this.updateCardStatusIcon(this.currentCoupon.id, true);
            this.showNotification('共享已开启', 'success');
        } catch (error) {
            console.error('开启共享失败:', error);
            this.showNotification('开启失败，请重试', 'error');

            if (toggleBtn) {
                toggleBtn.classList.remove('loading');
                toggleBtn.disabled = false;
            }
        }
    },

    async closeSharing() {
        const toggleBtn = document.getElementById('yhquan-gx-toggle');
        if (toggleBtn) {
            toggleBtn.classList.add('loading');
            toggleBtn.disabled = true;
        }

        try {
            const db = firebase.database();
            await db.ref(`yhq_gx/${this.currentCoupon.id}/shifenggongxiang`).set(false);

            // 强制更新卡片状态图标
            this.updateCardStatusIcon(this.currentCoupon.id, false);
            this.showNotification('共享已关闭', 'success');
        } catch (error) {
            console.error('关闭共享失败:', error);
            this.showNotification('关闭失败，请重试', 'error');

            if (toggleBtn) {
                toggleBtn.classList.remove('loading');
                toggleBtn.disabled = false;
            }
        }
    },

    async handleToggle() {
        const isSharing = this.shareData?.shifenggongxiang || false;

        if (isSharing) {
            await this.closeSharing();
        } else {
            await this.openSharing();
        }
    },

    async handleReset() {
        const resetBtn = document.getElementById('yhquan-gx-reset');
        if (resetBtn) {
            resetBtn.classList.add('loading');
            resetBtn.disabled = true;
        }

        try {
            const db = firebase.database();
            await db.ref(`yhq_gx/${this.currentCoupon.id}`).update({
                yaodiantongji: null,
                yifafangzongshu: 0,
                guanjianzi: '',
                dandianxianzhi: 10,
                zengsongzongshu: 100
            });

            this.showNotification(`${this.currentCoupon.name} 重置成功！`, 'success');

            // ✅ 实时监听器会自动更新UI，无需手动重新加载和渲染
        } catch (error) {
            console.error('重置失败:', error);
            this.showNotification('重置失败，请重试', 'error');

            if (resetBtn) {
                resetBtn.classList.remove('loading');
                resetBtn.disabled = false;
            }
        }
    },

    showNotification(message, type = 'info') {
        if (window.YhquanZsModule?.showNotification) {
            window.YhquanZsModule.showNotification(message, type);
        } else {
            alert(message);
        }
    },

    bindEvents() {
        const closeBtn = document.querySelector('.yhquan-gx-close');
        const toggleBtn = document.getElementById('yhquan-gx-toggle');
        const resetBtn = document.getElementById('yhquan-gx-reset');

        closeBtn?.addEventListener('click', () => this.hide());
        toggleBtn?.addEventListener('click', () => this.handleToggle());
        resetBtn?.addEventListener('click', () => this.handleReset());
    }
};

window.YhquanGxModule = YhquanGxModule;
