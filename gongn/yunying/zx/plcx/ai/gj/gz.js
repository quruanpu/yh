// BI batch query AI tool rules: parameterized read-only access to the batch panel shell.
const YejiPlcxAiGjGuize = {
    toolNames: {
        queryPanel: 'yeji_batch_query_panel'
    },

    getToolDefinitions() {
        return [
            {
                type: 'function',
                function: {
                    name: this.toolNames.queryPanel,
                    description: '按 BI 查询面板业务壳执行只读查询。可传入模板、筛选、日期字段、日期范围、聚合字段、目标范围和是否返回合并子项；计算仍由 BI 查询面板完成，不修改当前页面。需要多组查询时优先传入 queries 数组，单次最多并发 31 组。',
                    parameters: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            queries: {
                                type: 'array',
                                maxItems: 31,
                                items: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        startDate: {
                                            type: 'string',
                                            description: '查询开始日期，格式为 YYYY-MM-DD。'
                                        },
                                        endDate: {
                                            type: 'string',
                                            description: '查询结束日期，格式为 YYYY-MM-DD。'
                                        },
                                        templateKeys: {
                                            type: 'array',
                                            items: { type: 'string' },
                                            description: '可选模板 key 列表。'
                                        },
                                        templateNames: {
                                            type: 'array',
                                            items: { type: 'string' },
                                            description: '可选模板名称列表。'
                                        },
                                        filters: { type: 'object', description: '可选筛选值，键为筛选项名称或 cdId。' },
                                        excludeMode: { type: 'object', description: '可选排除模式，键为筛选项名称或 cdId，值为 true。' },
                                        dateField: { type: 'string', description: '日期字段，支持出库日期或支付日期。' },
                                        metricFields: {
                                            type: 'array',
                                            items: { type: 'string' },
                                            description: '可选聚合字段名称或 key。'
                                        },
                                        targetKey: { type: 'string', description: '可选目标范围 key。' },
                                        autoTarget: { type: 'boolean', description: '是否自动匹配目标，默认 true。' },
                                        includeChildren: { type: 'boolean', description: '合并模板是否返回子项，默认 true。' }
                                    }
                                },
                                description: '可选多组 BI 查询任务。传入后并发执行，最多 31 组。'
                            },
                            startDate: {
                                type: 'string',
                                description: '查询开始日期，格式为 YYYY-MM-DD。'
                            },
                            endDate: {
                                type: 'string',
                                description: '查询结束日期，格式为 YYYY-MM-DD。'
                            },
                            templateKeys: {
                                type: 'array',
                                items: { type: 'string' },
                                description: '可选模板 key 列表。未传时查询当前 BI 查询面板全部模板。'
                            },
                            templateNames: {
                                type: 'array',
                                items: { type: 'string' },
                                description: '可选模板名称列表。'
                            },
                            filters: { type: 'object', description: '可选筛选值，键为筛选项名称或 cdId。' },
                            excludeMode: { type: 'object', description: '可选排除模式，键为筛选项名称或 cdId，值为 true。' },
                            dateField: { type: 'string', description: '日期字段，支持出库日期或支付日期。' },
                            metricFields: {
                                type: 'array',
                                items: { type: 'string' },
                                description: '可选聚合字段名称或 key。'
                            },
                            targetKey: { type: 'string', description: '可选目标范围 key。' },
                            autoTarget: { type: 'boolean', description: '是否自动匹配目标，默认 true。' },
                            includeChildren: { type: 'boolean', description: '合并模板是否返回子项，默认 true。' }
                        }
                    }
                }
            }
        ];
    },

    normalizeDate(value) {
        return window.YejiPlcxFwGuize?.normalizeDate?.(value) || '';
    },

    validateDateRange(params = {}) {
        return window.YejiPlcxFwGuize.validateDateRange(params.startDate, params.endDate);
    },

    parseArguments(rawValue = '') {
        return window.YejiPlcxFwGuize?.parseArguments?.(rawValue) || {};
    },

    normalizeTemplateKeys(value = []) {
        if (!Array.isArray(value)) return [];
        return value.map(item => String(item || '').trim()).filter(Boolean).slice(0, 31);
    }
};

window.YejiPlcxAiGjGuize = YejiPlcxAiGjGuize;
