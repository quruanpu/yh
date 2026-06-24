/**
 * File Read Tool Definitions
 * Definition layer only. No storage or registry side effects.
 */
const FileReadToolDefinitions = {
    create(service = window.FileReadService) {
        if (!service) return [];

        const maxChunkLines = Number(service.config?.maxChunkLines || 500) || 500;
        const maxSearchHits = Number(service.config?.maxSearchHits || 20) || 20;

        const base = {
            registerType: 'ai',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        };

        const makeTool = (tool) => ({
            ...base,
            ...tool,
            parameters: tool.parameters || base.parameters
        });

        return [
            makeTool({
                id: 'get_file_list',
                name: 'File List',
                command: '/file-list',
                description: 'Get uploaded files for current session (includes file_id).',
                parameters: {
                    type: 'object',
                    properties: {
                        include_preview: {
                            type: 'boolean',
                            description: 'Whether to include preview text (default false for token saving)'
                        },
                        max_preview_chars: {
                            type: 'integer',
                            description: 'Max preview chars per file when include_preview=true'
                        }
                    },
                    required: []
                },
                handler: async (params) => service.getFileList(params)
            }),
            makeTool({
                id: 'describe_file_structure',
                name: 'Describe File',
                command: '/file-structure',
                description: 'Inspect file structure and return lightweight format hints plus sample.',
                parameters: {
                    type: 'object',
                    properties: {
                        file_id: {
                            type: 'integer',
                            description: 'File id from get_file_list'
                        },
                        sample_lines: {
                            type: 'integer',
                            description: 'How many head lines to sample (default 40)'
                        }
                    },
                    required: ['file_id']
                },
                handler: async (params) => service.describeFileStructure(params)
            }),
            makeTool({
                id: 'get_file_content',
                name: 'Read File Full',
                command: '/file-window',
                description: 'Adaptive read: full text for small files, windowed pagination for large files.',
                parameters: {
                    type: 'object',
                    properties: {
                        file_id: {
                            type: 'integer',
                            description: 'File id from get_file_list'
                        },
                        read_mode: {
                            type: 'string',
                            description: 'auto | full | window (default auto)'
                        },
                        start_char: {
                            type: 'integer',
                            description: 'Start character index (default 0)'
                        },
                        max_chars: {
                            type: 'integer',
                            description: 'Max returned characters for token control'
                        },
                        auto_full_threshold_chars: {
                            type: 'integer',
                            description: 'In auto mode, files at or below this char count return full text'
                        },
                        max_forced_full_chars: {
                            type: 'integer',
                            description: 'Hard cap for full mode; above it falls back to window mode'
                        }
                    },
                    required: ['file_id']
                },
                handler: async (params) => service.getFileContent(params)
            }),
            makeTool({
                id: 'read_file_chunk',
                name: 'Read File Chunk',
                command: '/file-chunk',
                description: 'Read file text in line-based chunks. Continue with returned next params.',
                parameters: {
                    type: 'object',
                    properties: {
                        file_id: {
                            type: 'integer',
                            description: 'File id from get_file_list'
                        },
                        start_line: {
                            type: 'integer',
                            description: 'Start line number (1-based, default 1)'
                        },
                        line_char_offset: {
                            type: 'integer',
                            description: 'Optional character offset inside start_line (for long-line continuation)'
                        },
                        max_lines: {
                            type: 'integer',
                            description: `Number of lines to read (1-${maxChunkLines})`
                        },
                        max_chars: {
                            type: 'integer',
                            description: 'Max returned characters for token control'
                        }
                    },
                    required: ['file_id']
                },
                handler: async (params) => service.readFileChunk(params)
            }),
            makeTool({
                id: 'search_files',
                name: 'Search Files',
                command: '/file-search',
                description: 'Search files by keyword on filename, extension, and type.',
                parameters: {
                    type: 'object',
                    properties: {
                        keyword: {
                            type: 'string',
                            description: 'Search keyword'
                        }
                    },
                    required: ['keyword']
                },
                handler: async (params) => service.searchFiles(params)
            }),
            makeTool({
                id: 'search_file_content',
                name: 'Search File Content',
                command: '/file-content-search',
                description: 'Search keyword hits in one file and return short context.',
                parameters: {
                    type: 'object',
                    properties: {
                        file_id: {
                            type: 'integer',
                            description: 'File id from get_file_list'
                        },
                        keyword: {
                            type: 'string',
                            description: 'Search keyword'
                        },
                        max_hits: {
                            type: 'integer',
                            description: `Max hit count to return (1-${maxSearchHits})`
                        },
                        context_lines: {
                            type: 'integer',
                            description: 'Context lines around each hit (0-5)'
                        },
                        start_line: {
                            type: 'integer',
                            description: 'Search from this line number (default 1)'
                        },
                        include_snippet: {
                            type: 'boolean',
                            description: 'Whether to include snippet text for each hit (default false)'
                        },
                        snippet_chars: {
                            type: 'integer',
                            description: 'Max chars per hit text/snippet'
                        }
                    },
                    required: ['file_id', 'keyword']
                },
                handler: async (params) => service.searchFileContent(params)
            })
        ];
    }
};

window.FileReadToolDefinitions = FileReadToolDefinitions;
