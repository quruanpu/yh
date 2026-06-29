// BI summary trend business: drill down achievement rate by cumulative date nodes.
const YejiPlcxQsYewu = {
getTrendConcurrency() {
    return 31;
},

hasBatchTrendTargetValue(context = this.state.batchTrendContext) {
    const value = context?.targetValue;
    if (value == null || String(value).trim() === '') return false;
    const numeric = window.YejiPlcxMbGongju?.toNumber(value);
    if (Number.isFinite(numeric)) return numeric !== 0;
    return true;
},

applyBatchTrendTargetAvailability(rows = [], context = this.state.batchTrendContext, model = '') {
    if (this.hasBatchTrendTargetValue(context)) return rows || [];
    const mode = model || (this.isBatchTrendRateModel?.(context) ? 'rate' : 'value');
    const valueTargetFields = [
        'targetText',
        'achievement',
        'gap',
        'pace',
        'speed',
        'acceleration',
        'baselineWeightedDailyAvg',
        'industryExpectedValue',
        'industryGapValue',
        'industryPace',
        'targetGapValue',
        'remainingWeightedDailyNeed',
        'pressureIndex',
        'forecastAchievement',
        'forecastLowAchievement',
        'forecastHighAchievement',
        'forecastTargetDiff',
        'forecastLowTargetDiff',
        'forecastHighTargetDiff',
        'forecastStatus',
        'diagnosisScore',
        'businessLevel',
        'mainReason',
        'actionSuggestion',
        'decisionConfidence'
    ];
    const rateTargetFields = [
        'targetText',
        'targetRate',
        'dailyTargetGap',
        'cumulativeTargetGap',
        'dailyEffectiveGap',
        'cumulativeEffectiveGap',
        'dailyTargetStatus',
        'cumulativeTargetStatus',
        'mainReason',
        'actionSuggestion'
    ];
    const fields = mode === 'rate' ? rateTargetFields : valueTargetFields;
    return (rows || []).map(row => {
        if (!row || row.loading) return row;
        const next = { ...row };
        fields.forEach(field => {
            next[field] = '';
        });
        return next;
    });
},

bindBatchTrendEntries() {
    document.querySelectorAll('[data-trend-entry]').forEach(cell => {
        cell.addEventListener('dblclick', () => this.openBatchTrendFromCell(cell));
    });
},

openBatchTrendFromCell(cell) {
    const context = this.buildBatchTrendContext(cell);
    if (!context) return;
    this.state.batchTrendSeq = (this.state.batchTrendSeq || 0) + 1;
    this.state.batchTrendError = '';
    this.state.batchTrendForecastChecking = false;
    this.state.batchTrendContext = context;
    const targetText = this.isBatchTrendRateModel?.(context)
        ? window.YejiPlcxQsLfxGuize.formatPercent(window.YejiPlcxQsLfxGuize.toTargetRate(context.targetValue))
        : window.YejiPlcxMbGongju.formatTargetValue(context.targetValue, value => this.formatBatchQueryValue(value, null), context.metricName);
    this.state.batchTrendRows = context.nodes.map(node => ({
        ...node,
        loading: true,
        targetText,
        queryProgress: window.YejiPlcxQsGuize.calcQueryProgress(context.dateInfo.range[0], node.endDate, context.periodEnd)
    }));
    this.renderBatchTrendModal();
    this.runBatchTrendQuery(context, this.state.batchTrendSeq);
},

buildBatchTrendContext(cell) {
    const dateInfo = this.getBatchTrendDateInfo();
    if (!dateInfo) {
        this._showToast('未找到当前 BI 查询日期，无法分析趋势。', 'warning');
        return null;
    }

    const rawKeys = this.parseBatchTrendRawKeys(cell.dataset.trendRawKeys);
    const templateSource = this.state.batchQueryTemplateSnapshot?.length
        ? this.state.batchQueryTemplateSnapshot
        : this.state.templates;
    const templateMap = new Map((templateSource || []).map(tpl => [tpl._key, tpl]));
    const templates = rawKeys.map(key => templateMap.get(key)).filter(Boolean);
    if (!templates.length) {
        this._showToast('未找到当前项目模板，无法分析趋势。', 'warning');
        return null;
    }

    const metric = this.findBatchTrendMetric(cell.dataset.trendMetricKey, cell.dataset.trendMetricName);
    if (!metric?.key) {
        this._showToast('未找到当前字段，无法分析趋势。', 'warning');
        return null;
    }

    const nodes = window.YejiPlcxQsGuize.buildNodes(dateInfo.range[0], dateInfo.range[1]);
    if (!nodes.length) {
        this._showToast('当前查询日期无效，无法分析趋势。', 'warning');
        return null;
    }

    const rateMeta = window.YejiPlcxQsLfxGuize?.getRateMeta?.(cell.dataset.trendMetricName || this.getMetricFieldDisplayName(metric));
    const context = {
        rowKey: cell.dataset.trendRowKey || '',
        rowName: cell.dataset.trendRowName || '',
        rawKeys,
        templates,
        metric,
        metricName: cell.dataset.trendMetricName || this.getMetricFieldDisplayName(metric),
        trendModel: rateMeta ? 'rate' : 'value',
        rateMeta,
        targetValue: cell.dataset.trendTarget || '',
        targetRangeKey: cell.dataset.trendTargetRange || '',
        dateInfo,
        periodEnd: window.YejiPlcxQsGuize.getPeriodEnd(dateInfo.range[1]),
        baseDateValues: this.clonePlain(this.state.batchQueryDateValues || this.getCurrentDateFilterValues()),
        fieldConfig: this.clonePlain(this.state.batchQueryFieldConfig || this.getBatchQueryFieldConfig()),
        nodes
    };
    context.queryPlan = this.buildTrendQueryPlan(context);
    context.metricFields = this.clonePlain(context.queryPlan.metricFields || []);
    if (this.isBatchTrendRateModel?.(context)) {
        const deps = this.getBatchRateDependencyFields?.(context) || {};
        if (!deps.numerator || !deps.denominator) {
            this._showToast('率字段缺少依赖字段或业务基数字段，无法分析趋势。', 'warning');
            return null;
        }
    }
    return context;
},

parseBatchTrendRawKeys(value = '') {
    try {
        const parsed = JSON.parse(decodeURIComponent(value || '[]'));
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
        return [];
    }
},

getBatchTrendDateInfo() {
    const dateValues = this.state.batchQueryDateValues || this.getCurrentDateFilterValues();
    const items = this.getVisibleFilterSelectors()
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
    return startDate && endDate
        ? { selectorId: primary.selector.cdId, name: primary.name, range: [startDate, endDate] }
        : null;
},

findBatchTrendMetric(metricKey, metricName) {
    return [
        ...(this.state.batchQueryMetricFields || []),
        ...(this.state.batchQueryDisplayMetricFields || []),
        ...(this.getBatchQueryMetricFields?.() || [])
    ].find(field => field.key === metricKey)
        || this.findMetricFieldByDisplayName?.(metricName)
        || null;
},

async runBatchTrendQuery(context, seq) {
    try {
        await this.runBatchTrendNodes(context, seq);
    } catch (error) {
        console.error('[yeji] 指标详解失败', error);
        if (seq !== this.state.batchTrendSeq) return;
        this.state.batchTrendError = error.message || '指标详解失败。';
        this.renderBatchTrendModal();
    }
},

async runBatchTrendNodes(context, seq) {
    const results = [];
    let cursor = 0;
    const workers = Array.from({ length: Math.min(this.getTrendConcurrency(), context.templates.length) }, async () => {
        while (seq === this.state.batchTrendSeq) {
            const tpl = context.templates[cursor++];
            if (!tpl) return;
            const row = await this.queryBatchTrendTemplateSeries(context, tpl, seq);
            if (seq !== this.state.batchTrendSeq) return;
            results.push(row);
        }
    });
    await Promise.all(workers);
    if (seq !== this.state.batchTrendSeq) return;
    if (!this.isBatchTrendRateModel?.(context)) {
        await window.YejiPlcxQsZfxGuize?.ensureReady?.();
        if (seq !== this.state.batchTrendSeq) return;
    }
    context.nodes.forEach((node, index) => {
        const isRate = this.isBatchTrendRateModel?.(context);
        const rows = results.map(result => isRate
            ? this.buildBatchRateTrendCumulativeRow(context, node, result)
            : this.buildBatchTrendCumulativeRow(context, node, result));
        const dailyRows = results.map(result => isRate
            ? this.buildBatchRateTrendDailyRow(context, node, result)
            : this.buildBatchTrendDailyRow(context, node, result));
        if (isRate) this.finishBatchRateTrendNode(context, node, index, rows, dailyRows);
        else this.finishBatchTrendNode(context, node, index, rows, dailyRows);
    });
    this.state.batchTrendRows = this.isBatchTrendRateModel?.(context)
        ? this.decorateBatchRateTrendRows(this.state.batchTrendRows || [], context)
        : this.decorateBatchTrendRows(this.state.batchTrendRows || [], context);
    this.renderBatchTrendModal();
    if (!this.isBatchTrendRateModel?.(context)) {
        this.runBatchTrendForecastEnhancement?.(context, seq);
    }
},

async queryBatchTrendTemplateSeries(context, tpl, seq) {
    if (seq !== this.state.batchTrendSeq) return this.makeEmptyBatchTrendTemplateRow(tpl);
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
        console.error('[yeji] 指标详解模板查询失败', tpl.name, error);
        return this.makeEmptyBatchTrendTemplateRow(tpl);
    }
},

makeEmptyBatchTrendTemplateRow(tpl = {}) {
    return {
        key: tpl._key || '',
        name: tpl.name || '未命名模板',
        series: new Map(),
        valuesByKey: {},
        formatsByKey: {}
    };
},

extractBatchTrendSeries(json, context = {}) {
    const cm = json?.response?.chartMain;
    const rowValues = cm?.row?.values || [];
    const data = cm?.data || [];
    const metricFields = this.getContextMetricFields(context);
    const series = new Map();
    rowValues.forEach((dims, index) => {
        if ((dims || []).some(cell => cell?.isGrandtotal)) return;
        const dateKey = this.normalizeBatchTrendDateCell((dims || [])[0]);
        if (!dateKey) return;
        const valuesByKey = {};
        (data[index] || []).forEach((metric, metricIndex) => {
            const field = metricFields[metricIndex];
            if (field?.key) valuesByKey[field.key] = metric?.v ?? '';
        });
        series.set(dateKey, valuesByKey);
    });
    return series;
},

extractBatchTrendFormats(json, context = {}) {
    const cm = json?.response?.chartMain;
    const formats = cm?.column?.metricFieldFormat?.numberFormat || [];
    const metricHeaders = this.normalizeMetricHeaders(cm?.column?.values || []);
    const formatsByKey = {};
    this.getContextMetricFields(context).forEach((field, index) => {
        const metric = metricHeaders[index] || {};
        const fmtIndex = metric?.fmt_idx ?? index;
        formatsByKey[field.key] = formats[fmtIndex] || null;
    });
    return formatsByKey;
},

normalizeBatchTrendDateCell(cell = {}) {
    const raw = cell?.title ?? cell?.value ?? cell?.v ?? cell?.displayValue ?? '';
    return window.YejiPlcxMbGuize?.normalizeDate(raw) || String(raw || '').replaceAll('/', '-');
},

scheduleBatchTrendRender() {
    if (this.state.batchTrendRenderScheduled) return;
    this.state.batchTrendRenderScheduled = true;
    const frame = window.requestAnimationFrame || (callback => setTimeout(callback, 16));
    frame(() => {
        this.state.batchTrendRenderScheduled = false;
        this.renderBatchTrendModal();
    });
},

captureBatchTrendScroll(modal = document.getElementById('yeji-trend-modal')) {
    const body = modal?.querySelector('.yeji-trend-body');
    const tableWrap = modal?.querySelector('.yeji-trend-table-wrap');
    return {
        bodyTop: body?.scrollTop || 0,
        bodyLeft: body?.scrollLeft || 0,
        tableTop: tableWrap?.scrollTop || 0,
        tableLeft: tableWrap?.scrollLeft || 0
    };
},

restoreBatchTrendScroll(position = {}, modal = document.getElementById('yeji-trend-modal')) {
    const body = modal?.querySelector('.yeji-trend-body');
    const tableWrap = modal?.querySelector('.yeji-trend-table-wrap');
    if (body) {
        body.scrollTop = position.bodyTop || 0;
        body.scrollLeft = position.bodyLeft || 0;
    }
    if (tableWrap) {
        tableWrap.scrollTop = position.tableTop || 0;
        tableWrap.scrollLeft = position.tableLeft || 0;
    }
},

renderBatchTrendModal() {
    const context = this.state.batchTrendContext;
    if (!context) return;
    let modal = document.getElementById('yeji-trend-modal');
    const scrollPosition = this.captureBatchTrendScroll(modal);
    const wasFullscreen = !!modal?.querySelector('.yeji-trend-dialog')?.classList.contains('yeji-modal-fullscreen');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'yeji-trend-modal';
        modal.className = 'yeji-trend-modal';
        document.body.appendChild(modal);
    }

    const tableHtml = this.isBatchTrendRateModel?.(context)
        ? this.renderBatchRateTrendTable()
        : this.renderBatchTrendTable();
    const checkingText = this.state.batchTrendForecastChecking
        ? '<span class="yeji-trend-checking"><i class="fa-solid fa-spinner fa-spin"></i> 数据校验中...</span>'
        : '';

    modal.innerHTML = `
        <div class="yeji-trend-backdrop"></div>
        <div class="yeji-trend-dialog" role="dialog" aria-modal="true" aria-label="指标详解">
            <div class="yeji-trend-header">
                <div class="yeji-trend-title">
                    <span>指标详解</span>
                    <small>${this.escapeHtml(context.rowName)} | ${this.escapeHtml(context.metricName)} | ${this.escapeHtml(context.dateInfo.name)}：${this.escapeHtml(context.dateInfo.range[0].replaceAll('-', '/'))}~${this.escapeHtml(context.dateInfo.range[1].replaceAll('-', '/'))} ${checkingText}</small>
                </div>
                <div class="yeji-modal-actions-wrap">
                    ${window.YejiHudongModule?.renderActions('trend') || ''}
                    <button type="button" class="yeji-trend-close" data-trend-close title="关闭">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
            <div class="yeji-trend-body">
                ${tableHtml}
            </div>
        </div>
    `;
    const dialog = modal.querySelector('.yeji-trend-dialog');
    if (wasFullscreen) dialog?.classList.add('yeji-modal-fullscreen');
    this.restoreBatchTrendScroll(scrollPosition, modal);
    modal.querySelector('[data-trend-close]')?.addEventListener('click', () => this.closeBatchTrendModal());
    window.YejiHudongModule?.bind(modal, { dialogSelector: '.yeji-trend-dialog' });
    this.refreshBiAiContext?.();
},

closeBatchTrendModal() {
    this.state.batchTrendSeq = (this.state.batchTrendSeq || 0) + 1;
    this.state.batchTrendForecastSeq = (this.state.batchTrendForecastSeq || 0) + 1;
    this.state.batchTrendContext = null;
    this.state.batchTrendRows = [];
    this.state.batchTrendError = '';
    this.state.batchTrendForecastChecking = false;
    document.getElementById('yeji-trend-modal')?.remove();
    this.refreshBiAiContext?.();
}
};

window.YejiPlcxQsYewu = YejiPlcxQsYewu;
