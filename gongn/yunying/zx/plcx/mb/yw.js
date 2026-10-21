// BI summary target business: upload, database sync, target picker, and target columns.
const YejiPlcxMbYewu = {
// ---------- 目标存储（sjk 中控：yeji_targets 集合，ranges 内嵌与原结构同构） ----------

_targetsDocId(pid) {
    const text = String(pid ?? '').trim();
    return text.replace(/[.#$/[\]]/g, '_') || 'unknown';
},

async fetchTargets(pid) {
    const doc = await window.SjkModule.get('yeji_targets', this._targetsDocId(pid));
    return doc || null;
},

async saveTargetRange(pid, rangeKey, payload) {
    const docId = this._targetsDocId(pid);
    const doc = (await window.SjkModule.get('yeji_targets', docId)) || {};
    const ranges = { ...(doc.ranges || {}) };
    ranges[rangeKey] = payload;
    await window.SjkModule.set('yeji_targets', docId, {
        version: 1,
        module: 'ultra',
        ranges,
        updatedAt: Date.now()
    });
},

async removeTargetRange(pid, rangeKey) {
    const docId = this._targetsDocId(pid);
    const doc = await window.SjkModule.get('yeji_targets', docId);
    if (!doc) return;
    const ranges = { ...(doc.ranges || {}) };
    delete ranges[rangeKey];
    await window.SjkModule.set('yeji_targets', docId, {
        version: doc.version || 1,
        module: doc.module || 'ultra',
        ranges,
        updatedAt: Date.now()
    });
},

async ensureBatchTargetsLoaded({ force = false, showToast = false } = {}) {
    if (this.state.batchQueryTargetsLoaded && !force) return this.state.batchQueryTargets || {};
    const pid = this.getTemplateProviderId();
    if (!pid || !window.SjkModule) {
        this.state.batchQueryTargets = { ranges: {} };
        this.state.batchQueryTargetsLoaded = true;
        return this.state.batchQueryTargets;
    }

    try {
        const data = await this.fetchTargets(pid);
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
    const rows = (this.buildBatchDisplayRows?.(sourceRows, metricFields, { includeChildren: true }) || sourceRows)
        .filter(row => row.displayType !== 'merged');
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
        if (!pid || !window.SjkModule) throw new Error('目标数据库未就绪');
        await this.saveTargetRange(pid, parsed.rangeKey, payload);
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
    const metricNames = this.getBatchMetricFields().map(field => this.getMetricFieldDisplayName(field));
    const items = {};

    parsed.items.forEach(item => {
        // 目标仅匹配原始模板（模板上传即原样，不做任何合并解析）
        const templateKey = String(item.templateKey || '').trim();
        const templateName = String(item.templateName || '').trim();
        const tpl = byKey.get(templateKey) || byName.get(templateName);
        if (!tpl?._key) return;
        const targets = {};
        metricNames.forEach(name => {
            targets[name] = item.targets?.[name] ?? '';
        });
        items[tpl._key] = {
            templateName: tpl.name || templateName || '未命名模板',
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

getBatchTargetUpdater() {
    try {
        const bi = window.LoginModule?.getLocalLogin?.('bi') || {};
        return bi.account || bi.username || bi.provider_id || window.DeviceModule?.state?.deviceId || '';
    } catch {
        return window.DeviceModule?.state?.deviceId || '';
    }
},

async deleteBatchTargetRange(rangeKey) {
    if (!rangeKey) return;
    const confirmed = window.Tongzhi?.confirm
        ? await Tongzhi.confirm('确定要删除当前目标？')
        : window.confirm('确定要删除当前目标？');
    if (!confirmed) return;

    const pid = this.getTemplateProviderId();
    if (!pid || !window.SjkModule) return;
    try {
        await this.removeTargetRange(pid, rangeKey);
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
    const displayRows = rows || [];
    // 目标列判定用全量行（参与项含子行形态），折叠合并行时列集合不随展开状态变化
    const completeRows = this.buildBatchDisplayRows?.(
        this.state.batchQueryRows || [],
        this.getBatchDisplayMetricFields?.(),
        { includeChildren: true }
    ) || displayRows;
    const metricConfigs = this.getBatchTargetMetricConfigs(targetRange, completeRows);
    if (!metricConfigs.some(metric => metric.hasTarget)) return null;
    const headers = metricConfigs.flatMap(metric => metric.hasTarget
        ? [`${metric.name}目标`, metric.name, `${metric.name}达成率`]
        : [metric.name]);
    return {
        headers,
        rows: displayRows.map(row => ({
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
        row.displayType === 'merged'
            ? { className: 'metric num', html: this.escapeHtml(targetText || '-') }
            : this.renderEditableBatchTargetCell(row, metric, targetRange, target, targetText),
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
    const isFormula = row?.displayType === 'merged';
    const formulaTree = isFormula ? (row.formulaTree || []) : [];
    const rawKeys = isFormula
        ? (window.YejiPlcxGsGuize?.flattenTreeKeys(formulaTree) || [])
        : (row.rawRows?.length ? row.rawRows : [row]).map(item => item.key).filter(Boolean);
    const emphasized = options.emphasized === true;
    const metricName = metric.name || this.getMetricFieldDisplayName?.(metric) || '';
    return {
        className: emphasized ? 'metric num yeji-trend-entry-cell' : 'metric num',
        attrs: [
            'data-trend-entry',
            `data-trend-row-key="${this.escapeHtml(row.key || '')}"`,
            `data-trend-row-name="${this.escapeHtml(row.name || '')}"`,
            `data-trend-raw-keys="${this.escapeHtml(encodeURIComponent(JSON.stringify(rawKeys)))}"`,
            ...(isFormula ? [`data-trend-formula-tree="${this.escapeHtml(encodeURIComponent(JSON.stringify(formulaTree)))}"`] : []),
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
    if (!pid || !window.SjkModule) throw new Error('目标数据库未就绪');
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

    await this.saveTargetRange(pid, rangeKey, nextRange);
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
    },

    getTemplateCaliberType(tpl) {
    const hasKeyword = String(tpl?.keyword || '').trim() !== '';
    const hasFilters = !!(tpl?.filters && typeof tpl.filters === 'object' && Object.keys(tpl.filters).length);
    if (hasKeyword && hasFilters) return '筛选+关键词';
    if (hasKeyword) return '关键词';
    if (hasFilters) return '筛选条件';
    return '汇总模板';
    },

    // 统一解析模板筛选值为「每项一值」数组，与查询执行端（cx.js）同一套语义：
    // selected/manual（可共存合并）、range 日期对、treePaths 区域树、纯字符串/数组（历史/AI 直传）
    // 字符串拆分复用规则层 YejiPlcxFwGuize.splitValues（plcx 体系单一拆分事实源）
    parseCaliberFilterValues(raw) {
        const split = window.YejiPlcxFwGuize?.splitValues?.bind(window.YejiPlcxFwGuize) || (text => [String(text ?? '')]);
        if (raw === undefined || raw === null || raw === '') return [];
        if (Array.isArray(raw)) {
            if (raw.some(item => Array.isArray(item))) return raw.filter(p => Array.isArray(p) && p.length).map(p => p.join('>'));
            return raw.map(v => String(v ?? '')).filter(v => v !== '');
        }
        if (typeof raw === 'string') return split(raw);
        if (typeof raw === 'object') {
            const parts = [];
            if (Array.isArray(raw.range)) {
                const range = raw.range.filter(Boolean).map(String);
                if (range.length === 2) parts.push(range[0] + ' ~ ' + range[1]);
                else parts.push(...range);
            }
            if (Array.isArray(raw.selected)) parts.push(...raw.selected.map(v => String(v ?? '')).filter(Boolean));
            if (Array.isArray(raw.treePaths)) parts.push(...raw.treePaths.filter(p => Array.isArray(p) && p.length).map(p => p.join('>')));
            if (typeof raw.manual === 'string') parts.push(...split(raw.manual));
            if (parts.length) return parts;
            return Object.values(raw).map(v => (v && typeof v === 'object') ? JSON.stringify(v) : String(v ?? '')).filter(Boolean);
        }
        return [String(raw)];
    },

    buildTemplateCaliberSheetRows(tpl) {
        const selectorMap = new Map((this.state.selectors || []).map(s => [s.cdId || s.id, s.name || s.title || s.cdId || '']));
        // 筛选项从 C 列开始：每项一列（列标题=筛选项名称），值纵向每单元格一个
        const filterCols = [];
        const filters = (tpl?.filters && typeof tpl.filters === 'object') ? tpl.filters : null;
        if (filters) {
            Object.keys(filters).forEach(field => {
                const label = selectorMap.get(field) || (field + '（未匹配组件）');
                filterCols.push({ label, values: this.parseCaliberFilterValues(filters[field]) });
            });
        }
        const keywordRaw = tpl?.keyword;
        const hasKeyword = Array.isArray(keywordRaw) ? keywordRaw.length > 0 : String(keywordRaw || '').trim() !== '';
        const filterLabels = filterCols.map(col => col.label);
        const situation = filterLabels.length
            ? '本模板含 ' + filterLabels.length + ' 个筛选项：' + filterLabels.join('、')
            : (hasKeyword ? '本模板无筛选项，仅按关键词查询' : '本模板无筛选项、无关键词');
        const baseRows = [
            ['口径类型', this.getTemplateCaliberType(tpl)],
            ['关键词', Array.isArray(keywordRaw) ? keywordRaw.join('、') : (String(keywordRaw || '').trim() || '—')],
            ['快捷搜索', tpl?.quickSearch ? '是' : '否'],
            ['情况说明', situation],
            ['更新时间', tpl?.time ? new Date(tpl.time).toLocaleString('zh-CN') : '—']
        ];
        const maxLen = filterCols.reduce((m, col) => Math.max(m, col.values.length), 0);
        const rows = [['项目', '内容', ...filterCols.map(col => col.label)]];
        baseRows.forEach(pair => rows.push(pair));
        if (baseRows.length < maxLen) {
            for (let i = baseRows.length; i < maxLen; i++) rows.push(['', '']);
        }
        for (let i = 0; i < maxLen; i++) {
            const row = rows[i + 1];
            filterCols.forEach((col, c) => {
                row[c + 2] = col.values[i] ?? '';
            });
        }
        return rows.map(row => row.map(cell => (cell === undefined ? '' : String(cell).length > 32000 ? String(cell).slice(0, 32000) + '…' : cell)));
    },

    // 合并行口径明细：公式全文逐条解析，表达式与面板「模板公式」逐字一致（可直接复现）；
    // 状态复用 validateFormulaText（单一校验事实源），参与项取自分词结果。
    buildFormulaCaliberEntries() {
        const text = this.state.batchFormulaText || '';
        const guize = window.YejiPlcxGsGuize;
        if (!text.trim() || !guize) return [];
        const { specs } = guize.parseFormulaText(text);
        if (!specs.length) return [];
        const report = this.validateFormulaText(text);
        const errorsByLine = new Map(report.errors.map(err => [err.line, err.message]));
        const registry = this.getFormulaRegistryNames();
        const formulaNames = new Set(specs.map(item => item.name));
        return specs.map(spec => {
            const tokenized = guize.tokenizeFormula(spec.expr, [...registry, ...formulaNames]);
            const participants = tokenized.error ? [] : [...new Set(tokenized.terms.map(term => term.name))];
            return {
                name: spec.name,
                expr: `${spec.name}=${spec.expr}`,
                participants,
                status: errorsByLine.get(spec.line) || '有效'
            };
        });
    },

    // 合并行分表：与模板分表同构（A/B 列键值对，C 列起无筛选项）
    buildMergedCaliberSheetRows(entry) {
        const updatedAt = this.state.batchFormulaUpdatedAt;
        return [
            ['项目', '内容'],
            ['口径类型', '合并行（公式计算）'],
            ['计算公式', entry.expr],
            ['参与项', entry.participants.join('、') || '—'],
            ['参与项明细', '见同名模板分表'],
            ['状态', entry.status],
            ['情况说明', '本行由面板按公式实时计算：值字段按公式逐列折叠；率字段按分子分母分别折叠后相除（加权口径，不对率值直接加减）；目标值由参与项目标按同一公式派生，不可直接编辑'],
            ['公式更新时间', updatedAt ? new Date(updatedAt).toLocaleString('zh-CN') : '—']
        ];
    },

    async downloadAllTemplateCalibers() {
        try {
            // 确保筛选组件元数据就绪（组件 ID → 中文名映射），失败不阻断导出（组件名回退显示 ID）
            await this.ensureBiReadyForTool?.({ showToast: false });
            await this.loadUltraMetadata?.();
        } catch (error) {
            console.warn('[yeji] 口径导出前元数据加载失败，组件名将回退显示 ID:', error);
        }
        await this.ensureBatchFormulasLoaded?.();
        const templates = this.state.templates || [];
        if (!templates.length) {
            this._showToast('暂无模板，无法导出口径', 'warning');
            return;
        }
        const formulaEntries = this.buildFormulaCaliberEntries();
        const mergeRows = [
            ['一、表结构说明'],
            ['本工作簿由 BI 批量查询面板导出，描述全部查询项目的取数口径，供人工查阅与 AI 助手直接读取。'],
            ['项目分两类：模板 = 向 BI 发起查询的原始口径；合并行 = 面板按公式实时计算的派生行，数据不落在 BI 平台。'],
            ['阅读方式：先读「二、项目明细」定位项目，再打开同名分表查口径；复现合并行时直接使用「计算公式」列原文。'],
            [],
            ['总表（本表）结构：'],
            ['1. 「一、表结构说明」：本段，说明工作簿整体结构与阅读方式。'],
            ['2. 「二、项目明细」：每行一个项目，列依次为：项目名、类型、计算公式、参与项、更新时间；合并行置顶，与面板展示同序。'],
            ['3. 「三、公式计算规则」：合并行的通用计算口径（值字段折叠方式、率字段加权、目标派生）。'],
            ['4. 「四、基本信息」：本表的导出日期与时间。'],
            [],
            ['分表结构（每个项目一张，以项目名命名）：'],
            ['1. 模板分表：A/B 列为基础信息（口径类型、关键词、快捷搜索、情况说明、更新时间），C 列起为筛选项明细——每个筛选项独占一列，列标题为筛选项名称，列下方每行一个筛选值，各列相互独立、短列留空。'],
            ['2. 合并行分表：计算公式、参与项、状态与计算说明，无筛选项。'],
            [],
            ['二、项目明细'],
            ['项目名', '类型', '计算公式', '参与项', '更新时间']
        ];
        formulaEntries.forEach(entry => {
            mergeRows.push([
                entry.name,
                '合并行（公式计算）',
                entry.expr,
                entry.participants.join('、') || '—',
                this.state.batchFormulaUpdatedAt ? new Date(this.state.batchFormulaUpdatedAt).toLocaleString('zh-CN') : '—'
            ]);
        });
        templates.forEach(tpl => {
            mergeRows.push([tpl.name || '', this.getTemplateCaliberType(tpl), '', '', tpl?.time ? new Date(tpl.time).toLocaleString('zh-CN') : '—']);
        });
        mergeRows.push(
            [],
            ['三、公式计算规则'],
            ['模板均为原始模板，不做任何命名解析；需要汇总、差值、比率等计算时，在 BI 查询面板的「模板公式」中配置：结果名=模板名+模板名-模板名。'],
            ['计算口径：'],
            ['1. 值字段：严格按公式计算（先乘除后加减，全角自动归一，除数为 0 或操作数为空时结果留空）；'],
            ['2. 率字段（有分子分母定义的五个率）：公式计算后自动加权计算——分子、分母分别按同一公式折叠后相除，而非对率值直接加减；'],
            ['3. 公式只引用原始模板，不支持层层嵌套（计算行不能再参与计算）；'],
            ['4. 计算结果称为「合并行」，置于面板顶部；其引用的模板称为「参与项」，可展开折叠查看；'],
            ['5. 合并行的目标值由参与项目标按同一公式派生，不可直接编辑；上传目标仅对原始模板生效。'],
            [],
            ['四、基本信息'],
            ['导出日期', new Date().toLocaleDateString('zh-CN')],
            ['导出时间', new Date().toLocaleTimeString('zh-CN')]
        );

        const sheets = [{ name: '总表', rows: mergeRows }];
        formulaEntries.forEach(entry => {
            sheets.push({ name: entry.name, rows: this.buildMergedCaliberSheetRows(entry) });
        });
        templates.forEach((tpl, index) => {
            sheets.push({
                name: tpl.name || ('模板' + (index + 1)),
                rows: this.buildTemplateCaliberSheetRows(tpl)
            });
        });

        await window.YejiPlcxGongju.downloadWorkbookSheets({
            filename: window.YejiPlcxGongju.makeFilename('BI模板取数口径'),
            sheets
        });
    }
    };

window.YejiPlcxMbYewu = YejiPlcxMbYewu;
