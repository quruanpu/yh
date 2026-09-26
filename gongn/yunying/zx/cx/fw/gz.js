// BI main query service rules: parameter normalization and allow-list checks.
const YejiCxFwGuize = {
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

    normalizePage(value, fallback = 1) {
        const page = Math.floor(Number(value || fallback));
        return Number.isFinite(page) && page > 0 ? page : fallback;
    },

    normalizePageSize(value, fallback = 20) {
        const pageSize = Math.floor(Number(value || fallback));
        if (!Number.isFinite(pageSize) || pageSize <= 0) return fallback;
        return Math.min(pageSize, 100);
    },

    normalizeFilterValue(selector = {}, value) {
        if (selector.selectorType === 'TIME_MACRO') {
            const range = Array.isArray(value) ? value : value?.range;
            const normalizedRange = (range || []).slice(0, 2).map(item => String(item || '').trim()).filter(Boolean);
            if (normalizedRange.length !== 2) throw new Error(`日期筛选 ${selector.name || selector.cdId} 必须传入开始和结束日期。`);
            return { range: normalizedRange, macroName: '' };
        }
        if (selector.selectorType === 'TREE') {
            const paths = Array.isArray(value?.treePaths) ? value.treePaths : [];
            const manual = Array.isArray(value) ? value.join('\n') : String(value?.manual || value || '');
            return paths.length ? { treePaths: paths } : { manual };
        }
        if (Array.isArray(value)) return { selected: value.map(item => String(item)) };
        if (Array.isArray(value?.selected)) return { selected: value.selected.map(item => String(item)) };
        if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'manual')) {
            return { manual: String(value.manual ?? '') };
        }
        return { manual: String(value ?? '') };
    },

    normalizeExcludeMode(input = {}, selectorMap = new Map()) {
        const output = {};
        Object.entries(input || {}).forEach(([key, enabled]) => {
            if (!enabled) return;
            const selector = selectorMap.get(String(key || '').trim());
            if (!selector?.cdId) throw new Error(`不支持的排除筛选字段：${key}`);
            output[selector.cdId] = true;
        });
        return output;
    }
};

window.YejiCxFwGuize = YejiCxFwGuize;
