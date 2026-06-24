// BI unified AI business: one floating assistant for all BI query contexts.
const YejiBiAiYewu = {
    getBiAiState() {
        return this.state.domains?.ai || this.state;
    },

    renderBiGlobalActions() {
        return `
            <div class="yeji-global-action-stack" data-bi-global-actions aria-label="BI全局操作">
                <button type="button" class="yeji-field-config-btn" data-bi-field-config title="字段配置" aria-label="字段配置">
                    <i class="fa-solid fa-sliders"></i>
                </button>
                ${this.renderBiAiButton()}
                <button type="button" class="yeji-batch-query-btn" data-bi-batch-query title="BI查询" aria-label="BI查询">
                    <i class="fa-solid fa-chart-column"></i>
                </button>
            </div>
        `;
    },

    renderBiAiButton() {
        return `
            <button type="button" class="yeji-bi-ai-btn" data-bi-ai-toggle title="AI助手" aria-label="AI助手">
                <span>AI</span>
            </button>
        `;
    },

    renderBiAiPanel() {
        const aiState = this.getBiAiState();
        if (!aiState.biAiOpen) return '';
        const messages = aiState.biAiMessages || [];
        const body = messages.length
            ? messages.map((item, index) => this.renderBiAiMessage(item, index)).join('')
            : `<div class="yeji-trend-ai-empty">${this.escapeHtml(this.getBiAiEmptyText())}</div>`;
        return `
            <aside class="yeji-bi-ai-panel" data-bi-ai-panel>
                <div class="yeji-trend-ai-header">
                    <span>AI助手</span>
                    <button type="button" data-bi-ai-close title="收起">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="yeji-trend-ai-messages" data-bi-ai-messages>${body}</div>
                <div class="yeji-trend-ai-compose">
                    <textarea data-bi-ai-input rows="1" placeholder="${this.escapeHtml(this.getBiAiPlaceholder())}" ${aiState.biAiLoading ? 'disabled' : ''}>${this.escapeHtml(aiState.biAiDraft || '')}</textarea>
                    <button type="button" data-bi-ai-send title="${aiState.biAiLoading ? '停止' : '发送'}" class="${aiState.biAiLoading ? 'stop' : ''}">
                        <i class="fa-solid ${aiState.biAiLoading ? 'fa-stop' : 'fa-paper-plane'}"></i>
                    </button>
                </div>
            </aside>
        `;
    },

    renderBiAiMessage(item = {}, index = 0) {
        const role = item.role === 'user' ? 'user' : (item.role === 'error' ? 'error' : (item.role === 'status' ? 'status' : 'assistant'));
        return `
            <div class="yeji-trend-ai-message ${role}" data-bi-ai-message="${index}">
                <div>${this.escapeHtml(item.content || '').replace(/\n/g, '<br>')}</div>
            </div>
        `;
    },

    renderBiAiRoot() {
        return `
            <div class="yeji-bi-ai-root" data-bi-ai-root>
                ${this.renderBiGlobalActions()}
                ${this.renderBiAiPanel()}
            </div>
        `;
    },

    renderBiAiSurface() {
        const page = document.getElementById('page-yeji');
        document.querySelectorAll('[data-bi-ai-root]').forEach(node => node.remove());
        if (!page || page.style.display === 'none') return;
        document.body.insertAdjacentHTML('beforeend', this.renderBiAiRoot());
        this.bindBiAi();
    },

    refreshBiAiContext() {
        if (!document.querySelector('[data-bi-ai-toggle]')) {
            this.renderBiAiSurface();
            return;
        }
        const input = document.querySelector('[data-bi-ai-input]');
        if (input) input.placeholder = this.getBiAiPlaceholder();
        const empty = document.querySelector('[data-bi-ai-panel] .yeji-trend-ai-empty');
        const aiState = this.getBiAiState();
        if (empty && !(aiState.biAiMessages || []).length) {
            empty.textContent = this.getBiAiEmptyText();
        }
    },

    bindBiAi() {
        const aiState = this.getBiAiState();
        document.querySelector('[data-bi-field-config]')?.addEventListener('click', () => this.openFieldConfigModal());
        document.querySelector('[data-bi-batch-query]')?.addEventListener('click', () => this.openBatchQueryModal());
        document.querySelector('[data-bi-ai-toggle]')?.addEventListener('click', () => this.toggleBiAi());
        document.querySelector('[data-bi-ai-close]')?.addEventListener('click', () => this.closeBiAi());
        document.querySelector('[data-bi-ai-send]')?.addEventListener('click', () => {
            if (aiState.biAiLoading) this.stopBiAiReply();
            else this.sendBiAiMessage();
        });
        const input = document.querySelector('[data-bi-ai-input]');
        if (input) {
            window.YejiAiApp?.bindInput?.(input, {
                onSend: () => {
                    if (aiState.biAiLoading) this.stopBiAiReply();
                    else this.sendBiAiMessage();
                },
                onInput: (_event, value) => {
                    aiState.biAiDraft = value || '';
                }
            }, { maxRows: 10, mobileMaxRows: 10 });
        }
        const messages = document.querySelector('[data-bi-ai-messages]');
        if (messages) {
            if (typeof aiState.biAiScrollTop === 'number') {
                messages.scrollTop = aiState.biAiScrollTop;
            } else if (aiState.biAiAutoFollow !== false) {
                messages.scrollTop = messages.scrollHeight;
            }
            this.bindBiAiScroll(messages);
        }
    },

    bindBiAiScroll(messages) {
        if (!messages || messages.dataset.biAiScrollBound === '1') return;
        const aiState = this.getBiAiState();
        messages.dataset.biAiScrollBound = '1';
        const getDistanceToBottom = () => messages.scrollHeight - messages.scrollTop - messages.clientHeight;
        const isNearBottom = () => getDistanceToBottom() <= 20;
        const syncAutoFollow = () => {
            const nearBottom = isNearBottom();
            aiState.biAiAutoFollow = nearBottom;
            aiState.biAiScrollTop = messages.scrollTop;
        };
        messages.addEventListener('scroll', syncAutoFollow, { passive: true });
        messages.addEventListener('wheel', () => {
            if (!isNearBottom()) aiState.biAiAutoFollow = false;
        }, { passive: true });
        messages.addEventListener('touchmove', () => {
            if (!isNearBottom()) aiState.biAiAutoFollow = false;
        }, { passive: true });
        syncAutoFollow();
    },

    scrollBiAiMessages(force = false) {
        const messages = document.querySelector('[data-bi-ai-messages]');
        if (!messages) return;
        const aiState = this.getBiAiState();
        const distanceToBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight;
        if (!force && aiState.biAiAutoFollow === false && distanceToBottom > 20) return;
        messages.scrollTop = messages.scrollHeight;
        aiState.biAiAutoFollow = true;
        aiState.biAiScrollTop = messages.scrollTop;
    },

    getBiAiPlaceholder() {
        if (window.YejiBiAiGuize?.hasTrendContext?.(this)) return '询问当前指标详解、BI查询或主查询数据...';
        if (window.YejiBiAiGuize?.hasBatchContext?.(this)) return '询问当前 BI 查询或主查询数据...';
        return '询问当前 BI 查询数据...';
    },

    getBiAiEmptyText() {
        if (window.YejiBiAiGuize?.hasTrendContext?.(this)) return '可分析主查询、BI查询面板和当前指标详解数据。';
        if (window.YejiBiAiGuize?.hasBatchContext?.(this)) return '可分析主查询和当前 BI 查询面板数据。';
        return '基于当前 BI 主查询页面分析，可按页码、筛选、字段和模板只读补查。';
    },

    toggleBiAi() {
        const aiState = this.getBiAiState();
        aiState.biAiOpen = !aiState.biAiOpen;
        this.renderBiAiSurface();
    },

    closeBiAi() {
        const aiState = this.getBiAiState();
        aiState.biAiOpen = false;
        aiState.biAiAutoFollow = true;
        aiState.biAiScrollTop = null;
        this.renderBiAiSurface();
    },

    resetBiAi() {
        const aiState = this.getBiAiState();
        this.stopBiAiToolStatus();
        this.stopBiAiReply(true);
        aiState.biAiOpen = false;
        aiState.biAiMessages = [];
        aiState.biAiDraft = '';
        aiState.biAiLoading = false;
        aiState.biAiSeq = (aiState.biAiSeq || 0) + 1;
        aiState.biAiAutoFollow = true;
        aiState.biAiScrollTop = null;
    },

    async sendBiAiMessage() {
        const aiState = this.getBiAiState();
        if (aiState.biAiLoading) return;
        const input = document.querySelector('[data-bi-ai-input]');
        const question = String(input?.value || '').trim();
        if (!question) return;
        aiState.biAiDraft = '';

        const seq = (aiState.biAiSeq || 0) + 1;
        aiState.biAiSeq = seq;
        const history = aiState.biAiMessages || [];
        aiState.biAiMessages = [...history, { role: 'user', content: question }, { role: 'assistant', content: '正在理解问题......' }];
        const assistantIndex = aiState.biAiMessages.length - 1;
        aiState.biAiLoading = true;
        aiState.biAiAutoFollow = true;
        aiState.biAiScrollTop = null;
        this.renderBiAiSurface();

        try {
            const answer = await this.requestBiAiAnswer(question, history, seq, content => {
                if (aiState.biAiToolStatus && String(content || '').trim()) {
                    this.stopBiAiToolStatus();
                }
                this.updateBiAiAssistantMessage(assistantIndex, content);
            });
            if (seq !== aiState.biAiSeq) return;
            this.updateBiAiAssistantMessage(assistantIndex, answer || '我没有拿到可分析结果。请补充模板、客户、商品或日期口径后再试。');
        } catch (error) {
            console.error('[yeji] BI通用AI助手失败', error);
            if (seq !== aiState.biAiSeq) return;
            const messages = [...(aiState.biAiMessages || [])];
            const errorText = window.YejiAiGuize?.getErrorText?.(error, 'unavailable')
                || window.ZhiLiaoModule?.getErrorMessage?.(error, 'AI助手暂时不可用。')
                || 'AI助手暂时不可用。';
            messages[assistantIndex] = { role: 'error', content: errorText };
            aiState.biAiMessages = messages;
        } finally {
            if (seq === aiState.biAiSeq) {
                this.stopBiAiToolStatus();
                aiState.biAiLoading = false;
                this.renderBiAiSurface();
            }
        }
    },

    stopBiAiReply(silent = false) {
        const aiState = this.getBiAiState();
        if (!aiState.biAiLoading && !aiState.biAiToolStatus) return false;
        aiState.biAiSeq = (aiState.biAiSeq || 0) + 1;
        this.stopBiAiToolStatus();
        aiState.biAiLoading = false;
        aiState.biAiAutoFollow = true;
        aiState.biAiScrollTop = null;
        const messages = [...(aiState.biAiMessages || [])];
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            if (messages[i]?.role === 'assistant' && String(messages[i]?.content || '').trim() === '') {
                messages[i] = { role: 'error', content: silent ? '已停止。' : '本次回复已停止。' };
                break;
            }
        }
        aiState.biAiMessages = messages;
        this.renderBiAiSurface();
        return true;
    },

    updateBiAiAssistantMessage(index, content) {
        const aiState = this.getBiAiState();
        const messages = aiState.biAiMessages || [];
        if (!messages[index]) return;
        const displayContent = window.YejiAiGuize?.cleanReplyText
            ? window.YejiAiGuize.cleanReplyText(content)
            : String(content || '');
        messages[index] = { ...messages[index], content: displayContent };
        const el = document.querySelector(`[data-bi-ai-message="${index}"] > div`);
        if (el) {
            el.innerHTML = this.escapeHtml(displayContent).replace(/\n/g, '<br>');
        }
        this.scrollBiAiMessages();
    },

    async ensureBiAiTemplateIndex() {
        if (typeof this.loadTemplates !== 'function') return;
        try {
            await this.loadTemplates();
        } catch (error) {
            console.warn('[yeji] BI AI模板索引预加载失败', error);
        }
    },

    async ensureBiAiGateway() {
        let gateway = window.ZhiLiaoModule;
        if (gateway?.callAPIWithJjgnFallback) return gateway;

        if (window.ZhiLiaoLoader?.load) {
            await window.ZhiLiaoLoader.load();
            gateway = window.ZhiLiaoModule;
        }

        if (!gateway?.callAPIWithJjgnFallback) {
            throw new Error('智聊模型网关未就绪。');
        }
        return gateway;
    },

    async requestBiAiAnswer(question, history, seq, onContent) {
        const gatewayReady = this.ensureBiAiGateway();
        gatewayReady.catch(() => {});
        await this.ensureBiAiTemplateIndex();
        if (seq !== this.getBiAiState().biAiSeq) return '';
        const snapshot = window.YejiBiAiGuize.buildSnapshot(this);
        if (this.requiresBiAiToolEvidence(question) && !this.getBiAiTools().length) {
            throw new Error('BI 查询工具未就绪，无法进行真实数据分析。请稍后重试。');
        }
        await Promise.all([
            gatewayReady,
            window.YejiBiSkillRuntime?.preparePrompt
                ? window.YejiBiSkillRuntime.preparePrompt({ question, snapshot })
                : Promise.resolve()
        ]);
        if (seq !== this.getBiAiState().biAiSeq) return '';
        const messages = window.YejiBiAiGuize.buildMessages({ question, history, snapshot });
        return this.runBiAiToolLoop(messages, seq, onContent);
    },

    getBiAiTools() {
        return window.YejiBiAiGuize?.getTools?.(this) || [];
    },

    async runBiAiToolLoop(messages = [], seq, onContent) {
        let currentMessages = messages;
        let displayedContent = '';
        let toolRounds = 0;
        let noToolRetries = 0;
        let hasToolEvidence = false;
        const maxToolRounds = 20;
        const originalQuestion = this.getLastBiAiUserQuestion(messages);
        const requiresToolEvidence = this.requiresBiAiToolEvidence(originalQuestion);

        while (true) {
            const suppressUnverifiedStream = requiresToolEvidence && !hasToolEvidence;
            const result = await this.callBiAiModel(currentMessages, {
                stream: true,
                seq,
                onContent: content => {
                    if (!suppressUnverifiedStream) onContent?.(displayedContent + (content || ''));
                }
            });
            if (seq !== this.getBiAiState().biAiSeq) return '';

            const resultContent = result.content || '';
            if (!result.toolCalls?.length) {
                this.stopBiAiToolStatus();
                if (requiresToolEvidence && !hasToolEvidence) {
                    noToolRetries += 1;
                    if (noToolRetries > 2) {
                        return '我还没有完成真实数据查询，因此不能给出金额、客户、排名或同环比结论。请稍后重试，或明确模板、日期和分析口径后再发起查询。';
                    }
                    currentMessages = [
                        ...currentMessages,
                        { role: 'user', content: this.buildBiAiToolRequiredPrompt(originalQuestion, noToolRetries) }
                    ];
                    continue;
                }
                if (this.shouldRetryBiAiWithTools(resultContent, toolRounds)) {
                    currentMessages = [
                        ...currentMessages,
                        { role: 'assistant', content: resultContent || null },
                        { role: 'user', content: '当前问题涉及 BI 数据分析。当前页面快照不足时，请先调用可用的 BI 查询工具补查真实数据；不要直接回答当前页面数据不足。' }
                    ];
                    toolRounds += 1;
                    continue;
                }
                displayedContent += resultContent;
                if (window.YejiAiGuize?.isLengthFinish?.(result.finishReason)) {
                    currentMessages = [
                        ...currentMessages,
                        { role: 'assistant', content: resultContent },
                        { role: 'user', content: '请从上文中断处继续，保持原有格式，不要重复已经说过的内容。' }
                    ];
                    continue;
                }
                return displayedContent || '';
            }

            toolRounds += 1;
            if (toolRounds > maxToolRounds) {
                this.stopBiAiToolStatus();
                throw new Error(`单次回复最多连续调用 ${maxToolRounds} 轮工具，请缩小查询范围后重试。`);
            }
            this.startBiAiToolStatus(seq);
            const toolMessages = await this.executeBiAiTools(result.toolCalls);
            hasToolEvidence = toolMessages.length > 0;
            currentMessages = [
                ...currentMessages,
                window.YejiAiApp?.buildToolAssistantMessage?.(result.toolCalls, resultContent) || { role: 'assistant', content: resultContent || null, tool_calls: result.toolCalls },
                ...toolMessages
            ];
        }
    },

    getLastBiAiUserQuestion(messages = []) {
        for (let i = (messages || []).length - 1; i >= 0; i -= 1) {
            const item = messages[i];
            if (item?.role === 'user' && String(item.content || '').trim()) {
                return String(item.content || '').trim();
            }
        }
        return '';
    },

    requiresBiAiToolEvidence(question = '') {
        const text = String(question || '').trim();
        if (!text) return false;
        const dataIntent = /查询|分析|统计|汇总|明细|模板|客户|商品|品种|药店|订单|单据|区域|活动|目标|达成|达成率|趋势|预测|同比|环比|同环比|同期|环期|增量|掉量|变化|排名|top|前\d+|金额|利润|毛利|费用率|销售|采购|含税|不含税/.test(text);
        if (!dataIntent) return false;
        const helpOnly = /^(怎么用|如何使用|能做什么|帮助|介绍一下|你是谁|说明一下功能|说明功能|规则说明|字段含义|口径解释)\??$/.test(text);
        return !helpOnly;
    },

    buildBiAiToolRequiredPrompt(question = '', retry = 1) {
        const active = window.YejiBiAiGuize?.buildSnapshot?.(this)?.activeContext || {};
        const title = active.title || '当前 BI 页面';
        const tool = active.preferredTool || '可用 BI 查询工具';
        return [
            `原始问题：${question}`,
            `这是 BI 数据分析问题，不能直接用语言生成金额、客户、排名、模板或同环比结论。`,
            `请先调用只读 BI 查询工具取真实数据。当前默认上下文是「${title}」，优先工具是「${tool}」。`,
            '如果需要同环比或时间对比，请用同一工具的 queries 同时查询本期、同期和环期。',
            '如果缺少模板、日期或字段，请只提出一个最小澄清问题；不要编造任何数据。',
            `这是第 ${retry} 次工具取证要求。`
        ].join('\n');
    },

    shouldRetryBiAiWithTools(content = '', toolRounds = 0) {
        if (toolRounds > 0) return false;
        const text = String(content || '').trim();
        if (!text) return true;
        return /当前页面数据不足|当前页数据不足|页面数据不足|当前面板数据不足/.test(text);
    },

    startBiAiToolStatus(seq) {
        const aiState = this.getBiAiState();
        this.stopBiAiToolStatus();
        const startedAt = Date.now();
        const messages = [...(aiState.biAiMessages || []), {
            role: 'status',
            content: '数据查询中（已耗时 0 秒）......',
            transient: true
        }];
        const index = messages.length - 1;
        aiState.biAiMessages = messages;
        aiState.biAiToolStatus = {
            seq,
            index,
            startedAt,
            timer: window.setInterval(() => {
                if (seq !== aiState.biAiSeq) {
                    this.stopBiAiToolStatus();
                    return;
                }
                const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
                this.updateBiAiToolStatus(index, `数据查询中（已耗时 ${elapsed} 秒）......`);
            }, 1000)
        };
        this.renderBiAiSurface();
    },

    updateBiAiToolStatus(index, content) {
        const aiState = this.getBiAiState();
        const messages = aiState.biAiMessages || [];
        if (!messages[index] || messages[index].role !== 'status') return;
        messages[index] = { ...messages[index], content };
        const el = document.querySelector(`[data-bi-ai-message="${index}"] > div`);
        if (el) {
            el.innerHTML = this.escapeHtml(content).replace(/\n/g, '<br>');
        }
        this.scrollBiAiMessages();
    },

    stopBiAiToolStatus() {
        const aiState = this.getBiAiState();
        const status = aiState.biAiToolStatus;
        if (status?.timer) window.clearInterval(status.timer);
        if (status && Array.isArray(aiState.biAiMessages)) {
            aiState.biAiMessages = aiState.biAiMessages.filter(item => item.role !== 'status' || !item.transient);
        }
        if (status?.index != null) {
            const node = document.querySelector(`[data-bi-ai-message="${status.index}"]`);
            if (node) node.remove();
        }
        aiState.biAiToolStatus = null;
    },

    async callBiAiModel(messages = [], options = {}) {
        const gateway = await this.ensureBiAiGateway();
        const result = await gateway.callAPIWithJjgnFallback({
            messages,
            stream: options.stream !== false,
            enableThinking: false,
            enableTools: true,
            tools: this.getBiAiTools(),
            temperature: 0.2,
            systemPrompt: ''
        });
        if (!result.response?.body || options.stream === false) {
            const json = await result.response.json();
            return this.parseBiAiResponse(result.payload?.capability || 'text', json);
        }
        return window.YejiAiApp.parseModelResponse(result, {
            protocol: result.payload?.capability || 'text',
            onContent: options.onContent,
            isCancelled: () => options.seq !== this.getBiAiState().biAiSeq || this.getBiAiState().biAiLoading === false
        });
    },

    parseBiAiResponse(protocol, json) {
        const parsed = window.YejiAiApp?.parseResponse?.(protocol, json) || {
            content: '',
            toolCalls: [],
            finishReason: ''
        };
        return {
            content: window.YejiAiGuize.cleanReplyText(parsed.content || ''),
            toolCalls: parsed.toolCalls || [],
            finishReason: parsed.finishReason || ''
        };
    },

    async executeBiAiTools(toolCalls = []) {
        const maxParallel = 31;
        return window.YejiAiApp?.executeToolCalls
            ? window.YejiAiApp.executeToolCalls(toolCalls, (toolName, args) => window.YejiBiAiGuize.executeTool(this, toolName, args), { maxParallel })
            : Promise.all((toolCalls || []).slice(0, maxParallel).map(async toolCall => {
                const result = await window.YejiBiAiGuize.executeTool(this, toolCall.function?.name || '', toolCall.function?.arguments || '{}');
                return window.YejiAiApp.buildToolResultMessage(toolCall, result);
            }));
    }
};

window.YejiBiAiYewu = YejiBiAiYewu;

