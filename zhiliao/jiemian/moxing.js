/**
 * 模型界面模块（模型按钮、模型列表、配置弹窗）
 */
const ZhiLiaoMoxingJiemianModule = {
    state: {
        modelButton: null,
        settingsButton: null,
        popover: null,
        submenu: null,
        modal: null,
        isPopoverOpen: false,
        popoverRequestId: 0,
        activePopoverGroupId: '',
        editingId: null,
        modalMode: 'list',
        configs: [],
        unsubscribeConfigs: null,
        loadingCount: 0,
        waitingFirstSync: false,
        initialized: false,
        draggingConfigId: '',
        dragTargetConfigId: '',
        listScrollTop: 0,
        editorModels: {},
        editorSelectedModelId: ''
    },

    async init() {
        if (this.state.initialized) return;
        this.state.modelButton = document.getElementById('model-button');
        this.state.settingsButton = document.getElementById('model-settings-button');
        if (!this.state.modelButton) return;
        this.state.initialized = true;

        this.state.modelButton.addEventListener('click', async (event) => {
            event.stopPropagation();
            if (this.state.isPopoverOpen) {
                this.closeModelPopover();
            } else {
                await this.openModelPopover();
            }
        });

        this.state.settingsButton?.addEventListener('click', (event) => {
            event.stopPropagation();
            this.closeModelPopover();
            this.openConfigModal();
        });

        document.addEventListener('click', (event) => this.handleDocumentClick(event));
        window.addEventListener('resize', () => this.positionPopover());
        window.addEventListener('scroll', () => this.positionPopover(), true);

        if (window.ZhiLiaoMoxingYewuModule) {
            await ZhiLiaoMoxingYewuModule.init();
            ZhiLiaoMoxingYewuModule.onChange(() => this.updateModelButtonText());
        }
        this.updateModelButtonText();
    },

    showToast(message, type = 'warning') {
        if (window.ZhiLiaoModule?.showToast) {
            ZhiLiaoModule.showToast(message, type);
        } else {
            console.warn(message);
        }
    },

    handleDocumentClick(event) {
        if (
            this.state.isPopoverOpen &&
            this.state.popover &&
            !this.state.popover.contains(event.target) &&
            !this.state.submenu?.contains(event.target) &&
            event.target !== this.state.modelButton &&
            !this.state.modelButton.contains(event.target)
        ) {
            this.closeModelPopover();
        }

        const editor = this.state.modal?.querySelector('#zl-model-editor-form');
        if (editor) {
            const modelSelect = editor.querySelector('#zl-model-name-select');
            const capabilitySelect = editor.querySelector('#zl-model-capability-select');
            if (modelSelect && !modelSelect.contains(event.target)) modelSelect.classList.remove('open');
            if (capabilitySelect && !capabilitySelect.contains(event.target)) capabilitySelect.classList.remove('open');
        }
    },

    ensurePopover() {
        if (this.state.popover) return this.state.popover;
        const popover = document.createElement('div');
        popover.className = 'zl-model-popover';
        popover.style.display = 'none';
        document.body.appendChild(popover);
        this.state.popover = popover;
        return popover;
    },

    ensureSubmenu() {
        if (this.state.submenu) return this.state.submenu;
        const submenu = document.createElement('div');
        submenu.className = 'zl-model-submenu';
        submenu.style.display = 'none';
        document.body.appendChild(submenu);
        this.state.submenu = submenu;
        return submenu;
    },

    truncateModelMenuText(value = '', maxLength = 30) {
        const text = String(value || '').trim();
        if (text.length <= maxLength) return text;
        return `${text.slice(0, maxLength)}...`;
    },

    positionPopover() {
        if (!this.state.isPopoverOpen || !this.state.popover || !this.state.modelButton) return;
        const rect = this.state.modelButton.getBoundingClientRect();
        const popover = this.state.popover;
        popover.style.width = 'max-content';
        popover.style.maxWidth = 'calc(100vw - 16px)';
        const top = rect.top - popover.offsetHeight - 8;
        const left = rect.left;

        popover.style.top = `${Math.max(8, top)}px`;
        const maxLeft = window.innerWidth - popover.offsetWidth - 8;
        popover.style.left = `${Math.max(8, Math.min(left, maxLeft))}px`;
        this.positionSubmenu();
    },

    positionSubmenu() {
        if (!this.state.isPopoverOpen || !this.state.submenu || !this.state.popover) return;
        if (this.state.submenu.style.display === 'none') return;
        const activeButton = this.state.popover.querySelector(`.zl-model-level1-option[data-group-id="${this.state.activePopoverGroupId}"]`);
        if (!activeButton) return;

        const buttonRect = activeButton.getBoundingClientRect();
        const submenu = this.state.submenu;
        const gap = 6;
        const rightLeft = buttonRect.right + gap;
        const leftLeft = buttonRect.left - submenu.offsetWidth - gap;
        const left = rightLeft + submenu.offsetWidth + 8 <= window.innerWidth
            ? rightLeft
            : Math.max(8, leftLeft);
        const top = Math.max(
            8,
            Math.min(buttonRect.bottom - submenu.offsetHeight, window.innerHeight - submenu.offsetHeight - 8)
        );

        submenu.style.left = `${left}px`;
        submenu.style.top = `${top}px`;
    },

    async openModelPopover() {
        if (!window.ZhiLiaoMoxingYewuModule) return;

        const popover = this.ensurePopover();
        const requestId = ++this.state.popoverRequestId;
        popover.innerHTML = `
            <div class="zl-model-option-loading-wrap">
                <div class="zl-model-option-loading">加载中...</div>
            </div>
        `;
        const submenu = this.ensureSubmenu();
        submenu.style.display = 'none';
        submenu.innerHTML = '';
        this.state.activePopoverGroupId = '';

        popover.style.width = 'max-content';
        popover.style.maxWidth = 'calc(100vw - 16px)';
        popover.style.display = 'block';
        this.state.isPopoverOpen = true;
        this.positionPopover();

        let groupedOptions = [];
        let selections = {};
        let mode = 'auto';

        try {
            [groupedOptions, selections] = await Promise.all([
                ZhiLiaoMoxingYewuModule.getGroupedModelOptions(),
                Promise.resolve(ZhiLiaoMoxingYewuModule.getManualSelections?.() || {})
            ]);
            mode = ZhiLiaoMoxingYewuModule.getSelectionMode?.() || 'auto';
        } catch (error) {
            if (!this.state.isPopoverOpen || this.state.popoverRequestId !== requestId) return;
            popover.innerHTML = `
                <div class="zl-model-option-loading-wrap">
                    <div class="zl-model-option-loading">加载失败</div>
                </div>
            `;
            this.positionPopover();
            this.showToast(error?.message || '模型列表加载失败', 'error');
            return;
        }
        if (!this.state.isPopoverOpen || this.state.popoverRequestId !== requestId) return;

        const groups = groupedOptions.map(item => item.group).filter(Boolean);
        const autoActive = mode !== 'manual';
        const firstLevelHtml = `
            <button class="zl-model-level1-option${autoActive ? ' active' : ''}" data-action="select-auto" aria-selected="${autoActive ? 'true' : 'false'}">
                <span>auto</span>
            </button>
        `;

        const groupHtml = groups.map(group => {
            const isActive = !autoActive && !!selections[group.id];
            return `
                <button class="zl-model-level1-option${isActive ? ' active' : ''}" data-action="show-group" data-group-id="${this.escapeHtml(group.id)}" aria-selected="${isActive ? 'true' : 'false'}">
                    <span>${this.escapeHtml(group.label)}</span>
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            `;
        }).join('');

        const optionsByGroup = {};
        groupedOptions.forEach(({ group, options }) => {
            optionsByGroup[group.id] = options;
        });

        const hasManualSelection = (groupId) => {
            const selection = selections[groupId] || null;
            return !!String(selection?.model || '').trim();
        };

        const renderSubmenuOptions = (groupId) => {
            const options = optionsByGroup[groupId] || [];
            const currentSelection = selections[groupId] || null;
            return options.length
                ? options.map(option => {
                    const isActive = currentSelection
                        && currentSelection.configId === option.configId
                        && (currentSelection.modelId ? currentSelection.modelId === option.modelId : currentSelection.model === option.model);
                    const rawModelName = (option.model || '').trim() || '自动发现';
                    const modelName = this.truncateModelMenuText(rawModelName);
                    return `
                        <button class="zl-model-option${isActive ? ' active' : ''}" data-group-id="${this.escapeHtml(groupId)}" data-config-id="${this.escapeHtml(option.configId)}" data-model-id="${this.escapeHtml(option.modelId || '')}" data-model="${this.escapeHtml(option.model)}" title="${this.escapeHtml(rawModelName)}" aria-selected="${isActive ? 'true' : 'false'}">
                            <span class="zl-model-option-name">${this.escapeHtml(modelName)}</span>
                            <span class="zl-model-option-sub">${this.escapeHtml(option.configName)}</span>
                        </button>
                    `;
                }).join('')
                : '<div class="zl-model-option-empty">暂无已启用模型。</div>';
        };

        popover.innerHTML = `
            <div class="zl-model-level1">
                ${firstLevelHtml}
                ${groupHtml}
            </div>
        `;
        popover.style.width = 'max-content';
        popover.style.maxWidth = 'calc(100vw - 16px)';

        const syncFirstLevelSelectionState = () => {
            const autoSelected = mode !== 'manual';
            const autoButton = popover.querySelector('[data-action="select-auto"]');
            if (autoButton) {
                autoButton.classList.toggle('active', autoSelected);
                autoButton.setAttribute('aria-selected', autoSelected ? 'true' : 'false');
            }
            popover.querySelectorAll('.zl-model-level1-option[data-group-id]').forEach(item => {
                const isActive = !autoSelected && hasManualSelection(item.dataset.groupId || '');
                item.classList.toggle('active', isActive);
                item.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });
        };

        const openSubmenu = (groupId) => {
            if (!groupId || !Object.prototype.hasOwnProperty.call(optionsByGroup, groupId)) return;
            this.state.activePopoverGroupId = groupId;
            popover.querySelectorAll('.zl-model-level1-option').forEach(item => item.classList.remove('open'));
            popover.querySelector(`.zl-model-level1-option[data-group-id="${groupId}"]`)?.classList.add('open');
            submenu.innerHTML = `
                <div class="zl-model-level2">
                    ${renderSubmenuOptions(groupId)}
                </div>
            `;
            submenu.style.display = 'block';
            this.positionSubmenu();
        };

        popover.querySelector('[data-action="select-auto"]')?.addEventListener('click', async () => {
            try {
                await ZhiLiaoMoxingYewuModule.selectAutoModel?.();
                this.updateModelButtonText();
                this.closeModelPopover();
                this.showToast('已切换为 auto 自动模式', 'success');
            } catch (error) {
                this.showToast(error?.message || '切换 auto 失败', 'error');
            }
        });

        const bindSubmenuActions = () => {
            submenu.querySelectorAll('.zl-model-option[data-config-id]').forEach(button => {
                if (button.dataset.bound === '1') return;
                button.dataset.bound = '1';
                button.addEventListener('click', async () => {
                    const groupId = button.dataset.groupId || 'text';
                    const configId = button.dataset.configId;
                    const model = button.dataset.model;
                    const modelId = button.dataset.modelId || '';
                    const displayModel = model || '自动发现';
                    try {
                        await ZhiLiaoMoxingYewuModule.selectCapabilityModel(groupId, configId, model, modelId);
                        mode = 'manual';
                        selections[groupId] = {
                            configId,
                            modelId,
                            model
                        };
                        this.updateModelButtonText();
                        syncFirstLevelSelectionState();
                        submenu.innerHTML = `
                            <div class="zl-model-level2">
                                ${renderSubmenuOptions(groupId)}
                            </div>
                        `;
                        bindSubmenuActions();
                        this.positionSubmenu();
                        this.showToast(`已切换模型：${displayModel}`, 'success');
                    } catch (error) {
                        this.showToast(error?.message || '模型切换失败', 'error');
                    }
                });
            });
        };

        if (submenu.dataset.clickBound !== '1') {
            submenu.dataset.clickBound = '1';
            submenu.addEventListener('click', (event) => {
                event.stopPropagation();
            });
        }
        const openAndBindSubmenu = (groupId) => {
            openSubmenu(groupId);
            bindSubmenuActions();
        };
        popover.querySelectorAll('[data-action="show-group"]').forEach(button => {
            const groupId = button.dataset.groupId || 'text';
            button.addEventListener('mouseenter', () => openAndBindSubmenu(groupId));
            button.addEventListener('focus', () => openAndBindSubmenu(groupId));
            button.addEventListener('click', (event) => {
                event.preventDefault();
                openAndBindSubmenu(groupId);
            });
        });

        this.positionPopover();
    },

    closeModelPopover() {
        if (!this.state.popover) return;
        this.state.popoverRequestId += 1;
        this.state.popover.style.display = 'none';
        if (this.state.submenu) {
            this.state.submenu.style.display = 'none';
            this.state.submenu.innerHTML = '';
        }
        this.state.activePopoverGroupId = '';
        this.state.isPopoverOpen = false;
    },

    updateModelButtonText() {
        if (!this.state.modelButton) return;
        const label = this.state.modelButton.querySelector('span');
        if (!label) return;
        const text = window.ZhiLiaoMoxingYewuModule?.getButtonText?.() || 'auto';
        label.textContent = text;
    },

    ensureModal() {
        if (this.state.modal) return this.state.modal;

        const modal = document.createElement('div');
        modal.className = 'zl-model-modal';
        modal.innerHTML = `
            <div class="zl-model-modal-mask" data-action="close-modal"></div>
            <div class="zl-model-modal-panel">
                <div class="zl-model-modal-header">
                    <h3 id="zl-model-modal-title">模型配置</h3>
                    <button class="zl-model-modal-close" data-action="close-modal">×</button>
                </div>
                <div class="zl-model-modal-body" id="zl-model-modal-body"></div>
                <div class="zl-model-modal-footer" id="zl-model-modal-footer">
                    <div class="zl-model-list-actions">
                        <button class="zl-model-list-cancel-btn" data-action="cancel-config-list">取消</button>
                        <button class="zl-model-list-add-btn" data-action="add-config">添加</button>
                    </div>
                </div>
                <div class="zl-model-loading-mask" id="zl-model-loading-mask">
                    <span>加载中...</span>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.state.modal = modal;

        // Keep modal open when clicking outside panel.
        modal.querySelector('.zl-model-modal-close')?.addEventListener('click', () => {
            this.closeConfigModal();
        });
        modal.querySelector('.zl-model-modal-mask')?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
        modal.querySelector('[data-action="add-config"]')?.addEventListener('click', () => {
            this.openEditor(null);
        });
        modal.querySelector('[data-action="cancel-config-list"]')?.addEventListener('click', () => {
            this.closeConfigModal();
        });

        return modal;
    },

    setModalMode(mode = 'list', title = '模型配置') {
        this.state.modalMode = mode;
        const titleEl = this.state.modal?.querySelector('#zl-model-modal-title');
        const panel = this.state.modal?.querySelector('.zl-model-modal-panel');
        const footer = this.state.modal?.querySelector('#zl-model-modal-footer');

        if (titleEl) titleEl.textContent = title;
        if (footer) footer.style.display = mode === 'edit' ? 'none' : 'block';
        if (panel) panel.classList.toggle('is-editing', mode === 'edit');
    },

    beginModalLoading() {
        this.state.loadingCount += 1;
        const mask = this.state.modal?.querySelector('#zl-model-loading-mask');
        if (mask) mask.classList.add('show');
    },

    endModalLoading() {
        this.state.loadingCount = Math.max(0, this.state.loadingCount - 1);
        const mask = this.state.modal?.querySelector('#zl-model-loading-mask');
        if (mask && this.state.loadingCount === 0) {
            mask.classList.remove('show');
        }
    },

    sortConfigs(list = []) {
        const copied = [...list];
        copied.sort((a, b) => {
            const aOrder = Number(a.sortOrder || 0);
            const bOrder = Number(b.sortOrder || 0);
            if (aOrder > 0 && bOrder > 0 && aOrder !== bOrder) return aOrder - bOrder;
            if (aOrder > 0 && bOrder <= 0) return -1;
            if (aOrder <= 0 && bOrder > 0) return 1;
            return Number(b.updated_at || 0) - Number(a.updated_at || 0);
        });
        return copied;
    },

    findConfigById(configId) {
        return this.state.configs.find(item => item.id === configId) || null;
    },

    buildCopyName(baseName = '') {
        const copySuffix = '\u526f\u672c';
        const rawName = String(baseName || '').trim();
        const base = (rawName || 'config').replace(new RegExp(`\\s*${copySuffix}(?:\\s*\\d+)?$`), '').trim() || 'config';
        const existing = new Set(
            (Array.isArray(this.state.configs) ? this.state.configs : [])
                .map(item => String(item?.name || '').trim())
                .filter(Boolean)
        );
        const firstCopy = `${base} ${copySuffix}`;
        if (!existing.has(firstCopy)) return firstCopy;

        let index = 2;
        while (existing.has(`${base} ${copySuffix}${index}`)) {
            index += 1;
        }
        return `${base} ${copySuffix}${index}`;
    },

    renderConfigListIfNeeded() {
        if (this.state.modalMode === 'list') this.renderConfigCards();
    },

    getConfigListScrollEl() {
        return this.state.modal?.querySelector('#zl-model-card-list') || null;
    },

    rememberConfigListScroll() {
        const list = this.getConfigListScrollEl();
        if (!list) return this.state.listScrollTop || 0;
        this.state.listScrollTop = list.scrollTop;
        return this.state.listScrollTop;
    },

    restoreConfigListScroll(scrollTop = this.state.listScrollTop || 0) {
        const list = this.getConfigListScrollEl();
        if (!list) return;
        const target = Math.max(0, Number(scrollTop || 0));
        list.scrollTop = target;
        this.state.listScrollTop = list.scrollTop;
    },

    bindConfigListScroll() {
        const list = this.getConfigListScrollEl();
        if (!list || list.dataset.scrollBound === '1') return;
        list.dataset.scrollBound = '1';
        list.addEventListener('scroll', () => {
            this.state.listScrollTop = list.scrollTop;
        }, { passive: true });
    },

    applyOptimisticConfig(configId, patch = {}) {
        const idx = this.state.configs.findIndex(item => item.id === configId);
        if (idx < 0) return;
        this.state.configs[idx] = { ...this.state.configs[idx], ...patch };
        this.state.configs = this.sortConfigs(this.state.configs);
        this.renderConfigListIfNeeded();
    },

    removeConfigLocal(configId) {
        this.state.configs = this.state.configs.filter(item => item.id !== configId);
        this.renderConfigListIfNeeded();
    },

    appendOptimisticCopy(source, payload) {
        const now = Date.now();
        const maxSortOrder = (Array.isArray(this.state.configs) ? this.state.configs : [])
            .reduce((max, item) => Math.max(max, Number(item?.sortOrder || 0)), 0);
        const tempId = `temp_copy_${now}_${Math.random().toString(36).slice(2, 8)}`;
        const optimisticConfig = {
            ...source,
            ...payload,
            id: tempId,
            sortOrder: maxSortOrder + 1,
            created_at: now,
            updated_at: now
        };
        this.state.configs = this.sortConfigs([...(this.state.configs || []), optimisticConfig]);
        this.renderConfigListIfNeeded();
        return tempId;
    },

    bindListActions() {
        const modalBody = this.state.modal?.querySelector('#zl-model-modal-body');
        if (!modalBody || modalBody.dataset.listActionsBound === '1') return;
        modalBody.dataset.listActionsBound = '1';
        modalBody.addEventListener('click', (event) => {
            this.handleListActionClick(event);
        });
    },

    handleListActionClick(event) {
        if (this.state.modalMode !== 'list') return;
        const actionButton = event.target?.closest?.('button[data-action]');
        if (!actionButton) return;
        const action = actionButton.dataset.action;
        if (!['delete', 'edit', 'toggle', 'copy'].includes(action)) return;

        const card = actionButton.closest('.zl-model-card');
        const configId = card?.dataset?.id;
        if (!configId) return;

        const configItem = this.findConfigById(configId);
        if (!configItem) return;

        if (action === 'edit') {
            this.openEditor(configItem);
            return;
        }
        if (action === 'copy') {
            this.handleCopyConfig(configId);
            return;
        }
        if (action === 'delete') {
            this.handleDeleteConfig(configId);
            return;
        }
        if (action === 'toggle') {
            this.handleToggleConfig(configId);
        }
    },

    handleDeleteConfig(configId) {
        const previousConfigs = [...this.state.configs];
        this.removeConfigLocal(configId);
        ZhiLiaoMoxingYewuModule.deleteConfig(configId)
            .then(() => {
                this.showToast('配置已删除', 'success');
            })
            .catch((error) => {
                this.state.configs = previousConfigs;
                this.renderConfigListIfNeeded();
                this.showToast(error.message || '删除失败', 'error');
            });
    },

    handleCopyConfig(configId) {
        const source = this.findConfigById(configId);
        if (!source) return;

        const payload = {
            name: this.buildCopyName(source.name),
            provider: source.provider || 'openai',
            url: source.url || '',
            key: source.key || '',
            models: this.cloneModelMap(source.models),
            enabled: !!source.enabled
        };

        const tempId = this.appendOptimisticCopy(source, payload);
        this.showToast('已创建副本，正在后台保存', 'success');

        ZhiLiaoMoxingYewuModule.createConfig(payload, { skipProbe: true })
            .then(() => {
                this.showToast('配置已复制', 'success');
            })
            .catch((error) => {
                this.removeConfigLocal(tempId);
                this.showToast(error?.message || '复制失败', 'error');
            });
    },

    handleToggleConfig(configId) {
        const current = this.findConfigById(configId);
        if (!current) return;
        const prevEnabled = !!current.enabled;
        const nextEnabled = !prevEnabled;

        this.applyOptimisticConfig(configId, { enabled: nextEnabled });
        ZhiLiaoMoxingYewuModule.setConfigEnabled(configId, nextEnabled)
            .then(() => {
                this.showToast(nextEnabled ? '配置已启用' : '配置已关闭', 'success');
            })
            .catch((error) => {
                this.applyOptimisticConfig(configId, { enabled: prevEnabled });
                this.showToast(error.message || '操作失败', 'error');
            });
    },

    bindDragSortEvents() {
        const list = this.state.modal?.querySelector('#zl-model-card-list');
        if (!list) return;

        const cards = list.querySelectorAll('.zl-model-card');
        cards.forEach((card) => {
            card.addEventListener('dragstart', (event) => this.handleCardDragStart(event));
            card.addEventListener('dragover', (event) => this.handleCardDragOver(event));
            card.addEventListener('dragleave', (event) => this.handleCardDragLeave(event));
            card.addEventListener('drop', (event) => this.handleCardDrop(event));
            card.addEventListener('dragend', () => this.handleCardDragEnd());
        });
    },

    clearDragInsertionLine() {
        this.state.dragTargetConfigId = '';
        const list = this.state.modal?.querySelector('#zl-model-card-list');
        if (!list) return;
        list.querySelectorAll('.zl-model-card.drag-insert-top').forEach((card) => {
            card.classList.remove('drag-insert-top');
        });
    },

    setDragInsertionLine(targetId = '') {
        const list = this.state.modal?.querySelector('#zl-model-card-list');
        if (!list) return;
        this.clearDragInsertionLine();
        const id = String(targetId || '').trim();
        if (!id) return;
        const cards = list.querySelectorAll('.zl-model-card');
        let targetCard = null;
        cards.forEach((card) => {
            if (targetCard) return;
            if (String(card.dataset.id || '').trim() === id) {
                targetCard = card;
            }
        });
        if (!targetCard) return;
        targetCard.classList.add('drag-insert-top');
        this.state.dragTargetConfigId = id;
    },

    handleCardDragStart(event) {
        const card = event.currentTarget;
        if (!(card instanceof HTMLElement)) return;
        const id = String(card.dataset.id || '').trim();
        if (!id) return;
        this.clearDragInsertionLine();
        this.state.draggingConfigId = id;
        card.classList.add('is-dragging');
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', id);
        }
    },

    handleCardDragOver(event) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        const card = event.currentTarget;
        if (!(card instanceof HTMLElement)) return;
        const targetId = String(card.dataset.id || '').trim();
        if (!targetId || targetId === this.state.draggingConfigId) {
            this.clearDragInsertionLine();
            return;
        }
        this.setDragInsertionLine(targetId);
    },

    handleCardDragLeave(event) {
        const card = event.currentTarget;
        if (!(card instanceof HTMLElement)) return;
        const related = event.relatedTarget;
        if (related instanceof Node && card.contains(related)) return;
        card.classList.remove('drag-insert-top');
        if (this.state.dragTargetConfigId === String(card.dataset.id || '').trim()) {
            this.state.dragTargetConfigId = '';
        }
    },

    async handleCardDrop(event) {
        event.preventDefault();
        const targetCard = event.currentTarget;
        if (!(targetCard instanceof HTMLElement)) return;
        const targetId = String(this.state.dragTargetConfigId || targetCard.dataset.id || '').trim();
        const dragId = this.state.draggingConfigId || (event.dataTransfer?.getData('text/plain') || '');
        this.clearDragInsertionLine();
        if (!dragId || !targetId || dragId === targetId) return;

        const fromIndex = this.state.configs.findIndex(item => item.id === dragId);
        const toIndex = this.state.configs.findIndex(item => item.id === targetId);
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

        const previous = [...this.state.configs];
        const reordered = [...this.state.configs];
        const [moved] = reordered.splice(fromIndex, 1);
        const insertIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
        reordered.splice(insertIndex, 0, moved);
        this.state.configs = reordered.map((item, index) => ({
            ...item,
            sortOrder: index + 1
        }));
        this.renderConfigCards();

        try {
            await ZhiLiaoMoxingYewuModule.reorderConfigs(this.state.configs.map(item => item.id));
            this.showToast('排序已更新', 'success');
        } catch (error) {
            this.state.configs = previous;
            this.renderConfigCards();
            this.showToast(error.message || '排序保存失败', 'error');
        }
    },

    handleCardDragEnd() {
        this.clearDragInsertionLine();
        this.state.draggingConfigId = '';
        this.state.dragTargetConfigId = '';
        const dragging = this.state.modal?.querySelector('.zl-model-card.is-dragging');
        if (dragging) dragging.classList.remove('is-dragging');
    },

    async startConfigRealtime() {
        if (this.state.unsubscribeConfigs) return;
        if (!window.ZhiLiaoMoxingCangkuModule?.subscribeConfigs) return;

        this.state.waitingFirstSync = true;
        this.beginModalLoading();
        try {
            this.state.unsubscribeConfigs = await ZhiLiaoMoxingCangkuModule.subscribeConfigs(
                (list) => {
                    this.state.configs = this.sortConfigs(Array.isArray(list) ? list : []);
                    if (this.state.modalMode === 'list') this.renderConfigCards();
                    if (this.state.waitingFirstSync) {
                        this.state.waitingFirstSync = false;
                        this.endModalLoading();
                    }
                },
                (error) => {
                    this.showToast(error?.message || '模型配置实时同步失败', 'error');
                    if (this.state.waitingFirstSync) {
                        this.state.waitingFirstSync = false;
                        this.endModalLoading();
                    }
                }
            );
        } catch (error) {
            if (this.state.waitingFirstSync) {
                this.state.waitingFirstSync = false;
                this.endModalLoading();
            }
            throw error;
        }
    },

    stopConfigRealtime() {
        if (typeof this.state.unsubscribeConfigs === 'function') {
            try {
                this.state.unsubscribeConfigs();
            } catch (error) {
                console.warn('停止实时监听失败:', error);
            }
        }
        this.state.unsubscribeConfigs = null;
    },

    async openConfigModal() {
        const modal = this.ensureModal();
        this.bindListActions();
        modal.classList.add('show');
        this.setModalMode('list', '模型配置');
        this.state.listScrollTop = 0;
        const body = modal.querySelector('#zl-model-modal-body');
        if (body) {
            body.innerHTML = '<div class="zl-model-list-scroll zl-model-card-list"></div>';
        }
        try {
            await this.startConfigRealtime();
            if (!this.state.waitingFirstSync) {
                this.renderConfigCards();
            }
        } catch (error) {
            this.showToast(error?.message || '加载模型配置失败', 'error');
            this.state.waitingFirstSync = false;
            this.state.configs = [];
            this.renderConfigCards();
        }
    },

    closeConfigModal() {
        if (!this.state.modal) return;
        this.stopConfigRealtime();
        this.state.waitingFirstSync = false;
        this.state.loadingCount = 0;
        this.state.draggingConfigId = '';
        const mask = this.state.modal.querySelector('#zl-model-loading-mask');
        if (mask) mask.classList.remove('show');
        this.state.modal.classList.remove('show');
        this.state.editingId = null;
        this.setModalMode('list', '模型配置');
    },

    getConstants() {
        return window.ZhiLiaoMoxingChangliangModule || null;
    },

    getProviderLabel(provider = 'openai') {
        return this.getConstants()?.getProviderLabel?.(provider) || provider || 'open';
    },

    getCapabilityLabel(capability = '') {
        return this.getConstants()?.getCapabilityLabel?.(capability) || capability || '未知能力';
    },

    cloneModelMap(models = {}) {
        const out = {};
        Object.entries(models || {}).forEach(([id, item]) => {
            if (!item || typeof item !== 'object') return;
            out[id] = {
                name: String(item.name || '').trim(),
                capabilities: Array.isArray(item.capabilities) ? [...item.capabilities] : [],
                enabled: item.enabled !== false,
                sortOrder: Number(item.sortOrder || 0)
            };
        });
        return out;
    },

    sortEditorModels(models = this.state.editorModels) {
        return Object.entries(models || {})
            .map(([id, item]) => ({
                id,
                name: String(item?.name || '').trim(),
                capabilities: Array.isArray(item?.capabilities) ? item.capabilities : [],
                enabled: item?.enabled !== false,
                sortOrder: Number(item?.sortOrder || 0)
            }))
            .filter(item => item.id && item.name)
            .sort((a, b) => {
                if (a.sortOrder > 0 && b.sortOrder > 0 && a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
                if (a.sortOrder > 0 && b.sortOrder <= 0) return -1;
                if (a.sortOrder <= 0 && b.sortOrder > 0) return 1;
                return a.name.localeCompare(b.name);
            });
    },

    buildModelId(name = '') {
        const validator = window.ZhiLiaoMoxingXiaoyanModule;
        const base = validator?.buildModelId
            ? validator.buildModelId(name)
            : String(name || 'model').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
        let id = base || `model_${Date.now()}`;
        let index = 2;
        while (this.state.editorModels[id]) {
            id = `${base}_${index}`;
            index += 1;
        }
        return id;
    },

    getSelectedEditorModel() {
        const id = this.state.editorSelectedModelId;
        return id && this.state.editorModels[id] ? { id, ...this.state.editorModels[id] } : null;
    },

    inferModelCapabilities(name = '') {
        return this.getConstants()?.inferCapabilitiesFromModelName?.(name) || [];
    },

    renderProviderOptions(provider = 'openai') {
        const constants = this.getConstants();
        const providers = constants?.providers || ['openai', 'claude', 'deepseek', 'zhipu', 'agnes'];
        return providers.map(item => {
            const value = String(item || '').trim();
            if (!value) return '';
            return `<option value="${this.escapeHtml(value)}"${provider === value ? ' selected' : ''}>${this.escapeHtml(this.getProviderLabel(value))}</option>`;
        }).join('');
    },

    renderModelNamePicker(selectedModelId = '') {
        const models = this.sortEditorModels();
        const selected = models.find(item => item.id === selectedModelId) || models[0] || null;
        const selectedText = selected?.name || '';
        const itemsHtml = models.length
            ? models.map(item => `
                <div class="zl-model-name-option${item.id === selected?.id ? ' active' : ''}" data-model-id="${this.escapeHtml(item.id)}">
                    <span class="zl-model-name-option-text">${this.escapeHtml(item.name)}</span>
                    <button type="button" class="zl-model-name-delete" data-action="delete-model-item" data-model-id="${this.escapeHtml(item.id)}" title="删除模型" aria-label="删除模型">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `).join('')
            : '<div class="zl-model-name-empty">暂无模型，请输入后添加</div>';
        return `
            <div class="zl-model-name-combo" id="zl-model-name-combo">
                <div class="zl-model-name-row">
                    <div class="zl-model-name-select" id="zl-model-name-select">
                        <input type="text" id="zl-model-editor-model-name" value="${this.escapeHtml(selectedText)}" placeholder="请输入模型名称">
                        <button type="button" class="zl-model-name-trigger" data-action="toggle-model-name-menu" title="选择模型" aria-label="选择模型">
                            <i class="fa-solid fa-chevron-down"></i>
                        </button>
                        <div class="zl-model-name-menu" id="zl-model-name-menu">${itemsHtml}</div>
                    </div>
                    <button type="button" class="zl-model-name-add" data-action="save-model-name" title="保存模型到列表" aria-label="保存模型到列表">
                        <i class="fa-solid fa-floppy-disk"></i>
                    </button>
                    <button type="button" class="zl-model-fetch-btn" data-action="fetch-models" title="获取模型列表" aria-label="获取模型列表">
                        <i class="fa-solid fa-rotate"></i>
                    </button>
                </div>
            </div>
        `;
    },

    renderCapabilityPicker(capabilities = []) {
        const constants = this.getConstants();
        const selected = Array.isArray(capabilities) ? capabilities : ['text'];
        return `
            <div class="zl-model-capability-select" id="zl-model-capability-select">
                <button type="button" class="zl-model-capability-trigger" data-action="toggle-capability-menu">
                    <span class="zl-model-capability-tags" id="zl-model-capability-tags"></span>
                    <span class="zl-model-dropdown-icon zl-model-capability-arrow" aria-hidden="true"><i class="fa-solid fa-chevron-down"></i></span>
                </button>
                <div class="zl-model-capability-menu" id="zl-model-capability-menu">
                    ${(constants?.capabilities || ['text']).map(capability => `
                        <label class="zl-model-capability-option">
                            <input type="checkbox" data-capability="${this.escapeHtml(capability)}"${selected.includes(capability) ? ' checked' : ''}>
                            <span>${this.escapeHtml(this.getCapabilityLabel(capability))}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    },

    getSelectedCapabilities(editor) {
        return Array.from(editor.querySelectorAll('[data-capability]:checked'))
            .map(input => input.dataset.capability)
            .filter(Boolean);
    },

    setCapabilityPickerValue(editor, capabilities = []) {
        const selected = Array.isArray(capabilities) ? capabilities : [];
        editor.querySelectorAll('[data-capability]').forEach(input => {
            input.checked = selected.includes(input.dataset.capability);
        });
        this.updateCapabilityTags(editor);
    },

    syncCurrentModelCapabilities(editor) {
        const selected = this.getSelectedEditorModel();
        if (!selected) return;
        this.state.editorModels[selected.id] = {
            ...this.state.editorModels[selected.id],
            capabilities: this.getSelectedCapabilities(editor)
        };
    },

    selectEditorModel(editor, modelId) {
        if (!modelId || !this.state.editorModels[modelId]) return;
        this.state.editorSelectedModelId = modelId;
        const model = this.state.editorModels[modelId];
        const input = editor.querySelector('#zl-model-editor-model-name');
        if (input) input.value = model.name || '';
        this.setCapabilityPickerValue(editor, model.capabilities || []);
        this.refreshModelNameMenu(editor);
    },

    refreshModelNameMenu(editor) {
        const combo = editor.querySelector('#zl-model-name-combo');
        if (!combo) return;
        combo.outerHTML = this.renderModelNamePicker(this.state.editorSelectedModelId);
        this.bindModelNamePicker(editor);
    },

    saveEditorModelToList(editor, rawName = '') {
        const name = String(rawName || editor.querySelector('#zl-model-editor-model-name')?.value || '').trim();
        if (!name) {
            this.showToast('请输入模型名称', 'warning');
            return null;
        }
        const duplicated = this.sortEditorModels().find(item => item.name.toLowerCase() === name.toLowerCase());
        if (duplicated) {
            const existing = this.state.editorModels[duplicated.id];
            if (!Array.isArray(existing.capabilities) || !existing.capabilities.length) {
                existing.capabilities = this.inferModelCapabilities(name);
            }
            this.selectEditorModel(editor, duplicated.id);
            this.showToast(`保存${name}模型成功！`, 'success');
            return duplicated.id;
        }
        const id = this.buildModelId(name);
        const inferred = this.inferModelCapabilities(name);
        this.state.editorModels[id] = {
            name,
            capabilities: inferred,
            enabled: true,
            sortOrder: this.sortEditorModels().length + 1
        };
        this.state.editorSelectedModelId = id;
        this.refreshModelNameMenu(editor);
        this.selectEditorModel(editor, id);
        this.showToast(`添加${name}模型成功！`, 'success');
        return id;
    },

    deleteEditorModel(editor, modelId) {
        if (!modelId || !this.state.editorModels[modelId]) return;
        delete this.state.editorModels[modelId];
        const next = this.sortEditorModels()[0] || null;
        this.state.editorSelectedModelId = next?.id || '';
        this.refreshModelNameMenu(editor);
        if (next) {
            this.selectEditorModel(editor, next.id);
        } else {
            this.setCapabilityPickerValue(editor, []);
            const input = editor.querySelector('#zl-model-editor-model-name');
            if (input) input.value = '';
        }
    },

    bindModelNamePicker(editor) {
        const select = editor.querySelector('#zl-model-name-select');
        const trigger = editor.querySelector('[data-action="toggle-model-name-menu"]');
        const menu = editor.querySelector('#zl-model-name-menu');
        const input = editor.querySelector('#zl-model-editor-model-name');
        if (!select || !trigger || !menu || !input) return;

        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            select.classList.toggle('open');
            const capabilitySelect = editor.querySelector('#zl-model-capability-select');
            if (capabilitySelect) capabilitySelect.classList.remove('open');
        });

        menu.addEventListener('click', (event) => {
            event.stopPropagation();
            const deleteButton = event.target.closest('[data-action="delete-model-item"]');
            if (deleteButton) {
                this.deleteEditorModel(editor, deleteButton.dataset.modelId || '');
                return;
            }
            const item = event.target.closest('.zl-model-name-option');
            if (item) {
                this.selectEditorModel(editor, item.dataset.modelId || '');
                select.classList.remove('open');
            }
        });

        editor.querySelector('[data-action="save-model-name"]')?.addEventListener('click', () => {
            this.saveEditorModelToList(editor);
        });

        editor.querySelector('[data-action="fetch-models"]')?.addEventListener('click', (event) => {
            this.fetchModelsForEditor(editor, event.currentTarget);
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.saveEditorModelToList(editor);
            }
        });
    },

    updateCapabilityTags(editor) {
        const tagBox = editor.querySelector('#zl-model-capability-tags');
        if (!tagBox) return;
        const selected = this.getSelectedCapabilities(editor);
        tagBox.innerHTML = selected.length
            ? selected.map(item => `<span class="zl-model-capability-tag">${this.escapeHtml(this.getCapabilityLabel(item))}</span>`).join('')
            : '<span class="zl-model-capability-placeholder">请选择模型能力</span>';
    },

    bindCapabilityPicker(editor) {
        const select = editor.querySelector('#zl-model-capability-select');
        const trigger = editor.querySelector('[data-action="toggle-capability-menu"]');
        const menu = editor.querySelector('#zl-model-capability-menu');
        if (!select || !trigger || !menu) return;

        this.updateCapabilityTags(editor);

        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            select.classList.toggle('open');
            const modelSelect = editor.querySelector('#zl-model-name-select');
            if (modelSelect) modelSelect.classList.remove('open');
        });

        menu.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        menu.querySelectorAll('[data-capability]').forEach(input => {
            input.addEventListener('change', () => {
                if (input.checked && input.dataset.capability === 'universal') {
                    menu.querySelectorAll('[data-capability]').forEach(other => {
                        if (other !== input) other.checked = false;
                    });
                } else if (input.checked) {
                    const universal = menu.querySelector('[data-capability="universal"]');
                    if (universal) universal.checked = false;
                }
                this.syncCurrentModelCapabilities(editor);
                this.updateCapabilityTags(editor);
            });
        });
    },

    getModelGatewayUrl() {
        const cloud = window.ZhiLiaoConfig?.cloudFunction || {};
        const constants = this.getConstants();
        return String(cloud.modelGatewayUrl || cloud.gatewayUrl || constants?.defaultGatewayUrl || 'https://ai.cfdaili.top/api')
            .trim()
            .replace(/\/+$/, '');
    },

    normalizeFetchedModels(result) {
        const source = Array.isArray(result?.models)
            ? result.models
            : (Array.isArray(result?.data) ? result.data : []);
        const seen = new Set();
        const models = [];
        source.forEach((item) => {
            const id = String(
                typeof item === 'string'
                    ? item
                    : (item?.id || item?.name || item?.model || '')
            ).trim();
            if (!id || seen.has(id)) return;
            seen.add(id);
            models.push(id);
        });
        return models;
    },

    async fetchModelsForEditor(editor, button) {
        const provider = editor.querySelector('#zl-model-editor-provider')?.value || 'openai';
        const url = editor.querySelector('#zl-model-editor-url')?.value || '';
        const key = editor.querySelector('#zl-model-editor-key')?.value || '';

        if (!url.trim()) {
            this.showToast('请先填写请求URL', 'warning');
            return;
        }
        if (!key.trim()) {
            this.showToast('请先填写请求Key', 'warning');
            return;
        }

        const oldTitle = button?.title || '';
        if (button) {
            button.disabled = true;
            button.title = '获取中';
        }

        try {
            const response = await fetch(this.getModelGatewayUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider,
                    action: 'models',
                    capability: 'text',
                    url,
                    key,
                    stream: false,
                    options: { timeout_ms: 120000 }
                })
            });
            const text = await response.text();
            let result = {};
            try {
                result = text ? JSON.parse(text) : {};
            } catch {
                result = {};
            }
            if (!response.ok || result.success === false) {
                throw new Error(result.error || result.message || text || `HTTP ${response.status}`);
            }

            const models = this.normalizeFetchedModels(result);
            if (!models.length) {
                this.showToast('未获取到模型列表', 'warning');
                return;
            }
            let added = 0;
            models.forEach((name) => {
                const before = this.sortEditorModels().length;
                this.saveEditorModelToList(editor, name);
                if (this.sortEditorModels().length > before) added += 1;
            });
            const first = this.sortEditorModels()[0] || null;
            if (first) this.selectEditorModel(editor, this.state.editorSelectedModelId || first.id);
            this.showToast(`已获取 ${models.length} 个模型，新增 ${added} 个`, 'success');
        } catch (error) {
            this.showToast(error?.message || '获取模型列表失败', 'error');
        } finally {
            if (button) {
                button.disabled = false;
                button.title = oldTitle || '获取模型列表';
            }
        }
    },

    renderConfigCards() {
        const modalBody = this.state.modal?.querySelector('#zl-model-modal-body');
        if (!modalBody) return;
        const scrollTop = this.rememberConfigListScroll();

        this.state.editingId = null;
        this.setModalMode('list', '模型配置');
        const configs = this.sortConfigs(Array.isArray(this.state.configs) ? this.state.configs : []);
        this.state.configs = configs;

        const cardsHtml = configs.map((config, index) => {
            const modelItems = this.sortEditorModels(config.models);
            const modelTags = modelItems.map(item => `<span class="zl-model-tag">${this.escapeHtml(item.name)}</span>`).join('');
            const featureTags = [
                `<span class="zl-model-tag">${this.escapeHtml(this.getProviderLabel(config.provider))}</span>`
            ].join('');
            const modelsTitle = this.escapeHtml(modelItems.map(item => item.name).join('；'));
            const urlText = this.escapeHtml(config.url || '');
            const orderText = `${index + 1}.`;

            return `
                <div class="zl-model-card" data-id="${this.escapeHtml(config.id)}" draggable="true">
                    <div class="zl-model-row1">
                        <div class="zl-model-name" title="${this.escapeHtml(config.name)}">${this.escapeHtml(orderText)} ${this.escapeHtml(config.name)}</div>
                        <div class="zl-model-actions">
                            <button data-action="delete">删除</button>
                            <button data-action="edit">编辑</button>
                            <button data-action="copy">复制</button>
                            <button data-action="toggle">${config.enabled ? '关闭' : '启用'}</button>
                        </div>
                    </div>
                    <div class="zl-model-row2" title="${modelsTitle}">${featureTags}${modelTags || '<span class="zl-model-tag-empty">无模型标签</span>'}</div>
                    <div class="zl-model-row3" title="${urlText}">${urlText}</div>
                </div>
            `;
        }).join('');

        modalBody.innerHTML = `
            <div class="zl-model-list-scroll zl-model-card-list" id="zl-model-card-list">
                ${configs.length === 0 ? '<div class="zl-model-empty">暂无配置，请先添加配置。</div>' : cardsHtml}
            </div>
        `;

        this.bindConfigListScroll();
        this.restoreConfigListScroll(scrollTop);
        this.bindDragSortEvents();
    },

    openEditor(config) {
        const modalBody = this.state.modal?.querySelector('#zl-model-modal-body');
        if (!modalBody) return;

        this.state.editingId = config?.id || null;
        this.setModalMode('edit', '编辑配置');

        const provider = String(config?.provider || 'openai').toLowerCase();
        const defaultUrl = config?.url || '';
        const keepEnabled = !!config?.enabled;
        this.state.editorModels = this.cloneModelMap(config?.models || {});
        const firstModel = this.sortEditorModels()[0] || null;
        this.state.editorSelectedModelId = firstModel?.id || '';
        const selectedCapabilities = firstModel?.capabilities || ['text'];

        modalBody.innerHTML = `
            <div class="zl-model-editor-page">
            <div class="zl-model-editor" id="zl-model-editor-form">
            <div class="zl-model-editor-grid">
                <label><span class="zl-model-editor-label">1. 配置名称</span><input type="text" id="zl-model-editor-name" value="${this.escapeHtml(config?.name || '')}" placeholder="例如：OpenAI 主线路"></label>
                <label><span class="zl-model-editor-label">2. 服务厂商</span>
                    <div class="zl-model-select-row">
                        <select id="zl-model-editor-provider">
                            ${this.renderProviderOptions(provider)}
                        </select>
                        <span class="zl-model-dropdown-icon" aria-hidden="true"><i class="fa-solid fa-chevron-down"></i></span>
                    </div>
                </label>
                <label><span class="zl-model-editor-label">3. 请求URL</span><input type="text" id="zl-model-editor-url" value="${this.escapeHtml(defaultUrl)}" placeholder="https://..."></label>
                <label><span class="zl-model-editor-label">4. 请求Key</span><input type="text" id="zl-model-editor-key" value="${this.escapeHtml(config?.key || '')}" placeholder="sk-..."></label>
                <div class="zl-model-editor-field"><span class="zl-model-editor-label">5. 模型名称</span>
                    ${this.renderModelNamePicker(this.state.editorSelectedModelId)}
                </div>
                <div class="zl-model-editor-field"><span class="zl-model-editor-label">6. 模型能力</span>
                    ${this.renderCapabilityPicker(selectedCapabilities)}
                </div>
            </div>
            <div class="zl-model-editor-actions">
                <button data-action="cancel-editor">返回</button>
                <button data-action="save-editor">保存</button>
            </div>
            </div>
            </div>
        `;

        const editor = modalBody.querySelector('#zl-model-editor-form');
        if (!editor) return;

        this.bindCapabilityPicker(editor);
        this.bindModelNamePicker(editor);

        editor.querySelector('[data-action="cancel-editor"]')?.addEventListener('click', () => {
            this.renderConfigCards();
        });

        editor.querySelector('[data-action="save-editor"]')?.addEventListener('click', async () => {
            const saveButton = editor.querySelector('[data-action="save-editor"]');
            if (!saveButton || saveButton.disabled) return;

            const originalSaveText = saveButton.textContent;
            saveButton.disabled = true;
            saveButton.textContent = '保存中...';

            const typedModelName = String(editor.querySelector('#zl-model-editor-model-name')?.value || '').trim();
            if (typedModelName) {
                const exists = this.sortEditorModels().some(item => item.name.toLowerCase() === typedModelName.toLowerCase());
                if (!exists) this.saveEditorModelToList(editor, typedModelName);
            }
            this.syncCurrentModelCapabilities(editor);
            Object.keys(this.state.editorModels).forEach((modelId) => {
                const item = this.state.editorModels[modelId];
                if (!Array.isArray(item.capabilities) || !item.capabilities.length) {
                    item.capabilities = ['text'];
                }
            });

            const payload = {
                name: editor.querySelector('#zl-model-editor-name')?.value || '',
                provider: editor.querySelector('#zl-model-editor-provider')?.value || 'openai',
                url: editor.querySelector('#zl-model-editor-url')?.value || '',
                key: editor.querySelector('#zl-model-editor-key')?.value || '',
                models: this.cloneModelMap(this.state.editorModels),
                enabled: this.state.editingId ? keepEnabled : false
            };

            const validation = window.ZhiLiaoMoxingXiaoyanModule?.validateAndNormalize
                ? ZhiLiaoMoxingXiaoyanModule.validateAndNormalize(payload)
                : { valid: true, data: payload, errors: [] };
            if (!validation.valid) {
                this.showToast(validation.errors.join('；') || '配置校验失败', 'error');
                saveButton.disabled = false;
                saveButton.textContent = originalSaveText;
                return;
            }

            const normalizedData = {
                ...validation.data,
                enabled: payload.enabled
            };
            let previousConfig = null;
            if (this.state.editingId) {
                previousConfig = this.state.configs.find(item => item.id === this.state.editingId) || null;
                this.applyOptimisticConfig(this.state.editingId, {
                    ...normalizedData,
                    updated_at: Date.now()
                });
            }

            try {
                if (this.state.editingId) {
                    await ZhiLiaoMoxingYewuModule.updateConfig(this.state.editingId, payload);
                    this.showToast('配置已更新', 'success');
                } else {
                    const newConfigId = await ZhiLiaoMoxingYewuModule.createConfig(payload);
                    this.state.editingId = newConfigId;
                    this.showToast('配置已创建', 'success');
                }
                await ZhiLiaoMoxingYewuModule.syncActiveOption();
                this.updateModelButtonText();
            } catch (error) {
                if (previousConfig?.id) {
                    this.applyOptimisticConfig(previousConfig.id, previousConfig);
                }
                this.showToast(error.message || '保存失败', 'error');
            } finally {
                saveButton.disabled = false;
                saveButton.textContent = originalSaveText;
            }
        });
    },

    escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};

window.ZhiLiaoMoxingJiemianModule = ZhiLiaoMoxingJiemianModule;
