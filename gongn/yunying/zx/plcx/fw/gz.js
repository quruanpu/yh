// BI dynamic query service rules: parameter normalization and allow-list checks.
const YejiPlcxFwGuize = {
    maxDateRangeDays: 366,
    defaultDateField: '出库日期',

    parseArguments(rawValue = '') {
        if (!rawValue) return {};
        if (typeof rawValue === 'object') return rawValue;
        try {
            return JSON.parse(String(rawValue || '{}'));
        } catch {
            return {};
        }
    },

    toArray(value) {
        if (Array.isArray(value)) return value;
        if (value == null || value === '') return [];
        return [value];
    },

    normalizeNames(value = []) {
        return this.toArray(value)
            .map(item => String(item || '').trim())
            .filter(Boolean);
    },

    normalizeDate(value = '') {
        const text = String(value || '').trim().replaceAll('/', '-');
        const normalized = window.YejiPlcxMbGuize?.normalizeDate?.(text) || text;
        return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
    },

    validateDateRange(startValue, endValue, options = {}) {
        const startDate = this.normalizeDate(startValue);
        const endDate = this.normalizeDate(endValue);
        if (!startDate || !endDate) throw new Error('查询时间必须使用 YYYY-MM-DD 格式。');

        const start = window.YejiPlcxMbGuize?.parseDate?.(startDate);
        const end = window.YejiPlcxMbGuize?.parseDate?.(endDate);
        if (!start || !end) throw new Error('查询时间无效。');
        if (start > end) throw new Error('查询开始日期不能晚于结束日期。');

        const days = (window.YejiPlcxMbGuize?.diffDays?.(start, end) ?? Math.round((end - start) / 86400000)) + 1;
        const maxDays = Number(options.maxDays || this.maxDateRangeDays);
        if (days > maxDays) throw new Error(`单次最多查询 ${maxDays} 天。`);
        return { startDate, endDate, days };
    },

    normalizeFilterValue(selector = {}, value) {
        if (selector.selectorType === 'TIME_MACRO') {
            const range = Array.isArray(value) ? value : value?.range;
            return { range: (range || []).slice(0, 2), macroName: '' };
        }
        if (selector.selectorType === 'TREE') {
            const paths = Array.isArray(value?.treePaths) ? value.treePaths : [];
            const manual = Array.isArray(value) ? value.join('\n') : String(value?.manual || value || '');
            return paths.length ? { treePaths: paths } : { manual };
        }
        if (Array.isArray(value)) return { selected: value.map(item => String(item)) };
        return { manual: String(value ?? '') };
    },

    normalizeExcludeMode(input = {}, selectorMap = new Map()) {
        const output = {};
        Object.entries(input || {}).forEach(([key, enabled]) => {
            if (!enabled) return;
            const selector = selectorMap.get(String(key || '').trim());
            if (selector?.cdId) output[selector.cdId] = true;
        });
        return output;
    }
};

window.YejiPlcxFwGuize = YejiPlcxFwGuize;
