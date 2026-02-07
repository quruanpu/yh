/**
 * 优惠券模块 - 共享业务逻辑
 */
const GxYewu = {
    currentCoupon: null,
    shareData: null,
    shareListener: null,

    async show(coupon) {
        this.currentCoupon = coupon;
        await this.loadShareData();
        this.render();
        this.bindEvents();
        this.setupShareListener();
    },

    hide() {
        this.cleanupShareListener();
        const modal = document.getElementById('yhquan-gx-modal');
        if (modal) modal.remove();
        this.currentCoupon = null;
        this.shareData = null;
    },

    setupShareListener() {
        try {
            this.cleanupShareListener();
            if (!this.currentCoupon) return;

            const db = firebase.database();
            const couponRef = db.ref(`yhq_gx/${this.currentCoupon.id}`);

            this.shareListener = couponRef.on('value', (snapshot) => {
                this.shareData = snapshot.val();
                this.updateButtonState();
                console.log('共享状态已更新（实时监听）:', this.currentCoupon.id);
            });

            console.log('共享状态监听器已设置:', this.currentCoupon.id);
        } catch (error) {
            console.error('设置共享状态监听失败:', error);
        }
    },

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

    updateCardStatusIcon(couponId, isSharing) {
        try {
            let coupon = null;
            if (window.YhquanModule?.state?.allCoupons) {
                coupon = window.YhquanModule.state.allCoupons.find(c => String(c.id) === String(couponId));
                if (coupon) {
                    coupon.isSharing = isSharing;
                }
            }

            const card = document.querySelector(`.yhquan-card[data-id="${couponId}"]`);
            if (card && coupon) {
                const statusIcon = card.querySelector('.yhquan-status-icon');
                if (statusIcon) {
                    statusIcon.textContent = YhquanGongju.getStatusIcon(coupon);
                    console.log(`卡片状态图标已更新: ${couponId} → ${statusIcon.textContent}`);
                }
            }
        } catch (error) {
            console.error('更新卡片状态图标失败:', error);
        }
    },

    updateButtonState() {
        const toggleBtn = document.getElementById('yhquan-gx-toggle');
        if (!toggleBtn) return;

        const isSharing = this.shareData?.shifenggongxiang || false;
        const status = YhquanGongju.getCouponStatus(this.currentCoupon);
        const isValid = status.text === '有效';

        toggleBtn.className = `yhquan-gx-btn ${isSharing ? 'yhquan-gx-btn-danger' : 'yhquan-gx-btn-primary'}`;
        toggleBtn.textContent = isSharing ? '关闭' : '开启';
        toggleBtn.disabled = !isValid;
        toggleBtn.classList.remove('loading');

        const resetBtn = document.getElementById('yhquan-gx-reset');
        if (resetBtn) {
            resetBtn.disabled = !isValid;
            resetBtn.classList.remove('loading');
        }

        const keywordInput = document.getElementById('yhquan-gx-keyword');
        const storeInput = document.getElementById('yhquan-gx-store');
        const totalInput = document.getElementById('yhquan-gx-total');

        if (keywordInput) keywordInput.value = this.shareData?.guanjianzi || '';
        if (storeInput) storeInput.value = this.shareData?.dandianxianzhi || 10;
        if (totalInput) totalInput.value = this.shareData?.zengsongzongshu || 100;
    },

    async loadShareData() {
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
        const escape = YhquanGongju.escapeHtml;
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
                        <span class="yhquan-gx-info-value">${escape(YhquanGongju.getValidPeriod(coupon))}</span>
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
        const escape = YhquanGongju.escapeHtml;
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
        const status = YhquanGongju.getCouponStatus(coupon);
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
                            <i class="fa-solid fa-share-nodes"></i> 共享 - ${YhquanGongju.escapeHtml(coupon.name)}
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

            if (resetBtn) {
                resetBtn.classList.remove('loading');
                resetBtn.disabled = false;
            }
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
        if (window.Tongzhi) {
            Tongzhi.show(message, type);
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

window.GxYewu = GxYewu;
