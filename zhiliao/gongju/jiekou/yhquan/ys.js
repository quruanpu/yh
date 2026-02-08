/**
 * 优惠券模块 - 样式与渲染
 *
 * 职责：
 * 1. 动态注入CSS样式
 * 2. 渲染优惠券卡片
 * 3. 处理UI交互（选择、展开/折叠等）
 */

const YhquanYsModule = {
    // 状态
    state: {
        styleInjected: false,
        defaultShowCount: 3,
        selectedCoupons: []
    },

    /**
     * 初始化模块
     */
    init() {
        this.injectStyles();
    },

    /**
     * 动态注入CSS样式
     */
    injectStyles() {
        if (this.state.styleInjected) return;

        const styleId = 'yhquan-chat-styles';
        if (document.getElementById(styleId)) {
            this.state.styleInjected = true;
            return;
        }

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = this.getChatStyles();
        document.head.appendChild(style);
        this.state.styleInjected = true;
    },

    /**
     * 获取聊天区域专用样式 - 与原版一致
     */
    getChatStyles() {
        return `
/* 优惠券卡片容器 - 横向排列自动换行 */
.zhiliao-hd-cards {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
}

/* 优惠券卡片 - 紧凑样式 */
.zhiliao-hd-card {
    flex: 0 0 auto;
    min-width: 80px;
    background: #f8fbff;
    border: 1px solid #d1e3ff;
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
}

.zhiliao-hd-card.selected {
    background: #e0e7ff;
    border-color: #a5b4fc;
}

/* 仅在支持hover且使用精确指针(鼠标)的设备上显示悬浮效果 */
@media (hover: hover) and (pointer: fine) {
    .zhiliao-hd-card:hover:not(.selected) {
        background: #e0e7ff;
        border-color: #a5b4fc;
    }
    .zhiliao-hd-card:hover:not(.selected) .zhiliao-hd-card-name {
        color: #4f46e5;
    }
    .zhiliao-hd-card:hover:not(.selected) .zhiliao-hd-card-info {
        color: #6b7280;
    }
}

.zhiliao-hd-card-name {
    font-size: 11px;
    font-weight: 500;
    color: #6366f1;
    margin-bottom: 1px;
    word-break: break-word;
    line-height: 1.3;
}

.zhiliao-hd-card-info {
    font-size: 10px;
    color: #9ca3af;
    word-break: break-word;
    line-height: 1.3;
}

.zhiliao-hd-card.selected .zhiliao-hd-card-name {
    color: #4f46e5;
}

.zhiliao-hd-card.selected .zhiliao-hd-card-info {
    color: #6b7280;
}

/* 选中标签容器 - 显示在输入区域上方 */
.zhiliao-hd-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
}

.zhiliao-hd-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: #e0e7ff;
    border-radius: 4px;
    font-size: 11px;
    color: #4f46e5;
}

.zhiliao-hd-tag-remove {
    cursor: pointer;
    font-size: 10px;
    color: #6366f1;
}

.zhiliao-hd-tag-remove:hover {
    color: #ef4444;
}

/* 用户消息中的优惠券标签 */
.zhiliao-hd-msg-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: flex-end;
    padding-right: 12px;
    margin-top: -4px;
    margin-bottom: 8px;
}

.zhiliao-hd-msg-tag {
    display: inline-block;
    padding: 4px 10px;
    background: #e0e7ff;
    border-radius: 4px;
    font-size: 11px;
    color: #4f46e5;
}
        `;
    },

    /**
     * 在聊天区域渲染优惠券结果
     */
    renderResults(coupons) {
        this.injectStyles();
        this.state.selectedCoupons = [];

        const messageContainer = document.getElementById('message-container');
        if (!messageContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message';

        messageDiv.innerHTML = `
            <img src="logo/ai.svg" alt="AI" class="system-avatar">
            <div class="system-text text-gray-700">
                <p><b>🎁已共享优惠券👇</b></p>
                <div class="zhiliao-hd-cards">
                    ${this.renderCards(coupons)}
                </div>
            </div>
        `;

        messageContainer.appendChild(messageDiv);

        if (window.ZhiLiaoBujuModule) {
            ZhiLiaoBujuModule.scrollToBottom();
        }
    },

    /**
     * 渲染优惠券卡片列表 - 紧凑横向排列
     */
    renderCards(coupons) {
        return coupons.map(coupon => `
            <div class="zhiliao-hd-card" data-id="${coupon.id}" data-keyword="${this.escapeHtml(coupon.keyword || '')}" onclick="YhquanYsModule.toggleCardSelect(this)">
                <div class="zhiliao-hd-card-name">${this.escapeHtml(coupon.name)}</div>
                <div class="zhiliao-hd-card-info">总${coupon.totalLimit || 0}张·限${coupon.storeLimit || 0}张</div>
            </div>
        `).join('');
    },

    /**
     * HTML转义
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
     * 切换卡片选中状态
     */
    toggleCardSelect(cardElement) {
        const couponId = cardElement.dataset.id;
        const keyword = cardElement.dataset.keyword;
        const name = cardElement.querySelector('.zhiliao-hd-card-name')?.textContent || '';

        const index = this.state.selectedCoupons.findIndex(c => String(c.id) === String(couponId));

        if (index >= 0) {
            this.state.selectedCoupons.splice(index, 1);
            cardElement.classList.remove('selected');
        } else {
            this.state.selectedCoupons.push({ id: couponId, keyword, name });
            cardElement.classList.add('selected');
        }

        this.updateSelectedTags();

        // 同步到 YhquanToolModule
        if (window.YhquanToolModule) {
            YhquanToolModule.setSelectedCoupons(this.state.selectedCoupons);
        }
    },

    /**
     * 更新选中标签显示
     */
    updateSelectedTags() {
        let tagsContainer = document.getElementById('zhiliao-hd-tags');
        const fileTagsContainer = document.getElementById('file-tags-container');

        if (this.state.selectedCoupons.length === 0) {
            if (tagsContainer) tagsContainer.remove();
            return;
        }

        if (!tagsContainer) {
            tagsContainer = document.createElement('div');
            tagsContainer.id = 'zhiliao-hd-tags';
            tagsContainer.className = 'zhiliao-hd-tags';
            fileTagsContainer?.parentNode?.insertBefore(tagsContainer, fileTagsContainer);
        }

        tagsContainer.innerHTML = this.state.selectedCoupons.map(coupon => `
            <div class="zhiliao-hd-tag" data-id="${coupon.id}">
                <span>${this.escapeHtml(coupon.name)}</span>
                <span class="zhiliao-hd-tag-remove" onclick="event.stopPropagation(); YhquanYsModule.removeSelectedCoupon('${coupon.id}')">✕</span>
            </div>
        `).join('');
    },

    /**
     * 移除选中的优惠券
     */
    removeSelectedCoupon(couponId) {
        const id = String(couponId);
        const index = this.state.selectedCoupons.findIndex(c => String(c.id) === id);
        if (index >= 0) {
            this.state.selectedCoupons.splice(index, 1);
            const card = document.querySelector(`.zhiliao-hd-card[data-id="${id}"]`);
            if (card) card.classList.remove('selected');
            this.updateSelectedTags();

            if (window.YhquanToolModule) {
                YhquanToolModule.setSelectedCoupons(this.state.selectedCoupons);
            }
        }
    },

    /**
     * 清空选中状态
     */
    clearSelectedCoupons() {
        this.state.selectedCoupons = [];
        document.querySelectorAll('.zhiliao-hd-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
        const tagsContainer = document.getElementById('zhiliao-hd-tags');
        if (tagsContainer) tagsContainer.remove();
    },

    /**
     * 添加用户消息
     */
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
            tagsDiv.innerHTML = coupons.map(c => `
                <span class="zhiliao-hd-msg-tag">${this.escapeHtml(c.name)}</span>
            `).join('');
            container.appendChild(tagsDiv);
        }

        if (window.ZhiLiaoBujuModule) {
            ZhiLiaoBujuModule.scrollToBottom();
        }
    }
};

// 导出模块
window.YhquanYsModule = YhquanYsModule;

// 初始化
YhquanYsModule.init();
