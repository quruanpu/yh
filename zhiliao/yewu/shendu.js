// 深度思考模块 - 处理 GLM-4.6V 模型的思维链功能
const ShendModule = {
    // 配置
    config: {
        model: 'glm-4.6v',
        maxTokens: 8192,
        thinkingBudget: 4096  // 思考token预算
    },

    // 判断是否需要深度思考（智能判断）
    needsDeepThinking(message) {
        if (typeof message !== 'string') return false;

        // 复杂任务关键词
        const complexKeywords = [
            '分析', '对比', '总结', '评估', '设计', '规划',
            '为什么', '怎么', '如何', '原因', '区别',
            '优化', '改进', '建议', '方案', '策略'
        ];

        // 简单任务关键词（不需要深度思考）
        const simpleKeywords = [
            '你好', '谢谢', '是什么', '帮我', '生成图表'
        ];

        // 检查是否为简单任务
        if (simpleKeywords.some(kw => message.includes(kw))) {
            return false;
        }

        // 检查是否为复杂任务
        const hasComplexKeyword = complexKeywords.some(kw => message.includes(kw));
        const isLongMessage = message.length > 100;

        return hasComplexKeyword || isLongMessage;
    },

    // 构建深度思考请求体
    buildRequestBody(messages, systemPrompt, options = {}) {
        return {
            model: this.config.model,
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages
            ],
            max_tokens: options.maxTokens || this.config.maxTokens,
            stream: true,
            thinking: {
                type: 'enabled',
                budget_tokens: options.budgetTokens || this.config.thinkingBudget
            }
        };
    },

    // 开始计时
    startTiming(timerId) {
        if (window.UtilsModule) {
            window.UtilsModule.Timer.start(timerId);
        }
    },

    // 获取思考时长（秒）
    getThinkingDuration(timerId) {
        if (window.UtilsModule) {
            return window.UtilsModule.Timer.stop(timerId);
        }
        return 0;
    },

    // 创建思考中的 HTML
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

    // 创建思考完成的 HTML
    createFinishedHTML(thinkingId, content, duration, renderFn) {
        const durationText = duration > 0 ? `（用时${duration}秒）` : '';
        return `
            <div class="thinking-block">
                <div class="thinking-header" onclick="ZhiLiaoModule.toggleThinking('${thinkingId}')">
                    <div class="thinking-header-icon">
                        <div class="header-dot"></div>
                    </div>
                    <div class="thinking-header-text">
                        <span>已思考${durationText}</span>
                        <i class="fa-solid fa-chevron-down thinking-arrow" id="${thinkingId}-arrow" style="transform: rotate(180deg);"></i>
                    </div>
                </div>
                <div class="thinking-content custom-scrollbar" id="${thinkingId}">
                    ${renderFn(content)}
                </div>
            </div>
        `;
    },

    // 创建已停止的 HTML
    createStoppedHTML(thinkingId, contentHtml, duration) {
        const durationText = duration > 0 ? `（用时${duration}秒）` : '';
        return `
            <div class="thinking-block">
                <div class="thinking-header" onclick="ZhiLiaoModule.toggleThinking('${thinkingId}')">
                    <div class="thinking-header-icon">
                        <div class="header-dot"></div>
                    </div>
                    <div class="thinking-header-text">
                        <span>已停止${durationText}</span>
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

// 导出模块
window.ShendModule = ShendModule;
