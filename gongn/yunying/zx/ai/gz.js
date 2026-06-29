// Common BI AI rules: text cleanup, model response parsing, tool calls and status copy.
const YejiAiGuize = {
    defaultProtocol: 'openai',

    statusText: {
        idle: 'AI助手已就绪',
        thinking: 'AI正在分析',
        streaming: 'AI正在回复',
        querying: '数据查询中',
        toolRunning: '工具执行中',
        retrying: '正在继续生成',
        emptyData: '当前快照不足',
        unavailable: 'AI助手暂时不可用',
        cancelled: '本次回复已停止',
        failed: 'AI助手处理失败'
    },

    toText(value = '') {
        if (value == null) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        try {
            return JSON.stringify(value);
        } catch {
            return '';
        }
    },

    normalizeWhitespace(text = '') {
        return this.toText(text)
            .replace(/\r\n?/g, '\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    },

    cleanDecorativeSymbolRuns(text = '') {
        return this.toText(text)
            .replace(/[#]{2,}/g, '')
            .replace(/[*]{2,}/g, '')
            .replace(/[?]{2,}/g, '')
            .replace(/([~`_=|^<>@$&+\\/-])\1{1,}/g, '');
    },

    cleanReplyText(text = '') {
        return this.normalizeWhitespace(this.cleanDecorativeSymbolRuns(text));
    },

    cleanPromptText(text = '', options = {}) {
        const maxLength = Number(options.maxLength || 0);
        const value = this.normalizeWhitespace(text)
            .replace(/\u0000/g, '')
            .replace(/[^\S\n]+/g, ' ');
        return maxLength > 0 && value.length > maxLength ? value.slice(0, maxLength) : value;
    },

    normalizePayload(raw = {}) {
        let payload = raw;
        if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'body')) {
            payload = payload.body;
        }
        if (typeof payload === 'string') {
            try {
                payload = JSON.parse(payload);
            } catch {
                return {};
            }
        }
        return payload && typeof payload === 'object' ? payload : {};
    },

    readOpenAIContent(content) {
        if (typeof content === 'string') return content;
        if (!Array.isArray(content)) return '';
        return content.map(item => {
            if (!item || typeof item !== 'object') return '';
            if (typeof item.text === 'string') return item.text;
            if (item.type === 'output_text' && typeof item.text === 'string') return item.text;
            return '';
        }).join('');
    },

    readOpenAIResponsesText(payload = {}) {
        if (typeof payload.output_text === 'string') return payload.output_text;
        const output = Array.isArray(payload.output) ? payload.output : [];
        const texts = [];
        output.forEach(item => {
            if (item?.type === 'output_text' && typeof item.text === 'string') texts.push(item.text);
            if (item?.type === 'message' && Array.isArray(item.content)) {
                item.content.forEach(block => {
                    if ((block?.type === 'output_text' || block?.type === 'text') && typeof block.text === 'string') {
                        texts.push(block.text);
                    }
                });
            }
        });
        return texts.join('');
    },

    readOpenAIChoicesText(payload = {}) {
        const message = payload?.choices?.[0]?.message || {};
        return this.readOpenAIContent(message.content);
    },

    readClaudeText(payload = {}) {
        const blocks = Array.isArray(payload.content) ? payload.content : [];
        return blocks
            .filter(item => item?.type === 'text')
            .map(item => item.text || '')
            .join('');
    },

    readGeminiText(payload = {}) {
        const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
        const texts = [];
        candidates.forEach(candidate => {
            const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
            parts.forEach(part => {
                if (typeof part?.text === 'string') texts.push(part.text);
            });
        });
        return texts.join('');
    },

    parseResponseContent(protocol, raw = {}) {
        const payload = this.normalizePayload(raw);
        const parser = window.ZhiLiaoMoxingXieyiGongchangModule;
        if (parser?.parseResponseContent) {
            const text = parser.parseResponseContent(protocol || this.defaultProtocol, raw);
            if (text) return this.cleanReplyText(text);
        }
        const openaiResponses = this.readOpenAIResponsesText(payload);
        const openaiChoices = this.readOpenAIChoicesText(payload);
        const claude = this.readClaudeText(payload);
        const gemini = this.readGeminiText(payload);
        const ordered = protocol === 'claude'
            ? [claude, openaiResponses, openaiChoices, gemini]
            : protocol === 'gemini'
                ? [gemini, openaiResponses, openaiChoices, claude]
                : [openaiResponses, openaiChoices, claude, gemini];
        return this.cleanReplyText(ordered.find(Boolean) || '');
    },

    extractFinishReason(protocol, raw = {}) {
        const payload = this.normalizePayload(raw);
        const reason = payload?.incomplete_details?.reason
            || payload?.response?.incomplete_details?.reason
            || payload?.choices?.[0]?.finish_reason
            || payload?.stop_reason
            || payload?.candidates?.[0]?.finishReason
            || payload?.finish_reason
            || '';
        if (payload?.status === 'incomplete' || payload?.response?.status === 'incomplete') return 'length';
        return String(reason || '').includes('max') ? 'length' : String(reason || '');
    },

    isLengthFinish(finishReason = '') {
        const reason = String(finishReason || '').trim().toLowerCase();
        return reason === 'length' || reason === 'max_tokens' || reason === 'max_token' || reason.includes('max_token');
    },

    isToolCallFinish(protocol, finishReason = '') {
        const parser = window.ZhiLiaoMoxingXieyiGongchangModule;
        if (parser?.isToolCallFinishReason) {
            return parser.isToolCallFinishReason(protocol || this.defaultProtocol, finishReason);
        }
        return protocol === 'claude' ? finishReason === 'tool_use' : finishReason === 'tool_calls';
    },

    normalizeToolCall(toolCall = {}, index = 0) {
        const fn = toolCall.function || {};
        const name = fn.name || toolCall.name || '';
        const args = fn.arguments != null ? fn.arguments : (toolCall.arguments ?? toolCall.input ?? {});
        if (!name) return null;
        return {
            id: toolCall.id || toolCall.call_id || `yeji_ai_tool_${index}`,
            type: toolCall.type || 'function',
            function: {
                name,
                arguments: typeof args === 'string' ? args : JSON.stringify(args || {})
            }
        };
    },

    extractToolCalls(protocol, raw = {}, choiceMessage = null) {
        const payload = this.normalizePayload(raw);
        const message = choiceMessage || payload?.choices?.[0]?.message || {};
        if (Array.isArray(message.tool_calls) && message.tool_calls.length) {
            return message.tool_calls.map((item, index) => this.normalizeToolCall(item, index)).filter(Boolean);
        }

        const output = Array.isArray(payload.output) ? payload.output : [];
        const responseCalls = output
            .filter(item => item?.type === 'function_call')
            .map((item, index) => this.normalizeToolCall(item, index))
            .filter(Boolean);
        if (responseCalls.length) return responseCalls;

        if (protocol === 'claude') {
            const content = Array.isArray(payload.content) ? payload.content : [];
            return content
                .filter(item => item?.type === 'tool_use')
                .map((item, index) => this.normalizeToolCall(item, index))
                .filter(Boolean);
        }
        return [];
    },

    parseResponse(protocol, raw = {}) {
        const payload = this.normalizePayload(raw);
        const choiceMessage = payload?.choices?.[0]?.message || {};
        return {
            content: this.parseResponseContent(protocol, raw),
            toolCalls: this.extractToolCalls(protocol, payload, choiceMessage),
            finishReason: this.extractFinishReason(protocol, payload)
        };
    },

    parseArguments(rawValue = '') {
        if (!rawValue) return {};
        if (typeof rawValue === 'object') return rawValue;
        try {
            return JSON.parse(String(rawValue || '{}'));
        } catch {
            return {};
        }
    },

    buildToolAssistantMessage(toolCalls = [], content = '') {
        return {
            role: 'assistant',
            content: this.cleanReplyText(content) || null,
            tool_calls: (toolCalls || []).map((toolCall, index) => {
                const normalized = this.normalizeToolCall(toolCall, index);
                return normalized || null;
            }).filter(Boolean)
        };
    },

    buildToolResultMessage(toolCall = {}, result = {}) {
        const normalized = this.normalizeToolCall(toolCall, 0) || {};
        return {
            tool_call_id: normalized.id || toolCall.id || '',
            role: 'tool',
            name: normalized.function?.name || toolCall.function?.name || toolCall.name || '',
            content: typeof result === 'string' ? result : JSON.stringify(result ?? {})
        };
    },

    getStatusText(type = 'idle', params = {}) {
        const base = this.statusText[type] || this.statusText.idle;
        const elapsed = Number(params.elapsedSeconds);
        if (Number.isFinite(elapsed) && elapsed >= 0) {
            return `${base}（已耗时 ${Math.floor(elapsed)} 秒）`;
        }
        if (params.detail) return `${base}：${params.detail}`;
        return base;
    },

    getErrorText(error, fallbackType = 'failed') {
        const message = error?.message || error;
        const readable = window.ZhiLiaoModule?.getErrorMessage?.(message, '') || message;
        return this.cleanReplyText(readable) || this.statusText[fallbackType] || this.statusText.failed;
    }
};

window.YejiAiGuize = YejiAiGuize;
