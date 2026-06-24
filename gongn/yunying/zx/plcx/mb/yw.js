// BI summary target business: upload, database sync, target picker, and target columns.
const YejiPlcxMbYewu = {
async ensureBatchTargetsLoaded({ force = false, showToast = false } = {}) {
    if (this.state.batchQueryTargetsLoaded && !force) return this.state.batchQueryTargets || {};
    const pid = this.getTemplateProviderId();
    if (!pid || !window.FirebaseModule?.getYejiTargets) {
        this.state.batchQueryTargets = { ranges: {} };
        this.state.batchQueryTargetsLoaded = true;
        return this.state.batchQueryTargets;
    }

    try {
        const data = await FirebaseModule.getYejiTargets(pid);
        this.state.batchQueryTargets = data || { ranges: {} };
        this.state.batchQueryTargets.ranges = this.state.batchQueryTargets.ranges || {};
        this.state.batchQueryTargetsLoaded = true;
    } catch (error) {
        console.error('[yeji] 目标加载失败', error);
        this.state.batchQueryTargets = { ranges: {} };
        this.state.batchQueryTargetsLoaded = true;
        if (showToast) this._showToast('目标加载失败', 'error');
    }
    return this.state.batchQueryTargets;
},

getCurrentBatchTargetRangeInfo() {
    const ranges = this.getBatchQueryDateRanges?.() || [];
    const target = ranges.find(item => item.name === '出库日期') || ranges[0];
    if (!target?.range?.length) return null;
    const startDate = window.YejiPlcxMbGongju?.normalizeDate(target.range[0]) || '';
    const endDate = window.YejiPlcxMbGongju?.normalizeDate(target.range[1]) || '';
    const key = window.YejiPlcxMbGongju?.makeRangeKey(startDate, endDate) || '';
    return key ? { key, startDate, endDate, sourceName: target.name } : null;
},

getMatchedBatchTargetRange() {
    const info = this.getCurrentBatchTargetRangeInfo();
    if (!info) return null;
    return window.YejiPlcxMbGuize?.pickContainingRange(
        this.getBatchTargetRanges(),
        [info.startDate, info.endDate]
    ) || null;
},

getBatchTargetRanges() {
    return window.YejiPlcxMbGuize?.sortRanges(
        window.YejiPlcxMbGuize.normalizeRanges(this.state.batchQueryTargets?.ranges || {})
    ) || [];
},

getActiveBatchTargetRange() {
    const ranges = this.getBatchTargetRanges();
    const info = this.getCurrentBatchTargetRangeInfo();
    if (this.state.batchQueryActiveTargetKey) {
        const active = ranges.find(range => range.key === this.state.batchQueryActiveTargetKey);
        const activeStillMatches = active && (!info || window.YejiPlcxMbGuize?.pickContainingRange([active], [info.startDate, info.endDate]));
        if (activeStillMatches) return active;
    }
    return this.getMatchedBatchTargetRange();
},

getBatchTargetRuntime() {
    const target = this.getActiveBatchTargetRange();
    return target ? window.YejiPlcxMbGuize?.resolveRuntimeRange(target) : null;
},

async ensureDefaultBatchTargetForToday() {
    if (this.state.batchQueryActiveTargetKey) return false;
    await this.ensureBatchTargetsLoaded?.();
    const target = window.YejiPlcxMbGuize?.pickContainingDate(this.getBatchTargetRanges(), new Date());
    if (!target) return false;
    return this.applyBatchTargetRange(target.key, { runQuery: false, render: false });
},

renderBatchTargetPicker() {
    const ranges = this.getBatchTargetRanges();
    const matchedKey = this.getActiveBatchTargetRange()?.key || '';
    const activeRange = ranges.find(item => item.key === matchedKey);
    const activeLabel = activeRange?.label || activeRange?.key || '目标列表';
    const menu = ranges.length ? ranges.map(item => `
        <div class="yeji-target-picker-item${item.key === matchedKey ? ' active' : ''}" data-target-range="${this.escapeHtml(item.key)}">
            <span>${this.escapeHtml(item.label || item.key)}</span>
            <button type="button" class="yeji-target-picker-del" data-target-delete="${this.escapeHtml(item.key)}" title="删除目标">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('') : '<div class="yeji-target-picker-empty">暂无目标</div>';

    return `
        <div class="yeji-target-picker" data-batch-target-picker>
            <button type="button" id="yeji-batch-target-picker-btn" class="yeji-target-picker-btn" title="目标列表">
                <i class="fa-solid fa-bullseye"></i>
                <span>${this.escapeHtml(activeLabel)}</span>
                <i class="fa-solid fa-caret-up"></i>
            </button>
            <div class="yeji-target-picker-menu" ${this.state.batchQueryTargetPickerOpen ? '' : 'hidden'}>${menu}</div>
        </div>
    `;
},

bindBatchTargetPicker() {
    const picker = document.querySelector('[data-batch-target-picker]');
    if (!picker) return;

    picker.querySelector('#yeji-batch-target-picker-btn')?.addEventListener('click', async event => {
        event.stopPropagation();
        if (!this.state.batchQueryTargetPickerOpen) {
            await this.ensureBatchTargetsLoaded({ force: true, showToast: true });
        }
        this.state.batchQueryTargetPickerOpen = !this.state.batchQueryTargetPickerOpen;
        this.renderBatchQueryBody();
    });

    picker.querySelectorAll('[data-target-range]').forEach(item => {
        item.addEventListener('click', event => {
            if (event.target.closest('[data-target-delete]')) return;
            this.applyBatchTargetRange(item.dataset.targetRange);
        });
    });

    picker.querySelectorAll('[data-target-delete]').forEach(button => {
        button.addEventListener('click', event => {
            event.stopPropagation();
            this.deleteBatchTargetRange(button.dataset.targetDelete);
        });
    });

    this.ensureBatchTargetPickerGlobalClose();
},

ensureBatchTargetPickerGlobalClose() {
    if (this._batchTargetPickerDocBound) return;
    this._batchTargetPickerDocBound = true;
    document.addEventListener('click', event => {
        if (!this.state.batchQueryTargetPickerOpen) return;
        if (event.target.closest('[data-batch-target-picker]')) return;
        this.state.batchQueryTargetPickerOpen = false;
        if (this.state.batchQueryOpen) this.renderBatchQueryBody();
    });
},

applyBatchTargetRange(rangeKey, options = {}) {
    const range = this.state.batchQueryTargets?.ranges?.[rangeKey];
    if (!range) return;
    const runtime = window.YejiPlcxMbGuize?.resolveRuntimeRange({ key: rangeKey, ...range });
    if (!runtime?.queryRange?.length) {
        this._showToast('目标日期无效', 'error');
        return;
    }

    const selector = this.state.selectors.find(item => item.name === '出库日期')
        || this.state.selectors.find(item => item.cdId === this.ultra.dateFilter.sourceCdId);
    if (!selector) {
        this._showToast('未找到出库日期筛选项', 'error');
        return;
    }

    this.state.filterValues[selector.cdId] = { range: runtime.queryRange, macroName: '' };
    delete this.state.clearedTimeSelectors[selector.cdId];
    if (selector.cdId === this.ultra.dateFilter.sourceCdId) this.state.dateRange = [...runtime.queryRange];
    this.state.batchQueryActiveTargetKey = rangeKey;
    this.state.batchQueryTargetPickerOpen = false;
    if (options.render !== false) this.renderFilters?.();
    if (options.runQuery !== false) this.runBatchTemplateQuery({ forceRefresh: true });
    return true;
},

async openBatchTargetModal() {
    this.state.batchTargetFile = null;
    this.renderBatchTargetModal();
},

closeBatchTargetModal() {
    this.state.batchTargetFile = null;
    document.getElementById('yeji-target-modal')?.remove();
},

renderBatchTargetModal() {
    document.getElementById('yeji-target-modal')?.remove();
    const uploading = !!this.state.batchQueryTargetUploading;
    const fileName = this.state.batchTargetFile?.name || '选择目标文件';
    const mask = document.createElement('div');
    mask.id = 'yeji-target-modal';
    mask.className = 'yeji-target-modal';
    mask.innerHTML = `
        <div class="yeji-target-backdrop"></div>
        <div class="yeji-target-dialog" role="dialog" aria-modal="true" aria-label="目标上传">
            <div class="yeji-target-header">
                <div class="yeji-target-title">目标</div>
                <button type="button" class="yeji-target-close" data-target-close title="关闭" ${uploading ? 'disabled' : ''}>
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="yeji-target-body">
                <section class="yeji-target-main">
                    <label class="yeji-target-upload${uploading ? ' disabled' : ''}" data-target-drop>
                        <input type="file" id="yeji-target-file" accept=".xlsx,.xls" hidden ${uploading ? 'disabled' : ''} />
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                        <span id="yeji-target-file-name">${this.escapeHtml(fileName)}</span>
                    </label>
                    ${uploading ? '<div class="yeji-target-uploading">上传中......</div>' : ''}
                </section>
            </div>
            <div class="yeji-target-footer">
                <button type="button" class="yeji-filter-mini" id="yeji-target-download" ${uploading ? 'disabled' : ''}>下载模板</button>
                <div class="yeji-target-actions">
                    <button type="button" class="yeji-filter-mini primary" id="yeji-target-upload" ${uploading ? 'disabled' : ''}>上传</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(mask);
    this.bindBatchTargetModal(mask);
},

bindBatchTargetModal(mask) {
    if (this.state.batchQueryTargetUploading) return;
    mask.querySelector('[data-target-close]')?.addEventListener('click', () => this.closeBatchTargetModal());
    mask.querySelector('#yeji-target-file')?.addEventListener('change', event => {
        const file = event.target.files?.[0] || null;
        this.setBatchTargetFile(file, mask);
    });
    this.bindBatchTargetDrop(mask);
    mask.querySelector('#yeji-target-download')?.addEventListener('click', () => this.downloadBatchTargetTemplate());
    mask.querySelector('#yeji-target-upload')?.addEventListener('click', () => this.uploadBatchTargetFile());
},

bindBatchTargetDrop(mask) {
    const drop = mask.querySelector('[data-target-drop]');
    if (!drop) return;
    const stop = event => {
        event.preventDefault();
        event.stopPropagation();
    };
    ['dragenter', 'dragover'].forEach(type => {
        drop.addEventListener(type, event => {
            stop(event);
            drop.classList.add('dragover');
        });
    });
    ['dragleave', 'dragend'].forEach(type => {
        drop.addEventListener(type, event => {
            stop(event);
            drop.classList.remove('dragover');
        });
    });
    drop.addEventListener('drop', event => {
        stop(event);
        drop.classList.remove('dragover');
        const file = Array.from(event.dataTransfer?.files || []).find(item => /\.(xlsx|xls)$/i.test(item.name));
        if (!file) {
            this._showToast('请拖入 xlsx 或 xls 目标文件', 'warning');
            return;
        }
        this.setBatchTargetFile(file, mask);
    });
},

setBatchTargetFile(file, mask) {
    this.state.batchTargetFile = file || null;
    const label = mask?.querySelector('#yeji-target-file-name');
    if (label) label.textContent = file ? file.name : '选择目标文件';
},

async downloadBatchTargetTemplate() {
    try {
        await this.loadTemplates({ force: true });
        const templates = this.state.templates || [];
        if (!templates.length) {
            this._showToast('暂无模板，无法下载目标模板', 'warning');
            return;
        }
        const range = this.getBatchTargetTemplateRangeInfo();
        const metricFields = this.getBatchMetricFields();
        const metricNames = metricFields.map(field => this.getMetricFieldDisplayName(field));
        const rows = this.buildBatchTargetTemplateRows(templates, metricFields, this.getActiveBatchTargetRange?.());
        await window.YejiPlcxMbGongju.downloadTemplate({
            rows,
            metricNames,
            startDate: range.startDate || '',
            endDate: range.endDate || ''
        });
    } catch (error) {
        console.error('[yeji] 目标模板下载失败', error);
        this._showToast(error.message || '目标模板下载失败', 'error');
    }
},

buildBatchTargetTemplateRows(templates = [], metricFields = this.getBatchMetricFields(), targetRange = null) {
    const sourceRows = (templates || []).map(tpl => ({
        key: tpl._key || '',
        name: tpl.name || '未命名模板',
        metricFields,
        valuesByKey: {},
        formatsByKey: {}
    }));
    const rows = this.buildBatchDisplayRows?.(sourceRows, metricFields, { includeChildren: true }) || sourceRows;
    const metricNames = (metricFields || []).map(field => this.getMetricFieldDisplayName(field));
    return rows.map(row => {
        const targets = {};
        metricNames.forEach(name => {
            const value = targetRange
                ? (this.getBatchTargetValueForDisplayRow?.(row, name, targetRange) ?? '')
                : '';
            const isEmpty = value == null || String(value).trim() === '';
            const isRate = window.YejiPlcxMbGongju?.isRateMetric?.(name);
            const formattedRate = isRate ? window.YejiPlcxMbGongju.formatRateTargetValue(value) : '';
            targets[name] = isEmpty ? '' : (isRate && formattedRate !== '-' ? formattedRate : value);
        });
        return {
            key: row.key || '',
            name: row.name || '未命名模板',
            targets
        };
    });
},

getBatchTargetTemplateRangeInfo() {
    const active = this.getActiveBatchTargetRange?.();
    if (active?.startDate && active?.endDate) {
        return { startDate: active.startDate, endDate: active.endDate };
    }

    const runtime = window.YejiPlcxMbGuize?.resolveDateRuntime(this.getBatchQueryDateRanges?.() || []);
    if (runtime?.periodRange?.length === 2) {
        return { startDate: runtime.periodRange[0], endDate: runtime.periodRange[1] };
    }

    return this.getCurrentBatchTargetRangeInfo() || {};
},

async uploadBatchTargetFile() {
    if (this.state.batchQueryTargetUploading) return;
    const file = this.state.batchTargetFile;
    if (!file) {
        this._showToast('请先选择目标文件', 'warning');
        return;
    }

    this.state.batchQueryTargetUploading = true;
    this.renderBatchTargetModal();
    await this.waitBatchTargetModalPaint();
    let uploadRestored = false;
    try {
        await this.loadTemplates({ force: true });
        const parsed = await window.YejiPlcxMbGongju.readWorkbook(file);
        const payload = this.buildBatchTargetPayload(parsed);
        const pid = this.getTemplateProviderId();
        if (!pid || !window.FirebaseModule?.saveYejiTargetRange) throw new Error('目标数据库未就绪');
        await FirebaseModule.saveYejiTargetRange(pid, parsed.rangeKey, payload);
        await this.ensureBatchTargetsLoaded({ force: true });
        this.state.batchTargetFile = null;
        this.state.batchQueryTargetUploading = false;
        uploadRestored = true;
        if (document.getElementById('yeji-target-modal')) this.renderBatchTargetModal();
        this.applyBatchTargetRange(parsed.rangeKey, { runQuery: false });
        if (this.state.batchQueryOpen) this.runBatchTemplateQuery({ forceRefresh: true });
        this._showToast('目标已上传', 'success');
    } catch (error) {
        console.error('[yeji] 目标上传失败', error);
        this._showToast(error.message || '目标上传失败', 'error');
    } finally {
        this.state.batchQueryTargetUploading = false;
        if (!uploadRestored && document.getElementById('yeji-target-modal')) this.renderBatchTargetModal();
    }
},

waitBatchTargetModalPaint() {
    return new Promise(resolve => {
        const frame = window.requestAnimationFrame || (callback => setTimeout(callback, 0));
        frame(() => resolve());
    });
},

buildBatchTargetPayload(parsed) {
    const templates = this.state.templates || [];
    const byKey = new Map(templates.map(tpl => [tpl._key, tpl]));
    const byName = new Map(templates.map(tpl => [tpl.name, tpl]));
    const mergeableNames = this.getBatchMergeableTargetNames(templates);
    const metricNames = this.getBatchMetricFields().map(field => this.getMetricFieldDisplayName(field));
    const items = {};

    parsed.items.forEach(item => {
        const targetItem = this.resolveBatchTargetPayloadItem(item, byKey, byName, mergeableNames);
        if (!targetItem?.key) return;
        const targets = {};
        metricNames.forEach(name => {
            targets[name] = item.targets?.[name] ?? '';
        });
        items[targetItem.key] = {
            templateName: targetItem.name || item.templateName || '未命名模板',
            targets
        };
    });

    if (!Object.keys(items).length) throw new Error('目标模板项目未匹配当前模板');

    return {
        version: 1,
        module: 'ultra',
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        label: parsed.label,
        metrics: metricNames,
        updatedAt: Date.now(),
        updatedBy: this.getBatchTargetUpdater(),
        items
    };
},

resolveBatchTargetPayloadItem(item = {}, byKey = new Map(), byName = new Map(), mergeableNames = new Set()) {
    const templateKey = String(item.templateKey || '').trim();
    const templateName = String(item.templateName || '').trim();
    const tpl = byKey.get(templateKey) || byName.get(templateName);
    if (tpl?._key) {
        return { key: tpl._key, name: tpl.name || templateName || '未命名模板' };
    }
    if (templateKey.startsWith('merge:')) {
        return { key: templateKey, name: templateName || templateKey.slice('merge:'.length) || '未命名模板' };
    }
    if (mergeableNames.has(templateName)) {
        return { key: `merge:${templateName}`, name: templateName };
    }
    return null;
},

getBatchMergeableTargetNames(templates = []) {
    const grouped = new Map();
    (templates || []).forEach(tpl => {
        const parsed = window.YejiPlcxHbGuize?.parseTemplateName(tpl.name || '') || {};
        if (!parsed.mergeable || !parsed.base) return;
        grouped.set(parsed.base, (grouped.get(parsed.base) || 0) + 1);
    });
    return new Set([...grouped.entries()].filter(([, count]) => count > 1).map(([name]) => name));
},

getBatchTargetUpdater() {
    try {
        const bi = window.LoginModule?.getLocalLogin?.('bi') || {};
        return bi.account || bi.username || bi.provider_id || window.FirebaseModule?.state?.deviceId || '';
    } catch {
        return window.FirebaseModule?.state?.deviceId || '';
    }
},

async deleteBatchTargetRange(rangeKey) {
    if (!rangeKey) return;
    const confirmed = window.Tongzhi?.confirm
        ? await Tongzhi.confirm('确定要删除当前目标？')
        : window.confirm('确定要删除当前目标？');
    if (!confirmed) return;

    const pid = this.getTemplateProviderId();
    if (!pid || !window.FirebaseModule?.deleteYejiTargetRange) return;
    try {
        await FirebaseModule.deleteYejiTargetRange(pid, rangeKey);
        if (this.state.batchQueryActiveTargetKey === rangeKey) this.state.batchQueryActiveTargetKey = '';
        await this.ensureBatchTargetsLoaded({ force: true });
        if (this.state.batchQueryOpen) this.renderBatchQueryBody();
        this._showToast('目标已删除', 'success');
    } catch (error) {
        console.error('[yeji] 目标删除失败', error);
        this._showToast('目标删除失败', 'error');
    }
},

buildBatchTargetTableModel(rows) {
    const targetRange = this.getActiveBatchTargetRange();
    if (!targetRange) return null;
    const metricConfigs = this.getBatchTargetMetricConfigs(targetRange, rows);
    if (!metricConfigs.some(metric => metric.hasTarget)) return null;
    const headers = metricConfigs.flatMap(metric => metric.hasTarget
        ? [`${metric.name}目标`, metric.name, `${metric.name}达成率`]
        : [metric.name]);
    return {
        headers,
        rows: (rows || []).map(row => ({
            name: row.name,
            nameHtml: this.renderBatchDisplayName?.(row),
            cells: metricConfigs.flatMap(metric => this.buildBatchTargetCells(row, metric, targetRange))
        }))
    };
},

getBatchTargetMetricConfigs(targetRange, rows = []) {
    return (this.getBatchDisplayMetricFields?.() || this.getBatchQueryMetricFields()).map(field => {
        const name = this.getMetricFieldDisplayName(field);
        return {
            key: field.key,
            name,
            hasTarget: (rows || []).some(row => this.hasBatchTargetValue(
                this.getBatchTargetValueForDisplayRow?.(row, name, targetRange)
            ))
        };
    });
},

hasBatchTargetValue(value) {
    if (value == null || String(value).trim() === '') return false;
    const numeric = window.YejiPlcxMbGongju?.toNumber(value);
    if (Number.isFinite(numeric)) return numeric !== 0;
    return true;
},

buildBatchTargetCells(row, metric, targetRange) {
    const target = this.getBatchTargetValueForDisplayRow?.(row, metric.name, targetRange) ?? '';
    const enabled = this.isBatchRowMetricEnabled(row, metric.key);
    const actualValue = enabled ? row.valuesByKey?.[metric.key] : '';
    const actualFormat = enabled ? row.formatsByKey?.[metric.key] : null;
    const actualCell = row.error
        ? '查询失败'
        : (row.loading ? this.renderBatchLoadingCell() : (enabled ? this.formatBatchQueryValue(actualValue, actualFormat) : '-'));
    const actualTrendCell = this.renderBatchMetricTrendCell(row, metric, targetRange, target, actualCell, { enabled });
    if (!metric.hasTarget) return [actualTrendCell];

    const targetText = window.YejiPlcxMbGongju.formatTargetValue(target, value => this.formatBatchQueryValue(value, null), metric.name);
    const rate = row.error || row.loading || !enabled ? '' : window.YejiPlcxMbGongju.calcAchievement(actualValue, target, metric.name);
    return [
        this.renderEditableBatchTargetCell(row, metric, targetRange, target, targetText),
        actualTrendCell,
        this.renderBatchTrendEntryCell(row, metric, targetRange, target, window.YejiPlcxMbGongju.formatAchievement(rate))
    ];
},

renderEditableBatchTargetCell(row, metric, targetRange, rawValue, displayText) {
    return {
        className: 'metric num yeji-target-edit-cell',
        attrs: [
            'data-target-edit',
            `data-target-range="${this.escapeHtml(targetRange.key || '')}"`,
            `data-target-row="${this.escapeHtml(row.key || '')}"`,
            `data-target-name="${this.escapeHtml(row.name || '')}"`,
            `data-target-metric="${this.escapeHtml(metric.name || '')}"`,
            `data-target-raw="${this.escapeHtml(rawValue ?? '')}"`
        ].join(' '),
        html: `<span class="yeji-target-edit-value">${this.escapeHtml(displayText || '-')}</span>`
    };
},

renderBatchMetricTrendCell(row, metric, targetRange, targetValue, displayText, options = {}) {
    if (displayText && typeof displayText === 'object') return displayText;
    const text = String(displayText ?? '').trim();
    if (!text || text === '-' || row?.error || row?.loading || options.enabled === false || !metric?.key) return displayText || '-';
    const rawKeys = (row.rawRows?.length ? row.rawRows : [row]).map(item => item.key).filter(Boolean);
    const emphasized = options.emphasized === true;
    const metricName = metric.name || this.getMetricFieldDisplayName?.(metric) || '';
    return {
        className: emphasized ? 'metric num yeji-trend-entry-cell' : 'metric num',
        attrs: [
            'data-trend-entry',
            `data-trend-row-key="${this.escapeHtml(row.key || '')}"`,
            `data-trend-row-name="${this.escapeHtml(row.name || '')}"`,
            `data-trend-raw-keys="${this.escapeHtml(encodeURIComponent(JSON.stringify(rawKeys)))}"`,
            `data-trend-metric-key="${this.escapeHtml(metric.key || '')}"`,
            `data-trend-metric-name="${this.escapeHtml(metricName)}"`,
            `data-trend-target="${this.escapeHtml(targetValue ?? '')}"`,
            `data-trend-target-range="${this.escapeHtml(targetRange?.key || '')}"`
        ].join(' '),
        html: emphasized
            ? `<span class="yeji-trend-entry-value">${this.escapeHtml(text)}</span>`
            : this.escapeHtml(text)
    };
},

renderBatchTrendEntryCell(row, metric, targetRange, targetValue, displayText) {
    return this.renderBatchMetricTrendCell(row, metric, targetRange, targetValue, displayText, { emphasized: true });
},

bindBatchTargetCellEditors() {
    document.querySelectorAll('[data-target-edit]').forEach(cell => {
        cell.addEventListener('dblclick', () => this.startBatchTargetCellEdit(cell));
    });
},

startBatchTargetCellEdit(cell) {
    if (!cell || cell.querySelector('.yeji-target-edit-input')) return;
    const original = cell.dataset.targetRaw || '';
    cell.classList.add('editing');
    cell.innerHTML = `<input class="yeji-target-edit-input" value="${this.escapeHtml(original)}" autocomplete="off" />`;
    const input = cell.querySelector('input');
    const finish = () => {
        if (cell.dataset.cancelled === '1') return;
        this.commitBatchTargetCellEdit(cell, input.value);
    };
    const cancel = () => {
        cell.dataset.cancelled = '1';
        cell.classList.remove('editing');
        cell.innerHTML = `<span class="yeji-target-edit-value">${this.escapeHtml(window.YejiPlcxMbGongju.formatTargetValue(original, value => this.formatBatchQueryValue(value, null), cell.dataset.targetMetric || '') || '-')}</span>`;
        setTimeout(() => delete cell.dataset.cancelled, 0);
    };
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            finish();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
        }
    });
    input.addEventListener('blur', finish, { once: true });
    setTimeout(() => {
        input.focus();
        input.select();
    }, 0);
},

async commitBatchTargetCellEdit(cell, value) {
    if (!cell || cell.dataset.saving === '1') return;
    const rangeKey = cell.dataset.targetRange || '';
    const rowKey = cell.dataset.targetRow || '';
    const rowName = cell.dataset.targetName || '未命名模板';
    const metricName = cell.dataset.targetMetric || '';
    const oldValue = cell.dataset.targetRaw || '';
    const nextValue = window.YejiPlcxMbGongju.normalizeTargetValue(value);
    if (String(nextValue) === String(oldValue)) {
        this.renderBatchQueryBody();
        return;
    }

    cell.dataset.saving = '1';
    try {
        await this.updateBatchTargetValue(rangeKey, rowKey, rowName, metricName, nextValue);
        this.renderBatchQueryBody();
        this._showToast('目标已更新', 'success');
    } catch (error) {
        console.error('[yeji] 目标更新失败', error);
        this.renderBatchQueryBody();
        this._showToast(error.message || '目标更新失败', 'error');
    }
},

async updateBatchTargetValue(rangeKey, rowKey, rowName, metricName, value) {
    if (!rangeKey || !rowKey || !metricName) throw new Error('目标字段信息不完整');
    const pid = this.getTemplateProviderId();
    if (!pid || !window.FirebaseModule?.saveYejiTargetRange) throw new Error('目标数据库未就绪');
    const targetRoot = this.state.batchQueryTargets || { ranges: {} };
    const range = targetRoot.ranges?.[rangeKey];
    if (!range) throw new Error('目标区间不存在');

    const nextRange = this.clonePlain(range);
    nextRange.items = nextRange.items || {};
    nextRange.items[rowKey] = nextRange.items[rowKey] || { templateName: rowName, targets: {} };
    nextRange.items[rowKey].templateName = nextRange.items[rowKey].templateName || rowName;
    nextRange.items[rowKey].targets = nextRange.items[rowKey].targets || {};
    nextRange.items[rowKey].targets[metricName] = value;
    nextRange.updatedAt = Date.now();
    nextRange.updatedBy = this.getBatchTargetUpdater();

    await FirebaseModule.saveYejiTargetRange(pid, rangeKey, nextRange);
    this.state.batchQueryTargets.ranges[rangeKey] = nextRange;
},

buildBatchTargetExportModel(rows) {
    const targetRange = this.getActiveBatchTargetRange();
    if (!targetRange) return null;
    const metricConfigs = this.getBatchTargetMetricConfigs(targetRange, rows);
    if (!metricConfigs.some(metric => metric.hasTarget)) return null;
    const headers = ['项目名称', ...metricConfigs.flatMap(metric => metric.hasTarget
        ? [`${metric.name}目标`, metric.name, `${metric.name}达成率`]
        : [metric.name])];
    const exportRows = (rows || []).map(row => {
        const data = { 项目名称: row.name || '' };
        metricConfigs.forEach(metric => {
            const target = this.getBatchTargetValueForDisplayRow?.(row, metric.name, targetRange) ?? '';
            const enabled = this.isBatchRowMetricEnabled(row, metric.key);
            const actualValue = enabled ? row.valuesByKey?.[metric.key] : '';
            data[metric.name] = enabled
                ? (window.YejiPlcxGongju?.normalizeExportValue(actualValue) ?? actualValue ?? '')
                : '';
            if (!metric.hasTarget) return;
            const rate = enabled ? window.YejiPlcxMbGongju.calcAchievement(actualValue, target, metric.name) : '';
            data[`${metric.name}目标`] = window.YejiPlcxMbGongju.isRateMetric(metric.name)
                ? window.YejiPlcxMbGongju.formatRateTargetValue(target)
                : (window.YejiPlcxGongju?.normalizeExportValue(target) ?? target);
            data[`${metric.name}达成率`] = window.YejiPlcxMbGongju.formatAchievement(rate);
        });
        return data;
    });
    return { headers, rows: exportRows };
}
};

window.YejiPlcxMbYewu = YejiPlcxMbYewu;
