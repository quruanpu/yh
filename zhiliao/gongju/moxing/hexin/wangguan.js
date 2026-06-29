const ZhiLiaoMoxingHexinWangguanModule = {
    constants() {
        return window.ZhiLiaoMoxingChangliangModule;
    },

    router() {
        return window.ZhiLiaoMoxingHexinLuyouModule;
    },

    streamParser() {
        return window.ZhiLiaoMoxingHexinLiushiModule;
    },

    getGatewayUrl() {
        const cloud = window.ZhiLiaoConfig?.cloudFunction || {};
        return String(cloud.modelGatewayUrl || cloud.gatewayUrl || this.constants().defaultGatewayUrl).trim().replace(/\/+$/, '');
    },

    getThinkingDefaults() {
        const budget = Number(window.ShendModule?.config?.thinkingBudget || 4096);
        return {
            reasoning_effort: 'medium',
            thinkingBudget: Number.isFinite(budget) && budget > 0 ? Math.floor(budget) : 4096
        };
    },

    stripEmptyFields(source = {}) {
        const out = {};
        Object.keys(source).forEach((key) => {
            const value = source[key];
            if (value === undefined || value === null) return;
            if (typeof value === 'string' && !value.trim()) return;
            if (Array.isArray(value) && value.length === 0) return;
            out[key] = value;
        });
        return out;
    },

    buildOptions(params = {}, option = {}) {
        const thinkingEnabled = params.enableThinking === true;
        const defaults = this.getThinkingDefaults();
        const options = {
            timeout_ms: params.timeoutMs || params.timeout_ms || undefined,
            max_tokens: params.maxTokens,
            temperature: params.temperature
        };
        if (thinkingEnabled) {
            options.thinking = { type: 'enabled' };
            options.reasoning_effort = params.reasoningEffort || defaults.reasoning_effort;
            options.thinking_budget = defaults.thinkingBudget;
        } else if (option.provider === 'zhipu') {
            options.thinking = { type: 'disabled' };
        }
        return this.stripEmptyFields(options);
    },

    buildPayloadForCapability(capability, params = {}) {
        const target = this.constants().normalizeCapability(capability) || 'text';
        if (target === 'image_generation') {
            return {
                ...(params.payload || {})
            };
        }
        if (target === 'video_generation') {
            return {
                ...(params.payload || {})
            };
        }
        return params.payload && typeof params.payload === 'object' ? params.payload : {};
    },

    async buildRequest(params = {}) {
        const capability = this.constants().normalizeCapability(params.capability || 'text') || 'text';
        const option = params.modelOption || await this.router().requireCapability(capability);
        const action = params.action || this.constants().getActionForCapability(capability);
        const tools = Array.isArray(params.tools)
            ? params.tools
            : (params.enableTools !== false && window.ZhiLiaoMoxingGongjuYingsheModule?.getOpenAITools
                ? ZhiLiaoMoxingGongjuYingsheModule.getOpenAITools({ messages: params.messages })
                : []);

        const requestBody = this.stripEmptyFields({
            provider: option.provider,
            action,
            capability,
            url: option.url,
            key: option.key,
            model: option.model,
            stream: params.stream !== false,
            messages: Array.isArray(params.messages) ? params.messages : [],
            tools,
            payload: this.buildPayloadForCapability(capability, params),
            options: this.buildOptions(params, option)
        });

        return {
            routeType: capability,
            provider: option.provider,
            capability,
            modelOption: option,
            endpoint: this.getGatewayUrl(),
            headers: { 'Content-Type': 'application/json' },
            requestBody
        };
    },

    async getActiveModelOption() {
        return this.router().requireCapability('text');
    },

    createStreamState() {
        return this.streamParser().createState();
    },

    consumeStreamChunk(_protocol, state, chunkText, callbacks = {}) {
        return this.streamParser().consumeChunk(state, chunkText, callbacks);
    },

    isToolCallFinishReason(_protocol, finishReason) {
        return this.streamParser().isToolCallFinishReason(finishReason);
    },

    normalizeResponsePayload(raw) {
        if (!raw) return {};
        if (typeof raw === 'string') {
            try {
                return JSON.parse(raw);
            } catch {
                return {};
            }
        }
        return raw && typeof raw === 'object' ? raw : {};
    },

    parseResponseContent(_protocol, raw) {
        const payload = this.normalizeResponsePayload(raw);
        return String(
            payload.text ||
            payload.output_text ||
            payload.content ||
            payload.raw?.choices?.[0]?.message?.content ||
            ''
        );
    }
};

window.ZhiLiaoMoxingHexinWangguanModule = ZhiLiaoMoxingHexinWangguanModule;
window.ZhiLiaoMoxingXieyiGongchangModule = ZhiLiaoMoxingHexinWangguanModule;
