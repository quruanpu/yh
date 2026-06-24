// BI operation template business.
const YejiMbYewu = {
getTemplateProviderId() {
    try {
        const biLogin = window.LoginModule?.getLocalLogin?.('bi') || {};
        return biLogin.provider_id || '';
    } catch (error) {
        return '';
    }
},

getTemplateDateSelectorIds() {
    const dateNames = new Set(['出库日期', '支付日期']);
    const configuredDateIds = new Set((this.ultra?.selectors || [])
        .filter(selector => selector.selectorType === 'TIME_MACRO' || dateNames.has(selector.name))
        .map(selector => selector.cdId));
    return new Set(this.state.selectors
        .filter(selector => dateNames.has(selector.name)
            || configuredDateIds.has(selector.cdId)
            || selector.selectorType === 'TIME_MACRO'
            || (selector.fields || []).some(field => field.fdType === 'DATE'))
        .map(selector => selector.cdId));
},

clonePlain(value) {
    return JSON.parse(JSON.stringify(value || {}));
},

hasTemplateFilterValue(value) {
    if (!value) return false;
    return ['selected', 'treePaths', 'range'].some(key => Array.isArray(value[key]) && value[key].length > 0)
        || !!String(value.manual || '').trim();
},

collectTemplateState(name) {
    const dateSelectorIds = this.getTemplateDateSelectorIds();
    const filters = {};
    Object.entries(this.state.filterValues || {}).forEach(([selectorId, value]) => {
        if (dateSelectorIds.has(selectorId) || !this.hasTemplateFilterValue(value)) return;
        filters[selectorId] = this.clonePlain(value);
    });

    const excludeMode = {};
    Object.entries(this.state.excludeMode || {}).forEach(([selectorId, enabled]) => {
        if (!enabled || dateSelectorIds.has(selectorId)) return;
        excludeMode[selectorId] = true;
    });

    const quickValue = this.getQuickSearchText();
    return {
        name,
        module: 'ultra',
        version: 2,
        sortIndex: 0,
        time: Date.now(),
        quickSearch: {
            selectorId: this.state.quickSearchSelectorId || '',
            value: quickValue
        },
        filters,
        excludeMode
    };
},

async loadTemplates({ force = false } = {}) {
    const pid = this.getTemplateProviderId();
    if (this.state.templatesLoaded && !force && this._templatesProviderId === pid) return this.state.templates;
    if (!pid || !window.FirebaseModule?.getTpls) {
        this.state.templates = [];
        this.state.templatesLoaded = false;
        this._templatesProviderId = '';
        return [];
    }
    const list = await FirebaseModule.getTpls(pid);
    this.state.templates = this.sortTemplates((list || []).filter(item => item?.module === 'ultra' && Number(item.version) === 2));
    this.state.templatesLoaded = true;
    this._templatesProviderId = pid;
    return this.state.templates;
},

sortTemplates(list = []) {
    const allSortable = list.length > 0 && list.every(item => Number.isFinite(Number(item.sortIndex)));
    return [...list].sort((a, b) => {
        if (allSortable) return Number(a.sortIndex) - Number(b.sortIndex);
        return (b.time || 0) - (a.time || 0);
    });
},

async toggleTemplatePanel() {
    const panel = document.getElementById('yeji-tpl-panel');
    if (!panel) return;
    const opening = panel.style.display === 'none';
    if (!opening) {
        panel.style.display = 'none';
        return;
    }
    panel.style.display = 'block';
    panel.innerHTML = '<div class="yeji-tpl-empty">加载中...</div>';
    try {
        await this.loadTemplates({ force: true });
        this.renderTemplatePanel();
    } catch (error) {
        console.error('[yeji] 模板加载失败', error);
        panel.innerHTML = '<div class="yeji-tpl-empty">模板加载失败</div>';
    }
},

renderTemplatePanel() {
    const panel = document.getElementById('yeji-tpl-panel');
    if (!panel) return;
    const list = this.state.templates || [];
    if (!list.length) {
        panel.innerHTML = '<div class="yeji-tpl-empty">暂无模板</div>';
        return;
    }
    const items = list.map(tpl => `
        <div class="yeji-tpl-item${tpl._key === this.state.activeTemplateKey ? ' active' : ''}" data-template-key="${this.escapeHtml(tpl._key || '')}" title="${this.escapeHtml(tpl.name || '')}">
            <span class="yeji-tpl-name">
                <i class="fa-solid fa-bookmark yeji-tpl-drag-handle" data-template-drag-handle title="按住拖动排序"></i>
                ${this.escapeHtml(tpl.name || '未命名模板')}
            </span>
            <button type="button" class="yeji-tpl-del" data-template-delete="${this.escapeHtml(tpl._key || '')}" title="删除模板">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');
    panel.innerHTML = `<div class="yeji-tpl-list">${items}</div>`;

    panel.querySelectorAll('[data-template-key]').forEach(item => {
        this.bindTemplateDragItem(item);
        item.addEventListener('click', event => {
            if (this.state.suppressTemplateClick) {
                delete this.state.suppressTemplateClick;
                return;
            }
            if (event.target.closest('[data-template-delete]')) return;
            const tpl = this.state.templates.find(template => template._key === item.dataset.templateKey);
            if (tpl) this.applyTemplate(tpl);
        });
    });
    panel.querySelectorAll('[data-template-delete]').forEach(button => {
        button.addEventListener('click', event => {
            event.stopPropagation();
            this.deleteTemplate(button.dataset.templateDelete);
        });
    });
},

bindTemplateDragItem(item) {
    const handle = item.querySelector('[data-template-drag-handle]');
    if (!handle) return;

    handle.addEventListener('pointerdown', event => {
        if (event.button != null && event.button !== 0) return;
        const list = item.closest('.yeji-tpl-list');
        if (!list) return;

        this.state.templateDrag = {
            sourceKey: item.dataset.templateKey,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            targetKey: item.dataset.templateKey,
            placeAfter: false,
            dragging: false
        };
        handle.setPointerCapture?.(event.pointerId);
    });

    handle.addEventListener('pointermove', event => {
        const drag = this.state.templateDrag;
        if (!drag || drag.pointerId !== event.pointerId || drag.sourceKey !== item.dataset.templateKey) return;
        const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
        if (!drag.dragging && moved < 5) return;

        event.preventDefault();
        drag.dragging = true;
        this.state.suppressTemplateClick = true;
        item.classList.add('dragging');
        this.ensureTemplateDragGhost(item, event.clientX, event.clientY);
        this.moveTemplateDragGhost(event.clientX, event.clientY);
        this.updateTemplateInsertIndicator(event.clientY);
        this.scrollTemplateListDuringDrag(event.clientY);
    });

    handle.addEventListener('pointerup', event => {
        const drag = this.state.templateDrag;
        if (!drag || drag.pointerId !== event.pointerId || drag.sourceKey !== item.dataset.templateKey) return;
        handle.releasePointerCapture?.(event.pointerId);
        item.classList.remove('dragging');
        this.removeTemplateInsertIndicator();
        this.removeTemplateDragGhost();
        delete this.state.templateDrag;

        if (!drag.dragging) return;
        this.reorderTemplates(drag.sourceKey, drag.targetKey, drag.placeAfter);
        setTimeout(() => delete this.state.suppressTemplateClick, 180);
    });

    handle.addEventListener('pointercancel', event => {
        const drag = this.state.templateDrag;
        if (!drag || drag.pointerId !== event.pointerId) return;
        item.classList.remove('dragging');
        this.removeTemplateInsertIndicator();
        this.removeTemplateDragGhost();
        delete this.state.templateDrag;
        delete this.state.suppressTemplateClick;
    });
},

ensureTemplateDragGhost(item, clientX, clientY) {
    const drag = this.state.templateDrag;
    if (!drag || drag.ghost) return;
    const rect = item.getBoundingClientRect();
    const ghost = item.cloneNode(true);
    ghost.classList.add('yeji-tpl-drag-ghost');
    ghost.classList.remove('dragging', 'active');
    ghost.style.width = `${rect.width}px`;
    document.body.appendChild(ghost);
    drag.ghost = ghost;
    drag.ghostOffsetX = clientX - rect.left;
    drag.ghostOffsetY = clientY - rect.top;
},

moveTemplateDragGhost(clientX, clientY) {
    const drag = this.state.templateDrag;
    if (!drag?.ghost) return;
    drag.ghost.style.transform = `translate3d(${clientX - drag.ghostOffsetX}px, ${clientY - drag.ghostOffsetY}px, 0)`;
},

removeTemplateDragGhost() {
    const ghost = this.state.templateDrag?.ghost || document.querySelector('.yeji-tpl-drag-ghost');
    ghost?.remove();
},

updateTemplateInsertIndicator(clientY) {
    const drag = this.state.templateDrag;
    const list = document.querySelector('#yeji-tpl-panel .yeji-tpl-list');
    if (!drag || !list) return;

    const items = [...list.querySelectorAll('.yeji-tpl-item')]
        .filter(item => item.dataset.templateKey !== drag.sourceKey);
    if (!items.length) return;

    let target = items[items.length - 1];
    let placeAfter = true;
    for (const item of items) {
        const rect = item.getBoundingClientRect();
        if (clientY <= rect.bottom) {
            target = item;
            placeAfter = false;
            break;
        }
    }

    drag.targetKey = target.dataset.templateKey;
    drag.placeAfter = placeAfter;
    this.placeTemplateInsertIndicator(list, target, placeAfter);
},

placeTemplateInsertIndicator(list, target, placeAfter) {
    let line = list.querySelector('.yeji-tpl-insert-line');
    if (!line) {
        line = document.createElement('div');
        line.className = 'yeji-tpl-insert-line';
    }
    if (placeAfter) target.insertAdjacentElement('afterend', line);
    else target.insertAdjacentElement('beforebegin', line);
},

removeTemplateInsertIndicator() {
    document.querySelector('.yeji-tpl-insert-line')?.remove();
},

scrollTemplateListDuringDrag(clientY) {
    const list = document.querySelector('#yeji-tpl-panel .yeji-tpl-list');
    if (!list) return;
    const rect = list.getBoundingClientRect();
    if (clientY < rect.top + 24) list.scrollTop -= 10;
    if (clientY > rect.bottom - 24) list.scrollTop += 10;
},

async reorderTemplates(sourceKey, targetKey, placeAfter = false) {
    if (!sourceKey || !targetKey || sourceKey === targetKey) return;
    const templates = [...(this.state.templates || [])];
    const sourceIndex = templates.findIndex(item => item._key === sourceKey);
    const targetIndex = templates.findIndex(item => item._key === targetKey);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const [moved] = templates.splice(sourceIndex, 1);
    let insertIndex = templates.findIndex(item => item._key === targetKey);
    if (placeAfter) insertIndex += 1;
    templates.splice(insertIndex, 0, moved);
    this.state.templates = templates.map((tpl, index) => ({ ...tpl, sortIndex: index }));
    this.renderTemplatePanel();
    this.syncBatchQueryRowsOrder();
    await this.persistTemplateOrder();
},

async persistTemplateOrder() {
    const pid = this.getTemplateProviderId();
    if (!pid || !window.FirebaseModule?.updateTpl) return;
    try {
        await Promise.all((this.state.templates || []).map((tpl, index) => {
            if (!tpl._key) return Promise.resolve();
            const payload = this.clonePlain({ ...tpl, sortIndex: index });
            delete payload._key;
            return FirebaseModule.updateTpl(pid, tpl._key, payload);
        }));
        this.state.templatesLoaded = true;
    } catch (error) {
        console.error('[yeji] 模板排序保存失败', error);
        this._showToast('模板排序保存失败', 'error');
    }
},

syncBatchQueryRowsOrder() {
    if (!this.state.batchQueryRows?.length) return;
    const rowMap = new Map(this.state.batchQueryRows.map(row => [row.key, row]));
    const orderedRows = (this.state.templates || []).map(tpl => rowMap.get(tpl._key)).filter(Boolean);
    const orderedKeys = new Set(orderedRows.map(row => row.key));
    this.state.batchQueryRows = [
        ...orderedRows,
        ...this.state.batchQueryRows.filter(row => !orderedKeys.has(row.key))
    ];
    this.state.batchQueryRowMap = new Map(this.state.batchQueryRows.map(row => [row.key, row]));
    if (this.state.batchQueryOpen) this.renderBatchQueryBody();
},

async showTemplateNameDialog() {
    if (document.getElementById('yeji-template-dialog')) return;
    await this.loadTemplates({ force: true });
    const mask = document.createElement('div');
    mask.id = 'yeji-template-dialog';
    mask.className = 'yeji-tpl-mask';
    mask.innerHTML = `
        <div class="yeji-tpl-dialog" role="dialog" aria-modal="true" aria-label="添加模板">
            <div class="yeji-tpl-dialog-row">
                <input id="yeji-template-name-input" class="yeji-tpl-dialog-input" placeholder="请输入模板名称" maxlength="30" autocomplete="off" />
                <button type="button" class="yeji-tpl-dialog-cancel">取消</button>
                <button type="button" class="yeji-tpl-dialog-ok">确定</button>
            </div>
        </div>
    `;
    document.body.appendChild(mask);

    const input = mask.querySelector('#yeji-template-name-input');
    const close = () => mask.remove();
    const submit = () => {
        const name = input.value.trim();
        if (!name) {
            input.focus();
            return;
        }
        close();
        this.saveTemplate(name);
    };
    mask.querySelector('.yeji-tpl-dialog-cancel')?.addEventListener('click', close);
    mask.querySelector('.yeji-tpl-dialog-ok')?.addEventListener('click', submit);
    input?.addEventListener('keydown', event => {
        if (event.key === 'Enter') submit();
    });
    setTimeout(() => input?.focus(), 30);
},

async saveTemplate(name) {
    const pid = this.getTemplateProviderId();
    if (!pid || !window.FirebaseModule) {
        this._showToast('模板保存失败：未找到供应商信息', 'error');
        return;
    }
    const tpl = this.collectTemplateState(name);
    try {
        const list = await this.loadTemplates({ force: true });
        const existing = list.find(item => item.name === name);
        const existingIndex = existing ? list.findIndex(item => item._key === existing._key) : -1;
        tpl.sortIndex = existing?.sortIndex ?? (existingIndex >= 0 ? existingIndex : list.length);
        if (existing?._key) await FirebaseModule.updateTpl(pid, existing._key, tpl);
        else await FirebaseModule.saveTpl(pid, tpl);
        await this.loadTemplates({ force: true });
        this.renderTemplatePanel();
        this._showToast('模板已保存', 'success');
    } catch (error) {
        console.error('[yeji] 模板保存失败', error);
        this._showToast('模板保存失败', 'error');
    }
},

async deleteTemplate(templateKey) {
    const tpl = (this.state.templates || []).find(item => item._key === templateKey);
    if (!tpl) return;
    const confirmed = window.Tongzhi?.confirm
        ? await Tongzhi.confirm('确定要删除当前模板？')
        : window.confirm('确定要删除当前模板？');
    if (!confirmed) return;

    const pid = this.getTemplateProviderId();
    if (!pid || !window.FirebaseModule?.deleteTpl) return;
    try {
        await FirebaseModule.deleteTpl(pid, templateKey);
        if (this.state.activeTemplateKey === templateKey) this.state.activeTemplateKey = '';
        await this.loadTemplates({ force: true });
        this.renderTemplatePanel();
        this.updateTemplateButton();
        this._showToast('模板已删除', 'success');
    } catch (error) {
        console.error('[yeji] 模板删除失败', error);
        this._showToast('模板删除失败', 'error');
    }
},

applyTemplate(tpl) {
    const dateSelectorIds = this.getTemplateDateSelectorIds();
    const preservedDates = {};
    dateSelectorIds.forEach(selectorId => {
        if (this.state.filterValues[selectorId]) preservedDates[selectorId] = this.clonePlain(this.state.filterValues[selectorId]);
    });

    this.state.filterValues = { ...preservedDates };
    Object.entries(tpl.filters || {}).forEach(([selectorId, value]) => {
        if (!dateSelectorIds.has(selectorId)) this.state.filterValues[selectorId] = this.clonePlain(value);
    });
    this.state.excludeMode = {};
    Object.entries(tpl.excludeMode || {}).forEach(([selectorId, enabled]) => {
        if (enabled && !dateSelectorIds.has(selectorId)) this.state.excludeMode[selectorId] = true;
    });
    this.state.quickSearchSelectorId = tpl.quickSearch?.selectorId || '';
    this.state.quickSearchValue = tpl.quickSearch?.value || '';
    if (this.state.quickSearchSelectorId && this.state.quickSearchValue) {
        this.clearQuickControlledFilterValue(tpl.quickSearch.selectorId);
    }
    this.state.filterOpen = {};
    this.state.filterSearch = {};
    this.state.batchOpen = {};
    this.state.activeTemplateKey = tpl._key || '';
    const panel = document.getElementById('yeji-tpl-panel');
    if (panel) panel.style.display = 'none';
    this.renderQuickSearchSelectOptions();
    this.updateQuickSearchControl();
    this.renderFilters();
    this.updateTemplateButton();
    this.runDefaultQuery({ resetOffset: true, requireConnection: true });
},

updateTemplateButton() {
    const btn = document.getElementById('yeji-tpl-btn');
    if (!btn) return;
    const active = !!this.state.activeTemplateKey;
    btn.classList.toggle('yeji-tpl-active', active);
    btn.innerHTML = active
        ? '<i class="fa-solid fa-bookmark"></i>模板<i class="fa-solid fa-xmark yeji-tpl-clear" data-template-clear-active title="取消模板选择"></i>'
        : '<i class="fa-solid fa-bookmark"></i>模板<i class="fa-solid fa-caret-down yeji-tpl-arrow" style="font-size:10px"></i>';
},

clearActiveTemplate() {
    if (!this.state.activeTemplateKey) return;
    this.state.activeTemplateKey = '';
    this.updateTemplateButton();
    this.renderTemplatePanel();
},

clearActiveTemplateAndQueryDefault() {
    if (!this.state.activeTemplateKey) return;
    this.state.activeTemplateKey = '';
    this.state.filterValues = {
        [this.ultra.dateFilter.sourceCdId]: {
            macroName: '本月到昨天',
            range: this.getDefaultDateRange()
        }
    };
    this.state.dateRange = this.state.filterValues[this.ultra.dateFilter.sourceCdId].range;
    this.state.clearedTimeSelectors = {};
    this.state.excludeMode = {};
    this.state.quickSearchSelectorId = this.getDefaultQuickSearchSelectorId();
    this.state.quickSearchValue = '';
    this.state.filterOpen = {};
    this.state.filterSearch = {};
    this.state.batchOpen = {};
    this.updateTemplateButton();
    this.renderTemplatePanel();
    this.renderQuickSearchSelectOptions();
    this.updateQuickSearchControl();
    this.renderFilters();
    this.runDefaultQuery({ resetOffset: true, requireConnection: true });
},

getCurrentDateFilterValues() {
    const values = {};
    this.getTemplateDateSelectorIds().forEach(selectorId => {
        if (this.state.filterValues[selectorId]) values[selectorId] = this.clonePlain(this.state.filterValues[selectorId]);
    });
    return values;
},

buildTemplateQueryContext(tpl) {
    const dateSelectorIds = this.getTemplateDateSelectorIds();
    const filterValues = this.getCurrentDateFilterValues();
    Object.entries(tpl.filters || {}).forEach(([selectorId, value]) => {
        if (!dateSelectorIds.has(selectorId)) filterValues[selectorId] = this.clonePlain(value);
    });

    const excludeMode = {};
    Object.entries(tpl.excludeMode || {}).forEach(([selectorId, enabled]) => {
        if (enabled && !dateSelectorIds.has(selectorId)) excludeMode[selectorId] = true;
    });

    return {
        filterValues,
        excludeMode,
        quickSearchSelectorId: tpl.quickSearch?.selectorId || '',
        quickSearchValue: tpl.quickSearch?.value || '',
        fieldConfig: this.getActiveFieldConfig()
    };
},
};

window.YejiMbYewu = YejiMbYewu;
