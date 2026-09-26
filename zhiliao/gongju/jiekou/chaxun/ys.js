/**
 * 商品查询模块 - 智聊渲染
 *
 * 职责
 * 1. 管理卡片展开/折叠
 * 2. 按条件排序展示（一口价+特价优先
 * 3. 复用商品查询模块的卡片、弹窗、API
 */

const ChaxunYsModule = {
    // 状
    state: {
        products: [],           // 当前查询结果
        displayedCount: 0,      // 已显示的卡片数量
        currentContainer: null, // 当前消息容器
        batchSize: 5,           // 每次展开的数量
        initialCards: []        // 初始显示的卡片
    },

    /**
     * 初始化模
     */
    init() {
        this.injectStyles();
    },

    /**
     * 注入样式（复用卡片样+ 智聊专用样式
     */
    injectStyles() {
        // 注入卡片样式
        if (window.ChaxunKapianYangshi) {
            ChaxunKapianYangshi.inject();
        }
        // 注入弹窗样式
        if (window.TanchuangYangshi) {
            TanchuangYangshi.inject();
        }
        // 注入智聊专用样式
        this.injectChatStyles();
    },

    /**
     * 注入智聊专用样式
     */
    injectChatStyles() {
        const styleId = 'chaxun-zhiliao-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
/* 智聊查询卡片容器 */
.zhiliao-cx-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 8px;
    max-width: 375px;
}

/* 聊天中“商品卡片块”与后续状态提示之间留白 */
.zhiliao-cx-inline-result {
    margin-bottom: 16px;
}

@media (max-width: 768px) {
    .zhiliao-cx-cards {
        max-width: none;
    }

    .zhiliao-cx-inline-result {
        margin-bottom: 18px;
    }
}

/* 展开/折叠按钮*/
.zhiliao-cx-btn-group {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    max-width: 375px;
}

@media (max-width: 768px) {
    .zhiliao-cx-btn-group {
        max-width: none;
    }
}

.zhiliao-cx-collapse-btn,
.zhiliao-cx-expand-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    background: #f3f4f6;
    border-radius: 8px;
    font-size: 12px;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
}

@media (hover: hover) and (pointer: fine) {
    .zhiliao-cx-collapse-btn:hover,
    .zhiliao-cx-expand-btn:hover {
        background: #e5e7eb;
        color: #3d6dff;
    }
}

.zhiliao-cx-collapse-btn.disabled,
.zhiliao-cx-expand-btn.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
}

.zhiliao-cx-collapse-btn i,
.zhiliao-cx-expand-btn i {
    font-size: 10px;
}
        `;
        document.head.appendChild(style);
    },

    /**
     * 在聊天区域渲染商品结
     */
    renderResults(products) {
        this.injectStyles();

        const messageContainer = document.getElementById('message-container');
        if (!messageContainer) return;

        // 保存商品数据
        this.state.products = products;

        // 创建系统消息
        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message';

        const containerId = 'cx-result-' + Date.now();

        // 获取初始显示的卡片（一口价+特价各一个）
        const initialCards = this.getInitialCards(products);
        this.state.initialCards = initialCards;
        this.state.displayedCount = initialCards.length;

        // 生成卡片HTML（复用卡片模块）
        const cardsHtml = initialCards.map(item =>
            window.ChaxunKapianYewu ?
                ChaxunKapianYewu.generateCard(item.product, item.index + 1) :
                this.fallbackCard(item.product, item.index + 1)
        ).join('');

        // 渲染摘要和卡
        const hasMore = products.length > initialCards.length;

        messageDiv.innerHTML = `
            <img src="logo/ai.svg" alt="AI" class="system-avatar">
            <div class="system-text text-gray-700">
                <p><b>🎁找到 ${products.length} 个商品</b></p>
                <div class="zhiliao-cx-cards" id="${containerId}">
                    ${cardsHtml}
                </div>
                ${hasMore ? this.renderButtonGroup(containerId) : ''}
            </div>
        `;

        messageContainer.appendChild(messageDiv);

        // 保存容器引用
        this.state.currentContainer = messageDiv.querySelector('.system-text');

        // 绑定事件
        this.bindEvents();

        // 滚动到底
        if (window.ZhiLiaoBujuModule) {
            ZhiLiaoBujuModule.scrollToBottom();
        }
    },

    /**
     * 获取初始显示的卡片（按销售金额排序，一口价+特价各取最高）
     */
    getInitialCards(products) {
        const result = [];
        const selectedIndices = new Set();

        // 分组：一口价、特价、其
        const yikoujiaList = [];
        const tejiaList = [];
        const otherList = [];

        products.forEach((product, index) => {
            const typeName = product.wholesaleTypeName || '';
            const item = { product, index, totalCost: product.totalCost || 0 };

            if (typeName === '一口价') {
                yikoujiaList.push(item);
            } else if (typeName.includes('特价')) {
                // 匹配：特价、限时特价、特价不可用
                tejiaList.push(item);
            } else {
                otherList.push(item);
            }
        });

        // 按销售金额降序排
        const sortBySales = (a, b) => b.totalCost - a.totalCost;
        yikoujiaList.sort(sortBySales);
        tejiaList.sort(sortBySales);
        otherList.sort(sortBySales);

        // 取销售金额最高的一口价
        if (yikoujiaList.length > 0) {
            result.push(yikoujiaList[0]);
            selectedIndices.add(yikoujiaList[0].index);
        }

        // 取销售金额最高的特价
        if (tejiaList.length > 0) {
            result.push(tejiaList[0]);
            selectedIndices.add(tejiaList[0].index);
        }

        // 补充逻辑：如果没有特价，从其他类型中取销售金额最高的
        if (tejiaList.length === 0 && result.length < 2 && products.length > 1) {
            // 先从一口价中取第二高的
            if (yikoujiaList.length > 1) {
                result.push(yikoujiaList[1]);
                selectedIndices.add(yikoujiaList[1].index);
            } else if (otherList.length > 0) {
                // 否则从其他类型中
                result.push(otherList[0]);
                selectedIndices.add(otherList[0].index);
            }
        }

        // 补充逻辑：如果没有一口价，从其他类型中取销售金额最高的
        if (yikoujiaList.length === 0 && result.length < 2 && products.length > 1) {
            // 先从特价中取第二高的
            if (tejiaList.length > 1) {
                result.push(tejiaList[1]);
                selectedIndices.add(tejiaList[1].index);
            } else if (otherList.length > 0) {
                // 否则从其他类型中
                result.push(otherList[0]);
                selectedIndices.add(otherList[0].index);
            }
        }

        // 如果只有一个商
        if (result.length === 0 && products.length > 0) {
            result.push({ product: products[0], index: 0 });
        }

        // 按类型优先级排序：一口价 > 特价 > 其他
        const getTypePriority = (item) => {
            const typeName = item.product.wholesaleTypeName || '';
            if (typeName === '一口价') return 0;
            if (typeName.includes('特价')) return 1;
            return 2;
        };
        result.sort((a, b) => getTypePriority(a) - getTypePriority(b));

        return result;
    },

    /**
     * 渲染按钮
     */
    renderButtonGroup(containerId) {
        const remaining = this.state.products.length - this.state.displayedCount;
        const initialCount = this.state.initialCards.length;
        const canCollapse = this.state.displayedCount - initialCount;
        const collapseCount = Math.min(canCollapse, this.state.batchSize);
        const expandCount = Math.min(remaining, this.state.batchSize);

        return `
            <div class="zhiliao-cx-btn-group" data-container="${containerId}">
                <div class="zhiliao-cx-collapse-btn ${canCollapse <= 0 ? 'disabled' : ''}" onclick="ChaxunYsModule.collapseCards()">
                    <i class="fa-solid fa-chevron-up"></i>
                    <span>收起${canCollapse > 0 ? ` (${collapseCount})` : ''}</span>
                </div>
                <div class="zhiliao-cx-expand-btn ${remaining <= 0 ? 'disabled' : ''}" onclick="ChaxunYsModule.expandMore()">
                    <span>展开${remaining > 0 ? ` (${expandCount})` : ''}</span>
                    <i class="fa-solid fa-chevron-down"></i>
                </div>
            </div>
        `;
    },

    /**
     * 展开更多卡片
     */
    expandMore() {
        const container = this.state.currentContainer;
        if (!container) return;

        const products = this.state.products;
        const batchSize = this.state.batchSize;

        // 获取已显示的索引
        const displayedIndices = this.getDisplayedIndices();

        // 获取下一批要显示的卡
        const nextBatch = [];
        for (let i = 0; i < products.length && nextBatch.length < batchSize; i++) {
            if (!displayedIndices.has(i)) {
                nextBatch.push({ product: products[i], index: i });
            }
        }

        if (nextBatch.length === 0) return;

        // 更新已显示数
        this.state.displayedCount += nextBatch.length;

        // 生成新卡片HTML
        const newCardsHtml = nextBatch.map(item =>
            window.ChaxunKapianYewu ?
                ChaxunKapianYewu.generateCard(item.product, item.index + 1) :
                this.fallbackCard(item.product, item.index + 1)
        ).join('');

        // 添加到卡片容
        const cardsContainer = container.querySelector('.zhiliao-cx-cards');
        if (cardsContainer) {
            cardsContainer.insertAdjacentHTML('beforeend', newCardsHtml);
        }

        // 更新按钮
        this.updateButtonGroup(container);

        // 重新绑定事件
        this.bindEvents();

        this.scrollToBottom();
    },

    /**
     * 折叠卡片
     */
    collapseCards() {
        const container = this.state.currentContainer;
        if (!container) return;

        const cardsContainer = container.querySelector('.zhiliao-cx-cards');
        if (!cardsContainer) return;

        const initialCount = this.state.initialCards.length;
        const currentCount = this.state.displayedCount;
        const batchSize = this.state.batchSize;

        // 计算收起后的数量
        const newCount = Math.max(initialCount, currentCount - batchSize);
        if (newCount >= currentCount) return;

        // 从后往前移除卡
        const cardsToRemove = currentCount - newCount;

        for (let i = 0; i < cardsToRemove; i++) {
            const lastCard = cardsContainer.querySelector('.chaxun-card:last-child');
            if (lastCard) lastCard.remove();
        }

        // 更新状
        this.state.displayedCount = newCount;

        // 更新按钮
        this.updateButtonGroup(container);
    },

    /**
     * 更新按钮组状
     */
    updateButtonGroup(container) {
        const btnGroup = container.querySelector('.zhiliao-cx-btn-group');
        if (!btnGroup) return;

        const remaining = this.state.products.length - this.state.displayedCount;
        const initialCount = this.state.initialCards.length;
        const canCollapse = this.state.displayedCount - initialCount;
        const collapseCount = Math.min(canCollapse, this.state.batchSize);
        const expandCount = Math.min(remaining, this.state.batchSize);

        // 更新折叠按钮
        const collapseBtn = btnGroup.querySelector('.zhiliao-cx-collapse-btn');
        if (collapseBtn) {
            if (canCollapse <= 0) {
                collapseBtn.classList.add('disabled');
                collapseBtn.querySelector('span').textContent = '收起';
            } else {
                collapseBtn.classList.remove('disabled');
                collapseBtn.querySelector('span').textContent = `收起 (${collapseCount})`;
            }
        }

        // 更新展开按钮
        const expandBtn = btnGroup.querySelector('.zhiliao-cx-expand-btn');
        if (expandBtn) {
            if (remaining <= 0) {
                expandBtn.classList.add('disabled');
                expandBtn.querySelector('span').textContent = '展开';
            } else {
                expandBtn.classList.remove('disabled');
                expandBtn.querySelector('span').textContent = `展开 (${expandCount})`;
            }
        }
    },

    /**
     * 获取已显示的卡片索引
     */
    getDisplayedIndices() {
        const indices = new Set();
        const container = this.state.currentContainer;
        if (!container) return indices;

        container.querySelectorAll('.chaxun-card').forEach(card => {
            const id = card.dataset.id;
            const index = this.state.products.findIndex(p => String(p.wholesaleId) === id);
            if (index !== -1) indices.add(index);
        });

        return indices;
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        const container = this.state.currentContainer;
        if (!container) return;

        // 详情按钮点击
        container.querySelectorAll('.chaxun-detail-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index) - 1;
                this.showDetail(index);
            };
        });

        // 品种负责人小眼睛点击
        container.querySelectorAll('.chaxun-contactor-eye').forEach(eye => {
            eye.onclick = (e) => {
                e.stopPropagation();
                this.queryContactor(eye);
            };
        });
    },

    /**
     * 显示详情弹窗
     */
    showDetail(index) {
        const product = this.state.products[index];
        if (!product) return;

        // 确保弹窗已渲
        this.ensureDetailOverlay();

        // 调用弹窗模块显示
        if (window.TanchuangYewu) {
            // 使用智聊专用弹窗
            const overlay = document.getElementById('zhiliao-cx-detail-overlay');
            const body = overlay?.querySelector('.chaxun-detail-body');
            if (overlay && body) {
                body.innerHTML = TanchuangYewu.renderContent(product);
                overlay.classList.add('active');
            }
        }
    },

    /**
     * 确保详情弹窗DOM存在
     */
    ensureDetailOverlay() {
        if (document.getElementById('zhiliao-cx-detail-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'zhiliao-cx-detail-overlay';
        overlay.className = 'chaxun-detail-overlay';
        overlay.innerHTML = `
            <div class="chaxun-detail-modal">
                <div class="chaxun-detail-header">
                    <span class="chaxun-detail-title">商品详情</span>
                    <button class="chaxun-detail-close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="chaxun-detail-body"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        // 绑定关闭事件
        overlay.querySelector('.chaxun-detail-close').onclick = () => this.hideDetail();
        overlay.onclick = (e) => {
            if (e.target === overlay) this.hideDetail();
        };

        // 绑定分组折叠事件
        overlay.querySelector('.chaxun-detail-body').onclick = (e) => {
            const imageItem = e.target.closest('.chaxun-detail-image-item');
            if (imageItem) {
                e.preventDefault();
                const imageUrl = String(imageItem.dataset.imageUrl || '').trim();
                if (imageUrl) {
                    window.ZhiLiaoBujuModule?.viewImage?.(imageUrl);
                }
                return;
            }

            const header = e.target.closest('.chaxun-detail-section-header');
            if (header) {
                header.closest('.chaxun-detail-section')?.classList.toggle('collapsed');
            }
        };
    },

    /**
     * 隐藏详情弹窗
     */
    hideDetail() {
        const overlay = document.getElementById('zhiliao-cx-detail-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    /**
     * 查询品种负责
     */
    async queryContactor(eyeIcon) {
        const parentTag = eyeIcon.closest('.chaxun-tag-contactor');
        const drugCode = parentTag?.dataset.drugcode;
        const valueSpan = parentTag?.querySelector('.chaxun-contactor-value');

        if (!drugCode || !valueSpan) {
            if (valueSpan) valueSpan.textContent = '-';
            return;
        }

        // 显示加载状
        eyeIcon.className = 'fa-solid fa-spinner fa-spin chaxun-contactor-eye';

        // 调用API查询
        if (window.GongjuApi) {
            const result = await GongjuApi.queryPmsContactor(drugCode);
            if (result.success) {
                valueSpan.textContent = result.contactor;
                eyeIcon.style.display = 'none';
            } else {
                valueSpan.textContent = result.error || '查询失败';
                valueSpan.style.color = '#ef4444';
                eyeIcon.className = 'fa-regular fa-eye chaxun-contactor-eye';
            }
        } else {
            valueSpan.textContent = '-';
            eyeIcon.className = 'fa-regular fa-eye chaxun-contactor-eye';
        }
    },

    /**
     * 在指定位置渲染卡片（供AI工具调用使用
     */
    renderCardsAt(products, parentElement, insertBefore) {
        this.injectStyles();

        // 保存商品数据
        this.state.products = products;

        const containerId = 'cx-result-' + Date.now();

        // 获取初始显示的卡
        const initialCards = this.getInitialCards(products);
        this.state.initialCards = initialCards;
        this.state.displayedCount = initialCards.length;

        // 生成卡片HTML
        const cardsHtml = initialCards.map(item =>
            window.ChaxunKapianYewu ?
                ChaxunKapianYewu.generateCard(item.product, item.index + 1) :
                this.fallbackCard(item.product, item.index + 1)
        ).join('');

        const hasMore = products.length > initialCards.length;

        // 创建容器
        const wrapper = document.createElement('div');
        wrapper.className = 'system-text text-gray-700 zhiliao-cx-inline-result';
        wrapper.innerHTML = `
            <p><b>🎁找到 ${products.length} 个商品</b></p>
            <div class="zhiliao-cx-cards" id="${containerId}">
                ${cardsHtml}
            </div>
            ${hasMore ? this.renderButtonGroup(containerId) : ''}
        `;

        // 保存容器引用
        this.state.currentContainer = wrapper;

        if (insertBefore) {
            parentElement.insertBefore(wrapper, insertBefore);
        } else {
            parentElement.appendChild(wrapper);
        }

        // 绑定事件
        this.bindEvents();

        return wrapper;
    },

    /**
     * 降级卡片（当卡片模块未加载时使用
     */
    fallbackCard(product, index) {
        const escape = (text) => {
            if (!text) return '';
            return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        };
        return `
            <div class="chaxun-card" data-id="${product.wholesaleId}">
                <div style="font-size:10px;color:#3b82f6;">#${index}</div>
                <div style="font-size:11px;font-weight:700;">${escape(product.drugName || '未知商品')}</div>
                <div style="font-size:10px;color:#6b7280;">${escape(product.factoryName || '')}</div>
            </div>
        `;
    },

    /**
     * 滚动到底
     */
    scrollToBottom() {
        if (window.ZhiLiaoBujuModule) {
            ZhiLiaoBujuModule.scrollToBottom();
        }
    }
};

// 导出模块
window.ChaxunYsModule = ChaxunYsModule;

// 初始
ChaxunYsModule.init();
