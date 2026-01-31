// AI工具调用模块 - 定义AI可以使用的数据库查询工具
const AIToolsModule = {
    // 工具定义（符合OpenAI Function Calling格式）
    tools: [
        {
            type: 'function',
            function: {
                name: 'get_file_list',
                description: '获取当前会话中所有已上传文件的列表（包含文件名、类型、大小等基本信息）',
                parameters: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_file_content',
                description: '根据文件ID获取文件的完整内容',
                parameters: {
                    type: 'object',
                    properties: {
                        file_id: {
                            type: 'number',
                            description: '文件的ID'
                        }
                    },
                    required: ['file_id']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'search_files',
                description: '根据关键词搜索文件（按文件名搜索）',
                parameters: {
                    type: 'object',
                    properties: {
                        keyword: {
                            type: 'string',
                            description: '搜索关键词'
                        }
                    },
                    required: ['keyword']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'get_file_with_preview',
                description: '获取文件内容并生成可视化预览（支持图表、表格等）',
                parameters: {
                    type: 'object',
                    properties: {
                        file_id: {
                            type: 'number',
                            description: '文件的ID'
                        },
                        include_visual: {
                            type: 'boolean',
                            description: '是否包含可视化预览（图表、表格渲染等）',
                            default: true
                        }
                    },
                    required: ['file_id']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'compare_files_visual',
                description: '对比多个文件并生成可视化对比图',
                parameters: {
                    type: 'object',
                    properties: {
                        file_ids: {
                            type: 'array',
                            items: { type: 'number' },
                            description: '要对比的文件ID列表'
                        },
                        comparison_type: {
                            type: 'string',
                            enum: ['side_by_side', 'overlay', 'diff'],
                            description: '对比方式：并排、叠加、差异高亮'
                        }
                    },
                    required: ['file_ids']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'generate_chart_from_data',
                description: '从文件数据生成图表（柱状图、折线图、饼图等）',
                parameters: {
                    type: 'object',
                    properties: {
                        file_id: {
                            type: 'number',
                            description: '数据文件ID'
                        },
                        chart_type: {
                            type: 'string',
                            enum: ['bar', 'line', 'pie', 'scatter'],
                            description: '图表类型'
                        },
                        x_column: {
                            type: 'string',
                            description: 'X轴数据列名'
                        },
                        y_column: {
                            type: 'string',
                            description: 'Y轴数据列名'
                        }
                    },
                    required: ['file_id', 'chart_type']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'generate_chart_from_statistics',
                description: '根据统计数据或用户描述直接生成图表（无需上传文件）',
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
                }
            }
        }
    ],

    // 执行工具调用
    async executeTool(toolName, args, sessionId) {
        if (!window.DBModule) {
            return { error: '数据库模块未加载' };
        }

        try {
            switch (toolName) {
                case 'get_file_list':
                    return await this.getFileList(sessionId);

                case 'get_file_content':
                    return await this.getFileContent(args.file_id);

                case 'search_files':
                    return await this.searchFiles(sessionId, args.keyword);

                case 'get_file_with_preview':
                    return await this.getFileWithPreview(args.file_id, args.include_visual);

                case 'compare_files_visual':
                    return await this.compareFilesVisual(args.file_ids, args.comparison_type);

                case 'generate_chart_from_data':
                    return await this.generateChart(args);

                case 'generate_chart_from_statistics':
                    return await this.generateChartFromStatistics(args);

                default:
                    return { error: `未知的工具: ${toolName}` };
            }
        } catch (error) {
            return { error: error.message };
        }
    },

    // 获取文件列表（精简返回）
    async getFileList(sessionId) {
        const files = await DBModule.getFileList(sessionId);
        return {
            success: true,
            count: files.length,
            files: files.map(f => ({
                id: f.id,
                name: f.filename,
                type: f.type
            }))
        };
    },

    // 获取文件内容
    async getFileContent(fileId) {
        const file = await DBModule.getFile(fileId);
        if (!file) {
            return { error: '文件不存在' };
        }
        return {
            success: true,
            file: file
        };
    },

    // 搜索文件
    async searchFiles(sessionId, keyword) {
        const files = await DBModule.searchFiles(sessionId, keyword);
        return {
            success: true,
            count: files.length,
            files: files
        };
    },

    // ========== 视觉工具方法 ==========

    // 获取文件并生成预览
    async getFileWithPreview(fileId, includeVisual = true) {
        const file = await DBModule.getFile(fileId);
        if (!file) {
            return { error: '文件不存在' };
        }

        const result = {
            success: true,
            file: {
                id: file.id,
                filename: file.filename,
                type: file.type,
                size: file.size
            }
        };

        // 如果是图片/视频，直接返回URL
        if (file.url && ['image', 'video', 'document'].includes(file.type)) {
            result.visual_url = file.url;
            result.visual_type = file.type;
        }

        // 如果是表格数据，生成HTML表格预览
        if (includeVisual && file.type === 'spreadsheet' && file.content) {
            result.visual_html = this.generateTableHTML(file.content);
        }

        // 如果是文本，返回内容
        if (file.content) {
            result.content = file.content;
        }

        return result;
    },

    // 生成HTML表格（用于表格数据可视化）
    generateTableHTML(content) {
        const lines = content.split('\n').slice(0, 20); // 最多20行
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

    // 对比文件（生成可视化对比）
    async compareFilesVisual(fileIds, comparisonType = 'side_by_side') {
        const files = await Promise.all(
            fileIds.map(id => DBModule.getFile(id))
        );

        const validFiles = files.filter(f => f !== null);
        if (validFiles.length === 0) {
            return { error: '没有找到有效的文件' };
        }

        return {
            success: true,
            comparison_type: comparisonType,
            files: validFiles.map(f => ({
                id: f.id,
                filename: f.filename,
                type: f.type,
                url: f.url,
                content_preview: f.content ? f.content.substring(0, 500) : null
            })),
            message: `已准备${validFiles.length}个文件的对比数据，请根据内容进行分析`
        };
    },

    // 生成图表（从数据文件生成真实图表图片）
    async generateChart(args) {
        const file = await DBModule.getFile(args.file_id);
        if (!file || !file.content) {
            return { error: '文件不存在或无内容' };
        }

        // 解析数据
        const lines = file.content.split('\n').filter(l => l.trim());
        const headers = lines[0].split(/[,\t]/);
        const data = lines.slice(1).map(line => line.split(/[,\t]/));

        // 提取指定列的数据
        const xIndex = headers.indexOf(args.x_column);
        const yIndex = headers.indexOf(args.y_column);

        if (xIndex === -1 || yIndex === -1) {
            return { error: '指定的列名不存在' };
        }

        const labels = data.map(row => row[xIndex]);
        const values = data.map(row => parseFloat(row[yIndex]) || 0);

        // 使用ChartGeneratorModule生成图表
        if (!window.ChartGeneratorModule) {
            return { error: '图表生成模块未加载' };
        }

        const result = await ChartGeneratorModule.generateChart(
            args.chart_type,
            labels,
            values,
            { title: `${args.x_column} vs ${args.y_column}` }
        );

        if (!result.success) {
            return { error: result.error };
        }

        // 返回JSON格式（包含图片URL，GLM-4.6V会视觉理解）
        return {
            success: true,
            image_url: result.image_url,
            chart_type: args.chart_type,
            data_points: labels.length,
            description: `已生成${args.chart_type}图表，包含${labels.length}个数据点`
        };
    },

    // 从统计数据直接生成图表（无需文件）
    async generateChartFromStatistics(args) {
        // 验证输入
        if (!args.labels || !Array.isArray(args.labels)) {
            return { error: 'labels参数必须是数组' };
        }
        if (!args.values || !Array.isArray(args.values)) {
            return { error: 'values参数必须是数组' };
        }
        if (args.labels.length !== args.values.length) {
            return { error: 'labels和values数组长度必须相同' };
        }
        if (args.labels.length === 0) {
            return { error: '数据不能为空' };
        }

        // 检查图表生成模块
        if (!window.ChartGeneratorModule) {
            return { error: '图表生成模块未加载' };
        }

        // 直接使用提供的数据生成图表
        const result = await ChartGeneratorModule.generateChart(
            args.chart_type,
            args.labels,
            args.values,
            { title: args.title || '统计图表' }
        );

        if (!result.success) {
            return { error: result.error };
        }

        // 返回精简格式（图片已在界面显示）
        return {
            success: true,
            image_url: result.image_url,
            chart_type: args.chart_type,
            message: `${args.chart_type}图表已生成`
        };
    }
};

// 导出模块
window.AIToolsModule = AIToolsModule;
