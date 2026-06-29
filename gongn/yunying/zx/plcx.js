// BI operation batch query business.
const YejiPlcxYewu = {
openBatchQueryModal() {
    const modal = document.getElementById('yeji-batch-modal');
    if (modal) modal.hidden = false;
    this.state.batchQueryOpen = true;
    this.refreshBiAiContext?.();
    if (this.state.batchQueryRows?.length) this.renderBatchQueryBody();
    else this.renderBatchQueryBody('准备查询模板...');
    this.runBatchTemplateQuery();
},

closeBatchQueryModal() {
    const modal = document.getElementById('yeji-batch-modal');
    if (modal) modal.hidden = true;
    this.state.batchQueryOpen = false;
    this.closeBatchTrendModal?.();
    this.refreshBiAiContext?.();
},

renderBatchQueryModal() {
    const modal = document.getElementById('yeji-batch-modal');
    const dialog = modal?.querySelector('.yeji-batch-dialog');
    const wasFullscreen = !!dialog?.classList.contains('yeji-modal-fullscreen');
    this.renderBatchQueryBody();
    const nextDialog = modal?.querySelector('.yeji-batch-dialog');
    if (wasFullscreen) nextDialog?.classList.add('yeji-modal-fullscreen');
},

async runBatchTemplateQuery(options = {}) {
    if (this.state.batchQueryLoading) {
        if (options.forceRefresh) {
            this.state.batchQueryPendingRefresh = true;
            this.updateBatchQueryTitleMeta();
            if (!this.state.batchQueryRows?.length) this.renderBatchQueryBody('准备查询模板...');
        }
        return;
    }
    if (!this.state.proxyReady || !this.state.tokenValid) {
        await this.ensureBiConnection({ showToast: true });
        if (!this.state.proxyReady || !this.state.tokenValid) {
            this.state.batchQueryPendingRefresh = true;
            this.state.batchQueryLoading = false;
            this.renderBatchQueryBody(this.state.proxyReady ? 'BI代理已连接，请先完成BI登录。' : '未连接BI代理，请先完成BI连接。');
            return;
        }
    }

    this.state.batchQueryLoading = true;
    this.renderBatchQueryBody(this.state.batchQueryRows?.length ? '' : '准备查询模板...');
    try {
        await this.loadUltraMetadata();
        const templatesPromise = this.loadTemplates({ force: true });
        const targetsPromise = this.ensureBatchTargetsLoaded?.();
        await targetsPromise;
        await this.ensureDefaultBatchTargetForToday?.();
        const templates = await templatesPromise;
        if (!templates.length) {
            this.state.batchQueryRows = [];
            this.state.batchQueryLoading = false;
            this.renderBatchQueryBody('暂无模板，请先在筛选弹窗中添加模板。');
            return;
        }

        const dateValues = this.getCurrentDateFilterValues();
        const displayMetricFields = this.getBatchMetricFields();
        const queryPlans = this.buildBatchQueryPlans(templates, displayMetricFields);
        const batchMetricFields = this.getBatchPlanMetricUnion(queryPlans);
        const serviceInput = {
            templates,
            dateValues,
            displayMetricFields,
            metricFields: batchMetricFields,
            fieldConfig: this.getBatchQueryFieldConfig(batchMetricFields),
            queryPlans,
            targetRange: this.getActiveBatchTargetRange?.() || null,
            includeChildren: true
        };
        this.state.batchQueryMetricFields = batchMetricFields;
        this.state.batchQueryDisplayMetricFields = displayMetricFields;
        this.state.batchQueryFieldConfig = serviceInput.fieldConfig;
        this.state.batchQueryDateValues = this.clonePlain(dateValues);
        this.state.batchQueryTemplateSnapshot = this.clonePlain(templates);
        const cacheKey = this.getBatchQueryCacheKey(templates, dateValues);
        const cached = !options.forceRefresh ? this.state.batchQueryCache[cacheKey] : null;
        if (cached) {
            this.state.batchQueryRows = this.clonePlain(cached.rows);
            this.state.batchQueryRowMap = new Map(this.state.batchQueryRows.map(row => [row.key, row]));
            this.state.batchQueryMetricFields = this.clonePlain(cached.metricFields || batchMetricFields);
            this.state.batchQueryDisplayMetricFields = this.clonePlain(cached.displayMetricFields || displayMetricFields);
            this.state.batchQueryFieldConfig = this.clonePlain(cached.fieldConfig || this.state.batchQueryFieldConfig);
            this.state.batchQueryLoading = false;
            this.renderBatchQueryBody();
            return;
        }

        this.state.batchQueryRows = templates.map(tpl => ({
            key: tpl._key,
            name: tpl.name || '未命名模板',
            metricFields: queryPlans.get(tpl._key)?.metricFields || batchMetricFields,
            queryPlan: queryPlans.get(tpl._key) || { rowFields: [], metricFields: batchMetricFields },
            loading: true,
            valuesByKey: {},
            formatsByKey: {}
        }));
        this.state.batchQueryRowMap = new Map(this.state.batchQueryRows.map(row => [row.key, row]));
        this.renderBatchQueryBody();

        const rows = await this.queryBatchRowsForInput(serviceInput);
        const result = this.buildBatchQueryServiceResult(serviceInput, rows);
        this.applyBatchQueryServiceResult(result);
        if (this.state.batchQueryPendingRefresh) return;
        this.state.batchQueryCache[cacheKey] = {
            time: Date.now(),
            rows: this.clonePlain(this.state.batchQueryRows),
            metricFields: this.clonePlain(this.state.batchQueryMetricFields),
            displayMetricFields: this.clonePlain(this.state.batchQueryDisplayMetricFields),
            fieldConfig: this.clonePlain(this.state.batchQueryFieldConfig)
        };
        this.state.batchQueryLoading = false;
        this.renderBatchQueryBody();
    } catch (error) {
        console.error('[yeji] 批量查询失败', error);
        this.state.batchQueryLoading = false;
        this.renderBatchQueryBody(`批量查询失败：${error.message || '未知错误。'}`);
    } finally {
        this.state.batchQueryLoading = false;
        if (this.state.batchQueryPendingRefresh && this.state.batchQueryOpen) {
            this.state.batchQueryPendingRefresh = false;
            setTimeout(() => this.runBatchTemplateQuery({ forceRefresh: true }), 0);
        }
    }
},

getBatchQueryConcurrency() {
    return 31;
},

buildBatchTemplateQueryContext(tpl, dateValues = null) {
    const dateSelectorIds = this.getTemplateDateSelectorIds();
    const filterValues = this.clonePlain(dateValues || this.getCurrentDateFilterValues());
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
        fieldConfig: this.state.batchQueryFieldConfig || this.getBatchQueryFieldConfig()
    };
},

getBatchQueryFieldConfig(metricFields = null) {
    const rowFields = [];
    const fields = metricFields || this.getBatchQueryMetricFields();
    return this.normalizeFieldConfig({
        rowKeys: rowFields.map(field => field.key).filter(Boolean),
        metricKeys: fields.map(field => field.key).filter(Boolean)
    });
},

getBatchQueryCacheKey(templates, dateValues = null) {
    const dates = dateValues || this.getCurrentDateFilterValues();
    const fieldConfig = this.state.batchQueryFieldConfig || this.getBatchQueryFieldConfig();
    const tplKeys = (templates || []).map(tpl => ({
        key: tpl._key || '',
        name: tpl.name || '',
        time: tpl.time || 0,
        filters: tpl.filters || {},
        excludeMode: tpl.excludeMode || {},
        quickSearch: tpl.quickSearch || {}
    }));
    return JSON.stringify({ dateValues: dates, fieldConfig, tplKeys });
},

extractGrandMetricValues(json, context = this.state) {
    const cm = json?.response?.chartMain;
    if (!cm) return { valuesByKey: {}, formatsByKey: {} };
    const rowValues = cm.row?.values || [];
    const data = cm.data || [];
    const columnValues = cm.column?.values || [];
    const metricHeaders = this.normalizeMetricHeaders(columnValues);
    const formats = cm.column?.metricFieldFormat?.numberFormat || [];
    const grandIndex = rowValues.findIndex(dims => (dims || []).some(cell => cell?.isGrandtotal));
    const metrics = grandIndex >= 0
        ? (data[grandIndex] || [])
        : (Array.isArray(data[0]) ? data[0] : (Array.isArray(data) ? data : []));
    const valuesByKey = {};
    const formatsByKey = {};
    this.getContextMetricFields(context).forEach((field, index) => {
        const metric = metricHeaders[index] || {};
        const fmtIndex = metric?.fmt_idx ?? index;
        valuesByKey[field.key] = metrics[index]?.v ?? '';
        formatsByKey[field.key] = formats[fmtIndex] || null;
    });
    return { valuesByKey, formatsByKey };
},

getContextMetricFields(context = this.state) {
    return Array.isArray(context.queryPlan?.metricFields)
        ? context.queryPlan.metricFields
        : this.getQueryMetricFields(context);
},

renderBatchQueryBody(message = '') {
    const wrap = document.getElementById('yeji-batch-body');
    if (!wrap) return;
    if (!message && !this.state.batchQueryRows?.length) {
        message = this.state.batchQueryLoading ? '准备查询模板...' : '暂无BI汇总查询数据。';
    }
    if (message) {
        const loading = this.state.batchQueryLoading;
        wrap.innerHTML = `
            <div class="yeji-batch-table-area">
                <div class="yeji-batch-table-wrap">
                    <div class="yeji-empty"><i class="fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-inbox'}"></i> ${this.escapeHtml(message)}</div>
                </div>
            </div>
            ${this.renderBatchQueryStatusBar()}
        `;
        this.bindBatchQueryStatusBar();
        this.updateBatchQueryTitleMeta();
        return;
    }

    const metricFields = this.getBatchDisplayMetricFields?.() || this.getBatchQueryMetricFields();
    const metricHeaders = metricFields.map(field => this.getMetricFieldDisplayName(field));
    const displayRows = this.buildBatchDisplayRows?.(this.state.batchQueryRows || [], metricFields) || (this.state.batchQueryRows || []);
    const targetTable = this.buildBatchTargetTableModel?.(displayRows);
    const ths = [
        '<th>项目名称</th>',
        ...(targetTable ? targetTable.headers : metricHeaders).map(name => `<th class="metric">${this.escapeHtml(name)}</th>`)
    ].join('');
    const tableRows = targetTable?.rows || displayRows.map(row => {
        const values = row.error
            ? metricHeaders.map(() => '查询失败')
            : (row.loading ? metricHeaders.map(() => this.renderBatchLoadingCell()) : metricFields.map(field => {
                if (!this.isBatchRowMetricEnabled(row, field.key)) return '-';
                const displayText = this.formatBatchQueryValue(row.valuesByKey?.[field.key], row.formatsByKey?.[field.key]);
                return this.renderBatchMetricTrendCell?.(row, field, null, '', displayText, { enabled: true }) || displayText;
            }));
        return { name: row.name, nameHtml: this.renderBatchDisplayName?.(row), cells: values };
    });
    const trs = tableRows.map(row => {
        return `
            <tr>
                <td>${row.nameHtml || this.escapeHtml(row.name)}</td>
                ${row.cells.map(cell => this.renderBatchTableCell(cell)).join('')}
            </tr>
        `;
    }).join('');

    wrap.innerHTML = `
        <div class="yeji-batch-table-area">
            <div class="yeji-batch-table-wrap">
                <table class="yeji-table yeji-batch-table">
                    <thead><tr>${ths}</tr></thead>
                    <tbody>${trs}</tbody>
                </table>
            </div>
        </div>
        ${this.renderBatchQueryStatusBar()}
    `;
    this.bindBatchQueryStatusBar();
    this.bindBatchMergeRows?.();
    this.bindBatchTargetCellEditors?.();
    this.bindBatchTrendEntries?.();
    this.updateBatchQueryTitleMeta();
},

renderBatchTableCell(cell) {
    if (cell && typeof cell === 'object' && !Array.isArray(cell)) {
        const className = cell.className || 'metric num';
        const attrs = cell.attrs ? ` ${cell.attrs}` : '';
        const content = cell.html != null ? cell.html : this.escapeHtml(cell.text ?? '');
        return `<td class="${this.escapeHtml(className)}"${attrs}>${content}</td>`;
    }
    return `<td class="metric num">${this.escapeHtml(cell)}</td>`;
},

renderBatchLoadingCell() {
    return {
        className: 'metric num yeji-loading-cell',
        html: '<i class="fa-solid fa-spinner fa-spin"></i>'
    };
},

renderBatchQueryStatusBar() {
    return `
        <div class="yeji-batch-status">
            ${this.renderBatchTargetPicker?.() || '<span></span>'}
            <div class="yeji-batch-actions">
                <button type="button" id="yeji-batch-target" class="yeji-batch-icon-btn" title="上传目标">
                    <i class="fa-solid fa-upload"></i>
                </button>
                <button type="button" id="yeji-batch-download" class="yeji-batch-icon-btn" title="下载Excel" ${this.canDownloadBatchQuery() ? '' : 'disabled'}>
                    <i class="fa-solid fa-download"></i>
                </button>
                <button type="button" id="yeji-batch-refresh" class="yeji-batch-icon-btn" title="刷新" ${this.state.batchQueryLoading ? 'disabled' : ''}>
                    <i class="fa-solid ${this.state.batchQueryLoading ? 'fa-spinner fa-spin' : 'fa-rotate-right'}"></i>
                </button>
            </div>
        </div>
    `;
},

bindBatchQueryStatusBar() {
    this.bindBatchTargetPicker?.();
    document.getElementById('yeji-batch-target')?.addEventListener('click', () => {
        this.openBatchTargetModal?.();
    });
    document.getElementById('yeji-batch-refresh')?.addEventListener('click', () => {
        this.runBatchTemplateQuery({ forceRefresh: true });
    });
    document.getElementById('yeji-batch-download')?.addEventListener('click', () => {
        this.downloadBatchQueryExcel();
    });
},

updateBatchQueryTitleMeta() {
    const el = document.getElementById('yeji-batch-title-meta');
    if (!el) return;
    el.textContent = this.getBatchQueryDateText();
},

formatBatchQueryValue(value, format) {
    if (window.YejiPlcxGongju?.formatDisplayValue) {
        return window.YejiPlcxGongju.formatDisplayValue(value, format, this.formatMetric.bind(this)) || '-';
    }
    return this.formatMetric(value, format) || '-';
},

canDownloadBatchQuery() {
    return !this.state.batchQueryLoading && (this.state.batchQueryRows || []).some(row => !row.loading && !row.error);
},

async downloadBatchQueryExcel() {
    try {
        const rows = (this.state.batchQueryRows || []).filter(row => !row.loading && !row.error);
        if (!rows.length) {
            this._showToast('暂无可下载的 BI 汇总查询数据。', 'warning');
            return;
        }
        const metricFields = this.getBatchDisplayMetricFields?.() || this.getBatchQueryMetricFields();
        const exportRows = (this.buildBatchDisplayRows?.(rows, metricFields) || rows).filter(row => !row.loading && !row.error);
        const headers = metricFields.map(field => this.getMetricFieldDisplayName(field));
        if (!window.YejiPlcxGongju?.downloadExcel) throw new Error('BI 汇总查询导出模块未加载。');
        const targetExport = this.buildBatchTargetExportModel?.(exportRows);
        if (targetExport) {
            await window.YejiPlcxGongju.downloadExcel({
                exportRows: targetExport.rows,
                headers: targetExport.headers,
                filename: window.YejiPlcxGongju.makeFilename('BI汇总查询')
            });
        } else {
            await window.YejiPlcxGongju.downloadExcel({
                exportRows: this.buildBatchQueryExportRows(exportRows, metricFields),
                headers: ['项目名称', ...headers],
                filename: window.YejiPlcxGongju.makeFilename('BI汇总查询')
            });
        }
    } catch (error) {
        console.error('[yeji] BI汇总查询导出失败', error);
        this._showToast(error.message || 'BI 汇总查询导出失败。', 'error');
    }
},

buildBatchQueryExportRows(rows = [], metricFields = []) {
    return (rows || []).map(row => {
        const data = { 项目名称: row.name || '' };
        metricFields.forEach(field => {
            data[this.getMetricFieldDisplayName(field)] = this.isBatchRowMetricEnabled(row, field.key)
                ? (window.YejiPlcxGongju?.normalizeExportValue(row.valuesByKey?.[field.key]) ?? '')
                : '';
        });
        return data;
    });
},

getBatchQueryMetricFields() {
    return this.state.batchQueryMetricFields?.length
        ? this.state.batchQueryMetricFields
        : this.getBatchMetricFields();
},

isBatchRowMetricEnabled(row, metricKey) {
    return (row.metricFields || []).some(field => field.key === metricKey);
},

getBatchQueryDateText() {
    return window.YejiPlcxMbGuize?.formatTitleMeta(
        this.getBatchTargetRuntime?.(),
        this.getBatchQueryDateRanges()
    ) || '| 时间进度：- | 未选择出库日期或支付日期';
},

getBatchQueryDateRanges() {
    return this.getVisibleFilterSelectors()
        .filter(selector => ['出库日期', '支付日期'].includes(selector.name))
        .map(selector => {
            const range = (this.state.filterValues[selector.cdId]?.range || []).filter(Boolean);
            return range.length === 2 ? { name: selector.name, range } : null;
        })
        .filter(Boolean);
},
};

window.YejiPlcxYewu = YejiPlcxYewu;
