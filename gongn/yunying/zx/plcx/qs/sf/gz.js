// BI summary trend algorithm rules: industry rhythm labels and risk interpretation.
const YejiPlcxQsSuanfaGuize = {
    toNumber(value) {
        if (window.YejiPlcxQsGuize?.toNumber) return window.YejiPlcxQsGuize.toNumber(value);
        if (value == null || value === '') return null;
        const numeric = Number(String(value).replace(/,/g, '').trim());
        return Number.isFinite(numeric) ? numeric : null;
    },

    parseDate(value) {
        return window.YejiPlcxMbGuize?.parseDate(value) || null;
    },

    analyzeRow(row = {}, context = {}) {
        if (row.loading) return this.emptyAnalysis(row);
        const date = this.parseDate(row.endDate);
        return {
            weekRole: this.getWeekRole(date),
            monthStage: this.getMonthStage(date),
            paceLevel: this.getPaceLevel(row),
            riskText: this.getRiskText(row, date, context),
            speedText: this.getSpeedText(row.speed),
            accelerationText: this.getAccelerationText(row.acceleration)
        };
    },

    analyzeTrendSummary(rows = [], context = {}) {
        const completed = (rows || []).filter(row => !row.loading && this.toNumber(row.achievement) != null);
        if (!completed.length) {
            return {
                conclusion: '趋势数据加载中',
                risk: '等待累计节点返回后生成判断',
                observe: '优先关注最近3日当日速度与进度差变化',
                details: {
                    highSpeedDays: 0,
                    lowSpeedDays: 0,
                    gapBetterDays: 0,
                    gapWorseDays: 0
                }
            };
        }

        const last = completed[completed.length - 1];
        const recent = completed.slice(-3);
        const streaks = this.calcStreaks(completed);
        const gapTrend = this.calcGapTrend(recent);
        const recentSpeed = this.calcRecentSpeed(recent);
        const keyDay = this.analyzeKeyWeekdays(completed);

        return {
            conclusion: this.buildConclusion(last, streaks, gapTrend, recentSpeed),
            risk: this.buildSummaryRisk(last, streaks, gapTrend, keyDay),
            observe: this.buildObserveText(last, context, keyDay),
            details: {
                ...streaks,
                gapTrend,
                recentSpeed,
                keyDay
            }
        };
    },

    emptyAnalysis(row = {}) {
        const date = this.parseDate(row.endDate);
        return {
            weekRole: this.getWeekRole(date),
            monthStage: this.getMonthStage(date),
            paceLevel: '-',
            riskText: '-',
            speedText: '-',
            accelerationText: '-'
        };
    },

    getWeekRole(date) {
        if (!date) return '-';
        return [
            '周低谷',
            '周促峰值',
            '周一后回落',
            '连锁小高峰',
            '连锁延续',
            '延续回落',
            '拼团观察'
        ][date.getDay()] || '-';
    },

    getMonthStage(date) {
        if (!date) return '-';
        const day = date.getDate();
        const weekIndex = Math.ceil(day / 7);
        if (weekIndex <= 1) return this.getFirstWeekStage(date);
        if (weekIndex === 2) return '自然回落期';
        if (weekIndex === 3) return '修复观察期';
        if (weekIndex === 4) return '后段回落期';
        return '月底尾段';
    },

    getFirstWeekStage(date) {
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        if (firstDay.getDay() === 1) return '月初强促完整周';
        if ([0, 6].includes(firstDay.getDay())) return '月初效应延后';
        return '月初强促非完整周';
    },

    getPaceLevel(row = {}) {
        const gap = this.toNumber(row.gap);
        const pace = this.toNumber(row.pace);
        if (gap == null && pace == null) return '-';
        if ((gap != null && gap >= 0.05) || (pace != null && pace >= 1.1)) return '强势领先';
        if (gap != null && gap >= 0.01) return '正常领先';
        if (gap != null && gap > -0.01) return '基本同步';
        if (gap != null && gap > -0.05) return '轻微落后';
        if (gap != null && gap > -0.1) return '明显落后';
        return '高风险';
    },

    getRiskText(row = {}, date = null) {
        const gap = this.toNumber(row.gap);
        const speed = this.toNumber(row.speed);
        const acceleration = this.toNumber(row.acceleration);
        const day = date?.getDay();
        if (gap == null) return '-';

        if (day === 1 && gap < -0.03) return '周一峰值低于时间节奏，需关注本周补量';
        if (day === 3 && speed != null && speed >= 1.1) return '周三小高峰拉升明显';
        if (day === 0 && gap < 0) return '周日低谷，单日落后需结合下周一观察';
        if (gap <= -0.1) return '累计落后较大，达成风险高';
        if (gap <= -0.05) return '累计明显落后，需关注后续提速';
        if (speed != null && speed < 0.7) return '当日速度偏低，存在掉速迹象';
        if (acceleration != null && acceleration < -0.3) return '速度变化转弱，需关注连续性';
        if (gap >= 0.05) return '累计领先明显，关注后续是否回落';
        if (speed != null && speed >= 1.2) return '当日速度较强，存在追赶动能';
        return '节奏基本可控';
    },

    calcStreaks(rows = []) {
        return {
            highSpeedDays: this.countRecent(rows, row => {
                const speed = this.toNumber(row.speed);
                return speed != null && speed >= 1.1;
            }),
            lowSpeedDays: this.countRecent(rows, row => {
                const speed = this.toNumber(row.speed);
                return speed != null && speed < 0.9;
            }),
            gapBetterDays: this.countRecentPairs(rows, (previous, current) => {
                const prevGap = this.toNumber(previous.gap);
                const currentGap = this.toNumber(current.gap);
                return prevGap != null && currentGap != null && currentGap > prevGap;
            }),
            gapWorseDays: this.countRecentPairs(rows, (previous, current) => {
                const prevGap = this.toNumber(previous.gap);
                const currentGap = this.toNumber(current.gap);
                return prevGap != null && currentGap != null && currentGap < prevGap;
            })
        };
    },

    countRecent(rows = [], predicate) {
        let count = 0;
        for (let index = rows.length - 1; index >= 0; index -= 1) {
            if (!predicate(rows[index])) break;
            count += 1;
        }
        return count;
    },

    countRecentPairs(rows = [], predicate) {
        let count = 0;
        for (let index = rows.length - 1; index > 0; index -= 1) {
            if (!predicate(rows[index - 1], rows[index])) break;
            count += 1;
        }
        return count;
    },

    calcGapTrend(rows = []) {
        if (rows.length < 2) return '样本不足';
        const first = this.toNumber(rows[0].gap);
        const last = this.toNumber(rows[rows.length - 1].gap);
        if (first == null || last == null) return '样本不足';
        const delta = last - first;
        if (Math.abs(delta) < 0.005) return '进度差稳定';
        if (last < 0) return delta > 0 ? '落后收窄' : '落后扩大';
        return delta > 0 ? '领先扩大' : '领先收窄';
    },

    calcRecentSpeed(rows = []) {
        const speeds = rows.map(row => this.toNumber(row.speed)).filter(value => value != null);
        if (!speeds.length) return '样本不足';
        const average = speeds.reduce((sum, value) => sum + value, 0) / speeds.length;
        if (average >= 1.15) return '近期速度强';
        if (average >= 0.95) return '近期速度稳';
        if (average >= 0.75) return '近期速度弱';
        return '近期速度低';
    },

    analyzeKeyWeekdays(rows = []) {
        const latestByDay = new Map();
        rows.forEach(row => {
            const date = this.parseDate(row.endDate);
            if (!date) return;
            latestByDay.set(date.getDay(), row);
        });
        return {
            monday: this.judgeKeyDay(latestByDay.get(1), '星期一'),
            wednesday: this.judgeKeyDay(latestByDay.get(3), '星期三'),
            thursday: this.judgeKeyDay(latestByDay.get(4), '星期四')
        };
    },

    judgeKeyDay(row, name) {
        if (!row) return '待观察';
        const speed = this.toNumber(row.speed);
        const gap = this.toNumber(row.gap);
        if (speed == null && gap == null) return '待观察';
        if (speed != null && speed >= 1.1) return '有效';
        if (speed != null && speed < 0.8) return '偏弱';
        if (gap != null && gap < -0.05) return '承压';
        return '正常';
    },

    buildConclusion(last = {}, streaks = {}, gapTrend = '', recentSpeed = '') {
        const level = this.getPaceLevel(last);
        if (streaks.highSpeedDays >= 3) return `${level}，连续${streaks.highSpeedDays}日高于标准节奏，追赶动能较强`;
        if (streaks.lowSpeedDays >= 3) return `${level}，连续${streaks.lowSpeedDays}日低于标准节奏，掉速风险加重`;
        if (gapTrend === '落后收窄') return `${level}，近期落后幅度收窄，存在追赶迹象`;
        if (gapTrend === '落后扩大') return `${level}，近期落后幅度扩大，风险上升`;
        if (gapTrend === '领先收窄') return `${level}，领先优势收窄，需关注后续速度`;
        if (gapTrend === '领先扩大') return `${level}，领先优势扩大，节奏较强`;
        return `${level}，${recentSpeed}`;
    },

    buildSummaryRisk(last = {}, streaks = {}, gapTrend = '', keyDay = {}) {
        const gap = this.toNumber(last.gap);
        if (gap != null && gap <= -0.1) return '累计落后超过10%，达成风险高';
        if (streaks.lowSpeedDays >= 3) return `连续${streaks.lowSpeedDays}日低速，需尽快补量`;
        if (keyDay.monday === '偏弱' || keyDay.monday === '承压') return '周一峰值偏弱，需关注本周后续补量能力';
        if (gapTrend === '领先收窄') return '领先优势正在收窄，需防止后段回落';
        if (gapTrend === '落后扩大') return '落后幅度继续扩大，短期需重点干预';
        return '暂无明显连续性风险';
    },

    buildObserveText(last = {}, context = {}, keyDay = {}) {
        const date = this.parseDate(last.endDate);
        const day = date?.getDay();
        if (day != null && day < 3) return '重点观察星期三连锁小高峰是否拉升';
        if (day === 3 && keyDay.wednesday === '有效') return '关注星期四连锁延续是否保持';
        if (day === 4) return '关注星期五延续回落幅度';
        if (day >= 5) return '关注下个星期一周促峰值是否修复';
        return `关注后续节点${context.metricName ? `的${context.metricName}` : ''}累计节奏`;
    },

    getSpeedText(value) {
        const speed = this.toNumber(value);
        if (speed == null) return '-';
        if (speed >= 1.2) return '强';
        if (speed >= 0.9) return '稳';
        if (speed >= 0.7) return '弱';
        return '低';
    },

    getAccelerationText(value) {
        const acceleration = this.toNumber(value);
        if (acceleration == null) return '-';
        if (acceleration > 0.15) return '提速';
        if (acceleration < -0.15) return '掉速';
        return '持平';
    }
};

window.YejiPlcxQsSuanfaGuize = YejiPlcxQsSuanfaGuize;
