// Value trend stage 3 baseline-date matching: align comparable days before history forecasting.
const YejiPlcxQsZfxJd3Jizhunri = {
    findBaselineDate(currentItem = {}, referenceSeries = []) {
        const candidates = (referenceSeries || []).filter(Boolean);
        if (!currentItem || !candidates.length) return null;
        const scored = candidates
            .map(item => this.scoreBaselineDate(currentItem, item))
            .sort((a, b) => b.score - a.score);
        return scored[0] || null;
    },

    scoreBaselineDate(currentItem = {}, referenceItem = {}) {
        let score = 0;
        const reasons = [];

        const holidayScore = this.scoreHolidayMatch(currentItem, referenceItem);
        score += holidayScore.score;
        if (holidayScore.reason) reasons.push(holidayScore.reason);

        if (currentItem.completeWeekIndex > 0 && currentItem.completeWeekIndex === referenceItem.completeWeekIndex) {
            score += 26;
            reasons.push(`第${currentItem.completeWeekIndex}个完整周`);
        } else if (currentItem.monthWeekIndex && currentItem.monthWeekIndex === referenceItem.monthWeekIndex) {
            score += 14;
            reasons.push(currentItem.monthStage || '月内阶段相近');
        }

        if (currentItem.dayOfWeek != null && currentItem.dayOfWeek === referenceItem.dayOfWeek) {
            score += this.getWeekdayMatchWeight(currentItem.dayOfWeek);
            reasons.push(currentItem.weekday || '星期一致');
        }

        if (currentItem.monthStage && currentItem.monthStage === referenceItem.monthStage) {
            score += 10;
        }

        const progressGap = Math.abs((this.toNumber(currentItem.progressRatio) ?? 0) - (this.toNumber(referenceItem.progressRatio) ?? 0));
        score += Math.max(0, 20 - (progressGap * 80));

        const ordinalGap = Math.abs((currentItem.seriesIndex || 0) - (referenceItem.seriesIndex || 0));
        score += Math.max(0, 10 - ordinalGap);

        const weightRatio = this.calcWeightSimilarity(currentItem.dayWeight, referenceItem.dayWeight);
        score += weightRatio * 10;
        if (weightRatio >= 0.88) reasons.push('行业权重相近');

        const matchType = this.getBaselineMatchType(currentItem, referenceItem, reasons);
        return {
            currentDate: currentItem.dateText || '',
            referenceDate: referenceItem.dateText || '',
            currentIndex: currentItem.seriesIndex,
            referenceIndex: referenceItem.seriesIndex,
            referenceItem,
            score: Math.max(0, Math.min(100, score)),
            matchType,
            reasons
        };
    },

    scoreHolidayMatch(currentItem = {}, referenceItem = {}) {
        if (currentItem.isHolidayLike && referenceItem.isHolidayLike) {
            return { score: 30, reason: '节假日修正匹配' };
        }
        if (currentItem.isHolidayLike || referenceItem.isHolidayLike) {
            return { score: -35, reason: '节假日错位' };
        }
        if (currentItem.isActivityLike && referenceItem.isActivityLike) {
            return { score: 18, reason: '活动修正匹配' };
        }
        if (currentItem.isActivityLike || referenceItem.isActivityLike) {
            return { score: -16, reason: '活动修正错位' };
        }
        return { score: 8, reason: '常规日匹配' };
    },

    getWeekdayMatchWeight(day) {
        if (day === 1) return 24;
        if (day === 3) return 21;
        if (day === 0) return 19;
        return 16;
    },

    calcWeightSimilarity(a, b) {
        const left = this.toNumber(a);
        const right = this.toNumber(b);
        if (left == null || right == null || left <= 0 || right <= 0) return 0;
        return Math.max(0, Math.min(1, Math.min(left, right) / Math.max(left, right)));
    },

    getBaselineMatchType(currentItem = {}, referenceItem = {}, reasons = []) {
        if (reasons.includes('节假日修正匹配')) return '节假日基准';
        if (currentItem.completeWeekIndex > 0 && currentItem.completeWeekIndex === referenceItem.completeWeekIndex && currentItem.dayOfWeek === referenceItem.dayOfWeek) {
            return '完整周星期基准';
        }
        if (currentItem.dayOfWeek === referenceItem.dayOfWeek) return '星期基准';
        if (currentItem.monthStage === referenceItem.monthStage) return '月内阶段基准';
        return '顺序基准';
    },

    buildBaselineMap(currentSeries = [], referenceSeries = []) {
        return (currentSeries || [])
            .map(item => this.findBaselineDate(item, referenceSeries))
            .filter(Boolean);
    },

    findBaselineForProgress(currentSeries = [], referenceSeries = [], progress) {
        const targetProgress = this.toNumber(progress);
        const validCurrent = (currentSeries || []).filter(Boolean);
        if (!validCurrent.length || targetProgress == null) return null;
        const currentItem = validCurrent.reduce((best, item) => {
            const gap = Math.abs((this.toNumber(item.progressRatio) ?? 0) - targetProgress);
            if (!best || gap < best.gap) return { item, gap };
            return best;
        }, null)?.item;
        return currentItem ? this.findBaselineDate(currentItem, referenceSeries) : null;
    }
};

window.YejiPlcxQsZfxJd3Jizhunri = YejiPlcxQsZfxJd3Jizhunri;
