(function registerFileReadSkill() {
    function pickKeyword(center, params = {}, context = {}) {
        const fields = [params.keyword, params.query, params.text, params.content, params.message];
        for (let i = 0; i < fields.length; i += 1) {
            const t = center.text(fields[i]);
            if (t) return t;
        }
        return center.text(context?.latestUserText || '');
    }

    function hasFileId(value) {
        if (value === null || value === undefined) return false;
        const t = String(value).trim();
        return t !== '';
    }

    function buildRoutingText(center, context = {}, params = {}) {
        const parts = [
            center.text(context?.routingText),
            center.text(context?.latestUserText),
            center.text(params?.keyword),
            center.text(params?.query),
            center.text(params?.text),
            center.text(params?.content),
            center.text(params?.message)
        ].filter(Boolean);
        return parts.join('\n').toLowerCase();
    }

    function hasNotebookIntent(textValue = '') {
        const t = String(textValue || '').toLowerCase();
        if (!t) return false;
        const hasNotebookWord = /记事本|备忘录|备忘|笔记|notebook|memo|note/.test(t);
        const hasCredential = /账号|账户|密码|密钥|token|cookie|apikey|api key|登录信息|门店码|k码/.test(t);
        const hasMemoryVerb = /记住|保存|存储|写入|记录|查询|查找|读取|删除|修改|更新/.test(t);
        return hasNotebookWord || (hasCredential && hasMemoryVerb);
    }

    function hasFileIntent(textValue = '') {
        const t = String(textValue || '').toLowerCase();
        if (!t) return false;
        return (
            /文件|文档|附件|上传|工作表|表格|pdf|docx?|xlsx?|csv|txt|file[_\s-]?id/.test(t) ||
            /file|document|attachment|spreadsheet/.test(t)
        );
    }

    window.ToolSkillDefinitions = window.ToolSkillDefinitions || [];
    window.ToolSkillDefinitions.push({
        id: 'skill.dq.file_read',
        tools: [
            'get_file_list',
            'describe_file_structure',
            'get_file_content',
            'read_file_chunk',
            'search_files',
            'search_file_content'
        ],
        priority: 40,
        promptGuidance:
            '[文件工具规则]\n' +
            '- 仅用于上传文件、附件、文档、表格、PDF、CSV、TXT 等文件内容问题。\n' +
            '- 第一步先 get_file_list 获取 file_id。\n' +
            '- 了解结构/字段/页表信息用 describe_file_structure；读取内容用 get_file_content 或 read_file_chunk；按文件名找文件用 search_files；按文件内容找关键词用 search_file_content。\n' +
            '- 账号密码、token、门店码等备忘信息查询不要走文件工具，改用 manage_notebook_node。',
        beforeExecute({ toolId, params, context, center }) {
            const base = center.isPlainObject(params) ? { ...params } : {};
            const routingText = buildRoutingText(center, context, base);
            const notebookIntent = hasNotebookIntent(routingText);
            const fileIntent = hasFileIntent(routingText);

            if (notebookIntent && !fileIntent) {
                return {
                    blocked: true,
                    suggestedTool: 'manage_notebook_node',
                    error: '检测到记事本信息存取意图，请改用 manage_notebook_node。'
                };
            }

            if (Object.prototype.hasOwnProperty.call(base, 'fileId') && !Object.prototype.hasOwnProperty.call(base, 'file_id')) {
                base.file_id = base.fileId;
            }
            delete base.fileId;

            if (toolId === 'get_file_list') {
                return { params: base };
            }

            if (toolId === 'search_files') {
                const keyword = pickKeyword(center, base, context);
                if (!keyword) {
                    return {
                        blocked: true,
                        suggestedTool: 'search_files',
                        error: 'search_files 缺少 keyword。'
                    };
                }
                return {
                    params: {
                        ...base,
                        keyword
                    }
                };
            }

            if (toolId === 'search_file_content') {
                if (!hasFileId(base.file_id)) {
                    return {
                        blocked: true,
                        suggestedTool: 'get_file_list',
                        error: 'search_file_content 需要 file_id，请先调用 get_file_list。'
                    };
                }
                const keyword = pickKeyword(center, base, context);
                if (!keyword) {
                    return {
                        blocked: true,
                        suggestedTool: 'search_file_content',
                        error: 'search_file_content 缺少 keyword。'
                    };
                }
                return {
                    params: {
                        ...base,
                        keyword
                    }
                };
            }

            if (toolId === 'describe_file_structure' || toolId === 'get_file_content' || toolId === 'read_file_chunk') {
                if (!hasFileId(base.file_id)) {
                    return {
                        blocked: true,
                        suggestedTool: 'get_file_list',
                        error: `${toolId} 需要 file_id，请先调用 get_file_list。`
                    };
                }
            }

            return { params: base };
        }
    });
})();
