/**
 * 优惠券渲染模块 - 样式与交互
 */
const YhquanYsModule = {
    state: {
        selectedCoupons: [],
        initialized: false
    },

    init() {
        if (this.state.initialized) return;
        this.state.initialized = true;
    },

    renderResults(coupons = []) {
        const container = document.getElementById('message-container');
        if (!container) return;
        const sharedTitle = String(window.YHQUAN_TEXT?.SHARED_TITLE || '已共享优惠券');

        const msg = document.createElement('div');
        msg.className = 'system-message';

        const cardsHtml = this.renderCouponCards(coupons);
        msg.innerHTML = `
            <img src="logo/ai.svg" alt="AI" class="system-avatar">
            <div class="system-text text-gray-700">
                <p><b>${this.escapeHtml(sharedTitle)}</b></p>
                ${cardsHtml}
            </div>
        `;

        container.appendChild(msg);
        window.ZhiLiaoModule?.scrollToBottom?.();
    },

    renderCouponCards(coupons = []) {
        if (!Array.isArray(coupons) || coupons.length === 0) {
            return '<p style="color:#999;font-size:12px;">暂无可用优惠券</p>';
        }

        return `
            <div class="zhiliao-hd-cards">
                ${coupons
                    .map((coupon) => {
                        const id = this.escapeHtml(String(coupon.id || ''));
                        const keyword = this.escapeHtml(String(coupon.keyword || ''));
                        const name = this.escapeHtml(String(coupon.name || coupon.keyword || '未命名'));
                        const totalLimit = Number(coupon.totalLimit || 0);
                        const storeLimit = Number(coupon.storeLimit || 0);
                        return `
                            <div class="zhiliao-hd-card" data-id="${id}" data-keyword="${keyword}" onclick="YhquanYsModule.toggleCardSelect(this)">
                                <div class="zhiliao-hd-card-name">${name}</div>
                                <div class="zhiliao-hd-card-info">总量${totalLimit}张 · 单店限${storeLimit}张</div>
                            </div>
                        `;
                    })
                    .join('')}
            </div>
        `;
    },

    escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    toggleCardSelect(cardElement) {
        const couponId = cardElement.dataset.id;
        const keyword = cardElement.dataset.keyword;
        const name = cardElement.querySelector('.zhiliao-hd-card-name')?.textContent || '';

        const index = this.state.selectedCoupons.findIndex((c) => String(c.id) === String(couponId));
        if (index >= 0) {
            this.state.selectedCoupons.splice(index, 1);
            cardElement.classList.remove('selected');
        } else {
            this.state.selectedCoupons.push({ id: couponId, keyword, name });
            cardElement.classList.add('selected');
        }

        this.updateSelectedTags();

        if (window.YhquanToolModule) {
            YhquanToolModule.setSelectedCoupons(this.state.selectedCoupons);
        }
    },

    updateSelectedTags() {
        window.ZhiLiaoTuopanModule?.setCoupons?.(this.state.selectedCoupons);
    },

    removeSelectedCoupon(couponId) {
        const id = String(couponId);
        const index = this.state.selectedCoupons.findIndex((c) => String(c.id) === id);
        if (index < 0) return;

        this.state.selectedCoupons.splice(index, 1);
        const card = document.querySelector(`.zhiliao-hd-card[data-id="${id}"]`);
        if (card) card.classList.remove('selected');

        this.updateSelectedTags();
        if (window.YhquanToolModule) {
            YhquanToolModule.setSelectedCoupons(this.state.selectedCoupons);
        }
    },

    clearSelectedCoupons() {
        this.state.selectedCoupons = [];
        document.querySelectorAll('.zhiliao-hd-card.selected').forEach((card) => {
            card.classList.remove('selected');
        });
        window.ZhiLiaoTuopanModule?.setCoupons?.([]);
    },

    addUserMessage(text, coupons = []) {
        const container = document.getElementById('message-container');
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'user-message';
        div.textContent = text;
        container.appendChild(div);

        if (coupons.length > 0) {
            const tagsDiv = document.createElement('div');
            tagsDiv.className = 'zhiliao-hd-msg-tags';
            tagsDiv.innerHTML = coupons
                .map((c) => `<span class="zhiliao-hd-msg-tag">${this.escapeHtml(c.name)}</span>`)
                .join('');
            container.appendChild(tagsDiv);
        }

        window.ZhiLiaoModule?.scrollToBottom?.();
    }
};

window.YhquanYsModule = YhquanYsModule;
YhquanYsModule.init();
