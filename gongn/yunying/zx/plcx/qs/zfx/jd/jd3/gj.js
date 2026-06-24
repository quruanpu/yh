// Value trend stage 3 helpers: date, weighted series, and model utilities.
const YejiPlcxQsZfxJd3Gongju = {
    recentWindowSize: 3,

    getCompletedRows(rows = [], endIndex = 0) {
        return (rows || [])
            .slice(0, endIndex + 1)
            .filter(row => row && !row.loading);
    },

    getRecentRows(rows = [], endIndex = 0) {
        return this.getCompletedRows(rows, endIndex).slice(-this.recentWindowSize);
    },

    getElapsedIndustryWeight(context = {}, nodeEndDate = '') {
        const startDate = context.dateInfo?.range?.[0] || '';
        if (typeof this.sumIndustryWeights !== 'function') return 0;
        return this.sumIndustryWeights(startDate, nodeEndDate, context);
    },

    getTotalIndustryWeight(context = {}) {
        const startDate = context.dateInfo?.range?.[0] || '';
        const periodEnd = context.periodEnd || context.dateInfo?.range?.[1] || '';
        if (typeof this.sumIndustryWeights !== 'function') return 0;
        return this.sumIndustryWeights(startDate, periodEnd, context);
    },

    calcWeightedDailyStats(rows = []) {
        let actualTotal = 0;
        let weightTotal = 0;
        let validCount = 0;
        (rows || []).forEach(row => {
            const actual = this.toNumber(row.dailyActual);
            const weight = this.toNumber(row.industryDayWeight);
            if (actual == null || weight == null || weight <= 0) return;
            actualTotal += actual;
            weightTotal += weight;
            validCount += 1;
        });
        return {
            average: weightTotal > 0 ? actualTotal / weightTotal : '',
            validCount,
            weightTotal
        };
    },

    calcWeightedDailyAverage(rows = []) {
        return this.calcWeightedDailyStats(rows).average;
    },

    normalizeWeightedAverageParts(parts = []) {
        const valid = parts
            .map(part => ({
                value: this.toNumber(part.value),
                weight: this.toNumber(part.weight)
            }))
            .filter(part => part.value != null && part.weight != null && part.weight > 0);
        const weightTotal = valid.reduce((sum, part) => sum + part.weight, 0);
        if (weightTotal <= 0) return '';
        return valid.reduce((sum, part) => sum + (part.value * part.weight), 0) / weightTotal;
    },

    clampNumber(value, min, max) {
        const numeric = this.toNumber(value);
        if (numeric == null) return null;
        return Math.max(min, Math.min(max, numeric));
    },

    getMonthStart(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
        return new Date(date.getFullYear(), date.getMonth(), 1);
    },

    getMonthEnd(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
        return new Date(date.getFullYear(), date.getMonth() + 1, 0);
    },

    addMonthsClamped(date, offset) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
        const day = date.getDate();
        const target = new Date(date.getFullYear(), date.getMonth() + offset, 1);
        const end = new Date(target.getFullYear(), target.getMonth() + 1, 0);
        target.setDate(Math.min(day, end.getDate()));
        return target;
    },

    buildMonthRangeByOffset(anchorDateText = '', offset = 0) {
        const anchor = this.parseDate(anchorDateText);
        if (!anchor) return null;
        const shifted = this.addMonthsClamped(anchor, offset);
        const start = this.getMonthStart(shifted);
        const end = this.getMonthEnd(shifted);
        return start && end ? {
            startDate: this.formatDate(start),
            endDate: this.formatDate(end)
        } : null;
    },

    buildYearRangeByOffset(anchorDateText = '', offset = -1) {
        const anchor = this.parseDate(anchorDateText);
        if (!anchor) return null;
        const shifted = this.addMonthsClamped(anchor, offset * 12);
        const start = this.getMonthStart(shifted);
        const end = this.getMonthEnd(shifted);
        return start && end ? {
            startDate: this.formatDate(start),
            endDate: this.formatDate(end)
        } : null;
    },

    buildShiftedDateRange(startText = '', endText = '', monthOffset = 0) {
        const start = this.parseDate(startText);
        const end = this.parseDate(endText);
        if (!start || !end || start > end) return null;
        const shiftedStart = this.addMonthsClamped(start, monthOffset);
        const shiftedEnd = this.addMonthsClamped(end, monthOffset);
        if (!shiftedStart || !shiftedEnd || shiftedStart > shiftedEnd) return null;
        return {
            startDate: this.formatDate(shiftedStart),
            endDate: this.formatDate(shiftedEnd)
        };
    },

    calcCoefficientOfVariation(values = []) {
        const nums = (values || []).map(value => this.toNumber(value)).filter(value => value != null);
        if (nums.length < 2) return 0;
        const mean = nums.reduce((sum, value) => sum + value, 0) / nums.length;
        if (mean <= 0) return 0;
        const variance = nums.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / nums.length;
        return Math.sqrt(variance) / mean;
    }
};

window.YejiPlcxQsZfxJd3Gongju = YejiPlcxQsZfxJd3Gongju;
