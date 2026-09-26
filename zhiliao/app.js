const ZhiLiaoModule = {
    config: {
        get systemPrompt() {
            return window.SystemPromptModule?.getSystemPrompt() || '';
        },
        maxTokens: 16384,
        temperature: 0.7,
        maxHistoryRounds: window.ZhiLiaoConfig?.message.maxHistoryRounds || 10,
        maxHistoryTokens: window.ZhiLiaoConfig?.message.maxTokens || 80000
    },

    state: {
        messageHistory: [],
        isWaitingResponse: false,
        enableThinking: false,
        currentAbortController: null,
        currentModelCapability: 'text',
        currentModelOption: null,
        container: null,
        isVisible: false,
        toolCallDepth: 0,
        lastToolCallSignature: '',
        repeatedToolCallCount: 0,
        uploadedFiles: [],
        sessionId: null,
        snapshotPersistChain: Promise.resolve()
    },

    bootstrapState: {
        initialized: false,
        promise: null
    },

    logDebug(scope, ...args) {
        window.ZhiLiaoLog?.debug?.(scope, ...args);
    },

    logWarn(scope, ...args) {
        console.warn(`[智聊] ${scope}`, ...args);
    },

    logError(scope, error = null, ...args) {
        if (error) {
            console.error(`[智聊] ${scope}`, ...args, error);
            return;
        }
        console.error(`[智聊] ${scope}`, ...args);
    },

    extractReadableError(value, fallback = '') {
        if (value === undefined || value === null) return fallback;

        if (typeof value === 'string') {
            const text = value.trim();
            if (!text) return fallback;
            if (text === '[object Object]') return fallback;
            const classified = this.classifyModelErrorText(text);
            if (classified) return classified;

            try {
                const parsed = JSON.parse(text);
                if (parsed && typeof parsed === 'object') {
                    const nested = this.extractReadableError(parsed, '');
                    if (nested) return nested;
                }
            } catch {
                // ignore non-json string
            }

            return text;
        }

        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }

        if (typeof value === 'object') {
            const candidates = [
                value.message,
                value.error,
                value.detail,
                value.error_message,
                value.reason,
                value.msg,
                value.description
            ];

            for (let i = 0; i < candidates.length; i += 1) {
                const picked = this.extractReadableError(candidates[i], '');
                if (picked) return picked;
            }

            try {
                const json = JSON.stringify(value);
                if (json && json !== '{}' && json !== '[]') return json;
            } catch {
                // ignore non-serializable object
            }
        }

        return fallback;
    },

    stripHtmlTags(text = '') {
        return String(text || '')
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    },

    classifyModelErrorText(text = '') {
        const raw = String(text || '').trim();
        if (!raw) return '';
        const plain = this.stripHtmlTags(raw);
        const lower = `${raw}\n${plain}`.toLowerCase();

        if (
            lower.includes('attention required') ||
            lower.includes('cloudflare') ||
            lower.includes('sorry, you have been blocked') ||
            lower.includes('unable to access') ||
            lower.includes('agnes-ai.com')
        ) {
            const ray = raw.match(/Cloudflare Ray ID:\s*<\/?[^>]*>\s*([a-z0-9]+)/i)
                || plain.match(/Cloudflare Ray ID:\s*([a-z0-9]+)/i);
            return `上游模型服务被安全策略拦截，暂时无法完成请求。${ray?.[1] ? `Cloudflare Ray ID：${ray[1]}。` : ''}请稍后重试或切换模型通道。`;
        }

        if (/failed to fetch|err_connection_closed|networkerror/i.test(raw)) {
            return '模型服务连接中断，请稍后重试。';
        }

        if (/http\s+429/i.test(raw)) {
            return '模型服务请求过于频繁，请稍后再试。';
        }

        if (/http\s+(401|403)/i.test(raw)) {
            return '模型服务认证或权限校验失败，请检查模型配置。';
        }

        if (/<html[\s\S]*<\/html>/i.test(raw)) {
            return plain || '模型服务返回了无法识别的网页错误，请稍后重试。';
        }

        return '';
    },

    getErrorMessage(error, fallback = '请求处理失败，请稍后重试。') {
        const direct = this.extractReadableError(error, '');
        if (direct) return direct;
        return fallback;
    },

    createErrorNotice(error, prefix = '抱歉，出现了错误：') {
        return `${prefix}${this.getErrorMessage(error)}`;
    },

    getRuntimeSystemPrompt() {
        const basePrompt = String(this.config.systemPrompt || '').trim();
        const skillPrompt = window.ToolSkillCenterModule?.buildSystemPromptExtension?.() || '';
        if (basePrompt && skillPrompt) return `${basePrompt}\n${skillPrompt}`;
        return basePrompt || skillPrompt;
    },

    setWaitingState(isWaiting) {
        this.state.isWaitingResponse = isWaiting;
        if (!isWaiting) {
            this.state.currentAbortController = null;
        }
        window.ZhiLiaoJiaohuModule?.updateSendButton?.(isWaiting);
    },

    pushUserHistory(message, userContent, currentFiles, needGroupedCall) {
        if (needGroupedCall) {
            const filesSummary = currentFiles.map(f => f.name).join('、');
            const textOnlyContent = message || `请分析这些文件：${filesSummary}`;
            this.state.messageHistory.push({ role: 'user', content: textOnlyContent });
            return;
        }

        if (currentFiles.length > 0) {
            const filesSummary = currentFiles.map(f => f.name).join('、');
            const textOnlyContent = message || `请分析文件：${filesSummary}`;
            const historyContent = `${textOnlyContent}\n[已上传 ${currentFiles.length} 个文件]`;
            this.state.messageHistory.push({ role: 'user', content: historyContent });
            return;
        }

        this.state.messageHistory.push({ role: 'user', content: userContent });
    },

    showAIError(error, textContainer = null) {
        const notice = this.createErrorNotice(error);
        if (textContainer) {
            textContainer.innerHTML = `<p style="color: #ef4444;">${this.escapeHtml(notice)}</p>`;
            return;
        }
        this.addSystemMessage(notice);
    },

    async bootstrap() {
        if (this.bootstrapState.promise) return this.bootstrapState.promise;

        this.bootstrapState.promise = (async () => {
            const framework = window.AppFramework || (typeof AppFramework !== 'undefined' ? AppFramework : null);
            if (!framework) {
                throw new Error('主框架未就绪：AppFramework');
            }

            if (!framework.modules?.zhiliao) {
                framework.register({
                    id: 'zhiliao',
                    name: '智聊',
                    icon: 'fa-solid fa-comments',
                    path: 'zhiliao',
                    order: 1
                });
            }
            framework.setModuleInstance('zhiliao', this);

            return this;
        })().catch((error) => {
            this.bootstrapState.promise = null;
            throw error;
        });

        return this.bootstrapState.promise;
    },

    async ensureInitialized() {
        if (this.bootstrapState.initialized) return;
        this.bootstrapState.initialized = true;
        await this.init();
    },

    isCurrentModule() {
        const framework = window.AppFramework || (typeof AppFramework !== 'undefined' ? AppFramework : null);
        return !framework?.currentModule || framework.currentModule === 'zhiliao';
    },

    async show() {
        if (!this.isCurrentModule()) return;
        await this.ensureInitialized();
        if (!this.isCurrentModule()) return;
        this.state.isVisible = true;
        document.getElementById('page-chat')?.style.setProperty('display', 'flex');
        document.getElementById('chat-footer')?.style.setProperty('display', 'flex');
    },

    hide() {
        this.state.isVisible = false;
        document.getElementById('page-chat')?.style.setProperty('display', 'none');
        document.getElementById('chat-footer')?.style.setProperty('display', 'none');
    },

};

if (!window.ZhiLiaoZjgAppModule || typeof window.ZhiLiaoZjgAppModule.applyTo !== 'function') {
    throw new Error('[智聊] 子架构加载失败：zhiliao/zjg/app.js 未正确加载');
}
window.ZhiLiaoZjgAppModule.applyTo(ZhiLiaoModule);

window.ZhiLiaoModule = ZhiLiaoModule;
