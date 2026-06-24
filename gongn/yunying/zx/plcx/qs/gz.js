// BI summary trend rules: cumulative nodes, progress, pace, and acceleration.
const YejiPlcxQsGuize = {
    parseDate(value) {
        return window.YejiPlcxMbGuize?.parseDate(value) || null;
    },

    formatDate(date) {
        return window.YejiPlcxMbGuize?.formatDate(date) || '';
    },

    addDays(date, days) {
        return window.YejiPlcxMbGuize?.addDays(date, days) || null;
    },

    diffDays(start, end) {
        return window.YejiPlcxMbGuize?.diffDays(start, end) ?? 0;
    },

    buildNodes(startText, endText) {
        const start = this.parseDate(startText);
        const end = this.parseDate(endText);
        if (!start || !end || start > end) return [];
        const nodes = [];
        for (let date = new Date(start); date <= end; date = this.addDays(date, 1)) {
            nodes.push({
                startDate: this.formatDate(start),
                endDate: this.formatDate(date),
                label: this.formatDate(date).replaceAll('-', '/'),
                weekday: this.formatWeekday(date)
            });
        }
        return nodes;
    },

    formatWeekday(date) {
        const names = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        return names[date.getDay()] || '';
    },

    getPeriodEnd(endText) {
        const end = this.parseDate(endText);
        if (!end) return '';
        return this.formatDate(new Date(end.getFullYear(), end.getMonth() + 1, 0));
    },

    calcQueryProgress(startText, nodeEndText, periodEndText) {
        const start = this.parseDate(startText);
        const nodeEnd = this.parseDate(nodeEndText);
        const periodEnd = this.parseDate(periodEndText);
        if (!start || !nodeEnd || !periodEnd || start > nodeEnd || start > periodEnd) return '';
        const totalDays = this.diffDays(start, periodEnd) + 1;
        const elapsedDays = this.diffDays(start, nodeEnd) + 1;
        if (totalDays <= 0) return '';
        return Math.max(0, Math.min(1, elapsedDays / totalDays));
    },

    toNumber(value) {
        if (window.YejiPlcxHbGuize?.toNumber) return window.YejiPlcxHbGuize.toNumber(value);
        if (value == null || value === '') return null;
        const numeric = Number(String(value).replace(/,/g, '').trim());
        return Number.isFinite(numeric) ? numeric : null;
    },

    formatPercent(value, signed = false) {
        const numeric = this.toNumber(value);
        if (numeric == null) return '-';
        const percent = numeric * 100;
        const sign = signed && percent > 0 ? '+' : '';
        return `${sign}${percent.toFixed(2)}%`;
    },

    formatRatio(value, signed = false) {
        const numeric = this.toNumber(value);
        if (numeric == null) return '-';
        const sign = signed && numeric > 0 ? '+' : '';
        return `${sign}${numeric.toFixed(2)}`;
    }
};

window.YejiPlcxQsGuize = YejiPlcxQsGuize;
