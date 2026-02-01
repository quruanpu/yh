// 优惠券效期修改模块
const YhquanXqModule = {
    currentCoupon: null,
    apiUrl: 'https://1317825751-4hivucf0ph.ap-guangzhou.tencentscf.com',

    show(coupon) {
        this.currentCoupon = coupon;
        this.render();
        this.bindEvents();

        // 检查优惠券是否已作废，如果已作废则禁用修改按钮
        const status = YhquanUtils.getCouponStatus(coupon);
        if (status.text === '已作废') {
            const submitBtn = document.getElementById('yhquan-xq-submit');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
                submitBtn.style.cursor = 'not-allowed';
                submitBtn.title = '该优惠券已作废，无法修改效期';
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
                            <i class="fa-solid fa-calendar-days"></i> 效期 - ${YhquanUtils.escapeHtml(coupon.name)}
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
        const status = YhquanUtils.getCouponStatus(coupon);
        const escape = YhquanUtils.escapeHtml;
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
                        <span class="yhquan-xq-info-value">${YhquanUtils.getCouponDetail(coupon)}</span>
                    </div>
                    <div class="yhquan-xq-info-row">
                        <span class="yhquan-xq-info-label">有效期：</span>
                        <span class="yhquan-xq-info-value">${YhquanUtils.getValidPeriod(coupon)}</span>
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
            this.showNotification('请选择新的失效日期！', 'error');
            return;
        }

        // 验证日期
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
                this.showNotification('效期修改成功！', 'success');
                // 更新当前优惠券的endTime
                this.currentCoupon.endTime = newEndDate + ' 23:59:59';
                // 更新卡片显示
                this.updateCardDisplay(this.currentCoupon.id, newEndDate);
                // 延迟关闭弹窗
                setTimeout(() => this.hide(), 1500);
            } else {
                this.showNotification(`修改失败：${result.message}`, 'error');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalHtml;
                }
            }
        } catch (error) {
            console.error('效期修改出错:', error);
            this.showNotification(`修改出错：${error.message}`, 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        }
    },

    async editEndTime(couponId, newEndDate) {
        // 直接复用优惠券API模块的凭证（已缓存）
        const credentials = await window.YhquanAPIModule?.getCredentials();
        if (!credentials) {
            return { success: false, message: '未登录，请先登录' };
        }

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify({
                credentials,
                couponId,
                newEndDate
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log('效期修改结果:', result);
        return result;
    },

    validateDate(newEndDate, currentEndDate) {
        try {
            const newDate = new Date(newEndDate);
            const currentDate = new Date(currentEndDate.split(' ')[0]);

            if (isNaN(newDate.getTime())) {
                return { valid: false, message: '日期格式错误' };
            }
            if (newDate <= currentDate) {
                return { valid: false, message: `新日期必须晚于当前结束日期(${currentEndDate.split(' ')[0]})` };
            }
            return { valid: true, message: '' };
        } catch (e) {
            return { valid: false, message: '日期验证失败' };
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
        // 复用赠送模块的通知样式
        if (window.YhquanZsModule?.showNotification) {
            window.YhquanZsModule.showNotification(message, type);
            return;
        }
        // 降级处理
        alert(message);
    },

    /**
     * 更新卡片显示
     */
    updateCardDisplay(couponId, newEndDate) {
        // 找到对应的卡片
        const card = document.querySelector(`.yhquan-card[data-id="${couponId}"]`);
        if (!card) return;

        // 更新有效期显示
        const validRow = card.querySelector('.yhquan-card-valid span');
        if (validRow && this.currentCoupon.beginTime) {
            const start = this.currentCoupon.beginTime.split(' ')[0];
            validRow.textContent = `${start} 至 ${newEndDate}`;
        }

        // 更新状态图标（如果从过期变为有效）
        const statusIcon = card.querySelector('.yhquan-status-icon');
        if (statusIcon) {
            const newEndDateTime = new Date(newEndDate + ' 23:59:59');
            if (newEndDateTime > new Date() && String(this.currentCoupon.couponStatus) === '1') {
                statusIcon.textContent = '💡';
            }
        }
    }
};

window.YhquanXqModule = YhquanXqModule;
