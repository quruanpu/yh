// Value trend analysis business: build cumulative rows and render value-model table.
const YejiPlcxQsZfxYewu = {
buildBatchTrendCumulativeRow(context, node, result = {}) {
    const valuesByKey = {};
    const metricFields = context.metricFields || [];
    const start = window.YejiPlcxMbGuize?.parseDate(context.dateInfo.range[0]);
    const end = window.YejiPlcxMbGuize?.parseDate(node.endDate);
    const dailyRows = [];
    (result.series || new Map()).forEach((dailyValues, dateText) => {
        const date = window.YejiPlcxMbGuize?.parseDate(dateText);
        if (!date || !start || !end || date < start || date > end) return;
        dailyRows.push({ valuesByKey: dailyValues });
    });
    metricFields.forEach(field => {
        valuesByKey[field.key] = window.YejiPlcxHbGuize.sumRows(dailyRows, field.key);
    });
    if (!Object.prototype.hasOwnProperty.call(valuesByKey, context.metric.key)) {
        valuesByKey[context.metric.key] = window.YejiPlcxHbGuize.aggregateField(
            [{ valuesByKey }],
            context.metric,
            metricFields,
            item => this.getMetricFieldDisplayName(item)
        );
    }
    return {
        key: result.key,
        name: result.name,
        valuesByKey,
        formatsByKey: result.formatsByKey || {}
    };
},

buildBatchTrendDailyRow(context, node, result = {}) {
    const dailyValues = (result.series || new Map()).get(node.endDate) || {};
    const valuesByKey = { ...dailyValues };
    if (!Object.prototype.hasOwnProperty.call(valuesByKey, context.metric.key)) {
        valuesByKey[context.metric.key] = window.YejiPlcxHbGuize.aggregateField(
            [{ valuesByKey }],
            context.metric,
            context.metricFields || [],
            item => this.getMetricFieldDisplayName(item)
        );
    }
    return {
        key: result.key,
        name: result.name,
        valuesByKey,
        formatsByKey: result.formatsByKey || {}
    };
},

finishBatchTrendNode(context, node, index, rows = [], dailyRows = []) {
    const merged = context.templates.length > 1;
    const actual = merged
        ? window.YejiPlcxHbGuize.aggregateField(
            rows,
            context.metric,
            context.metricFields,
            item => this.getMetricFieldDisplayName(item)
        )
        : rows[0]?.valuesByKey?.[context.metric.key];
    const dailyActual = merged
        ? window.YejiPlcxHbGuize.aggregateField(
            dailyRows,
            context.metric,
            context.metricFields,
            item => this.getMetricFieldDisplayName(item)
        )
        : dailyRows[0]?.valuesByKey?.[context.metric.key];
    const format = rows.find(row => row.formatsByKey?.[context.metric.key])?.formatsByKey?.[context.metric.key] || null;
    const displayFormat = format || context.metric?.fieldFormat?.numberFormat || null;
    const queryProgress = window.YejiPlcxQsGuize.calcQueryProgress(context.dateInfo.range[0], node.endDate, context.periodEnd);
    const achievement = window.YejiPlcxMbGongju?.calcAchievement
        ? window.YejiPlcxMbGongju.calcAchievement(actual, context.targetValue, context.metricName)
        : window.YejiPlcxQsZfxGuize.calcAchievement(actual, context.targetValue);
    this.state.batchTrendRows[index] = {
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
    this.state.batchTrendRows = this.decorateBatchTrendRows(this.state.batchTrendRows || [], context);
},

decorateBatchTrendRows(rows = [], context = this.state.batchTrendContext) {
    const decorated = window.YejiPlcxQsZfxGuize?.decorateRows
        ? window.YejiPlcxQsZfxGuize.decorateRows(rows || [], context)
        : (rows || []);
    return this.applyBatchTrendTargetAvailability?.(decorated, context, 'value') || decorated;
},

async runBatchTrendForecastEnhancement(context = this.state.batchTrendContext, batchSeq = this.state.batchTrendSeq) {
    if (!context || this.isBatchTrendRateModel?.(context) || !window.YejiPlcxQsZfxGuize?.buildHistoryReferenceRanges) return;
    const forecastSeq = (this.state.batchTrendForecastSeq || 0) + 1;
    this.state.batchTrendForecastSeq = forecastSeq;
    try {
        await window.YejiPlcxQsZfxGuize.ensureReady?.();
        if (batchSeq !== this.state.batchTrendSeq || forecastSeq !== this.state.batchTrendForecastSeq) return;
        const references = window.YejiPlcxQsZfxGuize.buildHistoryReferenceRanges(context);
        if (!references.length) return;
        this.state.batchTrendForecastChecking = true;
        this.renderBatchTrendModal();
        context.currentTrendSeries = window.YejiPlcxQsZfxGuize.buildStage3Series(this.state.batchTrendRows || [], context);
        const historyReferences = (await Promise.all(references.map(reference => (
            this.queryBatchTrendHistoryReference(context, reference, batchSeq)
        )))).filter(Boolean);
        if (batchSeq !== this.state.batchTrendSeq || forecastSeq !== this.state.batchTrendForecastSeq) return;
        if (!historyReferences.length) return;

        context.historyTrendReferences = historyReferences;
        this.state.batchTrendContext = context;
        const rows = (this.state.batchTrendRows || []).map(row => {
            if (!row || row.loading) return row;
            const {
                diagnosisScore,
                businessLevel,
                mainReason,
                actionSuggestion,
                decisionConfidence,
                ...baseRow
            } = row;
            return baseRow;
        });
        this.state.batchTrendRows = this.decorateBatchTrendRows(rows, context);
        this.state.batchTrendForecastChecking = false;
        this.renderBatchTrendModal();
    } catch (error) {
        console.warn('[yeji] 节奏预测增强失败', error);
    } finally {
        if (
            batchSeq === this.state.batchTrendSeq
            && forecastSeq === this.state.batchTrendForecastSeq
            && this.state.batchTrendForecastChecking
        ) {
            this.state.batchTrendForecastChecking = false;
            this.renderBatchTrendModal();
        }
    }
},

async queryBatchTrendHistoryReference(sourceContext = {}, reference = {}, batchSeq = this.state.batchTrendSeq) {
    const context = this.buildBatchTrendHistoryContext(sourceContext, reference);
    const rows = await this.queryBatchTrendValueRowsForContext(context, batchSeq);
    const completedRows = (rows || []).filter(row => row && !row.loading);
    const latest = completedRows[completedRows.length - 1] || null;
    const finalActual = window.YejiPlcxQsGuize?.toNumber?.(latest?.actual);
    if (finalActual == null || finalActual <= 0) return null;
    const referenceSeries = window.YejiPlcxQsZfxGuize.buildStage3Series(completedRows, context);
    const features = window.YejiPlcxQsZfxGuize.buildReferenceFeatures(sourceContext.currentTrendSeries || [], referenceSeries);
    return {
        key: reference.key || '',
        label: reference.label || '',
        baseWeight: reference.baseWeight,
        range: [reference.startDate, reference.endDate],
        finalActual,
        rows: completedRows,
        series: referenceSeries,
        baselineMap: features.baselineMap,
        matchSummary: features.matchSummary,
        shapeVolatility: features.shapeVolatility
    };
},

buildBatchTrendHistoryContext(source = {}, reference = {}) {
    const dateInfo = {
        ...(source.dateInfo || {}),
        range: [reference.startDate, reference.endDate]
    };
    const nodes = window.YejiPlcxQsGuize.buildNodes(reference.startDate, reference.endDate);
    return {
        ...source,
        dateInfo,
        periodEnd: window.YejiPlcxQsGuize.getPeriodEnd(reference.endDate),
        baseDateValues: this.clonePlain(source.baseDateValues || {}),
        fieldConfig: this.clonePlain(source.fieldConfig || {}),
        queryPlan: this.clonePlain(source.queryPlan || {}),
        metricFields: this.clonePlain(source.metricFields || []),
        historyReferenceKey: reference.key || '',
        historyReferenceLabel: reference.label || '',
        nodes
    };
},

async queryBatchTrendValueRowsForContext(context = {}, seq = this.state.batchTrendSeq) {
    const templates = context.templates || [];
    if (!templates.length || !context.metric?.key || !context.nodes?.length) return [];
    const results = [];
    let cursor = 0;
    const concurrency = Math.min(this.getTrendConcurrency?.() || 10, templates.length);
    const workers = Array.from({ length: concurrency }, async () => {
        while (seq === this.state.batchTrendSeq) {
            const tpl = templates[cursor++];
            if (!tpl) return;
            const row = await this.queryBatchTrendTemplateSeries(context, tpl, seq);
            if (seq !== this.state.batchTrendSeq) return;
            results.push(row);
        }
    });
    await Promise.all(workers);
    if (seq !== this.state.batchTrendSeq) return [];
    const rows = context.nodes.map(node => {
        const cumulativeRows = results.map(result => this.buildBatchTrendCumulativeRow(context, node, result));
        const dailyRows = results.map(result => this.buildBatchTrendDailyRow(context, node, result));
        return this.buildBatchTrendValueOutputRow(context, node, cumulativeRows, dailyRows);
    });
    return this.decorateBatchTrendRows(rows, context);
},

buildBatchTrendValueOutputRow(context, node, rows = [], dailyRows = []) {
    const merged = (context.templates || []).length > 1;
    const actual = merged
        ? window.YejiPlcxHbGuize.aggregateField(
            rows,
            context.metric,
            context.metricFields,
            item => this.getMetricFieldDisplayName(item)
        )
        : rows[0]?.valuesByKey?.[context.metric.key];
    const dailyActual = merged
        ? window.YejiPlcxHbGuize.aggregateField(
            dailyRows,
            context.metric,
            context.metricFields,
            item => this.getMetricFieldDisplayName(item)
        )
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

renderBatchTrendTable() {
    if (this.state.batchTrendError) {
        return `<div class="yeji-empty"><i class="fa-solid fa-circle-exclamation"></i> ${this.escapeHtml(this.state.batchTrendError)}</div>`;
    }
    const rows = this.state.batchTrendRows || [];
    const metricName = this.state.batchTrendContext?.metricName || '值';
    const headers = [
        '星期',
        '日期',
        '时间进度',
        `${metricName}目标`,
        `当日${metricName}`,
        `累计${metricName}`,
        `${metricName}达成率`,
        '进度差',
        '进度倍率',
        '当日完成强度',
        '行业进度',
        '权重说明',
        `行业预期累计${metricName}`,
        '行业节奏差',
        '行业节奏倍率',
        '目标缺口',
        '剩余加权日均',
        '趋势加权日均',
        `预测月底${metricName}`,
        '预测区间',
        '预测达成率',
        '预测目标差',
        '压力指数',
        '预测判断',
        '诊断分',
        '综合等级',
        '关键原因',
        '建议动作',
        '判断置信度'
    ];
    const trs = rows.map(row => this.renderBatchTrendValueRow(row)).join('');
    return `
        <div class="yeji-trend-table-wrap">
            <table class="yeji-table yeji-trend-table">
                <thead><tr>${headers.map(name => `<th>${this.escapeHtml(name)}</th>`).join('')}</tr></thead>
                <tbody>${trs}</tbody>
            </table>
        </div>
    `;
},

renderBatchTrendValueRow(row = {}) {
    const loading = row.loading;
    const forecastRangeText = this.formatBatchTrendForecastRange(row);
    const forecastStatusHtml = this.renderBatchTrendForecastStatusCell(row, loading);
    return `
        <tr>
            <td>${this.escapeHtml(row.weekday || '-')}</td>
            <td>${this.escapeHtml(row.label || '-')}</td>
            <td class="metric num">${this.escapeHtml(window.YejiPlcxQsGuize.formatPercent(row.queryProgress))}</td>
            <td class="metric num">${this.escapeHtml(row.targetText || '-')}</td>
            <td class="metric num">${loading ? '<i class="fa-solid fa-spinner fa-spin"></i>' : this.escapeHtml(row.dailyActualText || '-')}</td>
            <td class="metric num">${loading ? '<i class="fa-solid fa-spinner fa-spin"></i>' : this.escapeHtml(row.actualText || '-')}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(window.YejiPlcxQsGuize.formatPercent(row.achievement))}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(window.YejiPlcxQsGuize.formatPercent(row.gap, true))}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(window.YejiPlcxQsGuize.formatRatio(row.pace))}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(window.YejiPlcxQsGuize.formatRatio(row.speed))}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(window.YejiPlcxQsGuize.formatPercent(row.industryProgress))}</td>
            <td>${loading ? '-' : this.escapeHtml(row.industryWeightReason || '-')}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(this.formatBatchQueryValue(row.industryExpectedValue, row.displayFormat))}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(this.formatBatchQueryValue(row.industryGapValue, row.displayFormat))}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(window.YejiPlcxQsGuize.formatRatio(row.industryPace))}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(this.formatBatchQueryValue(row.targetGapValue, row.displayFormat))}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(this.formatBatchQueryValue(row.remainingWeightedDailyNeed, row.displayFormat))}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(this.formatBatchQueryValue(row.trendWeightedDailyAvg, row.displayFormat))}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(this.formatBatchQueryValue(row.forecastFinalValue, row.displayFormat))}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(forecastRangeText)}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(window.YejiPlcxQsGuize.formatPercent(row.forecastAchievement))}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(this.formatBatchQueryValue(row.forecastTargetDiff, row.displayFormat))}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(window.YejiPlcxQsGuize.formatRatio(row.pressureIndex))}</td>
            <td>${forecastStatusHtml}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(this.formatBatchTrendScore(row.diagnosisScore))}</td>
            <td>${loading ? '-' : this.escapeHtml(row.businessLevel || '-')}</td>
            <td>${loading ? '-' : this.escapeHtml(row.mainReason || '-')}</td>
            <td>${loading ? '-' : this.escapeHtml(row.actionSuggestion || '-')}</td>
            <td>${loading ? '-' : this.escapeHtml(row.decisionConfidence || '-')}</td>
        </tr>
    `;
},

renderBatchTrendForecastStatusCell(row = {}, loading = false) {
    if (loading) return '-';
    const text = this.escapeHtml(this.formatBatchTrendForecastStatus(row));
    if (!this.state.batchTrendForecastChecking) return text;
    return `${text}<span class="yeji-trend-checking">（<i class="fa-solid fa-spinner fa-spin"></i> 校验中...）</span>`;
},

formatBatchTrendForecastRange(row = {}) {
    if (row.forecastLowValue == null || row.forecastLowValue === '' || row.forecastHighValue == null || row.forecastHighValue === '') {
        return '-';
    }
    const low = this.formatBatchQueryValue(row.forecastLowValue, row.displayFormat);
    const high = this.formatBatchQueryValue(row.forecastHighValue, row.displayFormat);
    return `${low}~${high}`;
},

formatBatchTrendForecastStatus(row = {}) {
    const status = row.forecastStatus || '-';
    if (!row.historyTrendEnhanced) return status;
    return `${status}，趋势已校准`;
},

formatBatchTrendScore(value) {
    const numeric = window.YejiPlcxQsGuize?.toNumber?.(value);
    return numeric == null ? '-' : String(Math.round(numeric));
}
};

window.YejiPlcxQsZfxYewu = YejiPlcxQsZfxYewu;
