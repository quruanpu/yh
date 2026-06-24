// Value trend stage 3 forecast fusion: current trend plus history curve calibration.
const YejiPlcxQsZfxJd3Yuce = {
    getHistoryBlendWeight(row = {}) {
        const progress = this.toNumber(row.industryProgress);
        const confidence = this.toNumber(row.historyTrendConfidence);
        if (!row.historyTrendEnhanced || confidence == null || confidence <= 0) return 0;

        let base = 0.5;
        if (progress != null && progress < 0.15) base = 0.6;
        else if (progress != null && progress > 0.55) base = 0.35;

        return Math.max(0, Math.min(0.65, base * Math.min(1, confidence)));
    },

    calcEnhancedTrendAverage(row = {}, finalForecastValue) {
        const actual = this.toNumber(row.actual);
        const finalValue = this.toNumber(finalForecastValue);
        const remainingWeight = this.toNumber(row.remainingIndustryWeight);
        if (actual == null || finalValue == null || remainingWeight == null || remainingWeight <= 0) {
            return row.baseTrendWeightedDailyAvg;
        }
        return Math.max(0, (finalValue - actual) / remainingWeight);
    },

    calcForecastUncertainty(row = {}) {
        const base = this.toNumber(row.baseForecastUncertainty);
        const historyConfidence = this.toNumber(row.historyTrendConfidence);
        const baseForecast = this.toNumber(row.baseForecastFinalValue);
        const historyForecast = this.toNumber(row.historyTrendForecastValue);
        let uncertainty = base == null ? 0.2 : base;

        if (historyConfidence != null && historyConfidence > 0) {
            uncertainty *= (1 - Math.min(0.28, historyConfidence * 0.18));
        }
        if (baseForecast != null && historyForecast != null && baseForecast > 0) {
            const disagreement = Math.min(Math.abs(historyForecast - baseForecast) / baseForecast, 0.6);
            uncertainty += disagreement * 0.18;
        }
        return Math.max(0.07, Math.min(0.38, uncertainty));
    },

    calcForecastRange(actual, trendAverage, remainingWeight, uncertainty) {
        const average = this.toNumber(trendAverage);
        const ratio = this.toNumber(uncertainty);
        if (average == null || ratio == null) return { low: '', high: '' };
        return {
            low: this.calcForecastFinalValue(actual, average * (1 - ratio), remainingWeight),
            high: this.calcForecastFinalValue(actual, average * (1 + ratio), remainingWeight)
        };
    },

    getForecastStatus(row = {}) {
        const targetGap = this.toNumber(row.targetGapValue);
        const forecastDiff = this.toNumber(row.forecastTargetDiff);
        const forecastLowDiff = this.toNumber(row.forecastLowTargetDiff);
        const forecastHighDiff = this.toNumber(row.forecastHighTargetDiff);
        const pressure = this.toNumber(row.pressureIndex);
        if (targetGap != null && targetGap <= 0) return '已达标';
        if (forecastLowDiff != null && forecastLowDiff >= 0) return '稳健达标';
        if (forecastDiff != null && forecastDiff >= 0) return '预计达标';
        if (forecastHighDiff != null && forecastHighDiff >= 0 && pressure != null && pressure <= 1.08) return '可追平';
        if (pressure == null) return '数据不足';
        if (pressure <= 1.08) return '可追平';
        if (pressure <= 1.2) return '轻度压力';
        if (pressure <= 1.5) return '压力偏高';
        return '高风险';
    },

    decorateStage3ForecastRow(row = {}, context = {}) {
        const history = this.buildHistoryCurveForecast(row, context);
        const enriched = { ...row, ...history };
        const baseForecast = this.toNumber(enriched.baseForecastFinalValue);
        const historyForecast = this.toNumber(enriched.historyTrendForecastValue);
        const historyBlendWeight = this.getHistoryBlendWeight(enriched);
        const forecastFinalValue = baseForecast != null && historyForecast != null && historyBlendWeight > 0
            ? (baseForecast * (1 - historyBlendWeight)) + (historyForecast * historyBlendWeight)
            : enriched.baseForecastFinalValue;
        const trendWeightedDailyAvg = this.calcEnhancedTrendAverage(enriched, forecastFinalValue);
        const forecastUncertainty = this.calcForecastUncertainty({
            ...enriched,
            forecastFinalValue,
            trendWeightedDailyAvg
        });
        const forecastRange = this.calcForecastRange(
            enriched.actual,
            trendWeightedDailyAvg,
            enriched.remainingIndustryWeight,
            forecastUncertainty
        );
        const forecastAchievement = this.calcForecastAchievement(forecastFinalValue, context.targetValue);
        const forecastTargetDiff = this.calcForecastTargetDiff(forecastFinalValue, context.targetValue);
        const forecastLowAchievement = this.calcForecastAchievement(forecastRange.low, context.targetValue);
        const forecastHighAchievement = this.calcForecastAchievement(forecastRange.high, context.targetValue);
        const forecastLowTargetDiff = this.calcForecastTargetDiff(forecastRange.low, context.targetValue);
        const forecastHighTargetDiff = this.calcForecastTargetDiff(forecastRange.high, context.targetValue);
        const pressureIndex = this.calcPressureIndex(
            enriched.remainingWeightedDailyNeed,
            trendWeightedDailyAvg,
            enriched.targetGapValue
        );
        const next = {
            ...enriched,
            historyBlendWeight,
            trendWeightedDailyAvg,
            forecastUncertainty,
            forecastLowValue: forecastRange.low,
            forecastFinalValue,
            forecastHighValue: forecastRange.high,
            forecastAchievement,
            forecastLowAchievement,
            forecastHighAchievement,
            forecastTargetDiff,
            forecastLowTargetDiff,
            forecastHighTargetDiff,
            pressureIndex
        };
        return {
            ...next,
            forecastStatus: this.getForecastStatus(next)
        };
    }
};

window.YejiPlcxQsZfxJd3Yuce = YejiPlcxQsZfxJd3Yuce;
