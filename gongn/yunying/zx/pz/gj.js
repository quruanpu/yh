// BI field configuration helpers: selected keys, field resolution, and metric unions.
const YejiPzGongju = {
    cloneField(field) {
        return field ? JSON.parse(JSON.stringify(field)) : null;
    },

    cloneFields(fields = []) {
        return (fields || []).map(field => this.cloneField(field)).filter(Boolean);
    },

    mergeFields(...groups) {
        const map = new Map();
        groups.flat().forEach(field => {
            if (field?.key) map.set(field.key, field);
        });
        return [...map.values()].map(field => this.cloneField(field));
    },

    pickFieldsByKeys(fields = [], keys = []) {
        const map = new Map();
        (fields || []).forEach(field => {
            if (field?.key) map.set(field.key, field);
        });
        return this.uniqueKeys(keys).map(key => map.get(key)).filter(Boolean);
    },

    orderRowFields(fields = []) {
        const keys = window.YejiPzShuju?.rowFieldKeys || [];
        return keys.length ? this.pickFieldsByKeys(fields, keys) : this.cloneFields(fields);
    },

    orderMetricFields(fields = []) {
        const keys = window.YejiPzShuju?.metricFieldKeys || [];
        return keys.length ? this.pickFieldsByKeys(fields, keys) : this.cloneFields(fields);
    },

    uniqueKeys(keys = []) {
        const seen = new Set();
        return (keys || []).map(String).filter(key => {
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    },

    fieldMap(fields = [], fallbackFields = []) {
        const map = new Map();
        [...(fallbackFields || []), ...(fields || [])].forEach(field => {
            if (field?.key) map.set(field.key, field);
        });
        return map;
    },

    normalizeKeys(keys, availableFields = [], fallbackFields = [], defaultKeys = [], useDefault = true) {
        const map = this.fieldMap(availableFields, fallbackFields);
        const requested = this.uniqueKeys(keys);
        const valid = requested.filter(key => map.has(key));
        if (valid.length) return valid;
        if (!useDefault) return [];
        return this.uniqueKeys(defaultKeys).filter(key => map.has(key));
    },

    normalizeConfig(config = {}, source = {}) {
        const ultra = source.ultra || {};
        const hasRowKeys = Object.prototype.hasOwnProperty.call(config, 'rowKeys');
        const hasMetricKeys = Object.prototype.hasOwnProperty.call(config, 'metricKeys');
        return {
            version: 1,
            rowKeys: this.normalizeKeys(
                config.rowKeys,
                source.availableRowFields,
                ultra.rowFields,
                ultra.defaultRowKeys,
                !hasRowKeys
            ),
            metricKeys: this.normalizeKeys(
                config.metricKeys,
                source.availableMetricFields,
                ultra.metricFields,
                ultra.defaultMetricKeys,
                !hasMetricKeys
            )
        };
    },

    resolveFields(keys = [], availableFields = [], fallbackFields = []) {
        const map = this.fieldMap(availableFields, fallbackFields);
        return this.uniqueKeys(keys).map(key => this.cloneField(map.get(key))).filter(field => field?.key);
    },

    resolveRows(config = {}, source = {}) {
        const normalized = this.normalizeConfig(config, source);
        return this.resolveFields(normalized.rowKeys, source.availableRowFields, source.ultra?.rowFields);
    },

    resolveMetrics(config = {}, source = {}) {
        const normalized = this.normalizeConfig(config, source);
        return this.resolveFields(normalized.metricKeys, source.availableMetricFields, source.ultra?.metricFields);
    },

    makeSource(module) {
        const snapshot = window.YejiPzShuju || {};
        return {
            ultra: module?.ultra || {},
            availableRowFields: module?.state?.availableRowFields?.length
                ? this.orderRowFields(module.state.availableRowFields)
                : this.orderRowFields(snapshot.rowFields || []),
            availableMetricFields: module?.state?.availableMetricFields?.length
                ? this.orderMetricFields(module.state.availableMetricFields)
                : this.orderMetricFields(snapshot.metricFields || [])
        };
    }
};

window.YejiPzGongju = YejiPzGongju;
