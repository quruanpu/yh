const ZhiLiaoMoxingHexinLiushiModule = {
    createState() {
        return {
            buffer: '',
            content: '',
            reasoning: '',
            toolCalls: [],
            toolCallMap: {},
            finishReason: ''
        };
    },

    text(value) {
        if (value === undefined || value === null) return '';
        return String(value);
    },

    normalizeToolCalls(calls = []) {
        return (Array.isArray(calls) ? calls : [])
            .map((call, index) => {
                const fn = call?.function || {};
                return {
                    id: this.text(call?.id || `tool_${index}`),
                    type: this.text(call?.type || 'function'),
                    function: {
                        name: this.text(fn.name || call?.name),
                        arguments: typeof fn.arguments === 'string'
                            ? fn.arguments
                            : JSON.stringify(fn.arguments || call?.input || {})
                    }
                };
            })
            .filter(item => item.function.name);
    },

    mergeToolCallDelta(state, delta = {}) {
        const item = delta.tool_call || delta;
        const index = Number(item.index || 0);
        const current = state.toolCallMap[index] || {
            id: item.id || `tool_${index}`,
            type: 'function',
            function: { name: '', arguments: '' }
        };
        if (item.id) current.id = item.id;
        const name = item.name || item.function?.name || '';
        const args = item.arguments_delta || item.function?.arguments || '';
        if (name) current.function.name += name;
        if (args) current.function.arguments += args;
        state.toolCallMap[index] = current;
        state.toolCalls = this.normalizeToolCalls(Object.values(state.toolCallMap));
    },

    consumePayload(state, payload = {}, callbacks = {}) {
        const type = this.text(payload.type);
        if (type === 'content') {
            const text = this.text(payload.text);
            if (text) {
                state.content += text;
                callbacks.onContent?.(state.content);
            }
            return;
        }
        if (type === 'reasoning') {
            const text = this.text(payload.text);
            if (text) {
                state.reasoning += text;
                callbacks.onReasoning?.(state.reasoning);
            }
            return;
        }
        if (type === 'tool_call_delta') {
            this.mergeToolCallDelta(state, payload);
            callbacks.onToolCalls?.(state.toolCalls);
            return;
        }
        if (type === 'tool_call') {
            state.toolCalls = this.normalizeToolCalls(payload.tool_calls || []);
            callbacks.onToolCalls?.(state.toolCalls);
            state.finishReason = state.toolCalls.length ? 'tool_calls' : state.finishReason;
            callbacks.onFinishReason?.(state.finishReason);
            return;
        }
        if (type === 'done') {
            if (!state.finishReason) state.finishReason = state.toolCalls.length ? 'tool_calls' : 'stop';
            callbacks.onFinishReason?.(state.finishReason);
        }
    },

    consumeChunk(state, chunkText, callbacks = {}) {
        state.buffer += this.text(chunkText);
        const lines = state.buffer.split('\n');
        state.buffer = lines.pop() || '';

        lines.forEach((rawLine) => {
            const line = rawLine.trim();
            if (!line.startsWith('data:')) return;
            const data = line.slice(5).trim();
            if (!data || data === '[DONE]') return;
            try {
                this.consumePayload(state, JSON.parse(data), callbacks);
            } catch {
                // Ignore malformed SSE data.
            }
        });
    },

    isToolCallFinishReason(finishReason) {
        return this.text(finishReason) === 'tool_calls';
    }
};

window.ZhiLiaoMoxingHexinLiushiModule = ZhiLiaoMoxingHexinLiushiModule;
