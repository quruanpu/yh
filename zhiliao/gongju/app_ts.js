/**
 * 内置工具定义集合
 *
 * 说明：
 * - 文件读取类工具已拆分到 `zhiliao/gongju/jiekou/duqu/app.js`
 * - 此处仅保留与界面业务强绑定的内置工具
 */

const ToolDefinitions = {
    chartTools: [
        {
            id: 'generate_chart_from_statistics',
            name: '生成图表',
            command: '/生成图表',
            description:
                '根据统计数据生成专业 BI 图表。适用于柱状图、折线图、饼图、散点图、面积图、堆叠柱状图、漏斗图、雷达图等数据可视化需求。',
            icon: 'fa-solid fa-chart-pie',
            registerType: 'ai',
            parameters: {
                type: 'object',
                properties: {
                    chart_type: {
                        type: 'string',
                        enum: ['bar', 'line', 'pie', 'scatter', 'area', 'stacked_bar', 'funnel', 'radar'],
                        description: '图表类型。趋势用 line/area，排行对比用 bar，构成占比用 pie，分组对比可用 stacked_bar。'
                    },
                    title: {
                        type: 'string',
                        description: '图表标题。'
                    },
                    subtitle: {
                        type: 'string',
                        description: '图表副标题，可选。'
                    },
                    labels: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '简单图表的分类标签数组，例如 ["客户A", "客户B"]。'
                    },
                    values: {
                        type: 'array',
                        items: { type: 'number' },
                        description: '简单图表的数值数组，例如 [12000, 8600]。'
                    },
                    series: {
                        type: 'array',
                        description: '多系列数据。与 labels 搭配使用，例如 [{"name":"本期","data":[10,20]},{"name":"同期","data":[8,16]}]。',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                data: {
                                    type: 'array',
                                    items: { type: 'number' }
                                }
                            }
                        }
                    },
                    rows: {
                        type: 'array',
                        description: '结构化明细数据。多指标、多系列或查询结果数据优先使用 rows。',
                        items: {
                            type: 'object',
                            additionalProperties: true
                        }
                    },
                    dimensions: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '维度字段列表，例如 ["客户名称"] 或 ["月份", "客户类型"]。'
                    },
                    measures: {
                        type: 'array',
                        items: { type: 'string' },
                        description: '指标字段列表，例如 ["含税金额"]。'
                    },
                    x_field: {
                        type: 'string',
                        description: 'X 轴或分类字段。rows 模式建议提供。'
                    },
                    y_field: {
                        type: 'string',
                        description: 'Y 轴或数值字段。rows 模式建议提供。'
                    },
                    group_field: {
                        type: 'string',
                        description: '分组字段。需要多系列、堆叠、对比时提供。'
                    },
                    stack: {
                        type: 'boolean',
                        description: '是否堆叠显示。'
                    },
                    width: {
                        type: 'number',
                        description: '图表宽度，可选。'
                    },
                    height: {
                        type: 'number',
                        description: '图表高度，可选。'
                    },
                    delivery_mode: {
                        type: 'string',
                        enum: ['card_only', 'await_then_reply'],
                        description: '交付方式。纯生成只展示图表用 card_only；需要生成后继续分析、总结或在回复中插入图表用 await_then_reply。'
                    }
                },
                required: ['chart_type']
            },
            handler: async (params) => {
                const request = params && typeof params === 'object' ? { ...params } : {};
                if (!window.ChartGeneratorModule) {
                    return { error: '图表生成模块未加载。' };
                }

                const result = await ChartGeneratorModule.generate(request);
                if (!result.success) {
                    return { error: result.error || '图表生成失败。' };
                }

                return {
                    success: true,
                    image_url: result.image_url,
                    chart_type: result.chart_type || request.chart_type,
                    width: result.width,
                    height: result.height,
                    description: request.title || '图表已生成。'
                };
            }
        }
    ],

    getAllTools() {
        return [...this.chartTools];
    }
};

window.ToolDefinitions = ToolDefinitions;
