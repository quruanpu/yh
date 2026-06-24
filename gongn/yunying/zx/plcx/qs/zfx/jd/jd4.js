// Value trend stage 4: scored business diagnosis and action guidance.
const YejiPlcxQsZfxJd4 = {
    clamp(value, min, max) {
        const numeric = this.toNumber(value);
        if (numeric == null) return null;
        return Math.max(min, Math.min(max, numeric));
    },

    getSampleDays(row = {}, index = 0) {
        const recent = this.toNumber(row.recentValidDays);
        if (recent != null && recent > 0) return recent;
        return Math.max(0, index + 1);
    },

    scoreIndustryPace(row = {}) {
        const pace = this.toNumber(row.industryPace);
        if (pace == null) return 0;
        if (pace >= 1.12) return 24;
        if (pace >= 1.03) return 18;
        if (pace >= 0.97) return 12;
        if (pace >= 0.90) return 2;
        if (pace >= 0.80) return -12;
        return -24;
    },

    scoreForecast(row = {}) {
        const targetGap = this.toNumber(row.targetGapValue);
        const achievement = this.toNumber(row.forecastAchievement);
        const lowAchievement = this.toNumber(row.forecastLowAchievement);
        const highAchievement = this.toNumber(row.forecastHighAchievement);
        if (targetGap != null && targetGap <= 0) return 28;
        if (lowAchievement != null && lowAchievement >= 1) return 24;
        if (achievement != null && achievement >= 1) return 16;
        if (highAchievement != null && highAchievement >= 1) return 6;
        if (achievement != null && achievement >= 0.95) return -4;
        if (achievement != null && achievement >= 0.85) return -14;
        if (achievement != null) return -26;
        return 0;
    },

    scorePressure(row = {}) {
        const pressure = this.toNumber(row.pressureIndex);
        const targetGap = this.toNumber(row.targetGapValue);
        if (targetGap != null && targetGap <= 0) return 22;
        if (pressure == null) return 0;
        if (pressure <= 0.92) return 18;
        if (pressure <= 1.08) return 10;
        if (pressure <= 1.20) return 0;
        if (pressure <= 1.50) return -14;
        return -26;
    },

    scoreMomentum(row = {}) {
        const recent = this.toNumber(row.recentWeightedDailyAvg);
        const cumulative = this.toNumber(row.cumulativeWeightedDailyAvg);
        const speed = this.toNumber(row.speed);
        let score = 0;
        if (recent != null && cumulative != null && cumulative > 0) {
            const ratio = recent / cumulative;
            if (ratio >= 1.12) score += 10;
            else if (ratio >= 0.98) score += 4;
            else if (ratio >= 0.88) score -= 4;
            else score -= 10;
        }
        if (speed != null) {
            if (speed >= 1.1) score += 6;
            else if (speed < 0.8) score -= 6;
        }
        return score;
    },

    scoreConfidence(row = {}, index = 0) {
        const confidence = this.getDecisionConfidence(row, index);
        if (confidence === '高') return 6;
        if (confidence === '中') return 0;
        return -8;
    },

    calcDiagnosisScore(row = {}, index = 0) {
        const score = this.scoreIndustryPace(row)
            + this.scoreForecast(row)
            + this.scorePressure(row)
            + this.scoreMomentum(row)
            + this.scoreConfidence(row, index);
        return Math.round(score);
    },

    getDecisionConfidence(row = {}, index = 0) {
        const industryProgress = this.toNumber(row.industryProgress);
        const sampleDays = this.getSampleDays(row, index);
        const uncertainty = this.toNumber(row.forecastUncertainty);
        if (
            sampleDays < 2
            || (industryProgress != null && industryProgress < 0.08)
            || (uncertainty != null && uncertainty >= 0.28)
        ) {
            return '低';
        }
        if (
            sampleDays < 3
            || (industryProgress != null && industryProgress < 0.2)
            || (uncertainty != null && uncertainty >= 0.20)
        ) {
            return '中';
        }
        return '高';
    },

    getBusinessLevel(row = {}, score = this.calcDiagnosisScore(row)) {
        const targetGap = this.toNumber(row.targetGapValue);
        const industryPace = this.toNumber(row.industryPace);
        const forecastAchievement = this.toNumber(row.forecastAchievement);
        const forecastLowAchievement = this.toNumber(row.forecastLowAchievement);
        if (targetGap != null && targetGap <= 0) return '已完成';
        if (
            (forecastLowAchievement != null && forecastLowAchievement >= 1 && score >= 40)
            || (
                industryPace != null
                && industryPace >= 1.08
                && forecastAchievement != null
                && forecastAchievement >= 1.1
                && score >= 48
            )
        ) {
            return '强势达标';
        }
        if ((forecastAchievement != null && forecastAchievement >= 1) || score >= 24) return '稳健达标';
        if (score >= 8) return '可追平';
        if (score >= -8) return '轻微滞后';
        if (score >= -28) return '明显滞后';
        return '高风险';
    },

    buildReasonCandidates(row = {}) {
        const candidates = [];
        const targetGap = this.toNumber(row.targetGapValue);
        const industryPace = this.toNumber(row.industryPace);
        const pace = this.toNumber(row.pace);
        const pressure = this.toNumber(row.pressureIndex);
        const achievement = this.toNumber(row.forecastAchievement);
        const lowAchievement = this.toNumber(row.forecastLowAchievement);
        const recent = this.toNumber(row.recentWeightedDailyAvg);
        const cumulative = this.toNumber(row.cumulativeWeightedDailyAvg);
        const speed = this.toNumber(row.speed);

        if (targetGap != null && targetGap <= 0) {
            candidates.push({ text: '累计已覆盖目标', weight: 100 });
        }
        if (row.historyTrendEnhanced) {
            candidates.push({ text: '历史趋势已参与预测校准', weight: 66 });
        }
        if (lowAchievement != null && lowAchievement >= 1) {
            candidates.push({ text: '保守预测仍可达标', weight: 90 });
        } else if (achievement != null && achievement >= 1) {
            candidates.push({ text: '中性预测可达标', weight: 76 });
        } else if (achievement != null && achievement < 0.9) {
            candidates.push({ text: '预测月底缺口偏大', weight: 82 });
        }
        if (industryPace != null && industryPace >= 1.08) {
            candidates.push({ text: '行业节奏明显领先', weight: 84 });
        } else if (industryPace != null && industryPace >= 0.97) {
            candidates.push({ text: '行业节奏基本匹配', weight: 62 });
        } else if (industryPace != null && industryPace < 0.9) {
            candidates.push({ text: '累计低于行业应达节奏', weight: 88 });
        }
        if (pressure != null && pressure > 1.5) {
            candidates.push({ text: '剩余加权日均压力过高', weight: 86 });
        } else if (pressure != null && pressure > 1.2) {
            candidates.push({ text: '剩余加权日均压力偏高', weight: 74 });
        } else if (pressure != null && pressure <= 1.08 && targetGap != null && targetGap > 0) {
            candidates.push({ text: '剩余压力仍在可追范围', weight: 60 });
        }
        if (pace != null && pace < 0.92) {
            candidates.push({ text: '线性进度落后', weight: 54 });
        }
        if (recent != null && cumulative != null && cumulative > 0) {
            const ratio = recent / cumulative;
            if (ratio >= 1.12) candidates.push({ text: '近三日动能改善', weight: 58 });
            else if (ratio < 0.88) candidates.push({ text: '近三日动能转弱', weight: 58 });
        }
        if (speed != null && speed < 0.8) candidates.push({ text: '当日完成强度偏弱', weight: 45 });

        return candidates.sort((a, b) => b.weight - a.weight);
    },

    getMainReason(row = {}) {
        const candidates = this.buildReasonCandidates(row);
        return candidates.slice(0, 2).map(item => item.text).join('；') || '当前信号相对平稳';
    },

    getNextHighWeightHint(row = {}, context = {}) {
        const current = this.parseDate(row.endDate);
        const periodEnd = this.parseDate(context.periodEnd || context.dateInfo?.range?.[1]);
        if (!current || !periodEnd) return '';
        for (let date = this.addDays(current, 1); date && date <= periodEnd; date = this.addDays(date, 1)) {
            const day = date.getDay();
            if (day === 1) return '下一个周一高峰';
            if (day === 3) return '下一个周三小高峰';
        }
        return '';
    },

    getActionSuggestion(row = {}, context = {}) {
        const level = row.businessLevel || this.getBusinessLevel(row);
        const hint = this.getNextHighWeightHint(row, context);
        if (level === '已完成') return '保持投放效率，关注利润和异常波动';
        if (level === '强势达标') return '承接当前节奏，重点守住周一和周三高峰';
        if (level === '稳健达标') return '维持现有动作，继续观察预测下沿和剩余压力';
        if (level === '可追平') return hint ? `优先盯${hint}，补足当日完成强度` : '优先盯高权重日，补足当日完成强度';
        if (level === '轻微滞后') return hint ? `控制缺口扩大，等${hint}集中修复` : '提升近三日完成强度，避免缺口扩大';
        if (level === '明显滞后') return '复盘活动、供给和转化承接，优先拉升高权重日期';
        return '需要提前干预目标缺口，单靠自然节奏较难修复';
    },

    decorateStage4Rows(rows = [], context = {}) {
        return (rows || []).map((row, index) => {
            if (row.loading) return row;
            const diagnosisScore = this.calcDiagnosisScore(row, index);
            const businessLevel = this.getBusinessLevel(row, diagnosisScore);
            const next = {
                ...row,
                diagnosisScore,
                businessLevel,
                decisionConfidence: this.getDecisionConfidence(row, index)
            };
            return {
                ...next,
                mainReason: this.getMainReason(next),
                actionSuggestion: this.getActionSuggestion(next, context)
            };
        });
    },

    decorateRows(rows = [], context = {}) {
        const stage1Rows = typeof this.decorateStage1Rows === 'function'
            ? this.decorateStage1Rows(rows)
            : rows;
        const stage2Rows = typeof this.decorateStage2Rows === 'function'
            ? this.decorateStage2Rows(stage1Rows, context)
            : stage1Rows;
        const stage3Rows = typeof this.decorateStage3Rows === 'function'
            ? this.decorateStage3Rows(stage2Rows, context)
            : stage2Rows;
        return this.decorateStage4Rows(stage3Rows, context);
    }
};

window.YejiPlcxQsZfxJd4 = YejiPlcxQsZfxJd4;
