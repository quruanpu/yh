// 优惠券赠送模块
const YhquanZsModule = {
    currentCoupon: null,

    show(coupon) {
        this.currentCoupon = coupon;
        this.render();
        this.bindEvents();
        this.parseClipboard();

        // 检查优惠券是否有效，如果无效则禁用赠送按钮
        if (!this.isValidCoupon(coupon)) {
            const submitBtn = document.getElementById('yhquan-zs-submit');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
                submitBtn.style.cursor = 'not-allowed';
                submitBtn.title = '该优惠券已失效，无法赠送';
            }
        }
    },

    hide() {
        const modal = document.getElementById('yhquan-zs-modal');
        if (modal) modal.remove();
        this.currentCoupon = null;
    },

    render() {
        const coupon = this.currentCoupon;
        const oldModal = document.getElementById('yhquan-zs-modal');
        if (oldModal) oldModal.remove();

        const html = `
            <div id="yhquan-zs-modal" class="yhquan-zs-modal">
                <div class="yhquan-zs-overlay"></div>
                <div class="yhquan-zs-content">
                    <div class="yhquan-zs-header">
                        <span class="yhquan-zs-title">
                            <i class="fa-solid fa-gift"></i> 赠送 - ${YhquanUtils.escapeHtml(coupon.name)}
                        </span>
                        <button class="yhquan-zs-close"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="yhquan-zs-body">
                        ${this.renderCouponInfo(coupon)}
                        ${this.renderGiftSettings()}
                        ${this.renderTargetInput()}
                    </div>
                    <div class="yhquan-zs-footer">
                        <button class="yhquan-zs-btn yhquan-zs-btn-primary" id="yhquan-zs-submit">赠送</button>
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
            <div class="yhquan-zs-section">
                <div class="yhquan-zs-section-title">1.基本信息</div>
                <div class="yhquan-zs-info-grid">
                    <div class="yhquan-zs-info-row">
                        <span class="yhquan-zs-info-label">名称：</span>
                        <span class="yhquan-zs-info-value">${escape(coupon.name)}</span>
                    </div>
                    <div class="yhquan-zs-info-row">
                        <span class="yhquan-zs-info-label">详情：</span>
                        <span class="yhquan-zs-info-value">${YhquanUtils.getCouponDetail(coupon)}</span>
                    </div>
                    <div class="yhquan-zs-info-row">
                        <span class="yhquan-zs-info-label">有效期：</span>
                        <span class="yhquan-zs-info-value">${YhquanUtils.getValidPeriod(coupon)}</span>
                    </div>
                    <div class="yhquan-zs-info-row">
                        <span class="yhquan-zs-info-label">状态：</span>
                        <span class="yhquan-zs-info-value" style="color: ${status.color};">${status.text}</span>
                    </div>
                </div>
            </div>
        `;
    },

    renderGiftSettings() {
        return `
            <div class="yhquan-zs-section">
                <div class="yhquan-zs-section-title">2.赠送数量</div>
                <select id="yhquan-zs-quantity" class="yhquan-zs-quantity-select">
                    <option value="1" selected>1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                </select>
            </div>
        `;
    },

    renderTargetInput() {
        return `
            <div class="yhquan-zs-section">
                <div class="yhquan-zs-section-title">3.赠送目标</div>
                <textarea id="yhquan-zs-targets" class="yhquan-zs-textarea" placeholder="支持药店ID、客户编码以及手机号~"></textarea>
            </div>
        `;
    },

    bindEvents() {
        document.querySelector('.yhquan-zs-close')?.addEventListener('click', () => this.hide());
        document.getElementById('yhquan-zs-submit')?.addEventListener('click', () => this.handleSubmit());
    },

    async parseClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                const input = document.getElementById('yhquan-zs-targets');
                if (input) input.value = text;
            }
        } catch (error) {
            console.log('无法读取剪贴板:', error);
        }
    },

    async handleSubmit() {
        const quantity = parseInt(document.getElementById('yhquan-zs-quantity')?.value || 1);
        const inputText = document.getElementById('yhquan-zs-targets')?.value.trim() || '';

        if (!inputText) {
            this.showNotification('请输入赠送目标！', 'error');
            return;
        }

        const submitBtn = document.getElementById('yhquan-zs-submit');
        const originalHtml = submitBtn?.innerHTML || '赠送';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 赠送';
            setTimeout(() => {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalHtml;
                }
            }, 2000);
        }

        this.showNotification('成功发起请求...', 'success');

        try {
            const result = await this.callGiveAllAPI(inputText, quantity);
            if (result.success) {
                this.showResult(result);
            } else {
                this.showNotification(`赠送失败：${result.message || '未知错误'}`, 'error');
            }
        } catch (error) {
            console.error('赠送出错:', error);

            // 处理特殊错误类型
            if (error.message === 'COUPON_LIMIT') {
                this.showNotification('优惠券已达上限！', 'error');
            } else if (error.message === 'LOGIN_EXPIRED') {
                this.showNotification('登录已失效，请重新登录', 'warning');
                // 清除缓存的凭证
                if (window.YhquanAPIModule) {
                    window.YhquanAPIModule.state.credentials = null;
                }
                // 弹出SCM登录弹窗
                if (window.LoginModule) {
                    window.LoginModule.open('scm');
                }
            } else {
                this.showNotification(`赠送出错：${error.message}`, 'error');
            }
        }
    },

    async callGiveAllAPI(inputText, amount) {
        const credentials = await window.YhquanAPIModule?.getCredentials();
        if (!credentials) throw new Error('未找到登录凭证，请先登录');

        const couponTypeId = this.currentCoupon.id;
        if (!couponTypeId) throw new Error('优惠券ID无效');

        const requestBody = {
            action: 'giveAll',
            credentials,
            inputText,
            couponTypeId: String(couponTypeId),
            amount,
            storeMode: 'batch',
            interval: 2500,
            retryCount: 3
        };

        console.log('发送赠送请求:', requestBody);

        const response = await fetch('https://1317825751-7vayk0nz7f.ap-guangzhou.tencentscf.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        // HTTP 400 - 优惠券已达上限
        if (response.status === 400) {
            throw new Error('COUPON_LIMIT');
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const result = await response.json();
        console.log('赠送结果:', result);

        // 检查登录失效
        if (result.success === false && (result.needLogin || result.message?.includes('登录') || result.message?.includes('token'))) {
            throw new Error('LOGIN_EXPIRED');
        }

        return result;
    },

    showResult(result) {
        const data = result.data || {};
        const couponName = this.currentCoupon?.name || '优惠券';
        const messages = [];

        if (data.success?.length > 0) {
            messages.push(`成功（${couponName}）：${data.success.join('、')}`);
        }

        if (data.failed && typeof data.failed === 'object') {
            for (const [reason, items] of Object.entries(data.failed)) {
                if (items?.length > 0) {
                    messages.push(`失败（${couponName}）-${reason}：${items.join('、')}`);
                }
            }
        }

        if (messages.length === 0) {
            messages.push('赠送完成，但未返回详细结果');
        }

        messages.forEach((msg, index) => {
            setTimeout(() => {
                this.showNotification(msg, msg.startsWith('成功') ? 'success' : 'error');
            }, index * 50);
        });
    },

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `yhquan-zs-notification yhquan-zs-notification-${type}`;
        // 使用视觉视口确保在app环境中正确定位
        const safeTop = window.visualViewport?.offsetTop || 0;
        notification.style.top = `${20 + safeTop}px`;

        const icons = {
            success: '<i class="fa-solid fa-circle-check"></i>',
            error: '<i class="fa-solid fa-circle-xmark"></i>',
            warning: '<i class="fa-solid fa-triangle-exclamation"></i>'
        };

        notification.innerHTML = `
            <div class="yhquan-zs-notification-icon">${icons[type] || ''}</div>
            <div class="yhquan-zs-notification-content">${YhquanUtils.escapeHtml(message).replace(/\n/g, '<br>')}</div>
            <button class="yhquan-zs-notification-close"><i class="fa-solid fa-xmark"></i></button>
        `;

        document.body.appendChild(notification);

        requestAnimationFrame(() => {
            const newNotifHeight = notification.offsetHeight;
            const safeTop = window.visualViewport?.offsetTop || 0;
            document.querySelectorAll('.yhquan-zs-notification').forEach(notif => {
                if (notif !== notification) {
                    const currentTop = parseInt(notif.style.top) || (20 + safeTop);
                    notif.style.top = `${currentTop + newNotifHeight + 10}px`;
                }
            });
        });

        const removeNotification = () => {
            notification.classList.add('yhquan-zs-notification-hide');
            setTimeout(() => {
                notification.remove();
                this.reorderNotifications();
            }, 500);
        };

        notification.querySelector('.yhquan-zs-notification-close')?.addEventListener('click', removeNotification);
        setTimeout(() => {
            if (notification.parentNode) removeNotification();
        }, 8000);
    },

    reorderNotifications() {
        const safeTop = window.visualViewport?.offsetTop || 0;
        let topPosition = 20 + safeTop;
        document.querySelectorAll('.yhquan-zs-notification').forEach(notif => {
            notif.style.top = `${topPosition}px`;
            topPosition += notif.offsetHeight + 10;
        });
    },

    isValidCoupon(coupon) {
        return YhquanUtils.getCouponStatus(coupon).valid;
    }
};

window.YhquanZsModule = YhquanZsModule;
