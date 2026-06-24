// Value trend stage 2: industry-weighted rhythm progress and pressure.
const YejiPlcxQsZfxJd2 = {
    weekdayWeights: {
        0: 0.45,
        1: 1.55,
        2: 1.00,
        3: 1.25,
        4: 1.05,
        5: 0.85,
        6: 0.75
    },

    seasonFactors: {
        1: 1.12,
        2: 0.98,
        3: 0.96,
        4: 0.94,
        5: 0.92,
        6: 0.90,
        7: 0.86,
        8: 0.85,
        9: 0.93,
        10: 1.00,
        11: 1.06,
        12: 1.10
    },

    parseDate(value) {
        return window.YejiPlcxMbGuize?.parseDate(value) || null;
    },

    addDays(date, days) {
        return window.YejiPlcxMbGuize?.addDays(date, days) || null;
    },

    diffDays(start, end) {
        return window.YejiPlcxMbGuize?.diffDays(start, end) ?? 0;
    },

    formatDate(date) {
        return window.YejiPlcxMbGuize?.formatDate(date) || '';
    },

    getMonthWeekIndex(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 0;
        return Math.ceil(date.getDate() / 7);
    },

    getMonthStageFactor(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 1;
        const weekIndex = this.getMonthWeekIndex(date);
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
        if (weekIndex <= 1) {
            if (firstDay === 1) return 1.22;
            if (firstDay === 0 || firstDay === 6) return 1.02;
            return 1.14;
        }
        if (weekIndex === 2) return 0.95;
        if (weekIndex === 3) return 1.03;
        if (weekIndex === 4) return 0.88;
        return 0.78;
    },

    getFirstWeekDelayFactor(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 1;
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
        if (firstDay !== 0 && firstDay !== 6) return 1;
        if (date.getDay() === 1 && date.getDate() <= 9) return 1.12;
        return 1;
    },

    getSeasonFactor(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 1;
        return this.seasonFactors[date.getMonth() + 1] || 1;
    },

    getExternalDayFactor(context = {}, date) {
        const key = this.formatDate(date);
        const factors = context.industryDayFactors || context.dayFactors || {};
        const value = key ? this.toNumber(factors[key]) : null;
        return value != null && value > 0 ? value : 1;
    },

    getHolidayFactor(context = {}, date) {
        const key = this.formatDate(date);
        const factors = context.holidayFactors || {};
        const value = key ? this.toNumber(factors[key]) : null;
        return value != null && value > 0 ? value : 1;
    },

    getActivityFactor(context = {}, date) {
        const key = this.formatDate(date);
        const factors = context.activityFactors || {};
        const value = key ? this.toNumber(factors[key]) : null;
        return value != null && value > 0 ? value : 1;
    },

    getIndustryDayWeightDetail(date, context = {}) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 0;
        const weekdayWeight = this.weekdayWeights[date.getDay()] ?? 1;
        const monthStageFactor = this.getMonthStageFactor(date);
        const firstWeekDelayFactor = this.getFirstWeekDelayFactor(date);
        const seasonFactor = this.getSeasonFactor(date);
        const holidayFactor = this.getHolidayFactor(context, date);
        const activityFactor = this.getActivityFactor(context, date);
        const externalFactor = this.getExternalDayFactor(context, date);
        const weight = weekdayWeight
            * monthStageFactor
            * firstWeekDelayFactor
            * seasonFactor
            * holidayFactor
            * activityFactor
            * externalFactor;
        return {
            weight,
            weekdayWeight,
            monthStageFactor,
            firstWeekDelayFactor,
            seasonFactor,
            holidayFactor,
            activityFactor,
            externalFactor
        };
    },

    getIndustryDayWeight(date, context = {}) {
        const detail = this.getIndustryDayWeightDetail(date, context);
        return typeof detail === 'number' ? detail : detail.weight;
    },

    getIndustryWeightReason(date, context = {}) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        const detail = this.getIndustryDayWeightDetail(date, context);
        const reasons = [];
        const weekday = date.getDay();
        if (weekday === 1) reasons.push('周一促销高峰');
        else if (weekday === 3) reasons.push('周三连锁小高峰');
        else if (weekday === 0) reasons.push('周日低谷');
        else if (weekday === 6) reasons.push('周六拼团弱拉升');

        const weekIndex = this.getMonthWeekIndex(date);
        if (weekIndex <= 1) reasons.push('月初加权');
        else if (weekIndex === 2) reasons.push('第2周回落');
        else if (weekIndex === 3) reasons.push('第3周修复');
        else if (weekIndex >= 4) reasons.push('月后段回落');

        if (detail.firstWeekDelayFactor > 1) reasons.push('月初周末后延');
        if (detail.seasonFactor >= 1.05) reasons.push('旺季加权');
        if (detail.seasonFactor <= 0.92) reasons.push('淡季保守');
        if (detail.holidayFactor !== 1) reasons.push('节假日修正');
        if (detail.activityFactor !== 1) reasons.push('活动修正');
        if (detail.externalFactor !== 1) reasons.push('外部权重修正');
        return reasons.join('、') || '常规日';
    },

    sumIndustryWeights(startDate, endDate, context = {}) {
        const start = this.parseDate(startDate);
        const end = this.parseDate(endDate);
        if (!start || !end || start > end) return 0;
        let total = 0;
        for (let date = new Date(start); date <= end; date = this.addDays(date, 1)) {
            total += this.getIndustryDayWeight(date, context);
        }
        return total;
    },

    getIndustryProgress(context = {}, nodeEndDate = '') {
        const startDate = context.dateInfo?.range?.[0] || '';
        const periodEnd = context.periodEnd || context.dateInfo?.range?.[1] || '';
        const totalWeight = this.sumIndustryWeights(startDate, periodEnd, context);
        const elapsedWeight = this.sumIndustryWeights(startDate, nodeEndDate, context);
        if (!Number.isFinite(totalWeight) || totalWeight <= 0) return '';
        return Math.max(0, Math.min(1, elapsedWeight / totalWeight));
    },

    getRemainingIndustryWeight(context = {}, nodeEndDate = '') {
        const nextDate = this.addDays(this.parseDate(nodeEndDate), 1);
        if (!nextDate) return 0;
        const nextText = window.YejiPlcxMbGuize?.formatDate(nextDate) || '';
        const periodEnd = context.periodEnd || context.dateInfo?.range?.[1] || '';
        return this.sumIndustryWeights(nextText, periodEnd, context);
    },

    calcIndustryExpectedValue(target, industryProgress) {
        const targetNumber = this.toNumber(target);
        const progress = this.toNumber(industryProgress);
        if (targetNumber == null || progress == null) return '';
        return targetNumber * progress;
    },

    calcIndustryGap(actual, expected) {
        const actualNumber = this.toNumber(actual);
        const expectedNumber = this.toNumber(expected);
        if (actualNumber == null || expectedNumber == null) return '';
        return actualNumber - expectedNumber;
    },

    calcIndustryPace(actual, expected) {
        const actualNumber = this.toNumber(actual);
        const expectedNumber = this.toNumber(expected);
        if (actualNumber == null || expectedNumber == null || expectedNumber === 0) return '';
        return actualNumber / expectedNumber;
    },

    calcTargetGap(actual, target) {
        const actualNumber = this.toNumber(actual);
        const targetNumber = this.toNumber(target);
        if (actualNumber == null || targetNumber == null) return '';
        return targetNumber - actualNumber;
    },

    calcRemainingWeightedDailyNeed(targetGap, remainingWeight) {
        const gap = this.toNumber(targetGap);
        const weight = this.toNumber(remainingWeight);
        if (gap == null) return '';
        if (gap <= 0) return 0;
        if (weight == null || weight <= 0) return '';
        return gap / weight;
    },

    decorateStage2Rows(rows = [], context = {}) {
        return (rows || []).map(row => {
            if (row.loading) return row;
            const industryProgress = this.getIndustryProgress(context, row.endDate);
            const industryExpectedValue = this.calcIndustryExpectedValue(context.targetValue, industryProgress);
            const industryGapValue = this.calcIndustryGap(row.actual, industryExpectedValue);
            const industryPace = this.calcIndustryPace(row.actual, industryExpectedValue);
            const targetGapValue = this.calcTargetGap(row.actual, context.targetValue);
            const remainingIndustryWeight = this.getRemainingIndustryWeight(context, row.endDate);
            const remainingWeightedDailyNeed = this.calcRemainingWeightedDailyNeed(targetGapValue, remainingIndustryWeight);
            const date = this.parseDate(row.endDate);
            const industryWeightDetail = this.getIndustryDayWeightDetail(date, context);
            return {
                ...row,
                industryDayWeight: typeof industryWeightDetail === 'number' ? industryWeightDetail : industryWeightDetail.weight,
                industryWeightReason: this.getIndustryWeightReason(date, context),
                industryWeightDetail,
                industryProgress,
                industryExpectedValue,
                industryGapValue,
                industryPace,
                targetGapValue,
                remainingIndustryWeight,
                remainingWeightedDailyNeed
            };
        });
    },

    decorateRows(rows = [], context = {}) {
        const stage1Rows = typeof this.decorateStage1Rows === 'function'
            ? this.decorateStage1Rows(rows)
            : rows;
        return this.decorateStage2Rows(stage1Rows, context);
    }
};

window.YejiPlcxQsZfxJd2 = YejiPlcxQsZfxJd2;
