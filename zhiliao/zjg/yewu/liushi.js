const ZhiLiaoZjgLiushiModule = (() => {
    const methods = {
        createStreamRenderScheduler(renderFn) {
            let hasPending = false;
            let pendingValue = '';
            let renderedValue = '';
            let draining = false;
            const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

            const run = async () => {
                if (draining) return;
                draining = true;
                try {
                    while (hasPending) {
                        const value = pendingValue;
                        hasPending = false;
                        if (value !== renderedValue) {
                            renderFn(value);
                            renderedValue = value;
                        }
                        await nextFrame();
                    }
                } finally {
                    draining = false;
                }
            };

            return {
                push(value) {
                    pendingValue = value;
                    hasPending = true;
                    run();
                },
                async flush() {
                    while (draining || hasPending) {
                        if (!draining && hasPending) {
                            run();
                        }
                        await nextFrame();
                    }
                }
            };
        },

        async processStream(response, textContainer, thinkingContainer, protocol = 'openai', allowReasoning = false) {
            if (!window.ZhiLiaoMoxingXieyiGongchangModule) {
                throw new Error('Cloud protocol module is not loaded.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const streamState = ZhiLiaoMoxingXieyiGongchangModule.createStreamState(protocol);
            const thinkingScheduler = this.createStreamRenderScheduler((valueText) => {
                this.updateThinkingDisplay(thinkingContainer, valueText);
            });
            const contentScheduler = this.createStreamRenderScheduler((valueText) => {
                this.updateContentDisplay(textContainer, valueText);
            });

            let reasoningContent = '';
            let content = '';
            let toolCalls = [];
            let finishReason = '';

            let chunk = await reader.read();
            while (!chunk.done) {
                const chunkText = decoder.decode(chunk.value, { stream: true });
                ZhiLiaoMoxingXieyiGongchangModule.consumeStreamChunk(protocol, streamState, chunkText, {
                    onReasoning: (valueText) => {
                        reasoningContent = valueText;
                        if (allowReasoning) {
                            thinkingScheduler.push(reasoningContent);
                        }
                    },
                    onContent: (valueText) => {
                        content = valueText;
                        contentScheduler.push(content);
                    },
                    onToolCalls: (calls) => {
                        toolCalls = calls || [];
                    },
                    onFinishReason: (reason) => {
                        finishReason = reason || '';
                    }
                });

                const shouldHandleToolCalls = ZhiLiaoMoxingXieyiGongchangModule.isToolCallFinishReason(protocol, finishReason);

                if (shouldHandleToolCalls && toolCalls.length > 0) {
                    await Promise.all([thinkingScheduler.flush(), contentScheduler.flush()]);
                    await this.handleToolCalls(toolCalls, textContainer, thinkingContainer, {
                        reasoningContent,
                        reasoningSignature: streamState.reasoningSignature || ''
                    });
                    return {
                        content,
                        reasoningContent,
                        toolCalls,
                        finishReason,
                        handledByToolCalls: true,
                        historyCommitted: true
                    };
                }

                chunk = await reader.read();
            }

            if (!content) {
                content = streamState.content || '';
            }
            if (!reasoningContent) {
                reasoningContent = streamState.reasoning || '';
            }
            if (!allowReasoning) {
                reasoningContent = '';
            }

            await Promise.all([thinkingScheduler.flush(), contentScheduler.flush()]);
            this.finalizeMessage(textContainer, thinkingContainer, content, reasoningContent);
            return {
                content,
                reasoningContent,
                toolCalls,
                finishReason,
                handledByToolCalls: false,
                historyCommitted: false
            };
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

window.ZhiLiaoZjgLiushiModule = ZhiLiaoZjgLiushiModule;
