// Common BI AI app facade: reusable helpers shared by BI panels.
const YejiAiApp = {
    adapters: Object.create(null),

    get rules() {
        return window.YejiAiGuize || null;
    },

    get business() {
        return window.YejiAiYewu || null;
    },

    ensureCore() {
        return !!(this.rules && this.business);
    },

    registerAdapter(adapter = {}) {
        const panelId = String(adapter.panelId || '').trim();
        if (!panelId) throw new Error('AI面板适配器缺少 panelId。');
        if (typeof adapter !== 'object') throw new Error('AI面板适配器必须是对象。');
        const next = {
            panelId,
            name: adapter.name || panelId,
            scope: adapter.scope || panelId,
            getSnapshot: typeof adapter.getSnapshot === 'function' ? adapter.getSnapshot.bind(adapter) : null,
            buildSystemPrompt: typeof adapter.buildSystemPrompt === 'function' ? adapter.buildSystemPrompt.bind(adapter) : null,
            getTools: typeof adapter.getTools === 'function' ? adapter.getTools.bind(adapter) : null,
            executeTool: typeof adapter.executeTool === 'function' ? adapter.executeTool.bind(adapter) : null,
            open: typeof adapter.open === 'function' ? adapter.open.bind(adapter) : null,
            close: typeof adapter.close === 'function' ? adapter.close.bind(adapter) : null,
            send: typeof adapter.send === 'function' ? adapter.send.bind(adapter) : null,
            mount: typeof adapter.mount === 'function' ? adapter.mount.bind(adapter) : null
        };
        this.adapters[panelId] = next;
        return next;
    },

    unregisterAdapter(panelId = '') {
        delete this.adapters[String(panelId || '').trim()];
    },

    getAdapter(panelId = '') {
        return this.adapters[String(panelId || '').trim()] || null;
    },

    listAdapters() {
        return Object.values(this.adapters);
    },

    getPanelSnapshot(panelId, options = {}) {
        return this.getAdapter(panelId)?.getSnapshot?.(options) || null;
    },

    buildSystemPrompt(panelId, snapshot, options = {}) {
        const adapter = this.getAdapter(panelId);
        return adapter?.buildSystemPrompt?.(snapshot, options) || '';
    },

    getTools(panelId, snapshot, options = {}) {
        const adapter = this.getAdapter(panelId);
        return adapter?.getTools?.(snapshot, options) || [];
    },

    async executeTool(panelId, toolName, rawArgs = {}, context = {}) {
        const adapter = this.getAdapter(panelId);
        if (!adapter?.executeTool) {
            throw new Error(`未找到 AI 面板适配器：${panelId}。`);
        }
        return adapter.executeTool(toolName, rawArgs, context);
    },

    createToolApp({ guize, chaxun, toolNameKey, methodName, unknownError }) {
        return {
            maxParallelQueries: 31,

            getTools() {
                return guize?.getToolDefinitions?.() || [];
            },

            async execute(app, toolName, rawArgs = {}) {
                const args = guize?.parseArguments?.(rawArgs) || {};
                const expectedName = guize?.toolNames?.[toolNameKey] || '';
                if (toolName === expectedName && typeof chaxun?.[methodName] === 'function') {
                    return chaxun[methodName](app, args);
                }
                return {
                    success: false,
                    error: typeof unknownError === 'function'
                        ? unknownError(toolName)
                        : `未知工具：${toolName}。`
                };
            }
        };
    },

    async open(panelId, options = {}) {
        const adapter = this.getAdapter(panelId);
        if (!adapter) throw new Error(`未找到 AI 面板适配器：${panelId}。`);
        if (adapter.open) return adapter.open(options);
        if (adapter.mount) return adapter.mount(options);
        return { ok: true };
    },

    async close(panelId, options = {}) {
        const adapter = this.getAdapter(panelId);
        if (!adapter) return { ok: false };
        if (adapter.close) return adapter.close(options);
        return { ok: true };
    },

    async send(panelId, question, options = {}) {
        const adapter = this.getAdapter(panelId);
        if (!adapter?.send) throw new Error(`未找到 AI 面板发送入口：${panelId}。`);
        return adapter.send(question, options);
    },

    cleanPrompt(text = '', options = {}) {
        return this.rules?.cleanPromptText?.(text, options) || '';
    },

    cleanReply(text = '') {
        return this.rules?.cleanReplyText?.(text) || '';
    },

    parseResponse(protocol, raw = {}) {
        return this.rules?.parseResponse?.(protocol, raw) || {
            content: '',
            toolCalls: [],
            finishReason: ''
        };
    },

    async parseModelResponse(result = {}, options = {}) {
        const protocol = options.protocol || result.payload?.protocol || result.protocol || this.rules?.defaultProtocol || 'openai';
        if (result.response?.body && options.stream !== false) {
            return this.business.readStream(result.response, {
                protocol,
                onContent: options.onContent,
                onToolCalls: options.onToolCalls,
                onFinishReason: options.onFinishReason,
                isCancelled: options.isCancelled
            });
        }
        const json = result.response?.json ? await result.response.json() : result;
        return this.parseResponse(protocol, json);
    },

    buildToolAssistantMessage(toolCalls = [], content = '') {
        return this.rules?.buildToolAssistantMessage?.(toolCalls, content) || {
            role: 'assistant',
            content: this.cleanReply(content) || null,
            tool_calls: []
        };
    },

    buildToolResultMessage(toolCall = {}, result = {}) {
        return this.rules?.buildToolResultMessage?.(toolCall, result) || {
            tool_call_id: toolCall.id || '',
            role: 'tool',
            name: toolCall.function?.name || toolCall.name || '',
            content: typeof result === 'string' ? result : JSON.stringify(result ?? {})
        };
    },

    async executeToolCalls(toolCalls = [], executor, options = {}) {
        const maxParallel = Math.max(1, Number(options.maxParallel || toolCalls.length || 1));
        const calls = Array.isArray(toolCalls) ? toolCalls : [];
        const messages = await Promise.all(calls.map(async (toolCall, index) => {
            let result;
            if (index >= maxParallel) {
                result = {
                    success: false,
                    error: `单轮最多并发执行 ${maxParallel} 个工具调用，本次超出的调用已拒绝执行。`
                };
            } else {
                try {
                    const args = this.rules?.parseArguments?.(toolCall.function?.arguments || '{}') || {};
                    result = await executor?.(toolCall.function?.name || '', args, toolCall);
                } catch (error) {
                    result = {
                        success: false,
                        error: this.rules?.getErrorText?.(error) || String(error?.message || error || '')
                    };
                }
            }
            return this.buildToolResultMessage(toolCall, result);
        }));
        return messages;
    },

    normalizeQueryBatch(params = {}, options = {}) {
        const maxItems = Math.max(1, Number(options.maxItems || 31));
        const queries = Array.isArray(params?.queries) && params.queries.length
            ? params.queries
            : [params || {}];
        return queries.slice(0, maxItems).map(item => (item && typeof item === 'object' ? item : {}));
    },

    async runConcurrentQueries(queries = [], run, options = {}) {
        const maxParallel = Math.max(1, Number(options.maxParallel || 31));
        const items = Array.isArray(queries) ? queries : [];
        const results = new Array(items.length);
        let cursor = 0;
        const workers = Array.from({ length: Math.min(maxParallel, items.length) }, async () => {
            while (true) {
                const index = cursor++;
                if (index >= items.length) return;
                const query = items[index];
                try {
                    results[index] = {
                        index,
                        query,
                        result: await run(query, index)
                    };
                } catch (error) {
                    results[index] = {
                        index,
                        query,
                        result: {
                            success: false,
                            error: this.rules?.getErrorText?.(error) || String(error?.message || error || '查询失败。')
                        }
                    };
                }
            }
        });
        await Promise.all(workers);
        return results;
    },

    bindInput(input, handlers = {}, options = {}) {
        return this.business?.bindInput?.(input, handlers, options) || (() => {});
    },

    resizeInput(input, options = {}) {
        return this.business?.resizeInput?.(input, options) || null;
    },

    isMobileInput(options = {}) {
        return this.business?.isMobileInput?.(options) || false;
    },

    getStatusText(type = 'idle', params = {}) {
        return this.rules?.getStatusText?.(type, params) || '';
    },

    createStatusState(type = 'idle', options = {}) {
        return this.business?.createStatusState?.(type, options) || {
            type,
            startedAt: options.startedAt || Date.now(),
            detail: options.detail || '',
            transient: options.transient !== false
        };
    },

    startStatusTimer(status = {}, onTick = null, intervalMs = 1000) {
        return this.business?.startStatusTimer?.(status, onTick, intervalMs) || null;
    },

    stopStatusTimer(status = null) {
        return this.business?.stopStatusTimer?.(status);
    }
};

window.YejiAiApp = YejiAiApp;
window.YejiAiCore = YejiAiApp;
