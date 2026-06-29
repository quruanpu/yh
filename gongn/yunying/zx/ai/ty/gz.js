// BI unified AI rules: one assistant with dynamic panel permissions.
const YejiBiAiGuize = {
    panelId: 'bi-unified',

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    addDays(date, days) {
        const copy = new Date(date);
        copy.setDate(copy.getDate() + days);
        return copy;
    },

    buildDateDefaults() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const yesterday = this.addDays(today, -1);
        let monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        if (monthStart > yesterday) monthStart = yesterday;
        return {
            today: this.formatDate(today),
            yesterday: this.formatDate(yesterday),
            defaultDateField: '出库日期',
            defaultCurrentRange: [this.formatDate(monthStart), this.formatDate(yesterday)]
        };
    },

    buildSnapshot(app = window.YejiModule) {
        const contexts = [];
        const mainSnapshot = window.YejiMainAiGuize?.buildSnapshot?.(app);
        if (mainSnapshot) contexts.push(mainSnapshot);

        const batchSnapshot = window.YejiPlcxAiGuize?.buildSnapshot?.(app, { includeChildren: true });
        if (batchSnapshot) contexts.push(batchSnapshot);

        if (this.hasTrendContext(app)) {
            const trendSnapshot = window.YejiPlcxQsAiGuize?.buildSnapshot?.({
                context: app.state.batchTrendContext,
                rows: app.state.batchTrendRows || []
            });
            if (trendSnapshot) {
                contexts.push({
                    panelId: 'trend-detail',
                    scope: 'bi-trend',
                    title: '指标详解',
                    ...trendSnapshot
                });
            }
        }

        return {
            panelId: this.panelId,
            title: 'BI通用AI助手',
            dateDefaults: this.buildDateDefaults(),
            activeContext: this.buildActiveContext(app),
            activePermissions: this.getActivePermissions(app),
            contexts
        };
    },

    buildActiveContext(app = window.YejiModule) {
        if (this.hasTrendContext(app)) {
            return {
                scope: 'trend-detail',
                title: '指标详解',
                preferredTool: window.YejiPlcxQsAiGjGuize?.toolNames?.queryPanel || 'yeji_trend_query_panel',
                defaultPolicy: 'current-panel-first',
                canUseAuxiliaryTools: true
            };
        }
        if (this.hasBatchContext(app)) {
            return {
                scope: 'batch-query',
                title: 'BI查询面板',
                preferredTool: window.YejiPlcxAiGjGuize?.toolNames?.queryPanel || 'yeji_batch_query_panel',
                defaultPolicy: 'current-panel-first',
                canUseAuxiliaryTools: true
            };
        }
        return {
            scope: 'main-query',
            title: '主查询页面',
            preferredTool: window.YejiMainAiGjGuize?.toolNames?.queryPage || 'yeji_main_query_page',
            defaultPolicy: 'intent-first',
            canUseAuxiliaryTools: true
        };
    },

    hasBatchContext(app = window.YejiModule) {
        return !!app?.state?.batchQueryOpen;
    },

    hasTrendContext(app = window.YejiModule) {
        return !!(app?.state?.batchTrendContext && document.getElementById('yeji-trend-modal'));
    },

    getActivePermissions(app = window.YejiModule) {
        const permissions = ['主查询页面查询权限', 'BI查询面板动态查询权限', '指标详解动态查询权限'];
        if (this.hasBatchContext(app)) permissions.push('当前BI查询面板快照权限');
        if (this.hasTrendContext(app)) permissions.push('当前指标详解快照权限');
        return permissions;
    },

    getTools(app = window.YejiModule) {
        const tools = [
            ...(window.YejiMainAiGjApp?.getTools?.() || []),
            ...(window.YejiPlcxAiGjApp?.getTools?.() || []),
            ...(window.YejiPlcxQsAiGjApp?.getTools?.() || [])
        ];
        return tools;
    },

    async executeTool(app, toolName, args = {}) {
        const mainName = window.YejiMainAiGjGuize?.toolNames?.queryPage;
        const batchName = window.YejiPlcxAiGjGuize?.toolNames?.queryPanel;
        const trendName = window.YejiPlcxQsAiGjGuize?.toolNames?.queryPanel;

        if (toolName === mainName) {
            return window.YejiMainAiGjApp.execute(app, toolName, args);
        }
        if (toolName === batchName) {
            return window.YejiPlcxAiGjApp.execute(app, toolName, args);
        }
        if (toolName === trendName) {
            return window.YejiPlcxQsAiGjApp.execute(app, toolName, args);
        }
        return {
            success: false,
            error: `当前上下文没有可用工具：${toolName}。`
        };
    },

    buildMessages({ question = '', history = [], snapshot = {} } = {}) {
        const historyMessages = (history || [])
            .filter(item => ['user', 'assistant'].includes(item.role) && item.content)
            .slice(-8)
            .map(item => ({
                role: item.role,
                content: String(item.content || '').slice(0, 1200)
            }));

        return [
            {
                role: 'system',
                content: this.buildSystemPrompt(snapshot, { question })
            },
            {
                role: 'user',
                content: `当前 BI 通用助手上下文快照如下：\n${JSON.stringify(snapshot, null, 2)}`
            },
            ...historyMessages,
            {
                role: 'user',
                content: String(question || '').trim()
            }
        ];
    },

    buildSystemPrompt(snapshot = {}, options = {}) {
        const runtimePrompt = window.YejiBiSkillRuntime?.buildPrompt?.({
            question: options.question || '',
            snapshot
        });
        return runtimePrompt || this.buildFallbackSystemPrompt(snapshot);
    },

    buildFallbackSystemPrompt(snapshot = {}) {
        const activeContext = snapshot.activeContext || {};
        const activeTitle = activeContext.title || '主查询页面';
        const preferredTool = activeContext.preferredTool || 'yeji_main_query_page';
        return [
            '你是林默，一名医药行业业务数据分析师，服务 BI 查询、BI查询面板和指标详解场景。',
            '你现在是整个 BI 查询模块的通用助手。默认拥有主查询页面只读查询权限、BI 查询面板动态查询权限和指标详解动态查询权限。',
            `当前已开放权限：${(snapshot.activePermissions || []).join('、') || '主查询页面查询权限'}。`,
            `当前默认分析上下文：${activeTitle}；优先工具：${preferredTool}。指标详解弹窗或 BI 查询面板打开时，先沿用当前面板口径；其它工具只作为用户明确要求或证据不足时的辅助。`,
            '当前快照只是入口和上下文，不是最终数据边界。涉及具体数值、涨跌、排名、同环比、趋势、目标和预测时，必须优先使用只读工具查询真实数据。',
            '主查询工具用于明细、分页、排序、字段组合、客户/商品/区域/活动/单据拆分和主查询模板。BI查询工具用于模板汇总、模板对比、目标、达成率和合并模板。指标详解工具用于按日节点、节奏、目标压力、值模型、率模型和预测诊断。',
            '先理解用户目标，再识别主体、指标、维度、时间和输出粒度；再规划工具调用；工具返回后复核空数据、失败、分页、字段和口径；证据不足时继续补查或提出最小澄清。',
            '工具失败、空数据或日期不完整时，不能当成 0。不同工具结果只能并列解释，不能跨口径混算。',
            '回复风格：直接以林默身份回复，书面语、简洁、稳、有判断力。先给结论，再给依据，再给观察建议。',
            '回复格式：不得使用 Markdown 格式。不要使用星号、井号、反引号、代码块、表格、分割线、箭头、表情符号或其它特殊装饰符号。按自然段回复，需要分点时使用第一，第二，第三这类中文表达。'
        ].join('\n');
    }
};

window.YejiBiAiGuize = YejiBiAiGuize;
