// Value trend stage 3 baseline forecast: current month weighted trend.
const YejiPlcxQsZfxJd3Jizhun = {
    calcCumulativeWeightedDailyAverage(row = {}, context = {}) {
        const actual = this.toNumber(row.actual);
        const elapsedWeight = this.getElapsedIndustryWeight(context, row.endDate);
        if (actual == null || !Number.isFinite(elapsedWeight) || elapsedWeight <= 0) return '';
        return actual / elapsedWeight;
    },

    calcBaselineWeightedDailyAverage(context = {}) {
        const target = this.toNumber(context.targetValue);
        const totalWeight = this.getTotalIndustryWeight(context);
        if (target == null || !Number.isFinite(totalWeight) || totalWeight <= 0) return '';
        return target / totalWeight;
    },

    calcTrendWeightedDailyAverage(cumulativeAverage, recentAverage, recentCount, baselineAverage, industryProgress) {
        const cumulative = this.toNumber(cumulativeAverage);
        const recent = this.toNumber(recentAverage);
        const baseline = this.toNumber(baselineAverage);
        const progress = this.toNumber(industryProgress);
        if (cumulative == null && baseline == null) return '';

        if (progress != null && progress < 0.08) {
            return this.normalizeWeightedAverageParts([
                { value: baseline, weight: 0.55 },
                { value: cumulative, weight: 0.35 },
                { value: recent, weight: recentCount >= 2 ? 0.10 : 0 }
            ]);
        }

        if (recent != null && recentCount >= this.recentWindowSize && progress != null && progress >= 0.2) {
            return this.normalizeWeightedAverageParts([
                { value: baseline, weight: 0.20 },
                { value: cumulative, weight: 0.50 },
                { value: recent, weight: 0.30 }
            ]);
        }

        if (recent != null && recentCount >= 2) {
            return this.normalizeWeightedAverageParts([
                { value: baseline, weight: 0.30 },
                { value: cumulative, weight: 0.55 },
                { value: recent, weight: 0.15 }
            ]);
        }

        return this.normalizeWeightedAverageParts([
            { value: baseline, weight: 0.35 },
            { value: cumulative, weight: 0.65 }
        ]);
    },

    getBaseForecastUncertainty(cumulativeAverage, recentAverage, industryProgress, recentCount) {
        const cumulative = this.toNumber(cumulativeAverage);
        const recent = this.toNumber(recentAverage);
        const progress = this.toNumber(industryProgress);
        let base = 0.12;
        if (progress == null || progress < 0.08 || recentCount < 2) base = 0.28;
        else if (progress < 0.2 || recentCount < this.recentWindowSize) base = 0.20;

        let volatility = 0;
        if (cumulative != null && recent != null && cumulative > 0) {
            volatility = Math.min(Math.abs(recent - cumulative) / cumulative, 0.45);
        }
        return Math.max(0.08, Math.min(0.35, base + (volatility * 0.35)));
    },

    calcForecastFinalValue(actual, trendAverage, remainingWeight) {
        const actualNumber = this.toNumber(actual);
        const average = this.toNumber(trendAverage);
        const weight = this.toNumber(remainingWeight);
        if (actualNumber == null || average == null || weight == null) return '';
        return actualNumber + (average * Math.max(0, weight));
    },

    calcForecastAchievement(forecastFinalValue, target) {
        const forecast = this.toNumber(forecastFinalValue);
        const targetNumber = this.toNumber(target);
        if (forecast == null || targetNumber == null || targetNumber === 0) return '';
        return forecast / targetNumber;
    },

    calcForecastTargetDiff(forecastFinalValue, target) {
        const forecast = this.toNumber(forecastFinalValue);
        const targetNumber = this.toNumber(target);
        if (forecast == null || targetNumber == null) return '';
        return forecast - targetNumber;
    },

    calcPressureIndex(remainingNeed, trendAverage, targetGap) {
        const gap = this.toNumber(targetGap);
        if (gap != null && gap <= 0) return 0;
        const need = this.toNumber(remainingNeed);
        const average = this.toNumber(trendAverage);
        if (need == null || average == null || average <= 0) return '';
        return need / average;
    },

    decorateStage3BaseRow(row = {}, index = 0, list = [], context = {}) {
        const recentRows = this.getRecentRows(list, index);
        const baselineWeightedDailyAvg = this.calcBaselineWeightedDailyAverage(context);
        const cumulativeWeightedDailyAvg = this.calcCumulativeWeightedDailyAverage(row, context);
        const recentStats = this.calcWeightedDailyStats(recentRows);
        const recentWeightedDailyAvg = recentStats.average;
        const baseTrendWeightedDailyAvg = this.calcTrendWeightedDailyAverage(
            cumulativeWeightedDailyAvg,
            recentWeightedDailyAvg,
            recentStats.validCount,
            baselineWeightedDailyAvg,
            row.industryProgress
        );
        const baseForecastUncertainty = this.getBaseForecastUncertainty(
            cumulativeWeightedDailyAvg,
            recentWeightedDailyAvg,
            row.industryProgress,
            recentStats.validCount
        );
        const baseForecastFinalValue = this.calcForecastFinalValue(
            row.actual,
            baseTrendWeightedDailyAvg,
            row.remainingIndustryWeight
        );

        return {
            ...row,
            baselineWeightedDailyAvg,
            cumulativeWeightedDailyAvg,
            recentWeightedDailyAvg,
            recentValidDays: recentStats.validCount,
            baseTrendWeightedDailyAvg,
            baseForecastUncertainty,
            baseForecastFinalValue
        };
    }
};

window.YejiPlcxQsZfxJd3Jizhun = YejiPlcxQsZfxJd3Jizhun;
