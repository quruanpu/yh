// 优惠券卡片渲染模块
const YhquanCardModule = {
    /**
     * 格式化日期
     */
    formatDate(timestamp) {
        if (!timestamp) return '';

        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return timestamp;

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}`;
    },

    /**
     * 获取优惠券状态图标
     * 优先级：已作废 > 过期 > 共享 > 有效
     */
    getStatusIcon(coupon) {
        // 1. 先判断是否已作废（couponStatus = 0）
        if (coupon.couponStatus === 0) {
            return '🔴';
        }

        // 2. 再判断是否过期（当前日期 > 有效期结束时间）
        if (coupon.endTime) {
            const now = new Date();
            const endTime = new Date(coupon.endTime);
            if (!isNaN(endTime.getTime()) && now > endTime) {
                return '🕚';
            }
        }

        // 3. 判断是否共享
        if (coupon.isSharing) {
            return '🌎️';
        }

        // 4. 最后才是有效状态
        return '💡';
    },

    /**
     * 格式化有效期
     */
    formatValidPeriod(coupon) {
        // 优先级1：使用服务器返回的说明文本
        if (coupon.validDayNote) {
            return coupon.validDayNote;
        }

        // 优先级2：领取后N天有效
        if (coupon.validDays && coupon.validDays > 0) {
            return `领取后${coupon.validDays}天有效`;
        }

        // 优先级3：具体日期范围
        if (coupon.beginTime && coupon.endTime) {
            const start = coupon.beginTime.split(' ')[0];
            const end = coupon.endTime.split(' ')[0];
            return `${start} 至 ${end}`;
        }

        return '永久有效';
    },

    /**
     * 生成标签HTML
     */
    generateTags(coupon) {
        const tags = [];

        // 使用条件标签
        if (coupon.minPay && coupon.minPay > 0) {
            tags.push(`<span class="yhquan-tag yhquan-tag-condition">满${this.escapeHtml(String(coupon.minPay))}元</span>`);
        } else {
            tags.push(`<span class="yhquan-tag yhquan-tag-condition">无门槛</span>`);
        }

        // 归属类标签
        if (coupon.typeDesc) {
            tags.push(`<span class="yhquan-tag yhquan-tag-category">${this.escapeHtml(coupon.typeDesc)}</span>`);
        }

        // 面额标签
        if (coupon.price) {
            tags.push(`<span class="yhquan-tag yhquan-tag-price">${this.escapeHtml(coupon.price)}</span>`);
        }

        return tags.join('');
    },

    /**
     * 转义HTML特殊字符
     */
    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    /**
     * 生成单个优惠券卡片HTML
     */
    generateCard(coupon, index) {
        const description = this.escapeHtml(coupon.note || '暂无使用说明');

        return `
            <div class="yhquan-card" data-id="${coupon.id}">
                <div class="yhquan-card-row yhquan-card-header">
                    <span class="yhquan-card-index">#${index} | ID: ${coupon.id || 'N/A'}</span>
                    <div class="yhquan-card-actions">
                        <button class="yhquan-action-btn" data-action="validity" data-id="${coupon.id}">效期</button>
                        <button class="yhquan-action-btn" data-action="invalid" data-id="${coupon.id}">作废</button>
                        <button class="yhquan-action-btn" data-action="gift" data-id="${coupon.id}">赠送</button>
                        <button class="yhquan-action-btn" data-action="share" data-id="${coupon.id}">共享</button>
                    </div>
                </div>
                <div class="yhquan-card-row yhquan-card-title">
                    <span class="yhquan-status-icon">${this.getStatusIcon(coupon)}</span> ${this.escapeHtml(coupon.name || '未命名优惠券')}
                </div>
                <div class="yhquan-card-row yhquan-card-tags">
                    ${this.generateTags(coupon)}
                </div>
                <div class="yhquan-card-row yhquan-card-valid">
                    <i class="fa-regular fa-clock"></i>
                    <span>${this.escapeHtml(this.formatValidPeriod(coupon))}</span>
                </div>
                <div class="yhquan-card-row yhquan-card-meta">
                    <i class="fa-regular fa-user"></i>
                    <span>${this.escapeHtml(coupon.account || coupon.createMan || '未知')}</span>
                    <span class="yhquan-card-separator">|</span>
                    <span>${coupon.ctime || ''}</span>
                </div>
                <div class="yhquan-card-row yhquan-card-desc"
                     data-id="${coupon.id}"
                     data-desc="${description}">
                    <span>@${description}</span>
                </div>
            </div>
        `;
    },

    /**
     * 批量生成卡片HTML
     */
    generateCards(coupons, startIndex = 1) {
        if (!Array.isArray(coupons) || coupons.length === 0) {
            return '';
        }

        return coupons.map((coupon, idx) =>
            this.generateCard(coupon, startIndex + idx)
        ).join('');
    }
};

// 导出模块
window.YhquanCardModule = YhquanCardModule;
