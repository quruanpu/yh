// BI summary merge business: display rows, expansion, and merged targets.
const YejiPlcxHbYewu = {
getBatchDisplayMetricFields() {
    return this.state.batchQueryDisplayMetricFields?.length
        ? this.state.batchQueryDisplayMetricFields
        : this.getBatchMetricFields();
},

findBatchRowFieldByDisplayName(name) {
    const allFields = [
        ...(this.state.availableRowFields || []),
        ...(this.ultra.rowFields || []),
        ...(window.YejiPzShuju?.rowFields || [])
    ];
    return this.findBatchFieldByDisplayName(allFields, name, field => this.getRowFieldDisplayName(field));
},

findBatchMetricFieldByDisplayName(name, fields = null) {
    const allFields = fields || [
        ...(this.state.availableMetricFields || []),
        ...(this.ultra.metricFields || []),
        ...(window.YejiPzShuju?.metricFields || [])
    ];
    return this.findBatchFieldByDisplayName(allFields, name, field => this.getMetricFieldDisplayName(field));
},

findBatchFieldByDisplayName(fields = [], name, getDisplayName) {
    const normalize = value => window.YejiPlcxHbGuize?.normalizeName(value) || String(value || '').replace(/\s+/g, '').toLowerCase();
    const wanted = normalize(name);
    return (fields || []).find(field => {
        const names = [
            typeof getDisplayName === 'function' ? getDisplayName(field) : '',
            field?.name,
            field?.alias,
            field?.title,
            field?.originTitle
        ];
        return names.some(item => normalize(item) === wanted);
    }) || null;
},

uniqueBatchFields(fields = []) {
    const map = new Map();
    (fields || []).forEach(field => {
        if (field?.key && !map.has(field.key)) map.set(field.key, field);
    });
    return [...map.values()];
},

buildBatchDisplayRows(rows = this.state.batchQueryRows || [], metricFields = this.getBatchDisplayMetricFields(), options = {}) {
    // 模板行全部为原始行；计算行（合并行）由公式钩子置于顶部
    const sourceRows = (rows || []).map(row => this.decorateBatchDisplayRow(row, { type: 'single' }));
    return this.buildBatchFormulaRows?.(sourceRows, options) || sourceRows;
},

decorateBatchDisplayRow(row, extra = {}) {
    return {
        ...row,
        displayType: extra.type || row.displayType || 'single',
        parentKey: extra.parentKey || row.parentKey || '',
        rawRows: row.rawRows || [row]
    };
},

isBatchGroupRowExpanded(groupKey) {
    return !!this.state.batchGroupOpen?.[groupKey];
},

toggleBatchGroupRow(groupKey) {
    if (!groupKey) return;
    this.state.batchGroupOpen = this.state.batchGroupOpen || {};
    this.state.batchGroupOpen[groupKey] = !this.state.batchGroupOpen[groupKey];
    this.renderBatchQueryBody();
},

renderBatchDisplayName(row = {}) {
    // 计算行（合并行）：可展开折叠，展开时参与项紧随其后
    if (row.displayType === 'merged') {
        if (!row.childRows?.length) {
            const tip = row.formulaError ? this.escapeHtml(row.formulaError) : '计算行';
            return `<span title="${tip}">${this.escapeHtml(row.name || '')} <i class="fa-solid fa-square-root-variable" style="font-size:11px;opacity:.55;"></i></span>`;
        }
        const expanded = this.isBatchGroupRowExpanded(row.groupKey);
        return `<button type="button" class="yeji-batch-merge-toggle" data-group-key="${this.escapeHtml(row.groupKey)}" title="查看参与项">
            <span>${this.escapeHtml(row.name || '')}</span>
            <i class="fa-solid fa-square-root-variable" style="font-size:11px;opacity:.55;"></i>
            <i class="fa-solid fa-caret-${expanded ? 'up' : 'down'}"></i>
        </button>`;
    }
    const cls = row.displayType === 'child' ? 'yeji-batch-child-name' : '';
    return `<span class="${cls}">${this.escapeHtml(row.name || '')}</span>`;
},

bindBatchGroupRows() {
    document.querySelectorAll('[data-group-key]').forEach(button => {
        button.addEventListener('click', event => {
            event.stopPropagation();
            this.toggleBatchGroupRow(button.dataset.groupKey);
        });
    });
},

getBatchTargetValueForDisplayRow(row, metricName, targetRange) {
    if (!row) return '';
    // 计算行（合并行）：目标按公式派生（对参与项目标做公式折叠，率目标按百分点口径）
    if (row.displayType === 'merged') {
        if (!row.formulaTree?.length || !window.YejiPlcxGsGuize?.evalFormulaTargets) return '';
        return window.YejiPlcxGsGuize.evalFormulaTargets(row.formulaTree, targetRange?.items || {}, metricName);
    }
    return targetRange?.items?.[row.key]?.targets?.[metricName] ?? '';
},

findMetricFieldByDisplayName(metricName) {
    return (this.getBatchQueryMetricFields() || []).find(field => this.getMetricFieldDisplayName(field) === metricName)
        || (this.getBatchDisplayMetricFields() || []).find(field => this.getMetricFieldDisplayName(field) === metricName)
        || { key: metricName, name: metricName, alias: metricName };
}
};

window.YejiPlcxHbYewu = YejiPlcxHbYewu;
