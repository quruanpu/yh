// 智能历史管理模块 - 实现消息压缩和重要性评估
const HistoryModule = {
    // 配置
    config: {
        maxTokens: 100000,           // 最大token限制（预留安全边界）
        importanceThreshold: 0.7,    // 重要性阈值
        compressionRatio: 0.3        // 压缩比例（保留30%的详细内容）
    },

    // 评估消息重要性（0-1分数）
    evaluateImportance(message, index, totalMessages) {
        let score = 0.5; // 基础分数

        // 1. 位置权重（首尾消息更重要）
        if (index === 0 || index === 1) {
            score += 0.3; // 第一轮对话（包含初始上下文）
        }
        if (index >= totalMessages - 4) {
            score += 0.3; // 最近2轮对话
        }

        // 2. 内容类型权重
        if (Array.isArray(message.content)) {
            // 多模态消息（包含文件）
            const hasFiles = message.content.some(item =>
                ['image_url', 'video_url', 'file_url'].includes(item.type)
            );
            if (hasFiles) {
                score += 0.2; // 包含文件的消息更重要
            }
        }

        // 3. 角色权重
        if (message.role === 'system') {
            score += 0.4; // 系统提示词最重要
        }

        // 4. 工具调用权重
        if (message.tool_calls || message.role === 'tool') {
            score += 0.2; // 工具调用相关消息重要
        }

        // 5. 内容长度权重（长内容可能包含更多信息）
        const contentLength = this.getContentLength(message.content);
        if (contentLength > 1000) {
            score += 0.1;
        }

        return Math.min(score, 1.0); // 限制在0-1之间
    },

    // 获取内容长度
    getContentLength(content) {
        if (typeof content === 'string') {
            return content.length;
        }
        if (Array.isArray(content)) {
            return content.reduce((sum, item) => {
                if (item.type === 'text') {
                    return sum + (item.text?.length || 0);
                }
                return sum + 100; // 文件URL算100字符
            }, 0);
        }
        return 0;
    },

    // 估算消息的token数量（简化版）
    estimateTokens(message) {
        const contentLength = this.getContentLength(message.content);
        // 中文：1字符≈1.5tokens，英文：1字符≈0.25tokens
        // 简化估算：平均1字符≈0.5tokens
        return Math.ceil(contentLength * 0.5);
    },

    // 压缩单条消息内容
    compressMessage(message, importance) {
        if (importance >= this.config.importanceThreshold) {
            return message; // 重要消息不压缩
        }

        const compressed = { ...message };

        if (typeof message.content === 'string') {
            // 文本消息：提取摘要
            compressed.content = this.extractSummary(message.content);
            compressed._compressed = true;
        } else if (Array.isArray(message.content)) {
            // 多模态消息：保留文件URL，压缩文本
            compressed.content = message.content.map(item => {
                if (item.type === 'text' && item.text.length > 500) {
                    return {
                        type: 'text',
                        text: this.extractSummary(item.text)
                    };
                }
                return item; // 保留文件URL
            });
            compressed._compressed = true;
        }

        return compressed;
    },

    // 提取文本摘要
    extractSummary(text, maxLength = 200) {
        if (text.length <= maxLength) {
            return text;
        }

        // 策略1：提取关键句子（包含关键词的句子）
        const keywords = ['文件', '分析', '结果', '问题', '建议', '总结', '重要', '关键'];
        const sentences = text.split(/[。！？\n]+/).filter(s => s.trim());

        const importantSentences = sentences.filter(sentence =>
            keywords.some(keyword => sentence.includes(keyword))
        );

        if (importantSentences.length > 0) {
            const summary = importantSentences.slice(0, 3).join('。');
            if (summary.length <= maxLength) {
                return summary + '...[已压缩]';
            }
        }

        // 策略2：首尾截取
        const head = text.substring(0, maxLength * 0.6);
        const tail = text.substring(text.length - maxLength * 0.3);
        return `${head}...[省略]...${tail}`;
    },

    // 智能压缩历史消息
    compressHistory(messages, maxTokens = null) {
        if (!messages || messages.length === 0) {
            return messages;
        }

        const targetTokens = maxTokens || this.config.maxTokens;

        // 1. 评估每条消息的重要性
        const messagesWithScore = messages.map((msg, index) => ({
            message: msg,
            importance: this.evaluateImportance(msg, index, messages.length),
            tokens: this.estimateTokens(msg),
            index: index
        }));

        // 2. 计算总token数
        let totalTokens = messagesWithScore.reduce((sum, item) => sum + item.tokens, 0);

        console.log(`历史消息统计: ${messages.length}条, 约${totalTokens} tokens`);

        // 3. 如果未超限，直接返回
        if (totalTokens <= targetTokens) {
            return messages;
        }

        // 4. 需要压缩：按重要性排序
        const sorted = [...messagesWithScore].sort((a, b) => b.importance - a.importance);

        // 5. 保留高重要性消息，压缩低重要性消息
        const compressed = messagesWithScore.map(item => {
            if (item.importance >= this.config.importanceThreshold) {
                return item.message; // 保留原始消息
            } else {
                return this.compressMessage(item.message, item.importance);
            }
        });

        // 6. 重新计算token数
        const compressedTokens = compressed.reduce((sum, msg) =>
            sum + this.estimateTokens(msg), 0
        );

        console.log(`压缩后: ${compressed.length}条, 约${compressedTokens} tokens (节省${Math.round((1 - compressedTokens/totalTokens) * 100)}%)`);

        // 7. 如果还是超限，进行截断（保留重要消息）
        if (compressedTokens > targetTokens) {
            return this.truncateByImportance(messagesWithScore, targetTokens);
        }

        return compressed;
    },

    // 按重要性截断（保留最重要的消息）
    truncateByImportance(messagesWithScore, maxTokens) {
        // 必须保留的消息
        const mustKeep = messagesWithScore.filter(item =>
            item.message.role === 'system' ||
            item.index >= messagesWithScore.length - 2 // 最后一轮
        );

        let currentTokens = mustKeep.reduce((sum, item) => sum + item.tokens, 0);
        const result = [...mustKeep];

        // 按重要性添加其他消息
        const others = messagesWithScore
            .filter(item => !mustKeep.includes(item))
            .sort((a, b) => b.importance - a.importance);

        for (const item of others) {
            if (currentTokens + item.tokens <= maxTokens) {
                result.push(item);
                currentTokens += item.tokens;
            }
        }

        // 按原始顺序排序
        result.sort((a, b) => a.index - b.index);

        console.log(`截断后保留: ${result.length}/${messagesWithScore.length}条消息`);

        return result.map(item => item.message);
    }
};

// 导出模块
window.HistoryModule = HistoryModule;
