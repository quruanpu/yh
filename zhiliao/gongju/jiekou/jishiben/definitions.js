/**
 * Notebook Tool Definitions
 * Definition layer only.
 */
const NotebookToolDefinitions = {
    create(service = window.NotebookService) {
        if (!service) return [];

        return [
            {
                id: 'manage_notebook_node',
                name: '记事本',
                command: '/notebook',
                registerType: 'ai',
                description: '在当前登录供应商的记事本空间内增删查改节点和值（自动锁定到 jishiben/{providerId}）。',
                parameters: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['create_node', 'read_node', 'write_node', 'update_node', 'delete_node', 'list_nodes'],
                            description: '操作类型'
                        },
                        node_path: {
                            type: 'string',
                            description: '相对路径（相对于当前供应商根节点）'
                        },
                        value: {
                            description: '节点值（JSON）'
                        },
                        include_values: {
                            type: 'boolean',
                            description: 'list_nodes 时是否返回子节点值'
                        },
                        max_children: {
                            type: 'integer',
                            description: 'list_nodes 最多返回子节点数量'
                        }
                    },
                    required: ['action']
                },
                handler: async (params) => service.execute(params)
            }
        ];
    }
};

window.NotebookToolDefinitions = NotebookToolDefinitions;
