/**
 * Tool Center AI Tool Definitions (Read-only, single flow)
 */
const ToolCenterAiToolDefinitions = {
    create(service = window.ToolCenterAiService) {
        if (!service) return [];

        return [
            {
                id: 'manage_tool_center_item',
                name: '工具中心查询',
                command: '/tool-center-manage',
                registerType: 'ai',
                description: '查询工具中心数据库节点并返回工具数据（含链接）。仅查询，不联网、不推荐。',
                parameters: {
                    type: 'object',
                    properties: {
                        keyword: {
                            type: 'string',
                            description: '可选，按需求关键字检索工具；为空时可用于取全量列表（受 limit 控制）'
                        },
                        limit: {
                            type: 'integer',
                            description: '可选，返回条数上限（默认 50，最大 300）'
                        }
                    }
                },
                handler: async (params) => service.manageItems(params)
            }
        ];
    }
};

window.ToolCenterAiToolDefinitions = ToolCenterAiToolDefinitions;
