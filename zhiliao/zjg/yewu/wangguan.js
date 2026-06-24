const ZhiLiaoZjgWangguanModule = (() => {
    const methods = {
        getUnifiedGateway() {
            return window.ZhiLiaoMoxingHexinWangguanModule || window.ZhiLiaoMoxingXieyiGongchangModule || null;
        },

        async buildProtocolPayload({
            messages = [],
            stream = true,
            enableThinking = false,
            enableTools = false,
            maxTokens = this.config.maxTokens,
            temperature = this.config.temperature,
            systemPrompt = undefined,
            tools = undefined,
            capability = 'text',
            action = undefined,
            payload = undefined,
            modelOption = undefined
        } = {}) {
            const gateway = this.getUnifiedGateway();
            if (!gateway?.buildRequest) throw new Error('统一模型网关未加载');

            const request = await gateway.buildRequest({
                capability,
                action,
                modelOption,
                messages,
                systemPrompt: systemPrompt === undefined ? this.config.systemPrompt : systemPrompt,
                maxTokens,
                temperature,
                stream,
                enableThinking,
                enableTools,
                tools,
                payload
            });

            this.state.currentModelCapability = request.capability || 'text';
            this.state.currentModelOption = request.modelOption;
            return request;
        },

        isAbortError(error) {
            return !!(error && typeof error === 'object' && error.name === 'AbortError');
        },

        async callAPIWithJjgnFallback({
            messages = [],
            stream = true,
            enableThinking = false,
            enableTools = false,
            maxTokens = this.config.maxTokens,
            temperature = this.config.temperature,
            signal = null,
            systemPrompt = undefined,
            tools = undefined,
            capability = 'text',
            action = undefined,
            payload = undefined,
            modelOption = undefined
        } = {}) {
            const requestPayload = await this.buildProtocolPayload({
                messages,
                stream,
                enableThinking,
                enableTools,
                tools,
                maxTokens,
                temperature,
                systemPrompt,
                capability,
                action,
                payload,
                modelOption
            });
            const response = await this.callAPI(requestPayload, signal);
            return {
                response,
                payload: requestPayload,
                fallbackUsed: false
            };
        },

        parseGatewayErrorResponse(response, bodyText = '') {
            let errorData = null;
            if (bodyText) {
                try {
                    errorData = JSON.parse(bodyText);
                } catch {
                    errorData = null;
                }
            }
            const cloudError = errorData?.error;
            const rawMessage = typeof cloudError === 'string'
                ? cloudError
                : (cloudError?.message || errorData?.message || bodyText || `HTTP ${response.status}`);
            const message = window.ZhiLiaoModule?.getErrorMessage?.(rawMessage, rawMessage) || rawMessage;
            return {
                status: Number(response?.status || 0),
                errorData,
                bodyText,
                message
            };
        },

        async callAPI(requestPayload, signal = null) {
            if (!requestPayload?.endpoint || !requestPayload?.requestBody) {
                throw new Error('统一模型请求参数不完整');
            }

            const response = await fetch(requestPayload.endpoint, {
                method: 'POST',
                headers: requestPayload.headers || { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestPayload.requestBody),
                signal
            });

            if (response.ok) return response;

            const bodyText = await response.text().catch(() => '');
            const error = this.parseGatewayErrorResponse(response, bodyText);
            throw new Error(`HTTP ${error.status}: ${error.message}`);
        }
    };

    return {
        methods,
        applyTo(appModule) {
            if (!appModule || typeof appModule !== 'object') return appModule;
            Object.assign(appModule, methods);
            return appModule;
        }
    };
})();

window.ZhiLiaoZjgWangguanModule = ZhiLiaoZjgWangguanModule;
