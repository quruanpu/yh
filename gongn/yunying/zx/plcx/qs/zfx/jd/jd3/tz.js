// Value trend stage 3 features: summarize baseline matching quality and history shape signals.
const YejiPlcxQsZfxJd3Tezheng = {
    summarizeBaselineMatches(matches = []) {
        const valid = (matches || []).filter(item => item && this.toNumber(item.score) != null);
        if (!valid.length) {
            return {
                averageScore: 0,
                highQualityRatio: 0,
                holidayMismatchCount: 0,
                matchTypes: []
            };
        }
        const averageScore = valid.reduce((sum, item) => sum + (this.toNumber(item.score) || 0), 0) / valid.length;
        const highQualityRatio = valid.filter(item => (this.toNumber(item.score) || 0) >= 72).length / valid.length;
        const holidayMismatchCount = valid.filter(item => (item.reasons || []).includes('节假日错位')).length;
        const typeMap = new Map();
        valid.forEach(item => {
            const type = item.matchType || '顺序基准';
            typeMap.set(type, (typeMap.get(type) || 0) + 1);
        });
        const matchTypes = [...typeMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([type]) => type);

        return {
            averageScore,
            highQualityRatio,
            holidayMismatchCount,
            matchTypes
        };
    },

    calcHistoryShapeVolatility(series = []) {
        const values = (series || [])
            .map(item => item.dailyActual)
            .filter(value => this.toNumber(value) != null);
        return this.calcCoefficientOfVariation(values);
    },

    buildReferenceFeatures(currentSeries = [], referenceSeries = []) {
        const baselineMap = this.buildBaselineMap(currentSeries, referenceSeries);
        const matchSummary = this.summarizeBaselineMatches(baselineMap);
        return {
            baselineMap,
            matchSummary,
            shapeVolatility: this.calcHistoryShapeVolatility(referenceSeries)
        };
    }
};

window.YejiPlcxQsZfxJd3Tezheng = YejiPlcxQsZfxJd3Tezheng;
