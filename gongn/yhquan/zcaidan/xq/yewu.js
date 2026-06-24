/**
 * 优惠券模块 - 效期业务逻辑
 */
const XqYewu = {
    currentCoupon: null,
    apiUrl: 'https://1317825751-4hivucf0ph.ap-guangzhou.tencentscf.com',

    show(coupon) {
        this.currentCoupon = coupon;
        this.render();
        this.bindEvents();

        // 已失效的优惠券不能修改效期。
        if (String(coupon.couponStatus) !== '1') {
            const submitBtn = document.getElementById('yhquan-xq-submit');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
                submitBtn.style.cursor = 'not-allowed';
                submitBtn.title = '该优惠券已失效，无法修改效期。';
            }
        }
    },

    hide() {
        const modal = document.getElementById('yhquan-xq-modal');
        if (modal) modal.remove();
        this.currentCoupon = null;
    },

    render() {
        const coupon = this.currentCoupon;
        const oldModal = document.getElementById('yhquan-xq-modal');
        if (oldModal) oldModal.remove();

        const html = `
            <div id="yhquan-xq-modal" class="yhquan-xq-modal">
                <div class="yhquan-xq-overlay"></div>
                <div class="yhquan-xq-content">
                    <div class="yhquan-xq-header">
                        <span class="yhquan-xq-title">
                            <i class="fa-solid fa-calendar-days"></i> 效期 - ${YhquanGongju.escapeHtml(coupon.name)}
                        </span>
                        <button class="yhquan-xq-close"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="yhquan-xq-body">
                        ${this.renderCouponInfo(coupon)}
                        ${this.renderDateInput(coupon)}
                    </div>
                    <div class="yhquan-xq-footer">
                        <button class="yhquan-xq-btn yhquan-xq-btn-primary" id="yhquan-xq-submit">修改</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    renderCouponInfo(coupon) {
        const status = YhquanGongju.getCouponStatus(coupon);
        const escape = YhquanGongju.escapeHtml;
        return `
            <div class="yhquan-xq-section">
                <div class="yhquan-xq-section-title">1.基本信息</div>
                <div class="yhquan-xq-info-grid">
                    <div class="yhquan-xq-info-row">
                        <span class="yhquan-xq-info-label">名称：</span>
                        <span class="yhquan-xq-info-value">${escape(coupon.name)}</span>
                    </div>
                    <div class="yhquan-xq-info-row">
                        <span class="yhquan-xq-info-label">详情：</span>
                        <span class="yhquan-xq-info-value">${YhquanGongju.getCouponDetail(coupon)}</span>
                    </div>
                    <div class="yhquan-xq-info-row">
                        <span class="yhquan-xq-info-label">有效期：</span>
                        <span class="yhquan-xq-info-value">${YhquanGongju.getValidPeriod(coupon)}</span>
                    </div>
                    <div class="yhquan-xq-info-row">
                        <span class="yhquan-xq-info-label">状态：</span>
                        <span class="yhquan-xq-info-value" style="color: ${status.color};">${status.text}</span>
                    </div>
                </div>
            </div>
        `;
    },

    renderDateInput(coupon) {
        const minDate = this.getMinDate(coupon.endTime);
        return `
            <div class="yhquan-xq-section">
                <div class="yhquan-xq-section-title">2.修改效期</div>
                <input type="date" id="yhquan-xq-date" class="yhquan-xq-date-input" min="${minDate}" value="${minDate}">
            </div>
        `;
    },

    bindEvents() {
        document.querySelector('.yhquan-xq-close')?.addEventListener('click', () => this.hide());
        document.querySelector('.yhquan-xq-overlay')?.addEventListener('click', () => this.hide());
        document.getElementById('yhquan-xq-submit')?.addEventListener('click', () => this.handleSubmit());
    },

    async handleSubmit() {
        const newEndDate = document.getElementById('yhquan-xq-date')?.value;
        if (!newEndDate) {
            this.showNotification('请选择新的失效日期。', 'error');
            return;
        }

        const validation = this.validateDate(newEndDate, this.currentCoupon.endTime);
        if (!validation.valid) {
            this.showNotification(validation.message, 'error');
            return;
        }

        const submitBtn = document.getElementById('yhquan-xq-submit');
        const originalHtml = submitBtn?.innerHTML || '修改';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 修改';
        }

        try {
            const result = await this.editEndTime(this.currentCoupon.id, newEndDate);
            if (result.success) {
                this.showNotification(`效期已修改到 ${newEndDate}。`, 'success');
                this.currentCoupon.endTime = newEndDate + ' 23:59:59';
                this.updateCardDisplay(this.currentCoupon.id, newEndDate);
                await this.syncSharedCouponExpireAt(this.currentCoupon.id, newEndDate);
                window.YhquanModule?.syncCouponCardState?.(this.currentCoupon.id);
                setTimeout(() => this.hide(), 1500);
            } else {
                this.showNotification(`修改失败：${result.message || '未知错误。'}`, 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalHtml;
                }
            }
        } catch (error) {
            console.error('效期修改出错：', error);
            this.showNotification(`修改出错：${error.message || '未知错误。'}`, 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        }
    },

    // 如果该券在 Firebase 已有共享节点，则同步更新券级有效期。
    async syncSharedCouponExpireAt(couponId, newEndDate) {
        try {
            if (!window.FirebaseModule) return;
            await window.FirebaseModule.init();
            const db = window.FirebaseModule.state.database;
            if (!db) return;

            const loginResult = await window.LoginModule?.requireCredentials?.('scm', { silent: true });
            const creds = loginResult?.ok ? loginResult.credentials : null;
            const providerId = creds?.provider_id;
            if (!providerId) return;

            const ref = db.ref(`yhq_gx/${providerId}/${couponId}`);
            const snapshot = await ref.once('value');
            if (!snapshot.exists()) return;

            const node = snapshot.val() || {};
            const activities = {};
            if (node.activities && typeof node.activities === 'object') {
                Object.entries(node.activities).forEach(([id, activity]) => {
                    if (activity && typeof activity === 'object') activities[id] = activity;
                });
            }
            if (Object.keys(activities).length === 0) {
                await ref.remove();
                const coupon = window.YhquanModule?.state?.allCoupons?.find(c => String(c.id) === String(couponId));
                if (coupon) coupon.isSharing = false;
                return;
            }

            await ref.set({
                coupon_name: this.currentCoupon?.name || node.coupon_name || '',
                coupon_expire_at: newEndDate + ' 23:59:59',
                updated_at: Date.now(),
                activities
            });
            const coupon = window.YhquanModule?.state?.allCoupons?.find(c => String(c.id) === String(couponId));
            if (coupon) coupon.isSharing = true;
        } catch (err) {
            console.error('同步共享快照有效期失败：', err);
        }
    },

    async editEndTime(couponId, newEndDate) {
        const credentials = await YhquanGongju.getCredentials();
        if (!credentials) {
            return { success: false, message: '未登录，请先登录。' };
        }

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify({
                action: 'editEndTime',
                credentials,
                couponId,
                newEndDate
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log('效期修改结果：', result);
        return result;
    },

    validateDate(newEndDate, currentEndDate) {
        try {
            const newDate = new Date(newEndDate);
            const currentDate = new Date(currentEndDate.split(' ')[0]);

            if (isNaN(newDate.getTime())) {
                return { valid: false, message: '日期格式错误。' };
            }
            if (newDate <= currentDate) {
                return { valid: false, message: `新日期必须晚于当前结束日期（${currentEndDate.split(' ')[0]}）。` };
            }
            return { valid: true, message: '' };
        } catch (e) {
            return { valid: false, message: '日期验证失败。' };
        }
    },

    getMinDate(currentEndDate) {
        try {
            const date = new Date(currentEndDate.split(' ')[0]);
            date.setDate(date.getDate() + 1);
            return date.toISOString().split('T')[0];
        } catch (e) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow.toISOString().split('T')[0];
        }
    },

    showNotification(message, type = 'success') {
        if (window.Tongzhi) {
            Tongzhi.show(message, type);
        } else {
            alert(message);
        }
    },

    updateCardDisplay(couponId, newEndDate) {
        const card = document.querySelector(`.yhquan-card[data-id="${couponId}"]`);
        if (!card) return;

        const validRow = card.querySelector('.yhquan-card-valid span:last-child');
        if (validRow && this.currentCoupon.beginTime) {
            const start = this.currentCoupon.beginTime.split(' ')[0];
            validRow.textContent = `${start} 至 ${newEndDate}`;
        }

        window.YhquanModule?.syncCouponCardState?.(couponId);
    }
};

window.XqYewu = XqYewu;
