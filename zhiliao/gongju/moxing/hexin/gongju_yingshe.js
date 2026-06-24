const ZhiLiaoMoxingGongjuYingsheModule = {
    fileToolIds: new Set([
        'get_file_list',
        'describe_file_structure',
        'get_file_content',
        'read_file_chunk',
        'search_files',
        'search_file_content'
    ]),

    toText(value) {
        if (value === undefined || value === null) return '';
        return String(value);
    },

    flattenMessageText(messages = []) {
        if (!Array.isArray(messages)) return '';
        const chunks = [];
        for (let i = 0; i < messages.length; i += 1) {
            const content = messages[i]?.content;
            if (typeof content === 'string') {
                chunks.push(content);
                continue;
            }
            if (!Array.isArray(content)) continue;
            for (let j = 0; j < content.length; j += 1) {
                const block = content[j] || {};
                if (typeof block.text === 'string') chunks.push(block.text);
            }
        }
        return chunks.join('\n');
    },

    hasSessionFiles() {
        const sessionId = this.toText(window.ZhiLiaoModule?.state?.sessionId).trim();
        const files = window.DBModule?.state?.files;
        if (!sessionId || !Array.isArray(files) || files.length === 0) return false;
        return files.some(file => this.toText(file?.sessionId) === sessionId);
    },

    messageHintsNeedFileTools(messages = []) {
        const text = this.flattenMessageText(messages).toLowerCase();
        if (!text) return false;
        return text.includes('file_id:')
            || text.includes('[文件可读资源]'.toLowerCase())
            || text.includes('read_file_chunk')
            || text.includes('search_file_content')
            || text.includes('describe_file_structure');
    },

    shouldIncludeFileTools(options = {}) {
        if (options.includeFileTools === true) return true;
        if (options.includeFileTools === false) return false;
        return this.hasSessionFiles() || this.messageHintsNeedFileTools(options.messages);
    },

    filterToolsByContext(tools = [], options = {}) {
        if (this.shouldIncludeFileTools(options)) return tools;
        return tools.filter(tool => !this.fileToolIds.has(tool?.function?.name));
    },

    getOpenAITools(options = {}) {
        if (!window.ToolRegistry) return [];
        return this.filterToolsByContext(ToolRegistry.getTools(), options);
    }
};

window.ZhiLiaoMoxingGongjuYingsheModule = ZhiLiaoMoxingGongjuYingsheModule;
