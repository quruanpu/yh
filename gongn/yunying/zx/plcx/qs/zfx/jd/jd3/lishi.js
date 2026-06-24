// Value trend stage 3 history curve model: shape-based references, not raw value averaging.
const YejiPlcxQsZfxJd3Lishi = {
    historyReferenceSpecs: [
        { key: 'lastMonth', label: '上月环期', baseWeight: 0.50, type: 'month', offset: -1 },
        { key: 'lastYear', label: '去年同期', baseWeight: 0.30, type: 'year', offset: -1 },
        { key: 'twoMonthsAgo', label: '上上月同期', baseWeight: 0.20, type: 'month', offset: -2 }
    ],

    buildHistoryReferenceRanges(context = {}) {
        const start = context.dateInfo?.range?.[0] || '';
        const end = context.periodEnd || context.dateInfo?.range?.[1] || '';
        return this.historyReferenceSpecs
            .map(spec => {
                const monthOffset = spec.type === 'year' ? spec.offset * 12 : spec.offset;
                const range = this.buildShiftedDateRange(start, end, monthOffset);
                return range ? { ...spec, ...range } : null;
            })
            .filter(Boolean);
    },

    getHistoryReferenceByKey(context = {}, key = '') {
        return (context.historyTrendReferences || []).find(item => item?.key === key) || null;
    },

    findHistoryRowAtProgress(rows = [], progress) {
        const targetProgress = this.toNumber(progress);
        const valid = (rows || []).filter(row => row && !row.loading && this.toNumber(row.industryProgress) != null);
        if (!valid.length || targetProgress == null) return null;
        return valid.reduce((best, row) => {
            const gap = Math.abs(this.toNumber(row.industryProgress) - targetProgress);
            if (!best || gap < best.gap) return { row, gap };
            return best;
        }, null)?.row || valid[valid.length - 1];
    },

    findHistoryBaselineRow(reference = {}, currentRow = {}, context = {}) {
        const referenceSeries = reference.series || this.buildStage3Series(reference.rows || [], {
            ...context,
            dateInfo: {
                ...(context.dateInfo || {}),
                range: reference.range || context.dateInfo?.range || []
            },
            periodEnd: reference.range?.[1] || context.periodEnd
        });
        const currentSeries = context.currentTrendSeries || [];
        const currentItem = (currentSeries || []).find(item => item.dateText === currentRow.endDate)
            || this.buildStage3Series([currentRow], context)[0];
        const baseline = currentItem ? this.findBaselineDate(currentItem, referenceSeries) : null;
        if (baseline?.referenceItem && this.toNumber(baseline.score) >= 45) {
            return {
                row: baseline.referenceItem,
                baseline
            };
        }
        return {
            row: this.findHistoryRowAtProgress(reference.rows || [], currentRow.industryProgress),
            baseline: baseline || null
        };
    },

    calcReferenceReliability(reference = {}, progressRow = null, currentRow = {}, baseline = null) {
        const finalActual = this.toNumber(reference.finalActual);
        const progressActual = this.toNumber(progressRow?.actual);
        const rows = (reference.rows || []).filter(row => row && !row.loading);
        if (finalActual == null || finalActual <= 0 || progressActual == null || progressActual < 0 || rows.length < 5) {
            return 0;
        }

        let reliability = 1;
        const currentProgress = this.toNumber(currentRow.industryProgress);
        const matchedProgress = this.toNumber(progressRow?.industryProgress);
        if (currentProgress != null && matchedProgress != null) {
            const progressGap = Math.abs(currentProgress - matchedProgress);
            reliability *= Math.max(0.55, 1 - (progressGap * 1.8));
        }

        const dailyValues = rows.map(row => row.dailyActual);
        const volatility = this.calcCoefficientOfVariation(dailyValues);
        if (volatility > 1.2) reliability *= 0.72;
        else if (volatility > 0.75) reliability *= 0.86;

        const maxDaily = Math.max(...dailyValues.map(value => this.toNumber(value) || 0));
        if (maxDaily > 0 && finalActual > 0 && maxDaily / finalActual > 0.42) reliability *= 0.82;

        const matchScore = this.toNumber(baseline?.score);
        if (matchScore != null) reliability *= Math.max(0.45, Math.min(1, matchScore / 86));
        const averageScore = this.toNumber(reference.matchSummary?.averageScore);
        if (averageScore != null) reliability *= Math.max(0.55, Math.min(1, averageScore / 82));
        if ((reference.matchSummary?.holidayMismatchCount || 0) > 0) reliability *= 0.86;
        const shapeVolatility = this.toNumber(reference.shapeVolatility);
        if (shapeVolatility != null && shapeVolatility > 1.1) reliability *= 0.86;

        return Math.max(0, Math.min(1, reliability));
    },

    buildHistoryCurveItem(reference = {}, currentRow = {}, context = {}) {
        const matched = this.findHistoryBaselineRow(reference, currentRow, context);
        const progressRow = matched.row;
        const finalActual = this.toNumber(reference.finalActual);
        const progressActual = this.toNumber(progressRow?.actual);
        const currentActual = this.toNumber(currentRow.actual);
        if (!progressRow || finalActual == null || finalActual <= 0 || progressActual == null || progressActual <= 0 || currentActual == null) {
            return null;
        }

        const completionRatio = Math.max(0.02, Math.min(0.98, progressActual / finalActual));
        const forecastValue = currentActual / completionRatio;
        const reliability = this.calcReferenceReliability(reference, progressRow, currentRow, matched.baseline);
        if (reliability <= 0) return null;

        return {
            key: reference.key || '',
            label: reference.label || '',
            baseWeight: this.toNumber(reference.baseWeight) || 0,
            reliability,
            completionRatio,
            forecastValue,
            progressDate: progressRow.endDate || '',
            baselineMatchType: matched.baseline?.matchType || '进度近邻',
            baselineScore: matched.baseline?.score || '',
            progressActual,
            finalActual
        };
    },

    buildHistoryCurveForecast(row = {}, context = {}) {
        const references = (context.historyTrendReferences || [])
            .map(reference => this.buildHistoryCurveItem(reference, row, context))
            .filter(Boolean);
        const weighted = references
            .map(item => ({
                ...item,
                finalWeight: item.baseWeight * item.reliability
            }))
            .filter(item => item.forecastValue != null && item.finalWeight > 0);
        const totalWeight = weighted.reduce((sum, item) => sum + item.finalWeight, 0);
        if (totalWeight <= 0) {
            return {
                historyTrendEnhanced: false,
                historyTrendForecastValue: '',
                historyTrendCompletionRatio: '',
                historyTrendConfidence: 0,
                historyTrendBasis: '',
                historyTrendReferences: []
            };
        }

        const forecastValue = weighted.reduce((sum, item) => sum + (item.forecastValue * item.finalWeight), 0) / totalWeight;
        const completionRatio = weighted.reduce((sum, item) => sum + (item.completionRatio * item.finalWeight), 0) / totalWeight;
        const confidence = Math.max(0, Math.min(1, totalWeight));
        const labels = weighted
            .sort((a, b) => b.finalWeight - a.finalWeight)
            .map(item => item.label)
            .slice(0, 3);

        return {
            historyTrendEnhanced: true,
            historyTrendForecastValue: forecastValue,
            historyTrendCompletionRatio: completionRatio,
            historyTrendConfidence: confidence,
            historyTrendBasis: labels.length ? `参考${labels.join('、')}趋势` : '参考历史趋势',
            historyTrendReferences: weighted
        };
    }
};

window.YejiPlcxQsZfxJd3Lishi = YejiPlcxQsZfxJd3Lishi;
