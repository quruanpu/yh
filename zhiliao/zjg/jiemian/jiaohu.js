const ZhiLiaoZjgJiaohuModule = (() => {
    const methods = {
        addUserMessage(text, files = []) {
            window.ZhiLiaoBujuModule?.addUserMessage?.(text, files);
        },

        addSystemMessage(text) {
            window.ZhiLiaoBujuModule?.addSystemMessage?.(text);
        },

        scrollToBottom() {
            window.ZhiLiaoBujuModule?.scrollToBottom?.();
        },

        async copyToClipboard(button) {
            await window.ZhiLiaoJiaohuModule?.copyToClipboard?.(button);
        },

        async regenerateResponse(messageIndex) {
            await window.ZhiLiaoJiaohuModule?.regenerateResponse?.(
                messageIndex,
                this.state,
                (textContainer, thinkingContainer) => this.streamAPI(textContainer, thinkingContainer)
            );
        },

        escapeHtml(text) {
            return window.ZhiLiaoMessageRendererModule.escapeHtml(text);
        },

        escapeAttr(text) {
            return window.ZhiLiaoMessageRendererModule.escapeAttr(text);
        },

        renderStreamingMessage(text) {
            return window.ZhiLiaoMessageRendererModule.renderStreaming(text);
        },

        renderFinalMessage(text) {
            return window.ZhiLiaoMessageRendererModule.renderFinal(text);
        },

        showToast(message, type = 'warning') {
            window.ZhiLiaoBujuModule?.showToast?.(message, type);
        },

        toggleThinking(id) {
            window.ZhiLiaoJiaohuModule?.toggleThinking?.(id);
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

window.ZhiLiaoZjgJiaohuModule = ZhiLiaoZjgJiaohuModule;
