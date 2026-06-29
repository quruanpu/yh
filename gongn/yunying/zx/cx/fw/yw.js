// BI main query service shell: shared by UI default query and AI dynamic query.
const YejiCxFwYewu = {
async runMainQueryService(params = {}, options = {}) {
    await this.loadUltraMetadata();
    const context = await this.buildMainQueryContext(params, options);
    const json = await this.requestMainQueryContext(context);
    return this.buildMainQueryServiceResult(json, context);
},

async buildMainQueryContext(params = {}, options = {}) {
    const limit = window.YejiCxFwGuize.normalizePageSize(params.pageSize, options.pageSize || this.ultra?.limit || 20);
    const page = window.YejiCxFwGuize.normalizePage(params.page, options.page || 1);
    const inheritCurrent = options.inheritCurrent === true || params.inheritCurrent === true;
    const template = await this.resolveMainQueryTemplate(params);
    const context = inheritCurrent
        ? this.buildCurrentMainQueryContext()
        : this.buildDefaultMainQueryContext();

    context.offset = (page - 1) * limit;
    context.limit = limit;
    context.template = template ? {
        key: template._key || '',
        name: template.name || '未命名模板'
    } : null;

    if (template) this.applyMainTemplateContext(context, template);
    this.applyMainDynamicFilters(context, params.filters || {});
    this.applyMainDynamicExcludeMode(context, params.excludeMode || {});
    this.applyMainDynamicFields(context, params.rowFields || null, params.metricFields || null);
    this.applyMainDynamicSort(context, params.sort || null);
    return context;
},

buildCurrentMainQueryContext() {
    return {
        ...this.state,
        filterValues: this.clonePlain(this.state.filterValues || {}),
        excludeMode: this.clonePlain(this.state.excludeMode || {}),
        quickSearchSelectorId: this.state.quickSearchSelectorId || '',
        quickSearchValue: this.state.quickSearchValue || '',
        fieldConfig: this.clonePlain(this.state.fieldConfig || {}),
        mainSort: this.clonePlain(this.state.mainSort || null)
    };
},

buildDefaultMainQueryContext() {
    const context = {
        ...this.state,
        filterValues: {},
        excludeMode: {},
        quickSearchSelectorId: '',
        quickSearchValue: '',
        fieldConfig: this.getDefaultFieldConfig(),
        mainSort: this.clonePlain(this.state.mainSort || null)
    };
    const dateSelector = (this.getVisibleFilterSelectors?.() || this.state.selectors || [])
        .find(selector => selector.cdId === this.ultra.dateFilter.sourceCdId || selector.name === window.YejiCxFwGuize.defaultDateField);
    if (dateSelector?.cdId) {
        context.filterValues[dateSelector.cdId] = {
            macroName: '本月到昨天',
            range: this.getDefaultDateRange()
        };
    }
    return context;
},

async resolveMainQueryTemplate(params = {}) {
    const key = String(params.templateKey || '').trim();
    const name = String(params.templateName || '').trim();
    if (!key && !name) return null;
    if (!this.state.templatesLoaded && this.loadTemplates) await this.loadTemplates();
    const templates = this.state.templates || [];
    const template = templates.find(tpl => key && tpl._key === key)
        || templates.find(tpl => name && tpl.name === name)
        || null;
    if (!template) throw new Error(`未找到对应模板：${key || name}。`);
    return template;
},

applyMainTemplateContext(context, tpl = {}) {
    const dateSelectorIds = this.getTemplateDateSelectorIds?.() || new Set();
    const dateValues = {};
    dateSelectorIds.forEach(selectorId => {
        if (context.filterValues?.[selectorId]) dateValues[selectorId] = this.clonePlain(context.filterValues[selectorId]);
    });

    context.filterValues = { ...dateValues };
    Object.entries(tpl.filters || {}).forEach(([selectorId, value]) => {
        if (!dateSelectorIds.has(selectorId)) context.filterValues[selectorId] = this.clonePlain(value);
    });
    context.excludeMode = {};
    Object.entries(tpl.excludeMode || {}).forEach(([selectorId, enabled]) => {
        if (enabled && !dateSelectorIds.has(selectorId)) context.excludeMode[selectorId] = true;
    });
    context.quickSearchSelectorId = tpl.quickSearch?.selectorId || '';
    context.quickSearchValue = tpl.quickSearch?.value || '';
},

makeMainSelectorLookup() {
    const map = new Map();
    (this.getVisibleFilterSelectors?.() || this.state.selectors || []).forEach(selector => {
        if (selector.cdId) map.set(selector.cdId, selector);
        if (selector.name) map.set(selector.name, selector);
        if (selector.name === '省份-城市-区') map.set('区域', selector);
    });
    return map;
},

applyMainDynamicFilters(context, filters = {}) {
    if (!filters || typeof filters !== 'object') return;
    const selectorMap = this.makeMainSelectorLookup();
    Object.entries(filters).forEach(([key, value]) => {
        const selector = selectorMap.get(String(key || '').trim());
        if (!selector?.cdId) throw new Error(`不支持的筛选字段：${key}`);
        context.filterValues[selector.cdId] = window.YejiCxFwGuize.normalizeFilterValue(selector, value);
        if (selector.cdId === context.quickSearchSelectorId) context.quickSearchValue = '';
    });
},

applyMainDynamicExcludeMode(context, excludeMode = {}) {
    if (!excludeMode || typeof excludeMode !== 'object') return;
    context.excludeMode = {
        ...(context.excludeMode || {}),
        ...window.YejiCxFwGuize.normalizeExcludeMode(excludeMode, this.makeMainSelectorLookup())
    };
},

applyMainDynamicFields(context, rowFields = null, metricFields = null) {
    const rowKeys = this.resolveMainFieldKeys(rowFields, this.state.availableRowFields || [], field => this.getRowFieldDisplayName(field), '查询字段');
    const metricKeys = this.resolveMainFieldKeys(metricFields, this.state.availableMetricFields || [], field => this.getMetricFieldDisplayName(field), '聚合字段');
    if (!rowKeys && !metricKeys) return;
    const current = this.getActiveFieldConfig(context);
    context.fieldConfig = this.normalizeFieldConfig({
        rowKeys: rowKeys || current.rowKeys,
        metricKeys: metricKeys || current.metricKeys
    });
},

resolveMainFieldKeys(names, fields = [], getName, label = '字段') {
    const values = window.YejiCxFwGuize.normalizeNames(names);
    if (!values.length) return null;
    const keys = values.map(name => {
        const field = this.findMainField(name, fields, getName);
        if (!field?.key) throw new Error(`不支持的${label}：${name}`);
        return field.key;
    });
    return keys;
},

findMainField(name = '', fields = [], getName) {
    const text = String(name || '').trim();
    return (fields || []).find(item => {
        const names = [
            item.key,
            item.name,
            item.alias,
            item.title,
            item.originTitle,
            getName(item)
        ].map(value => String(value || '').trim()).filter(Boolean);
        return names.includes(text);
    }) || null;
},

applyMainDynamicSort(context, sort = null) {
    if (!sort || typeof sort !== 'object') return;
    const order = sort.order === 'asc' ? 'asc' : sort.order === 'desc' ? 'desc' : '';
    const fieldText = String(sort.field || sort.fieldName || sort.fieldKey || '').trim();
    if (!order || !fieldText) throw new Error('排序必须传入 field 和 asc/desc。');
    const rowFields = this.getQueryRowFields(context) || [];
    const metricFields = this.getQueryMetricFields(context) || [];
    const rowMatch = this.findMainField(fieldText, rowFields, field => this.getRowFieldDisplayName(field));
    const metricMatch = this.findMainField(fieldText, metricFields, field => this.getMetricFieldDisplayName(field));
    const match = rowMatch || metricMatch;
    if (!match) throw new Error(`排序字段不在当前查询字段中：${fieldText}`);
    context.mainSort = {
        fieldKey: match.key || '',
        fieldName: (rowMatch ? this.getRowFieldDisplayName(match) : this.getMetricFieldDisplayName(match)) || fieldText,
        order
    };
},

async requestMainQueryContext(context = {}) {
    const body = this.buildUltraRequestBody({
        context,
        offset: context.offset,
        limit: context.limit
    });
    return YejiGongju._post(`/api/card/${this.ultra.cardId}/data`, body);
},

buildMainQueryServiceResult(json = {}, context = {}) {
    const cm = json?.response?.chartMain;
    if (!cm) {
        return {
            success: false,
            error: 'BI未返回 chartMain 数据。',
            raw: json,
            context
        };
    }
    const rowMeta = cm.row?.meta || [];
    const columnValues = cm.column?.values || [];
    const metricHeaders = this.normalizeMetricHeaders(columnValues);
    const formats = cm.column?.metricFieldFormat?.numberFormat || [];
    const rows = this.normalizeUltraRows(cm.row?.values || [], cm.data || []);
    const normalRows = rows.filter(row => !row.isGrandtotal);
    const grandRows = rows.filter(row => row.isGrandtotal);
    const aggregateRow = !rowMeta.length && !(cm.row?.values || []).length && normalRows.length ? normalRows[0] : null;
    const summaryRow = grandRows[0] || aggregateRow || null;
    return {
        success: true,
        raw: json,
        context,
        chartMain: cm,
        rowMeta,
        metricHeaders,
        formats,
        rows,
        normalRows,
        grandRows,
        page: Math.floor(context.offset / context.limit) + 1,
        pageSize: context.limit,
        sort: this.normalizeMainSort?.(context.mainSort) || null,
        template: context.template || null,
        totalCount: cm.count ?? 0,
        hasMoreData: !!cm.hasMoreData,
        summary: this.buildMainQuerySummary(summaryRow, metricHeaders, formats),
        tableRows: normalRows.map(row => this.buildMainQueryRow(row, rowMeta, metricHeaders, formats))
    };
},

buildMainQuerySummary(row, metricHeaders = [], formats = []) {
    if (!row) return null;
    const summary = {};
    metricHeaders.forEach((metric, index) => {
        const fmtIndex = metric?.fmt_idx ?? index;
        summary[this.getMetricFieldDisplayName(metric)] = this.formatMetric(row.metrics?.[index]?.v, formats[fmtIndex]) || '-';
    });
    return summary;
},

buildMainQueryRow(row, rowMeta = [], metricHeaders = [], formats = []) {
    const output = {};
    const dimensionHeaders = this.getDimensionHeaders(rowMeta);
    dimensionHeaders.forEach((meta, index) => {
        output[this.getRowFieldDisplayName(meta)] = row.dims?.[index]?.title ?? '';
    });
    metricHeaders.forEach((metric, index) => {
        const fmtIndex = metric?.fmt_idx ?? index;
        output[this.getMetricFieldDisplayName(metric)] = this.formatMetric(row.metrics?.[index]?.v, formats[fmtIndex]) || '-';
    });
    return output;
},

applyMainQueryServiceResult(result = {}) {
    const context = result.context || {};
    this.state.offset = Number(context.offset || 0);
    this.state.totalCount = result.totalCount ?? 0;
    this.state.hasMoreData = !!result.hasMoreData;
    this.state.mainSort = this.normalizeMainSort(context.mainSort) || this.state.mainSort;
    const summaryRow = result.grandRows?.[0]
        || (!result.rowMeta?.length && result.normalRows?.length ? result.normalRows[0] : null);
    this.state.summarySnapshot = summaryRow ? {
        grandRow: summaryRow,
        metricHeaders: result.metricHeaders || [],
        formats: result.formats || []
    } : null;
}
};

window.YejiCxFwYewu = YejiCxFwYewu;
