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
    const sourceRows = rows || [];
    const grouped = new Map();
    sourceRows.forEach(row => {
        const parsed = window.YejiPlcxHbGuize.parseTemplateName(row.name || '');
        if (!parsed.mergeable || !parsed.base) return;
        if (!grouped.has(parsed.base)) grouped.set(parsed.base, []);
        grouped.get(parsed.base).push(row);
    });

    const mergeableBases = new Set(
        Array.from(grouped.entries())
            .filter(([, items]) => items.length > 1)
            .map(([base]) => base)
    );
    const emitted = new Set();
    const result = [];

    sourceRows.forEach(row => {
        const parsed = window.YejiPlcxHbGuize.parseTemplateName(row.name || '');
        if (!mergeableBases.has(parsed.base)) {
            result.push(this.decorateBatchDisplayRow(row, { type: 'single' }));
            return;
        }
        if (emitted.has(parsed.base)) return;
        emitted.add(parsed.base);
        const children = grouped.get(parsed.base) || [];
        const merged = this.buildMergedBatchRow(parsed.base, children, metricFields);
        result.push(merged);
        if (options.includeChildren || this.isBatchGroupRowExpanded(merged.groupKey)) {
            children.forEach(child => {
                result.push(this.decorateBatchDisplayRow(child, {
                    type: 'child',
                    parentKey: merged.groupKey
                }));
            });
        }
    });

    return this.buildBatchFormulaRows?.(result, options) || result;
},

decorateBatchDisplayRow(row, extra = {}) {
    return {
        ...row,
        displayType: extra.type || row.displayType || 'single',
        parentKey: extra.parentKey || row.parentKey || '',
        rawRows: row.rawRows || [row]
    };
},

buildMergedBatchRow(baseName, children = [], metricFields = []) {
    const queryFields = this.getBatchQueryMetricFields();
    const valuesByKey = {};
    const formatsByKey = {};
    queryFields.forEach(field => {
        valuesByKey[field.key] = window.YejiPlcxHbGuize.aggregateField(
            children,
            field,
            queryFields,
            item => this.getMetricFieldDisplayName(item)
        );
        formatsByKey[field.key] = children.find(row => row.formatsByKey?.[field.key])?.formatsByKey?.[field.key]
            || field.fieldFormat?.numberFormat
            || null;
    });

    const groupKey = `merge:${baseName}`;
    return {
        key: groupKey,
        name: baseName,
        displayType: 'merged',
        groupKey,
        rawRows: children,
        metricFields,
        loading: children.some(row => row.loading),
        error: children.every(row => row.error),
        valuesByKey,
        formatsByKey
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
    if (row.displayType === 'merged') {
        const expanded = this.isBatchGroupRowExpanded(row.groupKey);
        return `<button type="button" class="yeji-batch-merge-toggle" data-group-key="${this.escapeHtml(row.groupKey)}" title="查看原始记录">
            <span>${this.escapeHtml(row.name || '')}</span>
            <i class="fa-solid fa-caret-${expanded ? 'up' : 'down'}"></i>
        </button>`;
    }
    if (row.displayType === 'formula') {
        const tip = row.formulaError ? this.escapeHtml(row.formulaError) : '公式计算行';
        if (!row.childRows?.length) {
            return `<span class="yeji-batch-formula-name" title="${tip}">${this.escapeHtml(row.name || '')} <i class="fa-solid fa-square-root-variable" style="font-size:11px;opacity:.55;"></i></span>`;
        }
        const expanded = this.isBatchGroupRowExpanded(row.groupKey);
        return `<button type="button" class="yeji-batch-merge-toggle" data-group-key="${this.escapeHtml(row.groupKey)}" title="查看参与行">
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
    // 公式行：目标按公式树派生（对参与行目标做优先级折叠，率目标按百分点口径）
    if (row.displayType === 'formula') {
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
