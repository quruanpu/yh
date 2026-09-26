// BI main page AI tool rules.
const YejiMainAiGjGuize = {
    toolNames: {
        queryPage: 'yeji_main_query_page'
    },

    getToolDefinitions() {
        return [
            {
                type: 'function',
                function: {
                    name: this.toolNames.queryPage,
                    description: '按 BI 主查询业务壳执行只读查询。默认使用主查询默认口径；可传入页码、每页数量、筛选条件、排除条件、查询字段、聚合字段和排序字段，不修改当前页面。筛选值支持字符串、数组、{manual}、{selected}、{range}、{treePaths}。需要多个查询时优先传入 queries 数组，单次最多并发 31 组。',
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
                                        page: { type: 'number', description: '页码，默认 1。' },
                                        pageSize: { type: 'number', description: '每页数量，默认当前页面配置。' },
                                        inheritCurrent: { type: 'boolean', description: '是否继承当前页面筛选、字段和快捷搜索，默认 false。' },
                                        filters: { type: 'object', description: '可选筛选值，键为筛选项名称或 cdId；普通字段可传字符串、数组、{manual} 或 {selected}；日期字段传 {range:[start,end]}；区域树可传 {treePaths:[[省,市,区]]} 或批量路径文本。' },
                                        excludeMode: { type: 'object', description: '可选排除模式，键为筛选项名称或 cdId，值为 true。' },
                                        rowFields: {
                                            type: 'array',
                                            items: { type: 'string' },
                                            description: '可选查询字段名称或 key。'
                                        },
                                        metricFields: {
                                            type: 'array',
                                            items: { type: 'string' },
                                            description: '可选聚合字段名称或 key。'
                                        },
                                        templateKey: {
                                            type: 'string',
                                            description: '可选模板 key。'
                                        },
                                        templateName: {
                                            type: 'string',
                                            description: '可选模板名称。'
                                        },
                                        sort: {
                                            type: 'object',
                                            additionalProperties: false,
                                            properties: {
                                                field: { type: 'string', description: '排序字段名称或 key。' },
                                                order: {
                                                    type: 'string',
                                                    enum: ['asc', 'desc'],
                                                    description: 'asc 为升序，desc 为降序。'
                                                }
                                            }
                                        }
                                    }
                                },
                                description: '可选多组主查询任务。传入后并发执行，最多 31 组。'
                            },
                            page: { type: 'number', description: '页码，默认 1。' },
                            pageSize: { type: 'number', description: '每页数量，默认当前页面配置。' },
                            inheritCurrent: { type: 'boolean', description: '是否继承当前页面筛选、字段和快捷搜索，默认 false。' },
                            filters: { type: 'object', description: '可选筛选值，键为筛选项名称或 cdId；普通字段可传字符串、数组、{manual} 或 {selected}；日期字段传 {range:[start,end]}；区域树可传 {treePaths:[[省,市,区]]} 或批量路径文本。' },
                            excludeMode: { type: 'object', description: '可选排除模式，键为筛选项名称或 cdId，值为 true。' },
                            rowFields: {
                                type: 'array',
                                items: { type: 'string' },
                                description: '可选查询字段名称或 key。'
                            },
                            metricFields: {
                                type: 'array',
                                items: { type: 'string' },
                                description: '可选聚合字段名称或 key。'
                            },
                            templateKey: {
                                type: 'string',
                                description: '可选模板 key。传入后按该模板的筛选和快捷搜索口径查询。'
                            },
                            templateName: {
                                type: 'string',
                                description: '可选模板名称。未传 templateKey 时可按名称匹配模板查询。'
                            },
                            sort: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    field: {
                                        type: 'string',
                                        description: '排序字段名称或 key。'
                                    },
                                    order: {
                                        type: 'string',
                                        enum: ['asc', 'desc'],
                                        description: 'asc 为升序，desc 为降序。'
                                    }
                                },
                                description: '可选排序设置。百分比字段按 BI 原始数值排序。'
                            }
                        }
                    }
                }
            }
        ];
    },

    parseArguments(rawValue = '') {
        if (!rawValue) return {};
        if (typeof rawValue === 'object') return rawValue;
        try {
            return JSON.parse(String(rawValue || '{}'));
        } catch {
            return {};
        }
    },

    normalizePage(value, fallback = 1) {
        return window.YejiCxFwGuize?.normalizePage?.(value, fallback) || fallback;
    },

    normalizePageSize(value, fallback = 20) {
        return window.YejiCxFwGuize?.normalizePageSize?.(value, fallback) || fallback;
    }
};

window.YejiMainAiGjGuize = YejiMainAiGjGuize;
