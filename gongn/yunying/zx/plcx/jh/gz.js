// BI summary query plan rules: merge grouping and metric dependencies.
const YejiPlcxJhGuize = {
    dependencyMap: {
        '不含税边际利润率': ['不含税边际利润', '不含税金额'],
        '不含税配送费率': ['不含税配送费', '不含税金额'],
        '不含税人工费率': ['不含税仓库人工费', '不含税金额'],
        '不含税平台费率': ['不含税平台费', '不含税金额'],
        '不含税p4毛利率': ['不含税p4毛利额', '不含税金额']
    },

    normalizeName(name = '') {
        return window.YejiPlcxHbGuize?.normalizeName
            ? window.YejiPlcxHbGuize.normalizeName(name)
            : String(name || '').replace(/\s+/g, '').toLowerCase();
    },

    parseTemplateName(name = '') {
        return window.YejiPlcxHbGuize?.parseTemplateName
            ? window.YejiPlcxHbGuize.parseTemplateName(name)
            : { base: String(name || '').trim(), suffix: '', mergeable: false };
    },

    buildMergeableBaseSet(templates = []) {
        const grouped = new Map();
        (templates || []).forEach(tpl => {
            const parsed = this.parseTemplateName(tpl?.name || '');
            if (!parsed.mergeable || !parsed.base) return;
            if (!grouped.has(parsed.base)) grouped.set(parsed.base, []);
            grouped.get(parsed.base).push(tpl);
        });
        return new Set(
            Array.from(grouped.entries())
                .filter(([, items]) => items.length > 1)
                .map(([base]) => base)
        );
    },

    isTemplateMergeMember(tpl = {}, mergeableBases = new Set()) {
        const parsed = this.parseTemplateName(tpl.name || '');
        return !!(parsed.mergeable && parsed.base && mergeableBases.has(parsed.base));
    },

    dependencyNames(metricName = '') {
        return this.dependencyMap[this.normalizeName(metricName)] || [];
    }
};

window.YejiPlcxJhGuize = YejiPlcxJhGuize;
