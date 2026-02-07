/**
 * 工具定义集合 - 所有工具的统一定义
 *
 * 职责：
 * 1. 集中定义所有工具（内置 + 外部）
 * 2. 提供统一的工具定义格式
 * 3. 供工具注册中心（app_zc.js）使用
 *
 * 工具定义格式：
 * {
 *     id: 'tool_id',              // 工具唯一标识
 *     name: '工具名称',            // 用户可见名称
 *     command: '/命令',            // 命令触发关键字
 *     description: '功能描述',     // 详细说明
 *     icon: '🔧',                 // 图标
 *     parameters: {               // AI调用参数（JSON Schema）
 *         type: 'object',
 *         properties: { ... },
 *         required: [ ... ]
 *     },
 *     handler: async (params) => { // 执行函数
 *         // 业务逻辑
 *         return result;
 *     }
 * }
 */

const ToolDefinitions = {
    /**
     * 文件管理工具
     */
    fileTools: [
        {
            id: 'get_file_list',
            name: '文件列表',
            command: '/文件列表',
            description: '获取当前会话中所有已上传文件的列表（包含文件名、类型、大小等基本信息）',
            icon: '📋',
            registerType: 'ai',  // 仅AI可调用
            parameters: {
                type: 'object',
                properties: {},
                required: []
            },
            handler: async (params) => {
                if (!window.DBModule) {
                    return { error: '数据库模块未加载' };
                }

                const sessionId = window.ZhiLiaoModule?.state?.sessionId;
                if (!sessionId) {
                    return { error: '会话ID不存在' };
                }

                const files = await DBModule.getFileList(sessionId);
                return {
                    success: true,
                    count: files.length,
                    files: files.map(f => ({
                        id: f.id,
                        name: f.filename,
                        type: f.type,
                        size: f.size
                    }))
                };
            }
        },
        {
            id: 'get_file_content',
            name: '获取文件',
            command: '/获取文件',
            description: '根据文件ID获取文件的完整内容',
            icon: '📄',
            registerType: 'ai',  // 仅AI可调用
            parameters: {
                type: 'object',
                properties: {
                    file_id: {
                        type: 'number',
                        description: '文件的ID'
                    }
                },
                required: ['file_id']
            },
            handler: async (params) => {
                if (!window.DBModule) {
                    return { error: '数据库模块未加载' };
                }

                const fileId = typeof params === 'object' ? params.file_id : parseInt(params);
                const file = await DBModule.getFile(fileId);

                if (!file) {
                    return { error: '文件不存在' };
                }

                return {
                    success: true,
                    file: file
                };
            }
        },
        {
            id: 'search_files',
            name: '搜索文件',
            command: '/搜索文件',
            description: '根据关键词搜索文件（按文件名搜索）',
            icon: '🔍',
            registerType: 'ai',  // 仅AI可调用
            parameters: {
                type: 'object',
                properties: {
                    keyword: {
                        type: 'string',
                        description: '搜索关键词'
                    }
                },
                required: ['keyword']
            },
            handler: async (params) => {
                if (!window.DBModule) {
                    return { error: '数据库模块未加载' };
                }

                const sessionId = window.ZhiLiaoModule?.state?.sessionId;
                if (!sessionId) {
                    return { error: '会话ID不存在' };
                }

                const keyword = typeof params === 'object' ? params.keyword : params;
                const files = await DBModule.searchFiles(sessionId, keyword);

                return {
                    success: true,
                    count: files.length,
                    files: files
                };
            }
        }
    ],

    /**
     * 图表生成工具
     */
    chartTools: [
        {
            id: 'generate_chart_from_statistics',
            name: '生成图表',
            command: '/生成图表',
            description: '根据你分析整理的数据生成图表。当用户上传文件要求生成图表时，你应该先分析文件内容，自己整理出labels和values数组，然后调用此工具生成图表。',
            icon: '📊',
            registerType: 'ai',  // 仅AI可调用
            parameters: {
                type: 'object',
                properties: {
                    chart_type: {
                        type: 'string',
                        enum: ['bar', 'line', 'pie', 'scatter'],
                        description: '图表类型'
                    },
                    labels: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'X轴标签数组（如：["PDF", "图片", "视频"]）'
                    },
                    values: {
                        type: 'array',
                        items: { type: 'number' },
                        description: 'Y轴数值数组（如：[5, 3, 2]）'
                    },
                    title: {
                        type: 'string',
                        description: '图表标题（可选）'
                    }
                },
                required: ['chart_type', 'labels', 'values']
            },
            handler: async (params) => {
                if (!params.labels || !Array.isArray(params.labels)) {
                    return { error: 'labels参数必须是数组' };
                }
                if (!params.values || !Array.isArray(params.values)) {
                    return { error: 'values参数必须是数组' };
                }
                if (params.labels.length !== params.values.length) {
                    return { error: 'labels和values数组长度必须相同' };
                }
                if (params.labels.length === 0) {
                    return { error: '数据不能为空' };
                }

                if (!window.ChartGeneratorModule) {
                    return { error: '图表生成模块未加载' };
                }

                const result = await ChartGeneratorModule.generateChart(
                    params.chart_type, params.labels, params.values,
                    { title: params.title || '统计图表' }
                );

                if (!result.success) {
                    return { error: result.error };
                }

                return {
                    success: true,
                    image_url: result.image_url,
                    chart_type: params.chart_type,
                    message: `${params.chart_type}图表已生成`
                };
            }
        }
    ],

    /**
     * 生成HTML表格（辅助方法）
     */
    generateTableHTML(content) {
        const lines = content.split('\n').slice(0, 20);
        const rows = lines.map(line => line.split(/[,\t]/));

        let html = '<table border="1" style="border-collapse: collapse;">';
        rows.forEach((row, index) => {
            html += '<tr>';
            row.forEach(cell => {
                const tag = index === 0 ? 'th' : 'td';
                html += `<${tag} style="padding: 4px 8px;">${cell}</${tag}>`;
            });
            html += '</tr>';
        });
        html += '</table>';

        return html;
    },

    /**
     * 获取所有工具定义
     * @returns {Array} 所有工具的数组
     */
    getAllTools() {
        return [
            ...this.fileTools,
            ...this.chartTools
        ];
    }
};

// 导出模块
window.ToolDefinitions = ToolDefinitions;
