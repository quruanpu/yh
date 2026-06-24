// BI summary query plan business: minimal fields for summary and trend requests.
const YejiPlcxJhYewu = {
getMetricFieldsForNames(names = []) {
    const allFields = [
        ...(this.state.availableMetricFields || []),
        ...(this.ultra.metricFields || []),
        ...(window.YejiPzShuju?.metricFields || [])
    ];
    return (names || [])
        .map(name => this.findBatchMetricFieldByDisplayName?.(name, allFields))
        .filter(Boolean);
},

getRowFieldForName(name = '') {
    return this.findBatchRowFieldByDisplayName?.(name) || null;
},

uniquePlanFields(fields = []) {
    return this.uniqueBatchFields
        ? this.uniqueBatchFields(fields)
        : [...new Map((fields || []).filter(field => field?.key).map(field => [field.key, field])).values()];
},

getMetricDependencies(metric = {}) {
    const name = this.getMetricFieldDisplayName(metric);
    return this.getMetricFieldsForNames(window.YejiPlcxJhGuize.dependencyNames(name));
},

getMetricsWithDependencies(metrics = []) {
    const list = [];
    (metrics || []).forEach(metric => {
        if (metric?.key) list.push(metric);
        list.push(...this.getMetricDependencies(metric));
    });
    return this.uniquePlanFields(list);
},

buildBatchQueryPlans(templates = [], displayMetricFields = this.getBatchMetricFields()) {
    const mergeableBases = window.YejiPlcxJhGuize.buildMergeableBaseSet(templates);
    const plans = new Map();
    (templates || []).forEach(tpl => {
        const mergeMember = window.YejiPlcxJhGuize.isTemplateMergeMember(tpl, mergeableBases);
        const metricFields = mergeMember
            ? this.getMetricsWithDependencies(displayMetricFields)
            : this.uniquePlanFields(displayMetricFields);
        plans.set(tpl._key, {
            rowFields: [],
            metricFields,
            displayMetricFields: this.uniquePlanFields(displayMetricFields),
            mergeMember
        });
    });
    return plans;
},

getBatchPlanMetricUnion(plans = new Map()) {
    const fields = [];
    plans.forEach(plan => fields.push(...(plan.metricFields || [])));
    return this.uniquePlanFields(fields);
},

buildTrendQueryPlan(context = {}) {
    const dateField = this.getRowFieldForName(context.dateInfo?.name || '');
    if (!dateField) throw new Error(`指标详解缺少日期查询字段：${context.dateInfo?.name || '-'}`);
    const dependencies = this.getMetricDependencies(context.metric);
    const metricFields = dependencies.length
        ? this.uniquePlanFields(dependencies)
        : this.uniquePlanFields([context.metric]);
    const merged = (context.templates || []).length > 1;
    return {
        rowFields: [dateField],
        metricFields,
        displayMetricFields: this.uniquePlanFields([context.metric]),
        mergeMember: merged,
        seriesDateField: dateField
    };
}
};

window.YejiPlcxJhYewu = YejiPlcxJhYewu;
