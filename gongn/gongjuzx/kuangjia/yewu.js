// 工具中心模块 - 框架业务
const GongjuzxKuangjiaYewu = {
    state: {
        isVisible: false,
        isReady: false,
        containerId: '',
        allItems: [],
        keyword: '',
        providerId: '',
        unsubscribe: null
    },

    init(options = {}) {
        const containerId = String(options.containerId || 'module-container').trim();
        if (!containerId) return;
        if (this.state.isReady && this.state.containerId === containerId) return;

        this.state.containerId = containerId;
        this.render();
        this.bindEvents();
        this.state.isReady = true;
    },

    render() {
        if (document.getElementById('page-gongjuzx')) return;

        const container = document.getElementById(this.state.containerId);
        if (!container) return;

        container.insertAdjacentHTML('beforeend', `
            <main id="page-gongjuzx" class="gongjuzx-page" style="display: none;">
                <div class="gongjuzx-search-container">
                    <div class="gongjuzx-search-box">
                        <div class="gongjuzx-search-input-wrapper">
                            <input type="text" id="gongjuzx-search-input" class="gongjuzx-search-input" placeholder="搜索资源名称或描述..." autocomplete="off" />
                            <button id="gongjuzx-search-clear" class="gongjuzx-search-clear" style="display: none;" type="button">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <button id="gongjuzx-search-btn" class="gongjuzx-search-btn" type="button">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <span>搜索</span>
                        </button>
                    </div>
                </div>
                <div class="gongjuzx-content">
                    <div id="gongjuzx-cards" class="gongjuzx-cards"></div>
                </div>
                <button id="gongjuzx-add-fab" class="gongjuzx-add-fab" type="button" title="添加资源">
                    <i class="fa-solid fa-plus"></i>
                </button>
            </main>
        `);
    },

    bindEvents() {
        const input = document.getElementById('gongjuzx-search-input');
        const clearButton = document.getElementById('gongjuzx-search-clear');
        const searchButton = document.getElementById('gongjuzx-search-btn');
        const addButton = document.getElementById('gongjuzx-add-fab');
        const cards = document.getElementById('gongjuzx-cards');

        searchButton?.addEventListener('click', () => this.applySearch());
        input?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.applySearch();
            }
        });
        input?.addEventListener('input', () => {
            if (!input || !clearButton) return;
            const hasText = String(input.value || '').trim().length > 0;
            clearButton.style.display = hasText ? 'flex' : 'none';
            this.applySearch();
        });
        clearButton?.addEventListener('click', () => {
            if (!input || !clearButton) return;
            input.value = '';
            clearButton.style.display = 'none';
            this.applySearch();
            input.focus();
        });

        addButton?.addEventListener('click', () => this.openCreateModal());

        cards?.addEventListener('click', (event) => {
            const descElement = event.target.closest('.gongjuzx-card-desc');
            if (descElement) {
                const description = descElement.getAttribute('data-desc');
                if (description) this.toggleDescriptionTooltip(descElement, description);
                return;
            }

            const button = event.target.closest('button[data-action]');
            if (!button) return;
            const action = String(button.dataset.action || '').trim();
            const itemId = String(button.dataset.id || '').trim();
            if (!action || !itemId) return;

            if (action === 'visit') {
                this.handleVisit(itemId);
                return;
            }
            if (action === 'edit') {
                this.openEditModal(itemId);
                return;
            }
            if (action === 'delete') {
                this.handleDelete(itemId);
            }
        });

        document.addEventListener('click', (event) => {
            const tooltip = document.querySelector('.gongjuzx-desc-tooltip');
            if (!tooltip) return;
            if (event.target.closest('.gongjuzx-desc-tooltip')) return;
            if (event.target.closest('.gongjuzx-card-desc')) return;
            this.hideDescriptionTooltip();
        });
    },

    getCardsElement() {
        return document.getElementById('gongjuzx-cards');
    },

    showToast(message, type = 'warning') {
        if (window.Tongzhi && typeof window.Tongzhi[type] === 'function') {
            window.Tongzhi[type](message);
            return;
        }
        if (window.Tongzhi && typeof window.Tongzhi.info === 'function') {
            window.Tongzhi.info(message);
            return;
        }
        console[type === 'error' ? 'error' : 'log'](`[工具中心] ${message}`);
    },

    setLoading() {
        const cards = this.getCardsElement();
        if (!cards) return;
        this.hideDescriptionTooltip();
        cards.innerHTML = `
            <div class="gongjuzx-empty">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <p class="gongjuzx-empty-text">加载中...</p>
            </div>
        `;
    },

    formatDescriptionText(text) {
        if (!text) return '';
        return String(text).replace(/\\n/g, '\n')
            .replace(/(\d+)\./g, '\n$1.')
            .replace(/^\n/, '')
            .trim();
    },

    toggleDescriptionTooltip(element, description) {
        const itemId = String(element.getAttribute('data-id') || '').trim();
        const currentTooltip = document.querySelector('.gongjuzx-desc-tooltip');
        if (currentTooltip && currentTooltip.getAttribute('data-id') === itemId) {
            this.hideDescriptionTooltip();
            return;
        }
        this.showDescriptionTooltip(element, description, itemId);
    },

    showDescriptionTooltip(element, description, itemId = '') {
        this.hideDescriptionTooltip();

        const tooltip = document.createElement('div');
        tooltip.className = 'gongjuzx-desc-tooltip';
        tooltip.setAttribute('data-id', itemId);
        tooltip.textContent = this.formatDescriptionText(description);
        document.body.appendChild(tooltip);

        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
        let top = rect.bottom + 8;

        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }

        if (top + tooltipRect.height > window.innerHeight - 10) {
            top = rect.top - tooltipRect.height - 8;
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    },

    hideDescriptionTooltip() {
        const tooltip = document.querySelector('.gongjuzx-desc-tooltip');
        if (tooltip) tooltip.remove();
    },

    renderList() {
        const cards = this.getCardsElement();
        if (!cards) return;
        this.hideDescriptionTooltip();

        const keyword = String(this.state.keyword || '').trim().toLowerCase();
        let list = this.state.allItems;
        if (keyword) {
            list = list.filter((item) => {
                const name = String(item?.name || '').toLowerCase();
                const description = String(item?.description || '').toLowerCase();
                const url = String(item?.url || '').toLowerCase();
                return name.includes(keyword) || description.includes(keyword) || url.includes(keyword);
            });
        }

        if (window.GongjuzxKapianYewu?.renderList) {
            cards.innerHTML = GongjuzxKapianYewu.renderList(list);
        } else {
            cards.innerHTML = '';
        }
    },

    applySearch() {
        const input = document.getElementById('gongjuzx-search-input');
        this.state.keyword = String(input?.value || '').trim();
        this.renderList();
    },

    findItemById(itemId) {
        return this.state.allItems.find((item) => String(item.id) === String(itemId)) || null;
    },

    openCreateModal() {
        if (!window.GongjuzxTanchuangYewu?.openCreate) return;
        GongjuzxTanchuangYewu.openCreate(async (payload) => {
            await GongjuzxGongju.createItem(payload);
            this.showToast('资源已添加', 'success');
        });
    },

    openEditModal(itemId) {
        const item = this.findItemById(itemId);
        if (!item) {
            this.showToast('未找到资源', 'warning');
            return;
        }
        if (!item.can_manage) {
            this.showToast('无权编辑该工具', 'warning');
            return;
        }
        if (!window.GongjuzxTanchuangYewu?.openEdit) return;
        GongjuzxTanchuangYewu.openEdit(item, async (payload) => {
            await GongjuzxGongju.updateItem(itemId, payload);
            this.showToast('资源已保存', 'success');
        });
    },

    async handleDelete(itemId) {
        const item = this.findItemById(itemId);
        if (!item?.can_manage) {
            this.showToast('无权删除该工具', 'warning');
            return;
        }

        this.openDeleteConfirm(item);
    },

    openDeleteConfirm(item) {
        this.closeDeleteConfirm();
        this.hideDescriptionTooltip();

        document.body.insertAdjacentHTML('beforeend', `
            <div class="gongjuzx-delete-modal" id="gongjuzx-delete-modal">
                <div class="gongjuzx-delete-overlay"></div>
                <div class="gongjuzx-delete-content" role="dialog" aria-modal="true" aria-labelledby="gongjuzx-delete-title">
                    <div class="gongjuzx-delete-header">
                        <h3 class="gongjuzx-delete-title" id="gongjuzx-delete-title">删除确认</h3>
                    </div>
                    <div class="gongjuzx-delete-body">
                        <p class="gongjuzx-delete-text">是否删除？请输入“确认”进行删除！</p>
                        <input id="gongjuzx-delete-input" class="gongjuzx-delete-input" type="text" autocomplete="off" placeholder="输入：确认" />
                    </div>
                    <div class="gongjuzx-delete-footer">
                        <button class="gongjuzx-delete-btn gongjuzx-delete-cancel" id="gongjuzx-delete-cancel" type="button">取消</button>
                        <button class="gongjuzx-delete-btn gongjuzx-delete-confirm" id="gongjuzx-delete-confirm" type="button" disabled>确认</button>
                    </div>
                </div>
            </div>
        `);

        const input = document.getElementById('gongjuzx-delete-input');
        const cancelButton = document.getElementById('gongjuzx-delete-cancel');
        const confirmButton = document.getElementById('gongjuzx-delete-confirm');

        const updateConfirmState = () => {
            if (confirmButton) confirmButton.disabled = String(input?.value || '').trim() !== '确认';
        };

        input?.addEventListener('input', updateConfirmState);
        input?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && String(input.value || '').trim() === '确认') {
                event.preventDefault();
                this.performDelete(item.id);
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                this.closeDeleteConfirm();
            }
        });
        cancelButton?.addEventListener('click', () => this.closeDeleteConfirm());
        confirmButton?.addEventListener('click', () => this.performDelete(item.id));

        input?.focus();
    },

    closeDeleteConfirm() {
        const modal = document.getElementById('gongjuzx-delete-modal');
        if (modal) modal.remove();
    },

    async performDelete(itemId) {
        const input = document.getElementById('gongjuzx-delete-input');
        if (String(input?.value || '').trim() !== '确认') {
            this.showToast('请输入“确认”后再删除', 'warning');
            return;
        }

        const confirmButton = document.getElementById('gongjuzx-delete-confirm');
        const cancelButton = document.getElementById('gongjuzx-delete-cancel');
        if (confirmButton) confirmButton.disabled = true;
        if (cancelButton) cancelButton.disabled = true;

        try {
            await GongjuzxGongju.deleteItem(itemId);
            this.closeDeleteConfirm();
            this.showToast('资源已删除', 'success');
        } catch (error) {
            this.showToast(error?.message || '删除失败', 'error');
            if (confirmButton) confirmButton.disabled = false;
            if (cancelButton) cancelButton.disabled = false;
        }
    },

    handleVisit(itemId) {
        const item = this.findItemById(itemId);
        if (!item || !item.url) {
            this.showToast('资源URL无效', 'warning');
            return;
        }
        window.open(item.url, '_blank', 'noopener');
    },

    async ensureSubscribed() {
        const provider = await GongjuzxGongju.getProviderInfo();
        const providerId = String(provider?.provider_id || '').trim();
        if (typeof this.state.unsubscribe === 'function' && this.state.providerId === providerId) return;

        if (typeof this.state.unsubscribe === 'function') {
            this.state.unsubscribe();
            this.state.unsubscribe = null;
            this.state.allItems = [];
        }
        this.state.providerId = providerId;
        this.setLoading();

        try {
            this.state.unsubscribe = await GongjuzxGongju.subscribeItems(
                (list) => {
                    this.state.allItems = Array.isArray(list) ? list : [];
                    this.renderList();
                },
                (error) => {
                    console.error('[工具中心] 订阅失败', error);
                    this.showToast('资源加载失败，请稍后重试', 'error');
                }
            );
        } catch (error) {
            console.error('[工具中心] 初始化失败', error);
            this.showToast(error?.message || '初始化失败', 'error');
        }
    },

    async show() {
        const page = document.getElementById('page-gongjuzx');
        if (!page) return;
        page.style.display = 'flex';
        this.state.isVisible = true;
        await this.ensureSubscribed();
    },

    hide() {
        const page = document.getElementById('page-gongjuzx');
        if (!page) return;
        page.style.display = 'none';
        this.state.isVisible = false;
        this.hideDescriptionTooltip();
    }
};

window.GongjuzxKuangjiaYewu = GongjuzxKuangjiaYewu;
