// BI operation filter and quick-search business.
const YejiSxYewu = {
renderFilters(options = {}) {
    const panel = document.getElementById('yeji-filter-dialog-body');
    if (!panel) return;

    this.captureFilterScrollPositions();
    const selectors = this.getVisibleFilterSelectors();
    panel.innerHTML = `
        <div class="yeji-filter-modal-grid">
            ${selectors.map((selector, index) => this.renderFilterCell(selector, index)).join('')}
        </div>
    `;

    selectors.forEach(selector => this.bindFilterCell(selector));
    this.positionOpenFilterPopover();
    this.restoreFilterScrollPositions();
    this.restoreFilterSearchFocus(options);
    this.updateTemplateButton?.();
},

restoreFilterSearchFocus(options = {}) {
    if (!options.focusFilterSearchId) return;
    requestAnimationFrame(() => {
        const input = document.querySelector(`[data-filter="${options.focusFilterSearchId}"] [data-filter-search]`);
        if (!input) return;
        input.focus();
        const caret = Number.isFinite(Number(options.caretPosition)) ? Number(options.caretPosition) : input.value.length;
        input.setSelectionRange?.(caret, caret);
    });
},

renderFilterCell(selector, index = 0) {
    const isOpen = !!this.state.filterOpen[selector.cdId];
    const hasValue = this.filterHasValue(selector);
    const quickLocked = this.isQuickSearchSelector(selector);
    const label = `${index + 1}. ${this.shortFilterName(selector.name)}`;
    return `
        <div class="yeji-filter-cell${quickLocked ? ' quick-locked' : ''}" data-filter="${selector.cdId}">
            <span class="yeji-filter-cell-label" title="${this.escapeHtml(selector.name)}">${this.escapeHtml(label)}</span>
            <button type="button" class="yeji-filter-chip${isOpen ? ' open' : ''}${hasValue ? ' has-value' : ''}" data-filter-toggle ${quickLocked ? 'disabled title="已由顶部快捷筛选控制"' : ''}>
                <span class="yeji-filter-chip-text">${this.escapeHtml(this.filterSummary(selector))}</span>
                <i class="fa-solid fa-caret-down"></i>
                <i class="fa-solid fa-xmark yeji-filter-chip-clear" data-clear-inline></i>
            </button>
            ${quickLocked ? '' : this.renderFilterPopover(selector, isOpen)}
        </div>
    `;
},

renderFilterPopover(selector, isOpen) {
    if (selector.selectorType === 'TIME_MACRO') return this.renderTimePopover(selector, isOpen);
    if (selector.selectorType === 'TREE') return this.renderTreePopover(selector, isOpen);
    return this.renderElementPopover(selector, isOpen);
},

renderElementPopover(selector, isOpen) {
    const value = this.state.filterValues[selector.cdId] || {};
    const selected = value.selected || [];
    const manual = value.manual || '';
    const search = this.state.filterSearch[selector.cdId] || '';
    const batchOpen = !!this.state.batchOpen[selector.cdId];
    const options = this.filterSelectorOptions(selector).slice(0, 120);
    const loading = !!this.state.selectorLoading[selector.cdId];
    const visibleValues = options.map(option => String(option.value ?? ''));
    const selectState = this.getAggregateCheckState(visibleValues, new Set(selected));
    const optionHtml = options.map(option => {
        const optionValue = String(option.value ?? '');
        const label = String(option.label ?? option.value ?? '(空)');
        return `
            <label class="yeji-filter-option">
                <input class="yeji-filter-check" type="checkbox" data-chip="${this.escapeHtml(optionValue)}" ${selected.includes(optionValue) ? 'checked' : ''} />
                <span title="${this.escapeHtml(label)}">${this.escapeHtml(label)}</span>
            </label>
        `;
    }).join('');

    return `
        <div class="yeji-filter-popover" data-filter-popover ${isOpen ? '' : 'hidden'}>
            <div class="yeji-filter-popover-head">
                <input class="yeji-filter-input" data-filter-search placeholder="搜索已加载选项" value="${this.escapeHtml(search)}" />
            </div>
            <div class="yeji-filter-toolbar">
                <label><input class="yeji-filter-check${selectState === 'partial' ? ' partial' : ''}" type="checkbox" data-select-visible ${selectState === 'checked' ? 'checked' : ''} ${selectState === 'partial' ? 'data-check-partial="true" aria-checked="mixed"' : ''} /> 全选</label>
                <label><input class="yeji-filter-check" type="checkbox" data-exclude-mode ${this.state.excludeMode[selector.cdId] ? 'checked' : ''} /> 排除</label>
                <span class="yeji-filter-count">已选 ${selected.length}</span>
            </div>
            ${batchOpen ? `
                <div class="yeji-filter-batch">
                    <textarea class="yeji-filter-textarea" data-manual placeholder="粘贴筛选值，支持换行、逗号、顿号、分号分隔">${this.escapeHtml(manual)}</textarea>
                </div>
            ` : `
                <div class="yeji-filter-options">
                    ${loading ? '<div class="yeji-filter-empty">选项加载中...</div>' : (optionHtml || '<div class="yeji-filter-empty">暂无选项，可使用批量粘贴</div>')}
                </div>
            `}
            <div class="yeji-filter-footer">
                <button type="button" class="yeji-filter-mini link" data-batch-toggle>${batchOpen ? '勾选项' : '批量粘贴'}</button>
                <div>
                    <button type="button" class="yeji-filter-mini" data-clear-one>清空</button>
                    <button type="button" class="yeji-filter-mini primary" data-confirm-filter>确定</button>
                </div>
            </div>
        </div>
    `;
},

renderTimePopover(selector, isOpen) {
    const current = this.state.filterValues[selector.cdId] || {};
    const range = current.range || [];
    const start = range[0] || '';
    const end = range[1] || '';

    return `
        <div class="yeji-filter-popover" data-filter-popover ${isOpen ? '' : 'hidden'}>
            <div class="yeji-filter-popover-head">
                <div class="yeji-date-pair">
                    <input class="yeji-filter-input" data-date="start" type="date" value="${this.escapeHtml(start)}" />
                    <input class="yeji-filter-input" data-date="end" type="date" value="${this.escapeHtml(end)}" />
                </div>
            </div>
            <div class="yeji-filter-footer">
                <button type="button" class="yeji-filter-mini" data-clear-one>清空</button>
                <button type="button" class="yeji-filter-mini primary" data-confirm-filter>确定</button>
            </div>
        </div>
    `;
},

renderTreePopover(selector, isOpen) {
    const current = this.state.filterValues[selector.cdId] || {};
    const selected = this.treeSelectedSet(selector.cdId);
    const manual = current.manual || '';
    const search = this.state.filterSearch[selector.cdId] || '';
    const batchOpen = !!this.state.batchOpen[selector.cdId];
    const loading = !!this.state.selectorLoading[selector.cdId];
    const treeNodes = this.state.selectorOptions[selector.cdId] || [];
    const treeValues = this.flattenTreeValues(treeNodes);
    const selectState = this.getAggregateCheckState(treeValues, selected);
    const treeHtml = this.renderTreeNodes(selector.cdId, treeNodes, selected, 0);

    return `
        <div class="yeji-filter-popover" data-filter-popover ${isOpen ? '' : 'hidden'}>
            <div class="yeji-filter-popover-head">
                <input class="yeji-filter-input" data-filter-search placeholder="搜索地区" value="${this.escapeHtml(search)}" />
            </div>
            <div class="yeji-filter-toolbar">
                <label><input class="yeji-filter-check${selectState === 'partial' ? ' partial' : ''}" type="checkbox" data-tree-select-all ${selectState === 'checked' ? 'checked' : ''} ${selectState === 'partial' ? 'data-check-partial="true" aria-checked="mixed"' : ''} /> 全选</label>
                <label><input class="yeji-filter-check" type="checkbox" data-exclude-mode ${this.state.excludeMode[selector.cdId] ? 'checked' : ''} /> 排除</label>
                <span class="yeji-filter-count">已选 ${selected.size}</span>
            </div>
            ${batchOpen ? `
                <div class="yeji-filter-batch">
                    <textarea class="yeji-filter-textarea" data-manual placeholder="粘贴路径，如 广东省>广州市">${this.escapeHtml(manual)}</textarea>
                </div>
            ` : `
                <div class="yeji-filter-options">
                    ${loading ? '<div class="yeji-filter-empty">树节点加载中...</div>' : (treeHtml || '<div class="yeji-filter-empty">暂无节点，可使用批量粘贴</div>')}
                </div>
            `}
            <div class="yeji-filter-footer">
                <button type="button" class="yeji-filter-mini link" data-batch-toggle>${batchOpen ? '勾选项' : '批量粘贴'}</button>
                <div>
                    <button type="button" class="yeji-filter-mini" data-clear-one>清空</button>
                    <button type="button" class="yeji-filter-mini primary" data-confirm-filter>确定</button>
                </div>
            </div>
        </div>
    `;
},

bindFilterCell(selector) {
    const box = document.querySelector(`[data-filter="${selector.cdId}"]`);
    if (!box) return;

    box.querySelector('[data-filter-toggle]')?.addEventListener('click', event => {
        event.stopPropagation();
        if (event.target.closest('[data-clear-inline]')) {
            this.clearOneFilter(selector.cdId);
            return;
        }
        this.toggleFilterDropdown(selector.cdId);
    });
    box.querySelector('[data-filter-popover]')?.addEventListener('click', event => event.stopPropagation());
    const searchInput = box.querySelector('[data-filter-search]');
    searchInput?.addEventListener('compositionstart', () => {
        this.state.composingFilterSearch = selector.cdId;
    });
    searchInput?.addEventListener('compositionend', event => {
        this.state.filterSearch[selector.cdId] = event.target.value;
        delete this.state.composingFilterSearch;
        this.renderFilters({ focusFilterSearchId: selector.cdId, caretPosition: event.target.value.length });
    });
    searchInput?.addEventListener('input', event => {
        this.state.filterSearch[selector.cdId] = event.target.value;
        if (event.isComposing || this.state.composingFilterSearch === selector.cdId) return;
        this.renderFilters({ focusFilterSearchId: selector.cdId, caretPosition: event.target.selectionStart });
    });
    box.querySelector('[data-select-visible]')?.addEventListener('change', event => {
        this.selectVisibleOptions(selector, event.target.checked);
    });
    box.querySelector('[data-tree-select-all]')?.addEventListener('change', event => {
        this.selectAllTreeOptions(selector, event.target.checked);
    });
    box.querySelector('[data-exclude-mode]')?.addEventListener('change', event => {
        this.state.excludeMode[selector.cdId] = event.target.checked;
    });
    box.querySelector('[data-batch-toggle]')?.addEventListener('click', () => {
        this.state.batchOpen[selector.cdId] = !this.state.batchOpen[selector.cdId];
        this.renderFilters();
    });
    box.querySelector('[data-manual]')?.addEventListener('input', event => {
        this.state.filterValues[selector.cdId] = {
            ...(this.state.filterValues[selector.cdId] || {}),
            manual: event.target.value
        };
    });
    box.querySelector('[data-clear-one]')?.addEventListener('click', () => {
        if (this.state.batchOpen[selector.cdId]) {
            this.clearFilterManual(selector.cdId);
            return;
        }
        this.clearOneFilter(selector.cdId);
    });
    box.querySelector('[data-confirm-filter]')?.addEventListener('click', () => {
        this.state.filterOpen = {};
        this.renderFilters();
    });
    box.querySelectorAll('[data-chip]').forEach(input => {
        input.addEventListener('change', () => this.toggleOption(selector, input.dataset.chip, input.checked));
    });
    box.querySelectorAll('[data-date]').forEach(input => {
        input.addEventListener('input', () => this.chooseCustomDate(selector.cdId));
    });
    box.querySelectorAll('[data-tree-toggle]').forEach(button => {
        button.addEventListener('click', event => {
            event.stopPropagation();
            this.toggleTreeNode(selector.cdId, button.dataset.treeToggle);
        });
    });
    box.querySelectorAll('[data-tree-partial]').forEach(input => {
        input.indeterminate = true;
    });
    box.querySelectorAll('[data-check-partial]').forEach(input => {
        input.indeterminate = true;
    });
    box.querySelectorAll('[data-tree-value]').forEach(input => {
        input.addEventListener('change', () => this.toggleTreeOption(selector.cdId, input.dataset.treeValue, input.checked));
    });
},

toggleFilterDropdown(selectorId) {
    const willOpen = !this.state.filterOpen[selectorId];
    this.state.filterOpen = {};
    this.state.filterOpen[selectorId] = willOpen;
    this.renderFilters();

    const selector = this.state.selectors.find(item => item.cdId === selectorId);
    if (!willOpen || !selector) return;
    if (selector.selectorType === 'DS_ELEMENTS' && !this.state.selectorOptions[selectorId]?.length) {
        this.loadSelectorOptions(selector);
    }
    if (selector.selectorType === 'TREE' && !this.state.selectorOptions[selectorId]?.length) {
        this.loadTreeOptions(selector);
    }
},

positionOpenFilterPopover() {
    const openCell = document.querySelector('.yeji-filter-cell [data-filter-popover]:not([hidden])')?.closest('.yeji-filter-cell');
    if (!openCell) return;
    const popover = openCell.querySelector('[data-filter-popover]');
    const trigger = openCell.querySelector('[data-filter-toggle]');
    if (!popover || !trigger) return;

    const rect = trigger.getBoundingClientRect();
    popover.style.minWidth = `${Math.max(rect.width, 240)}px`;
    const width = popover.offsetWidth || 320;
    const height = popover.offsetHeight || 360;
    let left = rect.left;
    let top = rect.bottom + 6;

    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    if (left < 8) left = 8;
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 6);

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
},

captureFilterScrollPositions() {
    document.querySelectorAll('.yeji-filter-cell').forEach(cell => {
        const selectorId = cell.dataset.filter;
        if (!selectorId) return;
        const scrollBox = cell.querySelector('[data-filter-popover]:not([hidden]) .yeji-filter-options, [data-filter-popover]:not([hidden]) .yeji-filter-batch');
        if (scrollBox) this.state.filterScroll[selectorId] = scrollBox.scrollTop;
    });
},

restoreFilterScrollPositions() {
    requestAnimationFrame(() => {
        document.querySelectorAll('.yeji-filter-cell').forEach(cell => {
            const selectorId = cell.dataset.filter;
            if (!selectorId || this.state.filterScroll[selectorId] == null) return;
            const scrollBox = cell.querySelector('[data-filter-popover]:not([hidden]) .yeji-filter-options, [data-filter-popover]:not([hidden]) .yeji-filter-batch');
            if (scrollBox) scrollBox.scrollTop = this.state.filterScroll[selectorId];
        });
    });
},

filterSelectorOptions(selector) {
    const keyword = (this.state.filterSearch[selector.cdId] || '').trim().toLowerCase();
    const options = this.state.selectorOptions[selector.cdId] || [];
    if (!keyword) return options;
    return options.filter(option => String(option.label ?? option.value ?? '').toLowerCase().includes(keyword));
},

filterSummary(selector) {
    if (this.isQuickSearchSelector(selector)) {
        const quickValue = this.getQuickSearchText();
        return quickValue ? quickValue : '顶部搜索';
    }
    const value = this.state.filterValues[selector.cdId];
    if (!value) return '全部';
    if (selector.selectorType === 'TIME_MACRO') {
        const range = (value.range || []).filter(Boolean);
        return range.length === 2 ? `${range[0]}~${range[1]}` : '全部';
    }
    if (selector.selectorType === 'TREE') {
        const count = (value.treePaths || []).length + this.splitValues(value.manual || '').length;
        return count ? `已选${count}` : '全部';
    }
    const selected = value.selected || [];
    const manualCount = this.splitValues(value.manual || '').length;
    const total = selected.length + manualCount;
    if (!total) return '全部';
    if (total === 1) return selected[0] || this.splitValues(value.manual || '')[0] || '已选1';
    return `已选${total}`;
},

filterHasValue(selector) {
    return this.filterSummary(selector) !== '全部';
},

shortFilterName(name) {
    return String(name || '')
        .replace('省份-城市-区', '区域')
        .replace('星期几（支付日期）', '星期')
        .slice(0, 8);
},

getVisibleFilterSelectors() {
    const map = new Map(this.state.selectors.map(selector => [selector.cdId, selector]));
    return this.ultra.filterOrder.map(cdId => map.get(cdId)).filter(Boolean);
},

getQuickSearchSelectors() {
    const names = ['客户名称', '客户编码', '药店id', '商品名称', 'ERP商品编码', '药师帮ID', 'spuid', '乐药编码'];
    const map = new Map(this.getVisibleFilterSelectors().map(selector => [selector.name, selector]));
    return names.map(name => map.get(name)).filter(Boolean);
},

getDefaultQuickSearchSelectorId() {
    const customerSelector = this.getQuickSearchSelectors().find(selector => selector.name === '客户名称');
    return customerSelector?.cdId || 'cec3399458be84b7e870088b';
},

renderQuickSearchOptions() {
    const selectedId = this.state.quickSearchSelectorId || '';
    const noneSelected = selectedId ? '' : ' selected';
    const options = this.getQuickSearchSelectors().map(selector => {
        const name = this.shortFilterName(selector.name);
        return `<option value="${this.escapeHtml(selector.cdId)}" ${selector.cdId === selectedId ? 'selected' : ''}>${this.escapeHtml(name)}</option>`;
    }).join('');
    return `<option value=""${noneSelected}>无</option>${options}`;
},

getQuickSearchSelectedLabel() {
    const selector = this.getQuickSearchSelector();
    return selector ? this.shortFilterName(selector.name) : '无';
},

renderQuickSearchPanelOptions() {
    const selectedId = this.state.quickSearchSelectorId || '';
    const items = [
        { id: '', label: '无' },
        ...this.getQuickSearchSelectors().map(selector => ({
            id: selector.cdId,
            label: this.shortFilterName(selector.name)
        }))
    ];
    return items.map(item => `
        <button type="button" class="yeji-quick-option${item.id === selectedId ? ' active' : ''}" data-quick-selector="${this.escapeHtml(item.id)}">
            ${this.escapeHtml(item.label)}
        </button>
    `).join('');
},

renderQuickSearchSelectOptions() {
    const select = document.getElementById('yeji-quick-selector');
    const visibleIds = new Set(this.getQuickSearchSelectors().map(selector => selector.cdId));
    if (this.state.quickSearchSelectorId && !visibleIds.has(this.state.quickSearchSelectorId)) {
        this.state.quickSearchSelectorId = this.getDefaultQuickSearchSelectorId();
    }
    if (select) {
        select.innerHTML = this.renderQuickSearchOptions();
        select.value = this.state.quickSearchSelectorId || '';
    }
    this.renderQuickSearchDropdown();
},

renderQuickSearchDropdown() {
    const label = document.getElementById('yeji-quick-selector-label');
    const panel = document.getElementById('yeji-quick-selector-panel');
    if (label) label.textContent = this.getQuickSearchSelectedLabel();
    if (panel) {
        panel.innerHTML = this.renderQuickSearchPanelOptions();
        panel.querySelectorAll('[data-quick-selector]').forEach(option => {
            option.addEventListener('click', event => {
                event.stopPropagation();
                this.chooseQuickSearchSelector(option.dataset.quickSelector || '');
                this.closeQuickSearchDropdown();
            });
        });
    }
},

toggleQuickSearchDropdown() {
    const panel = document.getElementById('yeji-quick-selector-panel');
    const button = document.getElementById('yeji-quick-selector-btn');
    if (!panel || !button) return;
    const opening = panel.hidden;
    panel.hidden = !opening;
    button.classList.toggle('open', opening);
},

closeQuickSearchDropdown() {
    const panel = document.getElementById('yeji-quick-selector-panel');
    const button = document.getElementById('yeji-quick-selector-btn');
    if (panel) panel.hidden = true;
    if (button) button.classList.remove('open');
},

chooseQuickSearchSelector(selectorId) {
    this.clearActiveTemplate();
    this.state.quickSearchSelectorId = selectorId;
    this.state.quickSearchValue = '';
    this.clearQuickControlledFilterValue(this.state.quickSearchSelectorId);
    this.state.filterOpen = {};
    const select = document.getElementById('yeji-quick-selector');
    if (select) select.value = selectorId;
    this.renderQuickSearchDropdown();
    this.updateQuickSearchControl();
    this.renderFilters();
},

getQuickSearchSelector() {
    if (!this.state.quickSearchSelectorId) return null;
    return this.state.selectors.find(selector => selector.cdId === this.state.quickSearchSelectorId) || null;
},

getQuickSearchPlaceholder() {
    const selector = this.getQuickSearchSelector();
    if (!selector) return '请选择筛选项';
    return `请输入【${this.shortFilterName(selector.name)}】查询~`;
},

isQuickSearchSelector(selector) {
    return this.isQuickSearchSelectorFor(selector, this.state);
},

isQuickSearchSelectorFor(selector, context = this.state) {
    return !!selector?.cdId && !!context.quickSearchSelectorId && selector.cdId === context.quickSearchSelectorId;
},

getQuickSearchText() {
    return this.getQuickSearchTextFor(this.state);
},

getQuickSearchTextFor(context = this.state) {
    return String(context.quickSearchValue || '').trim();
},

updateQuickSearchControl() {
    const input = document.getElementById('yeji-search-input');
    const clear = document.getElementById('yeji-search-clear');
    const disabled = !this.state.quickSearchSelectorId;
    if (input) {
        input.disabled = disabled;
        input.value = this.state.quickSearchValue || '';
        input.placeholder = this.getQuickSearchPlaceholder();
    }
    if (clear) clear.style.display = !disabled && this.getQuickSearchText() ? 'flex' : 'none';
},

clearQuickControlledFilterValue(selectorId) {
    if (!selectorId) return;
    delete this.state.filterValues[selectorId];
    delete this.state.excludeMode[selectorId];
    delete this.state.batchOpen[selectorId];
    delete this.state.filterSearch[selectorId];
    delete this.state.filterOpen[selectorId];
},

openFilterModal() {
    this.state.filtersOpen = true;
    this.renderFilters();
    const modal = document.getElementById('yeji-filter-modal');
    if (modal) modal.hidden = false;
},

closeFilterModal() {
    this.state.filtersOpen = false;
    this.state.filterOpen = {};
    const modal = document.getElementById('yeji-filter-modal');
    if (modal) modal.hidden = true;
    this.renderFilters();
},

resetFilterValues() {
    const clearedTimeSelectors = {};
    this.getVisibleFilterSelectors()
        .filter(selector => selector.selectorType === 'TIME_MACRO')
        .forEach(selector => {
            clearedTimeSelectors[selector.cdId] = true;
        });
    this.state.filterValues = {};
    this.state.dateRange = [];
    this.state.clearedTimeSelectors = clearedTimeSelectors;
    this.state.filterOpen = {};
    this.state.filterSearch = {};
    this.state.batchOpen = {};
    this.state.excludeMode = {};
    this.state.quickSearchValue = '';
    this.updateQuickSearchControl();
    this.renderFilters();
},

scheduleVisibleFilterOptionsPreload(options = {}) {
    if (this.state.filterPreloadScheduled && !options.force) return;
    this.state.filterPreloadScheduled = true;
    const run = () => {
        this.state.filterPreloadScheduled = false;
        this.preloadVisibleFilterOptions(options);
    };
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(run, { timeout: 1200 });
    } else {
        setTimeout(run, 80);
    }
},

preloadVisibleFilterOptions({ force = false } = {}) {
    if (!window.YejiGongju || this.state.filterPreloadStarted && !force) return;
    this.state.filterPreloadStarted = true;
    const selectors = this.getVisibleFilterSelectors()
        .filter(selector => ['DS_ELEMENTS', 'TREE'].includes(selector.selectorType));
    selectors.forEach(selector => {
        if (!force && this.state.selectorOptions[selector.cdId]?.length) return;
        if (selector.selectorType === 'TREE') {
            this.loadTreeOptions(selector, { silent: true, force });
        } else {
            this.loadSelectorOptions(selector, { silent: true, force });
        }
    });
},

async loadSelectorOptions(selector, options = {}) {
    if (!window.YejiGongju || this.state.selectorLoading[selector.cdId]) return;
    if (!options.force && this.state.selectorOptions[selector.cdId]?.length) return;
    this.state.selectorLoading[selector.cdId] = true;
    if (!options.silent) this.renderFilters();

    try {
        const body = {
            fieldQuery: { offset: 0, limit: 1000 },
            dynamicParams: [],
            treeFilters: [],
            filters: this.buildFilters(selector.cdId),
            layerTreeFilters: []
        };
        const json = await YejiGongju._post(`/api/selector/${selector.cdId}/data`, body);
        const list = json?.response?.result || [];
        this.state.selectorOptions[selector.cdId] = list.map(item => ({
            value: String(item.value ?? item.displayValue ?? item.label ?? ''),
            label: String(item.displayValue ?? item.label ?? item.value ?? '(空)')
        })).filter(item => item.value !== '');
    } catch (error) {
        console.error('[yeji] 筛选项加载失败', selector.name, error);
        this._showToast(`${selector.name}选项加载失败`, 'error');
    } finally {
        this.state.selectorLoading[selector.cdId] = false;
        if (!options.silent || this.state.filtersOpen) this.renderFilters();
    }
},

async loadTreeOptions(selector, options = {}) {
    if (!window.YejiGongju || this.state.selectorLoading[selector.cdId]) return;
    if (!options.force && this.state.selectorOptions[selector.cdId]?.length) return;
    this.state.selectorLoading[selector.cdId] = true;
    if (!options.silent) this.renderFilters();

    try {
        const body = {
            dynamicParams: [],
            treeFilters: [],
            filters: [],
            layerTreeFilters: [],
            search: '',
            offset: 0,
            limit: 10000
        };
        const json = await YejiGongju._post(`/api/treeSelector/${selector.cdId}/data`, body);
        this.state.selectorOptions[selector.cdId] = this.normalizeTreeNodes(json?.response?.result || []);
    } catch (error) {
        console.error('[yeji] 树筛选加载失败', selector.name, error);
        this._showToast(`${selector.name}加载失败`, 'error');
    } finally {
        this.state.selectorLoading[selector.cdId] = false;
        if (!options.silent || this.state.filtersOpen) this.renderFilters();
    }
},

normalizeTreeNodes(nodes, parentPath = []) {
    return (nodes || []).map(node => {
        const label = String(node.displayValue ?? node.value ?? node.title ?? '').trim();
        const hasOwnLabel = label !== '';
        const path = hasOwnLabel ? [...parentPath, label].filter(Boolean) : parentPath;
        return {
            label: label || '(空)',
            value: path.join('>'),
            path,
            children: this.normalizeTreeNodes(node.children || [], path),
            isEmptyValue: !hasOwnLabel
        };
    }).filter(node => !node.isEmptyValue || node.children.length);
},

renderTreeNodes(selectorId, nodes, selected, depth) {
    const keyword = (this.state.filterSearch[selectorId] || '').trim().toLowerCase();
    return (nodes || []).map(node => {
        const match = !keyword || node.value.toLowerCase().includes(keyword);
        const childHtml = this.renderTreeNodes(selectorId, node.children, selected, depth + 1);
        if (keyword && !match && !childHtml) return '';

        const hasChildren = node.children?.length > 0;
        const expanded = this.isTreeNodeExpanded(selectorId, node.value, depth, !!keyword);
        const checkedState = this.getTreeNodeCheckState(node, selected);
        return `
            <div class="yeji-tree-node">
                <div class="yeji-tree-row" style="padding-left:${depth * 16 + 10}px">
                    ${hasChildren ? `<i class="fa-solid fa-caret-${expanded ? 'down' : 'right'} yeji-tree-toggle" data-tree-toggle="${this.escapeHtml(node.value)}"></i>` : '<span class="yeji-tree-toggle"></span>'}
                    <input class="yeji-tree-check${checkedState === 'partial' ? ' partial' : ''}" type="checkbox" data-tree-value="${this.escapeHtml(node.value)}" ${checkedState === 'checked' ? 'checked' : ''} ${checkedState === 'partial' ? 'data-tree-partial="true" aria-checked="mixed"' : ''} />
                    <span title="${this.escapeHtml(node.value)}">${this.escapeHtml(node.label)}</span>
                </div>
                ${hasChildren && expanded ? `<div>${childHtml}</div>` : ''}
            </div>
        `;
    }).join('');
},

isTreeNodeExpanded(selectorId, value, depth, forcedOpen) {
    if (forcedOpen) return true;
    const key = `${selectorId}:${value}`;
    if (Object.prototype.hasOwnProperty.call(this.state.expandedTree, key)) {
        return !!this.state.expandedTree[key];
    }
    return false;
},

getTreeNodeCheckState(node, selected) {
    const values = this.collectTreeNodeValues(node);
    const selectedCount = values.filter(value => selected.has(value)).length;
    if (!selectedCount) return 'none';
    return selectedCount === values.length && selected.has(node.value) ? 'checked' : 'partial';
},

getAggregateCheckState(values, selected) {
    const uniqueValues = [...new Set((values || []).filter(Boolean))];
    if (!uniqueValues.length) return 'none';
    const selectedCount = uniqueValues.filter(value => selected.has(value)).length;
    if (!selectedCount) return 'none';
    return selectedCount === uniqueValues.length ? 'checked' : 'partial';
},

treeSelectedSet(selectorId) {
    const paths = this.state.filterValues[selectorId]?.treePaths || [];
    return new Set(paths.map(path => path.join('>')));
},

toggleTreeNode(selectorId, value) {
    const key = `${selectorId}:${value}`;
    const depth = String(value || '').split('>').filter(Boolean).length - 1;
    const current = Object.prototype.hasOwnProperty.call(this.state.expandedTree, key)
        ? !!this.state.expandedTree[key]
        : false;
    this.state.expandedTree[key] = !current;
    this.renderFilters();
},

toggleTreeOption(selectorId, value, checked) {
    const current = this.state.filterValues[selectorId] || {};
    const treeNodes = this.state.selectorOptions[selectorId] || [];
    const selected = new Set((current.treePaths || []).map(path => path.join('>')));
    const node = this.findTreeNode(treeNodes, value);
    const values = node ? this.collectTreeNodeValues(node) : [String(value || '')].filter(Boolean);

    values.forEach(item => {
        if (checked) selected.add(item);
        else selected.delete(item);
    });

    this.syncTreeParentSelection(treeNodes, selected);
    this.state.filterValues[selectorId] = {
        ...current,
        treePaths: this.treeSelectedValuesToPaths(treeNodes, selected)
    };
    this.renderFilters();
},

selectAllTreeOptions(selector, checked) {
    const current = this.state.filterValues[selector.cdId] || {};
    const treeNodes = this.state.selectorOptions[selector.cdId] || [];
    const selected = new Set((current.treePaths || []).map(path => path.join('>')));
    this.flattenTreeValues(treeNodes).forEach(value => {
        if (checked) selected.add(value);
        else selected.delete(value);
    });
    this.syncTreeParentSelection(treeNodes, selected);
    this.state.filterValues[selector.cdId] = {
        ...current,
        treePaths: this.treeSelectedValuesToPaths(treeNodes, selected)
    };
    this.renderFilters();
},

findTreeNode(nodes, value) {
    for (const node of nodes || []) {
        if (node.value === value) return node;
        const match = this.findTreeNode(node.children || [], value);
        if (match) return match;
    }
    return null;
},

collectTreeNodeValues(node) {
    return [node.value, ...(node.children || []).flatMap(child => this.collectTreeNodeValues(child))].filter(Boolean);
},

flattenTreeValues(nodes) {
    return (nodes || []).flatMap(node => this.collectTreeNodeValues(node));
},

syncTreeParentSelection(nodes, selected) {
    (nodes || []).forEach(node => {
        this.syncTreeParentSelection(node.children || [], selected);
        if (!node.children?.length) return;

        const childValues = node.children.flatMap(child => this.collectTreeNodeValues(child));
        if (childValues.length && childValues.every(value => selected.has(value))) {
            selected.add(node.value);
        } else {
            selected.delete(node.value);
        }
    });
},

treeSelectedValuesToPaths(nodes, selected) {
    const ordered = this.flattenTreeValues(nodes);
    const orderedSet = new Set(ordered);
    const values = [
        ...ordered.filter(value => selected.has(value)),
        ...[...selected].filter(value => !orderedSet.has(value))
    ];
    return values.map(value => String(value).split('>').filter(Boolean));
},

toggleOption(selector, value, checked) {
    const current = this.state.filterValues[selector.cdId] || {};
    const selected = new Set(current.selected || []);
    if (selector.multiSelect === false) selected.clear();
    if (checked) selected.add(value);
    else selected.delete(value);
    this.state.filterValues[selector.cdId] = { ...current, selected: [...selected] };
    this.renderFilters();
},

selectVisibleOptions(selector, checked) {
    const visible = this.filterSelectorOptions(selector).slice(0, 120).map(item => String(item.value));
    const current = this.state.filterValues[selector.cdId] || {};
    const selected = new Set(selector.multiSelect === false ? [] : (current.selected || []));
    visible.forEach(value => {
        if (checked) selected.add(value);
        else selected.delete(value);
    });
    this.state.filterValues[selector.cdId] = { ...current, selected: [...selected] };
    this.renderFilters();
},

clearOneFilter(selectorId) {
    const selector = this.state.selectors.find(item => item.cdId === selectorId);
    delete this.state.filterValues[selectorId];
    if (selector?.selectorType === 'TIME_MACRO') {
        this.state.clearedTimeSelectors[selectorId] = true;
        if (selectorId === this.ultra.dateFilter.sourceCdId) this.state.dateRange = [];
    }
    delete this.state.excludeMode[selectorId];
    delete this.state.batchOpen[selectorId];
    this.renderFilters();
},

clearFilterManual(selectorId) {
    const current = this.state.filterValues[selectorId] || {};
    this.state.filterValues[selectorId] = { ...current, manual: '' };
    this.state.batchOpen[selectorId] = true;
    this.renderFilters();
},

chooseCustomDate(selectorId) {
    const box = document.querySelector(`[data-filter="${selectorId}"]`);
    const start = box?.querySelector('[data-date="start"]')?.value || '';
    const end = box?.querySelector('[data-date="end"]')?.value || '';
    this.state.filterValues[selectorId] = { range: [start, end], macroName: '' };
    delete this.state.clearedTimeSelectors[selectorId];
    if (selectorId === this.ultra.dateFilter.sourceCdId) this.state.dateRange = [start, end];
},

splitValues(text) {
    return String(text || '').split(/[\n,，;；、\s]+/).map(item => item.trim()).filter(Boolean);
},

splitTreePath(text) {
    return String(text || '').split(/[>/]/).map(item => item.trim()).filter(Boolean);
},
};

window.YejiSxYewu = YejiSxYewu;

