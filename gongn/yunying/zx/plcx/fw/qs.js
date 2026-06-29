// BI trend detail dynamic query service shell.
const YejiPlcxFwQushiYewu = {
async runTrendQueryService(params = {}, options = {}) {
    await this.loadUltraMetadata();
    await this.ensureBatchTargetsLoaded?.();
    const context = await this.buildTrendServiceContext(params, options);
    const rows = await this.queryTrendRowsForContext(context);
    const snapshot = window.YejiPlcxQsAiGuize?.buildSnapshot?.({ context, rows }) || null;
    return { context, rows, snapshot };
},

async queryTrendRowsForContext(context = {}) {
    const templates = context.templates || [];
    if (!templates.length) throw new Error('当前指标详解没有可查询模板。');
    if (!context.metric?.key) throw new Error('当前指标详解没有可查询字段。');

    const results = [];
    let cursor = 0;
    const concurrency = Math.min(this.getTrendConcurrency?.() || 31, templates.length);
    const workers = Array.from({ length: concurrency }, async () => {
        while (true) {
            const tpl = templates[cursor++];
            if (!tpl) return;
            const row = await this.queryTrendTemplateSeriesForContext(context, tpl);
            results.push(row);
        }
    });
    await Promise.all(workers);

    const isRate = this.isBatchTrendRateModel?.(context);
    if (!isRate) await window.YejiPlcxQsZfxGuize?.ensureReady?.();
    const rows = context.nodes.map(node => {
        const cumulativeRows = results.map(result => isRate
            ? this.buildBatchRateTrendCumulativeRow(context, node, result)
            : this.buildBatchTrendCumulativeRow(context, node, result));
        const dailyRows = results.map(result => isRate
            ? this.buildBatchRateTrendDailyRow(context, node, result)
            : this.buildBatchTrendDailyRow(context, node, result));
        return isRate
            ? this.buildTrendRateServiceRow(context, node, cumulativeRows, dailyRows)
            : this.buildTrendValueServiceRow(context, node, cumulativeRows, dailyRows);
    });
    return isRate
        ? this.decorateBatchRateTrendRows(rows, context)
        : this.decorateBatchTrendRows(rows, context);
},

async queryTrendTemplateSeriesForContext(context = {}, tpl = {}) {
    try {
        const dateValues = this.clonePlain(context.baseDateValues);
        dateValues[context.dateInfo.selectorId] = { range: context.dateInfo.range, macroName: '' };
        const queryContext = this.buildBatchTemplateQueryContext(tpl, dateValues);
        queryContext.queryPlan = this.clonePlain(context.queryPlan);
        const body = this.buildUltraRequestBody({ context: queryContext, offset: 0, limit: Math.max(1, context.nodes.length + 5) });
        const json = await YejiGongju._post(`/api/card/${this.ultra.cardId}/data`, body);
        return {
            key: tpl._key,
            name: tpl.name || '未命名模板',
            series: this.extractBatchTrendSeries(json, queryContext),
            formatsByKey: this.extractBatchTrendFormats(json, queryContext)
        };
    } catch (error) {
        console.error('[yeji] 指标详解服务模板查询失败', tpl.name, error);
        return this.makeEmptyBatchTrendTemplateRow(tpl);
    }
},

buildTrendValueServiceRow(context, node, rows = [], dailyRows = []) {
    const merged = (context.templates || []).length > 1;
    const actual = merged
        ? window.YejiPlcxHbGuize.aggregateField(rows, context.metric, context.metricFields, item => this.getMetricFieldDisplayName(item))
        : rows[0]?.valuesByKey?.[context.metric.key];
    const dailyActual = merged
        ? window.YejiPlcxHbGuize.aggregateField(dailyRows, context.metric, context.metricFields, item => this.getMetricFieldDisplayName(item))
        : dailyRows[0]?.valuesByKey?.[context.metric.key];
    const format = rows.find(row => row.formatsByKey?.[context.metric.key])?.formatsByKey?.[context.metric.key] || null;
    const displayFormat = format || context.metric?.fieldFormat?.numberFormat || null;
    const queryProgress = window.YejiPlcxQsGuize.calcQueryProgress(context.dateInfo.range[0], node.endDate, context.periodEnd);
    const achievement = window.YejiPlcxMbGongju?.calcAchievement
        ? window.YejiPlcxMbGongju.calcAchievement(actual, context.targetValue, context.metricName)
        : window.YejiPlcxQsZfxGuize.calcAchievement(actual, context.targetValue);
    return {
        ...node,
        loading: false,
        dailyActual,
        dailyActualText: this.formatBatchQueryValue(dailyActual, displayFormat),
        actual,
        actualText: this.formatBatchQueryValue(actual, displayFormat),
        displayFormat,
        targetText: window.YejiPlcxMbGongju.formatTargetValue(context.targetValue, value => this.formatBatchQueryValue(value, null), context.metricName),
        queryProgress,
        achievement
    };
},

buildTrendRateServiceRow(context, node, rows = [], dailyRows = []) {
    const deps = this.getBatchRateDependencyFields(context);
    const numeratorKey = deps.numerator?.key || '';
    const denominatorKey = deps.denominator?.key || '';
    const merged = (context.templates || []).length > 1;
    const sumValue = (items, key) => window.YejiPlcxHbGuize.sumRows(items, key);
    const cumNumerator = merged ? sumValue(rows, numeratorKey) : rows[0]?.valuesByKey?.[numeratorKey];
    const cumDenominator = merged ? sumValue(rows, denominatorKey) : rows[0]?.valuesByKey?.[denominatorKey];
    const dailyNumerator = merged ? sumValue(dailyRows, numeratorKey) : dailyRows[0]?.valuesByKey?.[numeratorKey];
    const dailyDenominator = merged ? sumValue(dailyRows, denominatorKey) : dailyRows[0]?.valuesByKey?.[denominatorKey];
    const actual = window.YejiPlcxQsLfxGuize.calcRate(cumNumerator, cumDenominator);
    const dailyActual = window.YejiPlcxQsLfxGuize.calcRate(dailyNumerator, dailyDenominator);
    const numeratorFormat = rows.find(row => row.formatsByKey?.[numeratorKey])?.formatsByKey?.[numeratorKey]
        || deps.numerator?.fieldFormat?.numberFormat
        || null;
    const denominatorFormat = rows.find(row => row.formatsByKey?.[denominatorKey])?.formatsByKey?.[denominatorKey]
        || deps.denominator?.fieldFormat?.numberFormat
        || null;
    const queryProgress = window.YejiPlcxQsGuize.calcQueryProgress(context.dateInfo.range[0], node.endDate, context.periodEnd);
    const targetRate = window.YejiPlcxQsLfxGuize.toTargetRate(context.targetValue);
    return {
        ...node,
        loading: false,
        dailyNumerator,
        dailyDenominator,
        cumNumerator,
        cumDenominator,
        dailyActual,
        actual,
        dailyActualText: window.YejiPlcxQsLfxGuize.formatPercent(dailyActual),
        actualText: window.YejiPlcxQsLfxGuize.formatPercent(actual),
        targetText: window.YejiPlcxQsLfxGuize.formatPercent(targetRate),
        dailyNumeratorText: this.formatBatchQueryValue(dailyNumerator, numeratorFormat),
        dailyDenominatorText: this.formatBatchQueryValue(dailyDenominator, denominatorFormat),
        cumNumeratorText: this.formatBatchQueryValue(cumNumerator, numeratorFormat),
        cumDenominatorText: this.formatBatchQueryValue(cumDenominator, denominatorFormat),
        queryProgress
    };
},

async buildTrendServiceContext(params = {}, options = {}) {
    const currentContext = this.state.batchTrendContext || null;
    const metricNameInput = String(params.metricField || params.metricName || params.metricKey || currentContext?.metricName || '').trim();
    if (!metricNameInput) throw new Error('指标详解必须指定指标字段，或先打开一个指标详解面板。');
    const hasTemplateInput = [
        params.templateKey,
        params.templateName,
        ...(window.YejiPlcxFwGuize.toArray(params.templateKeys)),
        ...(window.YejiPlcxFwGuize.toArray(params.templateNames))
    ].some(value => String(value || '').trim());
    const batchParams = {
        ...params,
        metricFields: [metricNameInput].filter(Boolean),
        includeChildren: true
    };
    if (currentContext && !hasTemplateInput) {
        batchParams.templateKeys = currentContext.rawKeys?.length
            ? this.clonePlain(currentContext.rawKeys)
            : (currentContext.templates || []).map(tpl => tpl._key).filter(Boolean);
    }
    if (currentContext && !batchParams.targetKey && currentContext.targetRangeKey) {
        batchParams.targetKey = currentContext.targetRangeKey;
    }
    const batchOptions = currentContext?.baseDateValues && !options.dateValues
        ? { ...options, dateValues: this.clonePlain(currentContext.baseDateValues) }
        : options;
    const batchInput = await this.prepareBatchQueryInput(batchParams, batchOptions);
    const metric = this.resolveBatchMetricField(metricNameInput) || this.findBatchTrendMetric('', metricNameInput);
    if (!metric?.key) throw new Error(`未找到指标字段：${metricNameInput || '-'}`);
    const displayName = this.getMetricFieldDisplayName(metric);
    const targetRange = batchInput.targetRange;

    const templates = batchInput.templates || [];
    const rowKey = templates.length === 1 ? templates[0]._key : `merge:${templates.map(tpl => tpl.name || '').join('+')}`;
    const rowName = templates.length === 1 ? (templates[0].name || '未命名模板') : templates.map(tpl => tpl.name || '未命名模板').join('+');
    const targetValue = this.resolveTrendTargetValue(targetRange, templates, displayName);

    const dateInfo = this.getBatchTargetInfoFromDateValues(batchInput.dateValues);
    if (!dateInfo) throw new Error('未找到指标详解日期范围。');
    const nodes = window.YejiPlcxQsGuize.buildNodes(dateInfo.startDate, dateInfo.endDate);
    if (!nodes.length) throw new Error('指标详解日期范围没有可用节点。');

    const rateMeta = window.YejiPlcxQsLfxGuize?.getRateMeta?.(displayName);
    const context = {
        rowKey,
        rowName,
        rawKeys: templates.map(tpl => tpl._key).filter(Boolean),
        templates,
        metric,
        metricName: displayName,
        trendModel: rateMeta ? 'rate' : 'value',
        rateMeta,
        targetValue,
        targetRangeKey: targetRange?.key || '',
        dateInfo: {
            selectorId: dateInfo.selectorId,
            name: dateInfo.sourceName,
            range: [dateInfo.startDate, dateInfo.endDate]
        },
        periodEnd: window.YejiPlcxQsGuize.getPeriodEnd(dateInfo.endDate),
        baseDateValues: this.clonePlain(batchInput.dateValues),
        fieldConfig: this.clonePlain(batchInput.fieldConfig),
        nodes
    };
    context.queryPlan = this.buildTrendQueryPlan(context);
    context.metricFields = this.clonePlain(context.queryPlan.metricFields || []);
    if (this.isBatchTrendRateModel?.(context)) {
        const deps = this.getBatchRateDependencyFields?.(context) || {};
        if (!deps.numerator || !deps.denominator) throw new Error('率字段缺少依赖字段或业务基数字段，无法分析趋势。');
    }
    return context;
},

resolveTrendTargetValue(targetRange, templates = [], metricName = '') {
    if (!targetRange || !metricName) return '';
    if (templates.length === 1) {
        return targetRange.items?.[templates[0]._key]?.targets?.[metricName] ?? '';
    }
    const rows = templates.map(tpl => ({
        key: tpl._key,
        name: tpl.name || '未命名模板',
        rawRows: [{ key: tpl._key, name: tpl.name || '未命名模板' }]
    }));
    const merged = this.buildBatchDisplayRows?.(rows, [this.findMetricFieldByDisplayName(metricName)], { includeChildren: false }) || rows;
    const row = merged.find(item => item.displayType === 'merged') || merged[0];
    return this.getBatchTargetValueForDisplayRow?.(row, metricName, targetRange) ?? '';
}
};

window.YejiPlcxFwQushiYewu = YejiPlcxFwQushiYewu;
