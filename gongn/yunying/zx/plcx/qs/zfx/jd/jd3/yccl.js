// Value trend stage 3 preprocessing: normalize rows into comparable daily series.
const YejiPlcxQsZfxJd3Yuchuli = {
    buildStage3Series(rows = [], context = {}) {
        const totalWeight = this.getTotalIndustryWeight(context);
        const validRows = (rows || []).filter(row => row && !row.loading);
        return validRows.map((row, index) => {
            const date = this.parseDate(row.endDate);
            const detail = row.industryWeightDetail || this.getIndustryDayWeightDetail(date, context);
            const dayWeight = this.toNumber(row.industryDayWeight) ?? this.toNumber(detail?.weight) ?? 0;
            const elapsedWeight = this.getElapsedIndustryWeight(context, row.endDate);
            const actual = this.toNumber(row.actual);
            const dailyActual = this.toNumber(row.dailyActual);
            return {
                ...row,
                seriesIndex: index,
                date,
                dateText: row.endDate || '',
                dayOfWeek: date ? date.getDay() : null,
                dayOfMonth: date ? date.getDate() : null,
                monthWeekIndex: date ? this.getMonthWeekIndex(date) : 0,
                completeWeekIndex: date ? this.getCompleteWeekIndex(date) : 0,
                monthStage: date ? this.getMonthStageLabel(date) : '',
                isHolidayLike: this.isHolidayLikeDay(detail),
                isActivityLike: this.isActivityLikeDay(detail),
                dayWeight,
                elapsedWeight,
                totalWeight,
                progressRatio: totalWeight > 0 ? Math.max(0, Math.min(1, elapsedWeight / totalWeight)) : '',
                actual,
                dailyActual,
                cumulativeShare: actual != null ? actual : ''
            };
        });
    },

    getCompleteWeekIndex(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 0;
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        let firstMonday = new Date(monthStart);
        const offset = (8 - firstMonday.getDay()) % 7;
        firstMonday = this.addDays(firstMonday, offset);
        if (!firstMonday || date < firstMonday) return 0;
        return Math.floor(this.diffDays(firstMonday, date) / 7) + 1;
    },

    getMonthStageLabel(date) {
        const weekIndex = this.getMonthWeekIndex(date);
        if (weekIndex <= 1) return '月初';
        if (weekIndex === 2) return '第2周';
        if (weekIndex === 3) return '第3周';
        if (weekIndex === 4) return '第4周';
        return '月底';
    },

    isHolidayLikeDay(detail = {}) {
        const factor = this.toNumber(detail?.holidayFactor);
        return factor != null && Math.abs(factor - 1) > 0.01;
    },

    isActivityLikeDay(detail = {}) {
        const factor = this.toNumber(detail?.activityFactor);
        return factor != null && Math.abs(factor - 1) > 0.01;
    },

    getSeriesFinalActual(series = []) {
        const last = (series || []).filter(Boolean).slice(-1)[0];
        const actual = this.toNumber(last?.actual);
        return actual != null && actual > 0 ? actual : null;
    }
};

window.YejiPlcxQsZfxJd3Yuchuli = YejiPlcxQsZfxJd3Yuchuli;
