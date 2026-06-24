const HistoryModule = {
    config: {
        maxTokens: 100000,
        importanceThreshold: 0.7
    },

    evaluateImportance(message, index, totalMessages) {
        let score = 0.5;

        if (index <= 1) {
            score += 0.3;
        }
        if (index >= totalMessages - 4) {
            score += 0.3;
        }

        if (Array.isArray(message.content)) {
            const hasFiles = message.content.some(item =>
                ['image_url', 'video_url', 'file_url'].includes(item.type)
            );
            if (hasFiles) {
                score += 0.2;
            }
        }

        if (message.role === 'system') {
            score += 0.4;
        }

        if (message.tool_calls || message.role === 'tool') {
            score += 0.2;
        }

        const contentLength = this.getContentLength(message.content);
        if (contentLength > 1000) {
            score += 0.1;
        }

        return Math.min(score, 1.0);
    },

    getContentLength(content) {
        if (typeof content === 'string') {
            return content.length;
        }
        if (Array.isArray(content)) {
            return content.reduce((sum, item) => (item.type === 'text' ? sum + (item.text?.length || 0) : sum + 100), 0);
        }
        return 0;
    },

    estimateTokens(message) {
        const contentLength = this.getContentLength(message.content);
        return Math.ceil(contentLength * 0.5);
    },

    compressMessage(message, importance) {
        if (importance >= this.config.importanceThreshold) {
            return message;
        }

        const compressed = { ...message };

        if (typeof message.content === 'string') {
            compressed.content = this.extractSummary(message.content);
            compressed._compressed = true;
        } else if (Array.isArray(message.content)) {
            compressed.content = message.content.map(item => {
                if (item.type === 'text' && item.text.length > 500) {
                    return {
                        type: 'text',
                        text: this.extractSummary(item.text)
                    };
                }
                return item;
            });
            compressed._compressed = true;
        }

        return compressed;
    },

    extractSummary(text, maxLength = 200) {
        if (text.length <= maxLength) {
            return text;
        }

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

        const head = text.substring(0, maxLength * 0.6);
        const tail = text.substring(text.length - maxLength * 0.3);
        return `${head}...[省略]...${tail}`;
    },

    compressHistory(messages, maxTokens = null) {
        if (!messages || messages.length === 0) {
            return messages;
        }

        const targetTokens = maxTokens || this.config.maxTokens;

        const messagesWithScore = messages.map((msg, index) => ({
            message: msg,
            importance: this.evaluateImportance(msg, index, messages.length),
            tokens: this.estimateTokens(msg),
            index
        }));

        const totalTokens = messagesWithScore.reduce((sum, item) => sum + item.tokens, 0);

        if (totalTokens <= targetTokens) return messages;

        const compressed = messagesWithScore.map((item) =>
            item.importance >= this.config.importanceThreshold
                ? item.message
                : this.compressMessage(item.message, item.importance)
        );

        const compressedTokens = compressed.reduce((sum, msg) =>
            sum + this.estimateTokens(msg), 0
        );

        if (compressedTokens > targetTokens) {
            return this.truncateByImportance(messagesWithScore, targetTokens);
        }

        return compressed;
    },

    truncateByImportance(messagesWithScore, maxTokens) {
        const keepIndexes = new Set();
        const mustKeep = messagesWithScore.filter((item) => {
            const keep = item.message.role === 'system' || item.index >= messagesWithScore.length - 2;
            if (keep) keepIndexes.add(item.index);
            return keep;
        });

        let currentTokens = mustKeep.reduce((sum, item) => sum + item.tokens, 0);
        const result = [...mustKeep];

        const others = messagesWithScore
            .filter((item) => !keepIndexes.has(item.index))
            .sort((a, b) => b.importance - a.importance);

        for (const item of others) {
            if (currentTokens + item.tokens <= maxTokens) {
                result.push(item);
                currentTokens += item.tokens;
            }
        }

        result.sort((a, b) => a.index - b.index);

        return result.map(item => item.message);
    }
};

window.HistoryModule = HistoryModule;
