// BI summary merge rules: template grouping and value aggregation.
const YejiPlcxHbGuize = {
    parseTemplateName(name = '') {
        const text = String(name || '').trim();
        const index = text.lastIndexOf('_');
        if (index <= 0 || index >= text.length - 1) return { base: text, suffix: '', mergeable: false };
        return {
            base: text.slice(0, index).trim(),
            suffix: text.slice(index + 1).trim(),
            mergeable: true
        };
    },

    normalizeName(name = '') {
        return String(name || '')
            .replace(/\s+/g, '')
            .replace(/（/g, '(')
            .replace(/）/g, ')')
            .toLowerCase();
    },

    getFieldName(field = {}, getDisplayName) {
        const displayName = typeof getDisplayName === 'function' ? getDisplayName(field) : '';
        return displayName || field.alias || field.title || field.originTitle || field.name || '';
    },

    fieldMatches(field, targetName, getDisplayName) {
        const wanted = this.normalizeName(targetName);
        return [this.getFieldName(field, getDisplayName), field.name, field.alias, field.title, field.originTitle]
            .some(name => this.normalizeName(name) === wanted);
    },

    findFieldByName(fields = [], targetName, getDisplayName) {
        return (fields || []).find(field => this.fieldMatches(field, targetName, getDisplayName)) || null;
    },

    isRateField(field = {}, getDisplayName) {
        return /率$/.test(this.getFieldName(field, getDisplayName));
    },

    toNumber(value) {
        if (value == null || value === '') return null;
        const numeric = Number(String(value).replace(/,/g, '').trim());
        return Number.isFinite(numeric) ? numeric : null;
    },

    sumRows(rows = [], key, valueGetter = (row, fieldKey) => row.valuesByKey?.[fieldKey], field = null) {
        let total = 0;
        let count = 0;
        rows.forEach(row => {
            const numeric = this.toNumber(valueGetter(row, key, field));
            if (numeric == null) return;
            total += numeric;
            count += 1;
        });
        return count ? total : '';
    },

    avgRows(rows = [], key, valueGetter = (row, fieldKey) => row.valuesByKey?.[fieldKey], field = null) {
        let total = 0;
        let count = 0;
        rows.forEach(row => {
            const numeric = this.toNumber(valueGetter(row, key, field));
            if (numeric == null) return;
            total += numeric;
            count += 1;
        });
        return count ? total / count : '';
    },

    sumByName(rows = [], fields = [], name, getDisplayName, valueGetter) {
        const field = this.findFieldByName(fields, name, getDisplayName);
        return field ? this.sumRows(rows, field.key, valueGetter, field) : '';
    },

    aggregateField(rows = [], field = {}, fields = [], getDisplayName, valueGetter = (row, fieldKey) => row.valuesByKey?.[fieldKey]) {
        const name = this.normalizeName(this.getFieldName(field, getDisplayName));
        const untaxedAmount = this.sumByName(rows, fields, '不含税金额', getDisplayName, valueGetter);

        if (name === this.normalizeName('不含税金额')) return untaxedAmount;
        if (name === this.normalizeName('不含税边际利润率')) {
            return this.divide(this.sumByName(rows, fields, '不含税边际利润', getDisplayName, valueGetter), untaxedAmount);
        }
        if (name === this.normalizeName('不含税配送费率')) {
            return this.divide(this.sumByName(rows, fields, '不含税配送费', getDisplayName, valueGetter), untaxedAmount);
        }
        if (name === this.normalizeName('不含税人工费率')) {
            return this.divide(this.sumByName(rows, fields, '不含税仓库人工费', getDisplayName, valueGetter), untaxedAmount);
        }
        if (name === this.normalizeName('不含税平台费率')) {
            return this.divide(this.sumByName(rows, fields, '不含税平台费', getDisplayName, valueGetter), untaxedAmount);
        }
        if (name === this.normalizeName('不含税p4毛利率')) {
            return this.divide(this.sumByName(rows, fields, '不含税p4毛利额', getDisplayName, valueGetter), untaxedAmount);
        }
        if (this.isRateField(field, getDisplayName)) return this.avgRows(rows, field.key, valueGetter, field);
        return this.sumRows(rows, field.key, valueGetter, field);
    },

    divide(numerator, denominator) {
        const top = this.toNumber(numerator);
        const bottom = this.toNumber(denominator);
        if (top == null || bottom == null || bottom === 0) return '';
        return top / bottom;
    }
};

window.YejiPlcxHbGuize = YejiPlcxHbGuize;
