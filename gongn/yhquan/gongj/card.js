// 优惠券卡片渲染模块
const YhquanCardModule = {
    /**
     * 生成标签HTML
     */
    generateTags(coupon) {
        const tags = [];
        const escape = YhquanUtils.escapeHtml;

        // 使用条件标签
        if (coupon.minPay && coupon.minPay > 0) {
            tags.push(`<span class="yhquan-tag yhquan-tag-condition">满${escape(String(coupon.minPay))}元</span>`);
        } else {
            tags.push(`<span class="yhquan-tag yhquan-tag-condition">无门槛</span>`);
        }

        // 归属类标签
        if (coupon.typeDesc) {
            tags.push(`<span class="yhquan-tag yhquan-tag-category">${escape(coupon.typeDesc)}</span>`);
        }

        // 面额标签
        if (coupon.price) {
            tags.push(`<span class="yhquan-tag yhquan-tag-price">${escape(coupon.price)}</span>`);
        }

        return tags.join('');
    },

    /**
     * 生成单个优惠券卡片HTML
     */
    generateCard(coupon, index) {
        const escape = YhquanUtils.escapeHtml;
        const description = escape(coupon.note || '暂无使用说明');

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
                    <span class="yhquan-status-icon">${YhquanUtils.getStatusIcon(coupon)}</span> ${escape(coupon.name || '未命名优惠券')}
                </div>
                <div class="yhquan-card-row yhquan-card-tags">
                    ${this.generateTags(coupon)}
                </div>
                <div class="yhquan-card-row yhquan-card-valid">
                    <i class="fa-regular fa-clock"></i>
                    <span>${escape(YhquanUtils.getValidPeriod(coupon))}</span>
                </div>
                <div class="yhquan-card-row yhquan-card-meta">
                    <i class="fa-regular fa-user"></i>
                    <span>${escape(coupon.account || coupon.createMan || '未知')}</span>
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
