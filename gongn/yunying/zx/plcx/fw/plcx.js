// BI batch query dynamic service shell.
const YejiPlcxFwPlcxYewu = {
async prepareBatchQueryInput(params = {}, options = {}) {
    await this.loadUltraMetadata();
    await this.ensureBatchTargetsLoaded?.();
    const templates = await this.resolveBatchTemplates(params, options);
    if (!templates.length) throw new Error('没有匹配到可查询模板。');

    const dateValues = this.resolveBatchDateValues(params, options);
    const displayMetricFields = this.resolveBatchDisplayMetricFields(params);
    const queryPlans = this.buildBatchQueryPlans(templates, displayMetricFields);
    const metricFields = this.getBatchPlanMetricUnion(queryPlans);
    const fieldConfig = this.getBatchQueryFieldConfig(metricFields);
    const targetRange = this.resolveBatchTargetRange(params, dateValues);
    const dynamicFilterValues = this.resolveBatchDynamicFilterValues(params);
    const dynamicExcludeMode = this.resolveBatchDynamicExcludeMode(params);

    return {
        templates,
        dateValues,
        dynamicFilterValues,
        dynamicExcludeMode,
        displayMetricFields,
        metricFields,
        fieldConfig,
        queryPlans,
        targetRange,
        includeChildren: params.includeChildren !== false
    };
},

async runBatchQueryService(params = {}, options = {}) {
    const input = await this.prepareBatchQueryInput(params, options);
    const rows = await this.queryBatchRowsForInput(input);
    return this.buildBatchQueryServiceResult(input, rows);
},

async resolveBatchTemplates(params = {}, options = {}) {
    const source = Array.isArray(options.templates)
        ? options.templates
        : await this.loadTemplates({ force: options.forceTemplates !== false });
    const keySet = new Set(window.YejiPlcxFwGuize.normalizeNames([
        ...window.YejiPlcxFwGuize.toArray(params.templateKey),
        ...window.YejiPlcxFwGuize.toArray(params.templateKeys)
    ]));
    const nameSet = new Set(window.YejiPlcxFwGuize.normalizeNames([
        ...window.YejiPlcxFwGuize.toArray(params.templateName),
        ...window.YejiPlcxFwGuize.toArray(params.templateNames)
    ]));
    if (!keySet.size && !nameSet.size) return this.clonePlain(source || []);
    return this.clonePlain((source || []).filter(tpl =>
        keySet.has(tpl._key || '') || nameSet.has(tpl.name || '')
    ));
},

makeSelectorLookup() {
    const map = new Map();
    (this.getVisibleFilterSelectors?.() || []).forEach(selector => {
        if (selector.cdId) map.set(selector.cdId, selector);
        if (selector.name) map.set(selector.name, selector);
        if (selector.name === '省份-城市-区') map.set('区域', selector);
    });
    return map;
},

resolveBatchDateValues(params = {}, options = {}) {
    const selectorMap = this.makeSelectorLookup();
    const base = options.inheritFilters === false
        ? {}
        : this.clonePlain(options.dateValues || this.getCurrentDateFilterValues());
    const filters = params.filters && typeof params.filters === 'object' ? params.filters : {};

    Object.entries(filters).forEach(([key, value]) => {
        const selector = selectorMap.get(String(key || '').trim());
        if (!selector?.cdId) throw new Error(`不支持的筛选字段：${key}`);
        base[selector.cdId] = window.YejiPlcxFwGuize.normalizeFilterValue(selector, value);
    });

    if (params.startDate || params.endDate) {
        const range = window.YejiPlcxFwGuize.validateDateRange(params.startDate, params.endDate);
        const dateField = String(params.dateField || window.YejiPlcxFwGuize.defaultDateField).trim();
        const selector = selectorMap.get(dateField);
        if (!selector?.cdId || !['出库日期', '支付日期'].includes(selector.name)) {
            throw new Error(`不支持的日期字段：${dateField || '-'}`);
        }
        base[selector.cdId] = { range: [range.startDate, range.endDate], macroName: '' };
    }

    return base;
},

resolveBatchDisplayMetricFields(params = {}) {
    const names = window.YejiPlcxFwGuize.normalizeNames(params.metricFields);
    if (!names.length) return this.getBatchMetricFields();
    const fields = names.map(name => this.resolveBatchMetricField(name)).filter(Boolean);
    const missing = names.filter(name => !fields.some(field => this.getMetricFieldDisplayName(field) === name || field.key === name));
    if (missing.length) throw new Error(`不支持的聚合字段：${missing.join('、')}`);
    return this.uniquePlanFields(fields);
},

resolveBatchMetricField(name = '') {
    const text = String(name || '').trim();
    if (!text) return null;
    const allFields = [
        ...(this.state.availableMetricFields || []),
        ...(this.ultra.metricFields || []),
        ...(window.YejiPzShuju?.metricFields || [])
    ];
    return allFields.find(field => field?.key === text)
        || this.findBatchMetricFieldByDisplayName?.(text, allFields)
        || null;
},

resolveBatchDynamicFilterValues(params = {}) {
    const selectorMap = this.makeSelectorLookup();
    const output = {};
    const filters = params.filters && typeof params.filters === 'object' ? params.filters : {};
    Object.entries(filters).forEach(([key, value]) => {
        const selector = selectorMap.get(String(key || '').trim());
        if (!selector?.cdId) throw new Error(`不支持的筛选字段：${key}`);
        output[selector.cdId] = window.YejiPlcxFwGuize.normalizeFilterValue(selector, value);
    });
    if (params.startDate || params.endDate) {
        const range = window.YejiPlcxFwGuize.validateDateRange(params.startDate, params.endDate);
        const dateField = String(params.dateField || window.YejiPlcxFwGuize.defaultDateField).trim();
        const selector = selectorMap.get(dateField);
        if (!selector?.cdId || !['出库日期', '支付日期'].includes(selector.name)) {
            throw new Error(`不支持的日期字段：${dateField || '-'}`);
        }
        output[selector.cdId] = { range: [range.startDate, range.endDate], macroName: '' };
    }
    return output;
},

resolveBatchDynamicExcludeMode(params = {}) {
    return window.YejiPlcxFwGuize.normalizeExcludeMode(params.excludeMode || {}, this.makeSelectorLookup());
},

resolveBatchTargetRange(params = {}, dateValues = null) {
    const ranges = this.getBatchTargetRanges?.() || [];
    const targetKey = String(params.targetKey || '').trim();
    if (targetKey) {
        const target = ranges.find(range => range.key === targetKey);
        if (!target) throw new Error(`未找到目标范围：${targetKey}`);
        return target;
    }
    if (params.autoTarget === false) return null;
    const info = this.getBatchTargetInfoFromDateValues(dateValues);
    if (!info) return null;
    return window.YejiPlcxMbGuize?.pickContainingRange(ranges, [info.startDate, info.endDate]) || null;
},

getBatchTargetInfoFromDateValues(dateValues = {}) {
    const selectors = this.getVisibleFilterSelectors?.() || [];
    const items = selectors
        .filter(selector => ['出库日期', '支付日期'].includes(selector.name))
        .map(selector => {
            const range = (dateValues?.[selector.cdId]?.range || []).filter(Boolean);
            return range.length === 2 ? { selector, name: selector.name, range } : null;
        })
        .filter(Boolean);
    const primary = window.YejiPlcxMbGuize?.pickPrimaryDateItem(items);
    if (!primary?.selector?.cdId) return null;
    const startDate = window.YejiPlcxMbGuize.normalizeDate(primary.range[0]);
    const endDate = window.YejiPlcxMbGuize.normalizeDate(primary.range[1]);
    return startDate && endDate ? { startDate, endDate, sourceName: primary.name, selectorId: primary.selector.cdId } : null;
},

async queryBatchRowsForInput(input = {}) {
    const rows = (input.templates || []).map(tpl => ({
        key: tpl._key,
        name: tpl.name || '未命名模板',
        metricFields: input.queryPlans.get(tpl._key)?.metricFields || input.metricFields,
        queryPlan: input.queryPlans.get(tpl._key) || { rowFields: [], metricFields: input.metricFields },
        loading: true,
        valuesByKey: {},
        formatsByKey: {}
    }));
    const rowMap = new Map(rows.map(row => [row.key, row]));
    let cursor = 0;
    const concurrency = Math.min(this.getBatchQueryConcurrency?.() || 31, input.templates.length);
    const workers = Array.from({ length: concurrency }, async () => {
        while (true) {
            const tpl = input.templates[cursor++];
            if (!tpl) return;
            const row = rowMap.get(tpl._key);
            await this.queryBatchRowForInput(tpl, row, input);
        }
    });
    await Promise.all(workers);
    return rows;
},

async queryBatchRowForInput(tpl, row, input = {}) {
    if (!row) return;
    try {
        const context = this.buildBatchTemplateQueryContext(tpl, input.dateValues);
        context.filterValues = {
            ...(context.filterValues || {}),
            ...(input.dynamicFilterValues || {})
        };
        context.excludeMode = {
            ...(context.excludeMode || {}),
            ...(input.dynamicExcludeMode || {})
        };
        context.queryPlan = this.clonePlain(row.queryPlan || { rowFields: [], metricFields: input.metricFields || [] });
        context.fieldConfig = this.clonePlain(input.fieldConfig || context.fieldConfig || {});
        let body = this.buildUltraRequestBody({ context, offset: 0, limit: 1 });
        if (this.findBatchLargeInFilter(body)) {
            const displayFields = context.queryPlan.displayMetricFields?.length
                ? context.queryPlan.displayMetricFields
                : (row.metricFields || context.queryPlan.metricFields || []);
            context.queryPlan = {
                ...context.queryPlan,
                metricFields: this.getMetricsWithDependencies(displayFields)
            };
            context.fieldConfig = this.getBatchQueryFieldConfig(context.queryPlan.metricFields);
            body = this.buildUltraRequestBody({ context, offset: 0, limit: 1 });
        }
        const queryResult = await this.queryBatchBodyWithLargeInFallback(body, context);
        const grandData = queryResult.grandData;
        row.valuesByKey = grandData.valuesByKey;
        row.formatsByKey = grandData.formatsByKey;
        row.loading = false;
    } catch (error) {
        console.error('[yeji] BI查询服务模板查询失败', tpl?.name, error);
        row.error = true;
        row.loading = false;
        row.valuesByKey = {};
        row.formatsByKey = {};
    }
},

getBatchLargeInChunkSize() {
    return 1000;
},

findBatchLargeInFilter(body = {}) {
    const chunkSize = this.getBatchLargeInChunkSize();
    return (body.filters || []).find(filter =>
        filter?.filterType === 'IN'
        && Array.isArray(filter.filterValue)
        && filter.filterValue.length > chunkSize
    ) || null;
},

uniqueBatchFilterValues(values = []) {
    const seen = new Set();
    return (values || []).filter(value => {
        const key = String(value ?? '');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
},

buildBatchLargeInChunkBodies(body = {}, largeFilter = null) {
    const chunkSize = this.getBatchLargeInChunkSize();
    const values = this.uniqueBatchFilterValues(largeFilter?.filterValue || []);
    const chunks = [];
    for (let index = 0; index < values.length; index += chunkSize) {
        const chunkValues = values.slice(index, index + chunkSize);
        const chunkBody = this.clonePlain(body);
        const chunkFilter = (chunkBody.filters || []).find(filter =>
            filter.sourceCdId === largeFilter.sourceCdId
            && filter.fdId === largeFilter.fdId
            && filter.name === largeFilter.name
        );
        if (!chunkFilter) continue;
        chunkFilter.filterValue = chunkValues;
        chunkFilter.displayValue = chunkValues;
        chunkBody.taskRequestId = this.makeTaskId();
        chunks.push(chunkBody);
    }
    return chunks;
},

async queryBatchBodyWithLargeInFallback(body = {}, context = {}) {
    const largeFilter = this.findBatchLargeInFilter(body);
    if (!largeFilter) {
        const json = await YejiGongju._post(`/api/card/${this.ultra.cardId}/data`, body);
        return {
            grandData: this.extractGrandMetricValues(json, context)
        };
    }

    const chunkBodies = this.buildBatchLargeInChunkBodies(body, largeFilter);
    if (chunkBodies.length <= 1) {
        const json = await YejiGongju._post(`/api/card/${this.ultra.cardId}/data`, body);
        return {
            grandData: this.extractGrandMetricValues(json, context)
        };
    }

    const chunkRows = await this.queryBatchLargeInChunks(chunkBodies, context);

    return {
        grandData: this.aggregateBatchChunkGrandData(chunkRows, context)
    };
},

async queryBatchLargeInChunks(chunkBodies = [], context = {}) {
    return Promise.all(chunkBodies.map(async chunkBody => {
        const json = await YejiGongju._post(`/api/card/${this.ultra.cardId}/data`, chunkBody);
        const grandData = this.extractGrandMetricValues(json, context);
        return {
            valuesByKey: grandData.valuesByKey,
            formatsByKey: grandData.formatsByKey
        };
    }));
},

aggregateBatchChunkGrandData(chunkRows = [], context = {}) {
    const fields = this.getContextMetricFields(context);
    const valuesByKey = {};
    const formatsByKey = {};
    fields.forEach(field => {
        valuesByKey[field.key] = window.YejiPlcxHbGuize.aggregateField(
            chunkRows,
            field,
            fields,
            item => this.getMetricFieldDisplayName(item)
        );
        formatsByKey[field.key] = chunkRows.find(row => row.formatsByKey?.[field.key])?.formatsByKey?.[field.key]
            || field.fieldFormat?.numberFormat
            || null;
    });
    return { valuesByKey, formatsByKey };
},

buildBatchQueryServiceResult(input = {}, rows = []) {
    const state = {
        ...this.state,
        batchQueryRows: rows,
        batchQueryTemplateSnapshot: input.templates,
        batchQueryMetricFields: input.metricFields,
        batchQueryDisplayMetricFields: input.displayMetricFields,
        batchQueryFieldConfig: input.fieldConfig,
        batchQueryDateValues: input.dateValues,
        batchQueryActiveTargetKey: input.targetRange?.key || ''
    };
    const appView = {
        ...this,
        state,
        getActiveBatchTargetRange: () => input.targetRange || null,
        getBatchQueryDateRanges: () => (this.getVisibleFilterSelectors?.() || [])
            .filter(selector => ['出库日期', '支付日期'].includes(selector.name))
            .map(selector => {
                const range = (input.dateValues?.[selector.cdId]?.range || []).filter(Boolean);
                return range.length === 2 ? { name: selector.name, range } : null;
            })
            .filter(Boolean)
    };
    const snapshot = window.YejiPlcxAiGuize?.buildSnapshot?.(appView, { includeChildren: input.includeChildren }) || null;
    return {
        input,
        rows,
        snapshot
    };
},

applyBatchQueryServiceResult(result = {}) {
    const input = result.input || {};
    this.state.batchQueryRows = this.clonePlain(result.rows || []);
    this.state.batchQueryRowMap = new Map(this.state.batchQueryRows.map(row => [row.key, row]));
    this.state.batchQueryMetricFields = this.clonePlain(input.metricFields || []);
    this.state.batchQueryDisplayMetricFields = this.clonePlain(input.displayMetricFields || []);
    this.state.batchQueryFieldConfig = this.clonePlain(input.fieldConfig || {});
    this.state.batchQueryDateValues = this.clonePlain(input.dateValues || {});
    this.state.batchQueryTemplateSnapshot = this.clonePlain(input.templates || []);
    this.state.batchQueryActiveTargetKey = input.targetRange?.key || this.state.batchQueryActiveTargetKey || '';
}
};

window.YejiPlcxFwPlcxYewu = YejiPlcxFwPlcxYewu;
