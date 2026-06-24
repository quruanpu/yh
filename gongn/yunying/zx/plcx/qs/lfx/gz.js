// Rate trend analysis rules: numerator/denominator rates and target gaps.
const YejiPlcxQsLfxGuize = {
    rateMap: {
        '不含税边际利润率': {
            numeratorName: '不含税边际利润',
            denominatorName: '不含税金额',
            direction: 'positive',
            typeName: '利润率',
            numeratorRole: 'profit',
            denominatorRole: 'revenue',
            numeratorLabel: '边际利润',
            denominatorLabel: '不含税金额'
        },
        '不含税p4毛利率': {
            numeratorName: '不含税p4毛利额',
            denominatorName: '不含税金额',
            direction: 'positive',
            typeName: '利润率',
            numeratorRole: 'profit',
            denominatorRole: 'revenue',
            numeratorLabel: 'P4毛利额',
            denominatorLabel: '不含税金额'
        },
        '不含税配送费率': {
            numeratorName: '不含税配送费',
            denominatorName: '不含税金额',
            direction: 'negative',
            typeName: '费用率',
            numeratorRole: 'cost',
            denominatorRole: 'revenue',
            numeratorLabel: '配送费',
            denominatorLabel: '不含税金额'
        },
        '不含税人工费率': {
            numeratorName: '不含税仓库人工费',
            denominatorName: '不含税金额',
            direction: 'negative',
            typeName: '费用率',
            numeratorRole: 'cost',
            denominatorRole: 'revenue',
            numeratorLabel: '人工费',
            denominatorLabel: '不含税金额'
        },
        '不含税平台费率': {
            numeratorName: '不含税平台费',
            denominatorName: '不含税金额',
            direction: 'negative',
            typeName: '费用率',
            numeratorRole: 'cost',
            denominatorRole: 'revenue',
            numeratorLabel: '平台费',
            denominatorLabel: '不含税金额'
        }
    },

    normalizeName(name = '') {
        return window.YejiPlcxHbGuize?.normalizeName
            ? window.YejiPlcxHbGuize.normalizeName(name)
            : String(name || '').replace(/\s+/g, '').toLowerCase();
    },

    getRateMeta(metricName = '') {
        const normalized = this.normalizeName(metricName);
        const entry = Object.entries(this.rateMap).find(([name]) => this.normalizeName(name) === normalized);
        if (!entry) return null;
        return {
            metricName: entry[0],
            ...entry[1]
        };
    },

    toNumber(value) {
        if (value == null || value === '') return null;
        const text = String(value).replace(/,/g, '').trim();
        const numeric = Number(text.replace(/[%％]$/, ''));
        if (!Number.isFinite(numeric)) return null;
        return /[%％]$/.test(text) ? numeric / 100 : numeric;
    },

    toTargetRate(value) {
        const numeric = this.toNumber(value);
        if (numeric == null) return null;
        return Math.abs(numeric) > 1 ? numeric / 100 : numeric;
    },

    calcRate(numerator, denominator) {
        const top = this.toNumber(numerator);
        const bottom = this.toNumber(denominator);
        if (top == null || bottom == null || bottom === 0) return '';
        return top / bottom;
    },

    calcTargetGap(rate, target) {
        const current = this.toNumber(rate);
        const targetRate = this.toTargetRate(target);
        if (current == null || targetRate == null) return '';
        return current - targetRate;
    },

    calcEffectiveGap(rate, target, meta = {}) {
        const gap = this.calcTargetGap(rate, target);
        if (gap === '') return '';
        return meta.direction === 'negative' ? -gap : gap;
    },

    calcChange(current, previous) {
        const currentNumber = this.toNumber(current);
        const previousNumber = this.toNumber(previous);
        if (currentNumber == null || previousNumber == null) return '';
        return currentNumber - previousNumber;
    },

    calcGrowth(current, previous) {
        const currentNumber = this.toNumber(current);
        const previousNumber = this.toNumber(previous);
        if (currentNumber == null || previousNumber == null || previousNumber === 0) return null;
        return currentNumber / previousNumber - 1;
    },

    calcContribution(previous = {}, current = {}) {
        const n0 = this.toNumber(previous.cumNumerator);
        const d0 = this.toNumber(previous.cumDenominator);
        const n1 = this.toNumber(current.cumNumerator);
        const d1 = this.toNumber(current.cumDenominator);
        if (n0 == null || d0 == null || n1 == null || d1 == null || d0 === 0 || d1 === 0) {
            return {
                rateChange: '',
                numeratorContribution: '',
                denominatorContribution: ''
            };
        }
        const numeratorChange = n1 - n0;
        const numeratorContribution = 0.5 * ((numeratorChange / d0) + (numeratorChange / d1));
        const denominatorContribution = 0.5 * (n0 + n1) * ((1 / d1) - (1 / d0));
        return {
            rateChange: this.calcChange(n1 / d1, n0 / d0),
            numeratorContribution,
            denominatorContribution
        };
    },

    getDirectionText(meta = {}) {
        if (meta.direction === 'negative') return '越低越好';
        if (meta.direction === 'positive') return '越高越好';
        return '方向未知';
    },

    getTargetStatus(effectiveGap) {
        const gap = this.toNumber(effectiveGap);
        if (gap == null) return '数据不足';
        if (gap >= 0) return '达标';
        if (gap >= -0.002) return '轻微偏离';
        if (gap >= -0.01) return '明显偏离';
        return '高风险';
    },

    getBaseReliability(row = {}, denominatorMax = 0) {
        const denominator = Math.abs(this.toNumber(row.cumDenominator) ?? 0);
        const progress = this.toNumber(row.queryProgress);
        if (!denominator || denominator <= 0) return '基数不足';
        const share = denominatorMax > 0 ? denominator / denominatorMax : 1;
        if (share < 0.08 || (progress != null && progress < 0.08)) return '低';
        if (share < 0.2 || (progress != null && progress < 0.2)) return '中';
        return '高';
    },

    getPartLabels(meta = {}) {
        return {
            numerator: meta.numeratorLabel || meta.numeratorName || '依赖字段',
            denominator: meta.denominatorLabel || meta.denominatorName || '业务基数'
        };
    },

    getMainDriver(row = {}, meta = {}) {
        if (row.baseReliability === '基数不足' || row.baseReliability === '低') return '基数不足';
        const rateChange = Math.abs(this.toNumber(row.rateChange) ?? 0);
        const numerator = Math.abs(this.toNumber(row.numeratorContribution) ?? 0);
        const denominator = Math.abs(this.toNumber(row.denominatorContribution) ?? 0);
        const labels = this.getPartLabels(meta);
        if (rateChange < 0.0005) return '变化不明显';
        if (numerator >= denominator * 1.4) return `${labels.numerator}主导`;
        if (denominator >= numerator * 1.4) return `${labels.denominator}主导`;
        return '共同影响';
    },

    getMainReason(row = {}, meta = {}) {
        const labels = this.getPartLabels(meta);
        if (row.baseReliability === '基数不足' || row.baseReliability === '低') return `${labels.denominator}基数偏小，率波动需谨慎判断`;
        const status = row.cumulativeTargetStatus || '';
        const driver = row.mainDriver || '';
        const effectiveRateChange = this.toNumber(row.effectiveRateChange);
        if (status === '达标' && driver === '变化不明显') return '累计率达标且波动较小';
        if (status === '达标') return meta.direction === 'negative' ? '费用率控制优于目标' : '利润率表现优于目标';
        if (driver === `${labels.numerator}主导`) {
            return meta.numeratorRole === 'cost'
                ? `${labels.numerator}变化主导率偏离`
                : `${labels.numerator}变化主导率偏离`;
        }
        if (driver === `${labels.denominator}主导`) return `${labels.denominator}变化主导率波动`;
        if (driver === '共同影响') return `${labels.numerator}和${labels.denominator}共同影响率变化`;
        if (effectiveRateChange != null && effectiveRateChange < 0) return '率变化方向转弱';
        return '目标差仍需观察';
    },

    getActionSuggestion(row = {}, meta = {}) {
        const labels = this.getPartLabels(meta);
        if (row.baseReliability === '基数不足' || row.baseReliability === '低') return `先补足${labels.denominator}规模，再判断率波动`;
        const status = row.cumulativeTargetStatus || '';
        if (status === '达标') return meta.direction === 'negative'
            ? `保持费用控制，继续观察${labels.numerator}绝对值和${labels.denominator}规模`
            : `保持盈利质量，继续观察${labels.numerator}和${labels.denominator}结构`;
        if (meta.numeratorRole === 'profit') return '优先复盘毛利结构、价格让利和低毛利品类占比';
        if (meta.numeratorRole === 'cost') return `优先复盘${labels.numerator}增长、履约承接和${labels.denominator}摊薄效果`;
        return `结合${labels.numerator}和${labels.denominator}变化复盘口径和结构`;
    },

    decorateRows(rows = [], context = {}) {
        const meta = context.rateMeta || {};
        const denominatorMax = Math.max(
            0,
            ...(rows || []).map(row => Math.abs(this.toNumber(row?.cumDenominator) ?? 0))
        );
        let previous = null;
        return rows.map(row => {
            const dailyEffectiveGap = this.calcEffectiveGap(row.dailyActual, context.targetValue, meta);
            const cumulativeEffectiveGap = this.calcEffectiveGap(row.actual, context.targetValue, meta);
            const contribution = previous && !row.loading ? this.calcContribution(previous, row) : {
                rateChange: '',
                numeratorContribution: '',
                denominatorContribution: ''
            };
            const effectiveRateChange = contribution.rateChange === ''
                ? ''
                : (meta.direction === 'negative' ? -contribution.rateChange : contribution.rateChange);
            const next = {
                ...row,
                targetRate: this.toTargetRate(context.targetValue),
                directionText: this.getDirectionText(meta),
                dailyTargetGap: this.calcTargetGap(row.dailyActual, context.targetValue),
                cumulativeTargetGap: this.calcTargetGap(row.actual, context.targetValue),
                dailyEffectiveGap,
                cumulativeEffectiveGap,
                dailyTargetStatus: this.getTargetStatus(dailyEffectiveGap),
                cumulativeTargetStatus: this.getTargetStatus(cumulativeEffectiveGap),
                rateChange: contribution.rateChange,
                effectiveRateChange,
                numeratorContribution: contribution.numeratorContribution,
                denominatorContribution: contribution.denominatorContribution
            };
            next.baseReliability = this.getBaseReliability(next, denominatorMax);
            next.mainDriver = this.getMainDriver(next, meta);
            next.mainReason = this.getMainReason(next, meta);
            next.actionSuggestion = this.getActionSuggestion(next, meta);
            if (!row.loading) previous = next;
            return {
                ...next
            };
        });
    },

    formatPercent(value) {
        const numeric = this.toNumber(value);
        if (numeric == null) return '-';
        return `${(numeric * 100).toFixed(2)}%`;
    },

    formatPoint(value, signed = false) {
        const numeric = this.toNumber(value);
        if (numeric == null) return '-';
        const sign = signed && numeric > 0 ? '+' : '';
        return `${sign}${(numeric * 100).toFixed(2)}个百分点`;
    }
};

window.YejiPlcxQsLfxGuize = YejiPlcxQsLfxGuize;
