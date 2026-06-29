// Rate trend analysis business: build numerator/denominator rows and render rate-model table.
const YejiPlcxQsLfxYewu = {
isBatchTrendRateModel(context = {}) {
    return context.trendModel === 'rate' && !!context.rateMeta;
},

getBatchRateDependencyFields(context = {}) {
    const meta = context.rateMeta || {};
    const fields = context.metricFields || [];
    const getName = item => this.getMetricFieldDisplayName(item);
    return {
        numerator: window.YejiPlcxHbGuize.findFieldByName(fields, meta.numeratorName, getName),
        denominator: window.YejiPlcxHbGuize.findFieldByName(fields, meta.denominatorName, getName)
    };
},

buildBatchRateTrendCumulativeRow(context, node, result = {}) {
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
    const deps = this.getBatchRateDependencyFields(context);
    valuesByKey[context.metric.key] = window.YejiPlcxQsLfxGuize.calcRate(
        deps.numerator ? valuesByKey[deps.numerator.key] : '',
        deps.denominator ? valuesByKey[deps.denominator.key] : ''
    );
    return {
        key: result.key,
        name: result.name,
        valuesByKey,
        formatsByKey: result.formatsByKey || {}
    };
},

buildBatchRateTrendDailyRow(context, node, result = {}) {
    const valuesByKey = { ...((result.series || new Map()).get(node.endDate) || {}) };
    const deps = this.getBatchRateDependencyFields(context);
    valuesByKey[context.metric.key] = window.YejiPlcxQsLfxGuize.calcRate(
        deps.numerator ? valuesByKey[deps.numerator.key] : '',
        deps.denominator ? valuesByKey[deps.denominator.key] : ''
    );
    return {
        key: result.key,
        name: result.name,
        valuesByKey,
        formatsByKey: result.formatsByKey || {}
    };
},

finishBatchRateTrendNode(context, node, index, rows = [], dailyRows = []) {
    const deps = this.getBatchRateDependencyFields(context);
    const numeratorKey = deps.numerator?.key || '';
    const denominatorKey = deps.denominator?.key || '';
    const merged = context.templates.length > 1;
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
    this.state.batchTrendRows[index] = {
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
    this.state.batchTrendRows = this.decorateBatchRateTrendRows(this.state.batchTrendRows || [], context);
},

decorateBatchRateTrendRows(rows = [], context = this.state.batchTrendContext) {
    const decorated = window.YejiPlcxQsLfxGuize.decorateRows(rows || [], context);
    return this.applyBatchTrendTargetAvailability?.(decorated, context, 'rate') || decorated;
},

getBatchRateTrendLabels(context = this.state.batchTrendContext) {
    const deps = this.getBatchRateDependencyFields(context);
    return {
        rateName: context?.metricName || context?.rateMeta?.metricName || '率',
        numeratorName: deps.numerator ? this.getMetricFieldDisplayName(deps.numerator) : context?.rateMeta?.numeratorName || '依赖字段',
        denominatorName: deps.denominator ? this.getMetricFieldDisplayName(deps.denominator) : context?.rateMeta?.denominatorName || '业务基数'
    };
},

renderBatchRateTrendTable() {
    if (this.state.batchTrendError) {
        return `<div class="yeji-empty"><i class="fa-solid fa-circle-exclamation"></i> ${this.escapeHtml(this.state.batchTrendError)}</div>`;
    }
    const rows = this.state.batchTrendRows || [];
    const labels = this.getBatchRateTrendLabels();
    const headers = [
        '星期',
        '日期',
        '当前时间进度',
        '方向',
        `${labels.rateName}目标`,
        `当日${labels.numeratorName}`,
        `累计${labels.numeratorName}`,
        `当日${labels.denominatorName}`,
        `累计${labels.denominatorName}`,
        `当日${labels.rateName}`,
        '日目标差',
        `累计${labels.rateName}`,
        '累计目标差',
        '方向修正差',
        '达标判断',
        '率变化',
        `${labels.numeratorName}贡献`,
        `${labels.denominatorName}贡献`,
        '主导因素',
        '基数可靠性',
        '关键原因',
        '建议动作'
    ];
    const trs = rows.map(row => this.renderBatchRateTrendRow(row)).join('');
    return `
        <div class="yeji-trend-table-wrap">
            <table class="yeji-table yeji-trend-table">
                <thead><tr>${headers.map(name => `<th>${this.escapeHtml(name)}</th>`).join('')}</tr></thead>
                <tbody>${trs}</tbody>
            </table>
        </div>
    `;
},

renderBatchRateTrendRow(row = {}) {
    const loading = row.loading;
    return `
        <tr>
            <td>${this.escapeHtml(row.weekday || '-')}</td>
            <td>${this.escapeHtml(row.label || '-')}</td>
            <td class="metric num">${this.escapeHtml(window.YejiPlcxQsGuize.formatPercent(row.queryProgress))}</td>
            <td>${loading ? '-' : this.escapeHtml(row.directionText || '-')}</td>
            <td class="metric num">${this.escapeHtml(row.targetText || '-')}</td>
            <td class="metric num">${loading ? '<i class="fa-solid fa-spinner fa-spin"></i>' : this.escapeHtml(row.dailyNumeratorText || '-')}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(row.cumNumeratorText || '-')}</td>
            <td class="metric num">${loading ? '<i class="fa-solid fa-spinner fa-spin"></i>' : this.escapeHtml(row.dailyDenominatorText || '-')}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(row.cumDenominatorText || '-')}</td>
            <td class="metric num">${loading ? '<i class="fa-solid fa-spinner fa-spin"></i>' : this.escapeHtml(row.dailyActualText || '-')}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(window.YejiPlcxQsLfxGuize.formatPoint(row.dailyTargetGap, true))}</td>
            <td class="metric num">${loading ? '<i class="fa-solid fa-spinner fa-spin"></i>' : this.escapeHtml(row.actualText || '-')}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(window.YejiPlcxQsLfxGuize.formatPoint(row.cumulativeTargetGap, true))}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(window.YejiPlcxQsLfxGuize.formatPoint(row.cumulativeEffectiveGap, true))}</td>
            <td>${loading ? '-' : this.escapeHtml(row.cumulativeTargetStatus || '-')}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(window.YejiPlcxQsLfxGuize.formatPoint(row.rateChange, true))}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(window.YejiPlcxQsLfxGuize.formatPoint(row.numeratorContribution, true))}</td>
            <td class="metric num">${loading ? '-' : this.escapeHtml(window.YejiPlcxQsLfxGuize.formatPoint(row.denominatorContribution, true))}</td>
            <td>${loading ? '-' : this.escapeHtml(row.mainDriver || '-')}</td>
            <td>${loading ? '-' : this.escapeHtml(row.baseReliability || '-')}</td>
            <td>${loading ? '-' : this.escapeHtml(row.mainReason || '-')}</td>
            <td class="yeji-trend-rate-action">${loading ? '-' : this.escapeHtml(row.actionSuggestion || '-')}</td>
        </tr>
    `;
}
};

window.YejiPlcxQsLfxYewu = YejiPlcxQsLfxYewu;
