/**
 * 优惠券模块 - 卡片业务
 */
const KapianYewu = {
    /**
     * 生成标签HTML
     */
    generateTags(coupon) {
        const tags = [];
        const escape = YhquanGongju.escapeHtml;

        if (coupon.minPay && coupon.minPay > 0) {
            tags.push(`<span class="yhquan-tag yhquan-tag-condition">满${escape(String(coupon.minPay))}元</span>`);
        } else {
            tags.push(`<span class="yhquan-tag yhquan-tag-condition">无门槛</span>`);
        }

        if (coupon.typeDesc) {
            tags.push(`<span class="yhquan-tag yhquan-tag-category">${escape(coupon.typeDesc)}</span>`);
        }

        if (coupon.price) {
            tags.push(`<span class="yhquan-tag yhquan-tag-price">${escape(coupon.price)}</span>`);
        }

        return tags.join('');
    },

    /**
     * 生成单个优惠券卡片HTML
     */
    renderCard(coupon, index) {
        const escape = YhquanGongju.escapeHtml;
        const description = escape(coupon.note || '暂无使用说明');

        return `
            <div class="yhquan-card" data-id="${coupon.id}">
                <div class="yhquan-card-row yhquan-card-header">
                    <span class="yhquan-card-index">#${index} | ID: ${coupon.id || 'N/A'}</span>
                    <div class="yhquan-card-actions">
                        <button class="yhquan-action-btn" data-action="validity" data-id="${coupon.id}">效期</button>
                        <button class="yhquan-action-btn" data-action="invalid" data-id="${coupon.id}">作废</button>
                        <button class="yhquan-action-btn" data-action="gift" data-id="${coupon.id}">赠送</button>
                        <button class="yhquan-action-btn" data-action="activity" data-id="${coupon.id}">活动</button>
                    </div>
                </div>
                <div class="yhquan-card-row yhquan-card-title">
                    <span class="yhquan-status-icon">${YhquanGongju.getStatusIcon(coupon)}</span> ${escape(coupon.name || '未命名优惠券')}
                </div>
                <div class="yhquan-card-row yhquan-card-tags">
                    ${this.generateTags(coupon)}
                    ${YhquanGongju.getCouponStatus(coupon).valid ? `<span class="yhquan-tag yhquan-tag-ewm" data-id="${coupon.id}" title="生成二维码链接"><i class="fa-solid fa-qrcode"></i></span>` : ''}
                </div>
                <div class="yhquan-card-row yhquan-card-valid">
                    <span>⌛️</span>
                    <span>${escape(YhquanGongju.getValidPeriod(coupon))}</span>
                </div>
                <div class="yhquan-card-row yhquan-card-meta">
                    <span>😊</span>
                    <span>${escape(coupon.account || coupon.createMan || '未知')}</span>
                    <span class="yhquan-card-separator">|</span>
                    <span>${coupon.ctime || ''}</span>
                </div>
                <div class="yhquan-card-row yhquan-card-stats">
                    <span class="yhquan-stats-item">
                        <span>📊</span>
                        使用/领取：${coupon.usedCount || 0}/${coupon.issuedCount || 0}
                    </span>
                    <span class="yhquan-card-separator">|</span>
                    <span class="yhquan-stats-item yhquan-gmv-item">
                        GMV：<span class="yhquan-gmv-value" data-id="${coupon.id}"></span>
                        <i class="fa-regular fa-eye yhquan-gmv-eye" data-id="${coupon.id}" title="点击查看GMV"></i>
                    </span>
                </div>
                <div class="yhquan-card-row yhquan-card-desc"
                     data-id="${coupon.id}"
                     data-desc="${description}">
                    <span>@${description}</span>
                </div>
            </div>
        `;
    }
};

window.KapianYewu = KapianYewu;
