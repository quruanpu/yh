(function registerNotebookSkill() {
    function text(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim();
    }

    function hasOwn(obj, key) {
        return Object.prototype.hasOwnProperty.call(obj || {}, key);
    }

    function normalizeAction(action) {
        const raw = String(action || '').trim().toLowerCase();
        const map = {
            create: 'create_node',
            create_node: 'create_node',
            add: 'create_node',
            read: 'read_node',
            read_node: 'read_node',
            get: 'read_node',
            query: 'read_node',
            write: 'write_node',
            write_node: 'write_node',
            save: 'write_node',
            set: 'write_node',
            update: 'update_node',
            update_node: 'update_node',
            patch: 'update_node',
            delete: 'delete_node',
            delete_node: 'delete_node',
            remove: 'delete_node',
            del: 'delete_node',
            list: 'list_nodes',
            list_nodes: 'list_nodes',
            ls: 'list_nodes'
        };
        return map[raw] || '';
    }

    function isObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    }

    function pickRoutingText(center, context = {}, params = {}) {
        const parts = [
            center.text(context?.routingText),
            center.text(context?.latestUserText),
            center.text(params?.keyword),
            center.text(params?.query),
            center.text(params?.text),
            center.text(params?.content),
            center.text(params?.message)
        ].filter(Boolean);
        return parts.join('\n');
    }

    function hasFileIntent(rawText) {
        const t = text(rawText).toLowerCase();
        if (!t) return false;
        return (
            /文件|文档|附件|上传|工作表|表格|pdf|docx?|xlsx?|csv|txt|file[_\s-]?id/.test(t) ||
            /file|document|attachment|spreadsheet/.test(t)
        );
    }

    function hasNotebookKeyword(rawText) {
        const t = text(rawText).toLowerCase();
        if (!t) return false;
        return (
            /记事本|备忘录|备忘|笔记|记下来|记一下|记住|存一下|保存到记事本|记录下来/.test(t) ||
            /notebook|memo|note/.test(t)
        );
    }

    function hasCredentialKeyword(rawText) {
        const t = text(rawText).toLowerCase();
        if (!t) return false;
        return /账号|账户|密码|口令|密钥|token|cookie|apikey|api key|登录信息|门店码|k码/.test(t);
    }

    function hasStoreVerb(rawText) {
        const t = text(rawText).toLowerCase();
        if (!t) return false;
        return /记住|记一下|保存|存储|存入|写入|记录|登记|新增|创建|新建/.test(t);
    }

    function hasReadVerb(rawText) {
        const t = text(rawText).toLowerCase();
        if (!t) return false;
        return /查|查询|查找|找一下|读取|读出|看看|获取|显示|告诉我|列出|全部|所有|有哪些/.test(t);
    }

    function hasDeleteVerb(rawText) {
        const t = text(rawText).toLowerCase();
        if (!t) return false;
        return /删除|删掉|移除|清空|抹掉/.test(t);
    }

    function hasUpdateVerb(rawText) {
        const t = text(rawText).toLowerCase();
        if (!t) return false;
        return /修改|更新|改成|替换|覆盖|重置|更改/.test(t);
    }

    function wantsConcreteValue(rawText) {
        const t = text(rawText).toLowerCase();
        return /密码是什么|账号是什么|具体值|显示|告诉我|读取|读出|查看详情|include_values|show values|read value/.test(t);
    }

    function isSafeNodePath(rawPath) {
        const p = text(rawPath);
        if (!p) return true;
        if (p === 'jishiben' || p.startsWith('jishiben/')) return false;
        if (p.startsWith('/') || p.startsWith('\\')) return false;
        if (/^[a-z]:[\\/]/i.test(p)) return false;
        if (p.split(/[\\/]+/).some(part => part === '..' || part === '')) return false;
        return true;
    }

    function serializedSize(value) {
        try {
            return JSON.stringify(value).length;
        } catch {
            return Infinity;
        }
    }

    function isNotebookIntent(rawText) {
        const t = text(rawText);
        if (!t) return false;
        if (hasNotebookKeyword(t)) return true;
        if (hasCredentialKeyword(t) && (hasStoreVerb(t) || hasReadVerb(t) || hasDeleteVerb(t) || hasUpdateVerb(t))) {
            return true;
        }
        return false;
    }

    function inferAction(base, routingText) {
        if (base.action) return base.action;

        const hasNodePath = text(base.node_path).length > 0;
        const hasValue = hasOwn(base, 'value');

        if (hasDeleteVerb(routingText)) return 'delete_node';
        if (hasUpdateVerb(routingText)) return hasValue ? 'update_node' : (hasNodePath ? 'update_node' : 'list_nodes');
        if (hasStoreVerb(routingText)) return hasValue ? 'write_node' : 'create_node';

        if (/目录|树|节点列表|键列表|都有哪些|有哪些节点/.test(text(routingText))) {
            return 'list_nodes';
        }

        if (hasReadVerb(routingText)) {
            return hasNodePath ? 'read_node' : 'list_nodes';
        }

        if (hasValue) return hasNodePath ? 'write_node' : 'list_nodes';
        return hasNodePath ? 'read_node' : 'list_nodes';
    }

    window.ToolSkillDefinitions = window.ToolSkillDefinitions || [];
    window.ToolSkillDefinitions.push({
        id: 'skill.jsb.manage_notebook_node',
        tools: ['manage_notebook_node'],
        priority: 34,
        promptGuidance:
            '[记事本规则]\n' +
            '- 记住、保存、查询、修改、删除账号密码、token、门店码或其它备忘信息：使用 manage_notebook_node。\n' +
            '- 禁止传 provider_id 或数据库根路径；工具会自动按当前登录供应商隔离。\n' +
            '- 写入、修改、删除必须给 node_path；查询未知路径时先 list_nodes，再按需 read_node。\n' +
            '- 默认列表不要返回具体敏感值；只有用户明确要查看具体值时才 include_values=true。',
        beforeExecute({ params, center, context }) {
            const base = center.isPlainObject(params) ? { ...params } : { action: center.text(params) };
            const routingText = pickRoutingText(center, context, base);

            if (!hasOwn(base, 'value')) {
                if (hasOwn(base, 'data')) base.value = base.data;
                else if (hasOwn(base, 'node_value')) base.value = base.node_value;
            }

            base.action = normalizeAction(base.action || base.op || base.mode || base.type);
            if (!base.node_path) {
                base.node_path = center.text(base.path || base.key || base.node || '');
            }
            if (!base.action) {
                base.action = inferAction(base, routingText);
            }

            if (hasFileIntent(routingText) && !isNotebookIntent(routingText)) {
                return {
                    blocked: true,
                    suggestedTool: 'get_file_list',
                    error: '检测到文件/附件读取意图，请改用文件工具链（先 get_file_list）。'
                };
            }

            delete base.provider_id;
            delete base.providerId;
            delete base.vendor_id;
            delete base.vendorId;
            delete base.provider;
            delete base.provider_path;
            delete base.root;
            delete base.root_path;
            delete base.root_node;
            delete base.rootNode;
            delete base.db_path;
            delete base.full_path;

            if (!base.action) {
                return {
                    blocked: true,
                    suggestedTool: 'manage_notebook_node',
                    error: 'manage_notebook_node 缺少 action。'
                };
            }

            if (['create_node', 'write_node', 'update_node', 'delete_node'].includes(base.action) && !center.text(base.node_path)) {
                return {
                    blocked: true,
                    suggestedTool: 'manage_notebook_node',
                    error: `${base.action} 需要 node_path。`
                };
            }

            const rawPath = center.text(base.node_path);
            if (!isSafeNodePath(rawPath)) {
                return {
                    blocked: true,
                    suggestedTool: 'manage_notebook_node',
                    error: 'node_path 必须是安全的相对路径，不能包含根节点、绝对路径、空路径段或 ..。'
                };
            }

            if (base.action === 'update_node' && !isObject(base.value)) {
                return {
                    blocked: true,
                    suggestedTool: 'manage_notebook_node',
                    error: 'update_node 的 value 必须是对象。'
                };
            }

            if (base.action === 'write_node' && !hasOwn(base, 'value')) {
                return {
                    blocked: true,
                    suggestedTool: 'manage_notebook_node',
                    error: 'write_node 缺少 value。'
                };
            }

            if ((base.action === 'write_node' || base.action === 'update_node') && serializedSize(base.value) > 20000) {
                return {
                    blocked: true,
                    suggestedTool: 'manage_notebook_node',
                    error: '写入内容过大，请拆分为更小的记事本节点。'
                };
            }

            if (base.action === 'delete_node' && !hasDeleteVerb(routingText) && base.confirm !== true) {
                return {
                    blocked: true,
                    suggestedTool: 'manage_notebook_node',
                    error: '删除记事本节点需要用户明确删除意图。'
                };
            }

            if (base.action === 'list_nodes' && !hasOwn(base, 'include_values')) {
                base.include_values = wantsConcreteValue(routingText);
            }

            if (base.action === 'read_node' && !center.text(base.node_path)) {
                base.action = 'list_nodes';
                if (!hasOwn(base, 'include_values')) base.include_values = wantsConcreteValue(routingText);
            }

            return { params: base };
        },
        afterExecute({ result, center }) {
            if (!center.isPlainObject(result)) return { result };
            if (result.success !== true) return { result };

            const next = { ...result };
            if (next.action === 'read_node' && next.exists === false) {
                next.hint = '目标节点不存在，可先 list_nodes 查看可用节点。';
            }
            if (next.action === 'list_nodes' && next.exists === true && Number(next.children_count || 0) === 0) {
                next.hint = '当前节点下暂无子节点，可用 create_node/write_node 新建内容。';
            }
            return { result: next };
        }
    });
})();
