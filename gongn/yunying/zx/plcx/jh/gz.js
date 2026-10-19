// BI summary query plan rules: rate field dependencies only.
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

    dependencyNames(metricName = '') {
        return this.dependencyMap[this.normalizeName(metricName)] || [];
    }
};

window.YejiPlcxJhGuize = YejiPlcxJhGuize;
