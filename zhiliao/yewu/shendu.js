// 深度思考模块 - 处理模型思维链显示
const ShendModule = {
    config: {
        maxTokens: 8192,
        thinkingBudget: 4096
    },

    getActiveModel() {
        return window.ZhiLiaoMoxingYewuModule?.getActiveOption?.()?.model || '';
    },

    buildRequestBody(messages, systemPrompt, options = {}) {
        return {
            model: options.model || this.getActiveModel(),
            messages: [{ role: 'system', content: systemPrompt }, ...messages],
            max_tokens: options.maxTokens || this.config.maxTokens,
            stream: true,
            thinking: {
                type: 'enabled',
                budget_tokens: options.budgetTokens || this.config.thinkingBudget
            }
        };
    },

    startTiming(timerId) {
        if (window.UtilsModule) {
            window.UtilsModule.Timer.start(timerId);
        }
    },

    getThinkingDuration(timerId) {
        if (window.UtilsModule) {
            return window.UtilsModule.Timer.stop(timerId);
        }
        return 0;
    },

    createThinkingHTML(thinkingId, content, renderFn) {
        return `
            <div class="thinking-block">
                <div class="thinking-header" onclick="ZhiLiaoModule.toggleThinking('${thinkingId}-content')">
                    <div class="thinking-header-icon">
                        <div class="spinner"></div>
                    </div>
                    <div class="thinking-header-text">
                        <span>正在思考</span>
                        <i class="fa-solid fa-chevron-down thinking-arrow" id="${thinkingId}-content-arrow"></i>
                    </div>
                </div>
                <div class="thinking-content custom-scrollbar" id="${thinkingId}-content">
                    ${renderFn(content)}
                </div>
            </div>
        `;
    },

    createFinishedHTML(thinkingId, content, duration, renderFn) {
        const durationText = duration > 0 ? `（用时 ${duration} 秒）` : '';
        return `
            <div class="thinking-block">
                <div class="thinking-header" onclick="ZhiLiaoModule.toggleThinking('${thinkingId}')">
                    <div class="thinking-header-icon">
                        <div class="header-dot"></div>
                    </div>
                    <div class="thinking-header-text">
                        <span>已思考 ${durationText}</span>
                        <i class="fa-solid fa-chevron-down thinking-arrow" id="${thinkingId}-arrow" style="transform: rotate(180deg);"></i>
                    </div>
                </div>
                <div class="thinking-content custom-scrollbar" id="${thinkingId}">
                    ${renderFn(content)}
                </div>
            </div>
        `;
    },

    createStoppedHTML(thinkingId, contentHtml, duration) {
        const durationText = duration > 0 ? `（用时 ${duration} 秒）` : '';
        return `
            <div class="thinking-block">
                <div class="thinking-header" onclick="ZhiLiaoModule.toggleThinking('${thinkingId}')">
                    <div class="thinking-header-icon">
                        <div class="header-dot"></div>
                    </div>
                    <div class="thinking-header-text">
                        <span>已停止 ${durationText}</span>
                        <i class="fa-solid fa-chevron-down thinking-arrow" id="${thinkingId}-arrow" style="transform: rotate(180deg);"></i>
                    </div>
                </div>
                <div class="thinking-content custom-scrollbar" id="${thinkingId}">
                    ${contentHtml}
                </div>
            </div>
        `;
    }
};

window.ShendModule = ShendModule;
