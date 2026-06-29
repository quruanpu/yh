// Common BI AI business helpers: input behavior, transient status and stream reading.
const YejiAiYewu = {
    inputDefaults: {
        maxRows: 10,
        mobileMaxRows: 6,
        mobileWidth: 768
    },

    isMobileInput(options = {}) {
        const width = Number(options.mobileWidth || this.inputDefaults.mobileWidth);
        return window.matchMedia?.('(hover: none) and (pointer: coarse)')?.matches
            || (navigator.maxTouchPoints > 0 && window.innerWidth <= width);
    },

    shouldSendOnEnter(event, options = {}) {
        if (!event || event.key !== 'Enter' || event.isComposing) return false;
        if (event.shiftKey) return false;
        return !this.isMobileInput(options);
    },

    resizeInput(input, options = {}) {
        if (!input) return null;
        const maxRows = this.isMobileInput(options)
            ? Number(options.mobileMaxRows || this.inputDefaults.mobileMaxRows)
            : Number(options.maxRows || this.inputDefaults.maxRows);
        const style = window.getComputedStyle(input);
        const lineHeight = parseFloat(style.lineHeight) || 18;
        const paddingTop = parseFloat(style.paddingTop) || 0;
        const paddingBottom = parseFloat(style.paddingBottom) || 0;
        const borderTop = parseFloat(style.borderTopWidth) || 0;
        const borderBottom = parseFloat(style.borderBottomWidth) || 0;
        const maxHeight = Math.ceil((lineHeight * Math.max(1, maxRows)) + paddingTop + paddingBottom + borderTop + borderBottom);

        input.style.height = 'auto';
        const nextHeight = Math.min(input.scrollHeight, maxHeight);
        input.style.height = `${nextHeight}px`;
        input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';

        return {
            height: nextHeight,
            maxHeight,
            overflow: input.style.overflowY
        };
    },

    bindInput(input, handlers = {}, options = {}) {
        if (!input) return () => {};
        const onKeydown = event => {
            if (!this.shouldSendOnEnter(event, options)) return;
            event.preventDefault();
            handlers.onSend?.(event);
        };
        const onInput = event => {
            this.resizeInput(input, options);
            handlers.onInput?.(event, input.value || '');
        };

        input.addEventListener('keydown', onKeydown);
        input.addEventListener('input', onInput);
        this.resizeInput(input, options);

        return () => {
            input.removeEventListener('keydown', onKeydown);
            input.removeEventListener('input', onInput);
        };
    },

    scrollToBottom(container) {
        if (!container) return;
        container.scrollTop = container.scrollHeight;
    },

    createStatusState(type = 'idle', options = {}) {
        return {
            type,
            startedAt: options.startedAt || Date.now(),
            detail: options.detail || '',
            transient: options.transient !== false
        };
    },

    getStatusContent(status = {}) {
        const startedAt = Number(status.startedAt || 0);
        const elapsedSeconds = startedAt > 0 ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;
        return window.YejiAiGuize.getStatusText(status.type || 'idle', {
            detail: status.detail || '',
            elapsedSeconds
        });
    },

    startStatusTimer(status = {}, onTick = null, intervalMs = 1000) {
        const current = {
            ...this.createStatusState(status.type || 'idle', status),
            timer: null
        };
        const tick = () => onTick?.(this.getStatusContent(current), current);
        tick();
        current.timer = window.setInterval(tick, Math.max(250, Number(intervalMs) || 1000));
        return current;
    },

    stopStatusTimer(status = null) {
        if (status?.timer) window.clearInterval(status.timer);
    },

    async readStream(response, options = {}) {
        const protocol = options.protocol || window.YejiAiGuize.defaultProtocol;
        const parser = window.ZhiLiaoMoxingXieyiGongchangModule;
        if (!response?.body?.getReader) {
            throw new Error('模型响应不支持流式读取。');
        }
        if (!parser?.createStreamState || !parser?.consumeStreamChunk) {
            throw new Error('流式解析模块未加载。');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const state = parser.createStreamState(protocol);
        let content = '';
        let toolCalls = [];
        let finishReason = '';

        const consume = chunkText => {
            parser.consumeStreamChunk(protocol, state, chunkText, {
                onContent: valueText => {
                    content = valueText || '';
                    options.onContent?.(window.YejiAiGuize.cleanReplyText(content), state);
                },
                onToolCalls: calls => {
                    toolCalls = calls || [];
                    options.onToolCalls?.(toolCalls, state);
                },
                onFinishReason: reason => {
                    finishReason = reason || '';
                    options.onFinishReason?.(finishReason, state);
                }
            });
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (options.isCancelled?.()) {
                try { await reader.cancel(); } catch {}
                return {
                    content: window.YejiAiGuize.cleanReplyText(content),
                    toolCalls: [],
                    finishReason: 'cancelled'
                };
            }
            consume(decoder.decode(value, { stream: true }));
        }

        const tailText = decoder.decode();
        if (tailText) consume(tailText);
        if (state.buffer) consume('\n');

        finishReason = finishReason || state.finishReason || '';
        content = content || state.content || '';

        if (window.YejiAiGuize.isToolCallFinish(protocol, finishReason) && toolCalls.length > 0) {
            return {
                content: '',
                toolCalls,
                finishReason
            };
        }

        const displayContent = window.YejiAiGuize.cleanReplyText(content);
        options.onContent?.(displayContent, state);
        return {
            content: displayContent,
            toolCalls: [],
            finishReason
        };
    }
};

window.YejiAiYewu = YejiAiYewu;
