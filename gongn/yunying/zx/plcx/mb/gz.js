// BI summary target rules: target period, runtime query range, and progress.
const YejiPlcxMbGuize = {
    normalizeDate(value) {
        if (window.YejiPlcxMbGongju?.normalizeDate) return window.YejiPlcxMbGongju.normalizeDate(value);
        if (value == null || value === '') return '';
        const text = String(value).trim();
        const match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
        if (!match) return '';
        return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
    },

    parseDate(value) {
        const normalized = this.normalizeDate(value);
        if (!normalized) return null;
        const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        date.setHours(0, 0, 0, 0);
        return Number.isNaN(date.getTime()) ? null : date;
    },

    formatDate(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    formatDisplayDate(value) {
        return this.normalizeDate(value).replaceAll('-', '/');
    },

    addDays(date, days) {
        const copy = new Date(date);
        copy.setDate(copy.getDate() + days);
        copy.setHours(0, 0, 0, 0);
        return copy;
    },

    diffDays(start, end) {
        return Math.floor((end.getTime() - start.getTime()) / 86400000);
    },

    resolveRuntimeRange(targetRange, today = new Date()) {
        const startDate = this.normalizeDate(targetRange?.startDate);
        const endDate = this.normalizeDate(targetRange?.endDate);
        const start = this.parseDate(startDate);
        const end = this.parseDate(endDate);
        if (!start || !end || start > end) return null;

        const current = new Date(today);
        current.setHours(0, 0, 0, 0);
        const totalDays = this.diffDays(start, end) + 1;
        if (totalDays <= 0) return null;

        let status = 'active';
        let elapsedDays = this.diffDays(start, current);
        let queryEnd = elapsedDays > 0 ? this.addDays(current, -1) : start;

        if (current < start) {
            status = 'future';
            elapsedDays = 0;
            queryEnd = end;
        } else if (current > end) {
            status = 'finished';
            elapsedDays = totalDays;
            queryEnd = end;
        }

        const progress = Math.max(0, Math.min(1, elapsedDays / totalDays));
        return {
            key: targetRange?.key || '',
            label: targetRange?.label || targetRange?.key || '',
            status,
            progress,
            progressText: `${(progress * 100).toFixed(2)}%`,
            targetRange: [startDate, endDate],
            queryRange: [startDate, this.formatDate(queryEnd)],
            totalDays,
            elapsedDays
        };
    },

    resolveDateRuntime(dateItems = [], today = new Date()) {
        const item = this.pickPrimaryDateItem(dateItems);
        if (!item?.range?.length) return null;

        const current = new Date(today);
        current.setHours(0, 0, 0, 0);
        const monthPeriod = this.resolveCurrentMonthPeriod(current);
        const startDate = this.normalizeDate(item.range[0]);
        const endDate = this.normalizeDate(item.range[1]);
        const isCurrentMonthToYesterday = startDate === monthPeriod.queryRange[0] && endDate === monthPeriod.queryRange[1];
        const runtime = isCurrentMonthToYesterday
            ? this.resolvePeriodProgress(monthPeriod.periodRange[0], monthPeriod.periodRange[1], current)
            : this.resolvePeriodProgress(startDate, endDate, current);
        return runtime ? {
            ...runtime,
            sourceName: item.name || '',
            queryRange: [startDate, endDate]
        } : null;
    },

    resolveQueryProgress(dateItems = []) {
        const item = this.pickPrimaryDateItem(dateItems);
        if (!item?.range?.length) return null;

        const startDate = this.normalizeDate(item.range[0]);
        const endDate = this.normalizeDate(item.range[1]);
        const start = this.parseDate(startDate);
        const end = this.parseDate(endDate);
        if (!start || !end || start > end) return null;

        const periodEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0);
        periodEnd.setHours(0, 0, 0, 0);
        const totalDays = this.diffDays(start, periodEnd) + 1;
        const elapsedDays = this.diffDays(start, end) + 1;
        if (totalDays <= 0) return null;

        const progress = Math.max(0, Math.min(1, elapsedDays / totalDays));
        return {
            sourceName: item.name || '',
            progress,
            progressText: `${(progress * 100).toFixed(2)}%`,
            periodRange: [startDate, this.formatDate(periodEnd)],
            queryRange: [startDate, endDate],
            totalDays,
            elapsedDays
        };
    },

    pickPrimaryDateItem(dateItems = []) {
        return dateItems.find(item => item.name === '出库日期')
            || dateItems.find(item => item.name === '支付日期')
            || dateItems[0]
            || null;
    },

    resolveCurrentMonthPeriod(today = new Date()) {
        const current = new Date(today);
        current.setHours(0, 0, 0, 0);
        const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
        const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
        const yesterday = this.addDays(current, -1);
        const queryEnd = yesterday < monthStart ? monthStart : yesterday;
        return {
            periodRange: [this.formatDate(monthStart), this.formatDate(monthEnd)],
            queryRange: [this.formatDate(monthStart), this.formatDate(queryEnd)]
        };
    },

    resolvePeriodProgress(startText, endText, today = new Date()) {
        const startDate = this.normalizeDate(startText);
        const endDate = this.normalizeDate(endText);
        const start = this.parseDate(startDate);
        const end = this.parseDate(endDate);
        if (!start || !end || start > end) return null;

        const current = new Date(today);
        current.setHours(0, 0, 0, 0);
        const totalDays = this.diffDays(start, end) + 1;
        if (totalDays <= 0) return null;

        let status = 'active';
        let elapsedDays = this.diffDays(start, current);
        if (current < start) {
            status = 'future';
            elapsedDays = 0;
        } else if (current > end) {
            status = 'finished';
            elapsedDays = totalDays;
        }

        const progress = Math.max(0, Math.min(1, elapsedDays / totalDays));
        return {
            status,
            progress,
            progressText: `${(progress * 100).toFixed(2)}%`,
            periodRange: [startDate, endDate],
            totalDays,
            elapsedDays
        };
    },

    normalizeRanges(ranges = {}) {
        return Object.entries(ranges || {}).map(([key, range]) => ({
            key,
            ...range,
            label: range?.label || key,
            startDate: this.normalizeDate(range?.startDate),
            endDate: this.normalizeDate(range?.endDate)
        })).filter(range => range.startDate && range.endDate);
    },

    sortRanges(ranges = []) {
        return [...ranges].sort((a, b) => String(b.key).localeCompare(String(a.key)));
    },

    pickContainingDate(ranges = [], date = new Date()) {
        const current = date instanceof Date ? date : this.parseDate(date);
        if (!current) return null;
        current.setHours(0, 0, 0, 0);
        const matches = ranges.map(range => {
            const start = this.parseDate(range.startDate);
            const end = this.parseDate(range.endDate);
            if (!start || !end || start > current || end < current) return null;
            return {
                ...range,
                span: this.diffDays(start, end),
                updatedAtValue: Number(range.updatedAt || 0)
            };
        }).filter(Boolean);
        return this.pickBestRange(matches);
    },

    pickContainingRange(ranges = [], queryRange = []) {
        const queryStart = this.parseDate(queryRange[0]);
        const queryEnd = this.parseDate(queryRange[1]);
        if (!queryStart || !queryEnd) return null;
        const matches = ranges.map(range => {
            const start = this.parseDate(range.startDate);
            const end = this.parseDate(range.endDate);
            if (!start || !end || start > queryStart || end < queryEnd) return null;
            return {
                ...range,
                span: this.diffDays(start, end),
                updatedAtValue: Number(range.updatedAt || 0)
            };
        }).filter(Boolean);
        return this.pickBestRange(matches);
    },

    pickBestRange(matches = []) {
        if (!matches.length) return null;
        return [...matches].sort((a, b) => {
            if (a.span !== b.span) return a.span - b.span;
            if (a.updatedAtValue !== b.updatedAtValue) return b.updatedAtValue - a.updatedAtValue;
            return String(b.key).localeCompare(String(a.key));
        })[0];
    },

    formatTitleMeta(runtime, dateItems = []) {
        const targetProgress = runtime?.progressText || '-';
        const queryProgress = this.resolveQueryProgress(dateItems)?.progressText || '-';
        const parts = dateItems.map(item =>
            `${item.name}：${this.formatDisplayDate(item.range?.[0])}~${this.formatDisplayDate(item.range?.[1])}`
        );
        return `| 目标时间进度：${targetProgress} | 查询时间进度：${queryProgress} | ${parts.length ? parts.join(' | ') : '未选择出库日期或支付日期'}`;
    }
};

window.YejiPlcxMbGuize = YejiPlcxMbGuize;
