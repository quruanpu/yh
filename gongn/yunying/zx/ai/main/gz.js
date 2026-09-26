// BI main page AI rules: read-only snapshot and prompt helpers.
const YejiMainAiGuize = {
    panelId: 'main-query',

    buildSnapshot(app = window.YejiModule, options = {}) {
        const rows = Array.isArray(options.rows)
            ? options.rows
            : this.buildCurrentRows(app, options);
        return {
            panelId: this.panelId,
            scope: 'bi-main',
            title: 'BI主查询',
            page: this.buildPageSnapshot(app),
            templates: this.buildTemplateSnapshot(app),
            sort: app?.normalizeMainSort?.(app?.state?.mainSort) || null,
            fields: {
                rows: (app?.getQueryRowFields?.() || []).map(field => ({
                    key: field.key || '',
                    name: app.getRowFieldDisplayName(field)
                })),
                metrics: (app?.getQueryMetricFields?.() || []).map(field => ({
                    key: field.key || '',
                    name: app.getMetricFieldDisplayName(field)
                }))
            },
            permissions: {
                tools: ['query-page', 'query-filter']
            },
            summary: this.buildSummarySnapshot(app),
            currentRows: rows
        };
    },

    buildPageSnapshot(app) {
        const limit = Number(app?.ultra?.limit || 20);
        return {
            page: Math.floor(Number(app?.state?.offset || 0) / limit) + 1,
            pageSize: limit,
            totalCount: Number(app?.state?.totalCount || 0),
            hasMoreData: !!app?.state?.hasMoreData
        };
    },

    buildTemplateSnapshot(app) {
        const templates = (app?.state?.templates || []).map(tpl => ({
            key: tpl._key || '',
            name: tpl.name || '未命名模板',
            active: tpl._key === app?.state?.activeTemplateKey
        }));
        const active = templates.find(tpl => tpl.active) || null;
        return {
            loaded: !!app?.state?.templatesLoaded,
            count: templates.length,
            activeTemplateKey: app?.state?.activeTemplateKey || '',
            activeTemplateName: active?.name || '',
            availableTemplates: templates
        };
    },

    buildSummarySnapshot(app) {
        const snapshot = app?.state?.summarySnapshot;
        if (!snapshot) return null;
        const data = {};
        (snapshot.metricHeaders || []).forEach((metric, index) => {
            const name = app.getMetricFieldDisplayName(metric || {});
            const fmtIndex = metric?.fmt_idx ?? index;
            data[name] = app.formatMetric(snapshot.grandRow?.metrics?.[index]?.v, snapshot.formats?.[fmtIndex]) || '-';
        });
        return data;
    },

    buildCurrentRows(app, options = {}) {
        const table = document.querySelector('#yeji-table-wrap .yeji-table');
        if (!table) return [];
        const headers = [...table.querySelectorAll('thead th')].map(th => th.textContent.trim());
        const limit = Number(options.limit || 80);
        return [...table.querySelectorAll('tbody tr')].slice(0, limit).map(tr => {
            const row = {};
            [...tr.querySelectorAll('td')].forEach((td, index) => {
                row[headers[index] || `字段${index + 1}`] = td.textContent.trim();
            });
            return row;
        });
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
                content: [
                    '你是林默，一名医药行业业务数据分析师，只服务当前 BI 主查询页面。',
                    '当前主查询页面快照只是入口和上下文，不是最终数据边界。只能使用当前主查询页面快照和私有只读查询工具返回的数据。不能声称访问其它页面、数据库后台或联网资料。',
                    '工具可以按筛选参数、排除参数、查询字段、聚合字段、排序字段、分页参数和模板查询数据。默认工具查询使用主查询默认口径，不继承当前页面筛选；用户明确要求按当前页面继续查、当前筛选、当前模板或当前字段口径时，才传 inheritCurrent:true。用户明确要求查询某个模板时，必须把快照中的模板 key 或模板名称传给工具，等待工具返回结果后再分析。工具结果只用于分析，不会修改当前页面表格、筛选或分页。',
                    '如果用户说当前选中的模板，就优先使用快照里的 activeTemplateKey。若用户说模板名称，就用 availableTemplates 中匹配的 key 或 name。模板不存在或工具返回模板未匹配时，直接说明未找到模板，不要退回默认主查询口径回答。',
                    '同环比问题中，用户只给一个名称且未明确说客户、药店、商品或品种时，先从 availableTemplates 和 activeTemplateName 匹配模板；匹配到模板就按模板查询，不能直接当客户名称。',
                    '涉及具体数值、分页明细、字段对比、筛选结果、同环比或历史对比时，如果当前快照不足但工具能够查询，必须先调用工具补查；只有工具也无法查询或必要字段、模板、日期仍缺失时，才说明缺少哪些条件。不能在未尝试工具补查时回答当前页面数据不足。',
                    '回复格式：不得使用 Markdown 格式。不要使用星号、井号、反引号、代码块、表格、分割线、箭头、表情符号或其它特殊装饰符号。按自然段回复，需要分点时使用第一，第二，第三这类中文表达。'
                ].join('\n')
            },
            {
                role: 'user',
                content: `当前 BI 主查询页面数据快照如下：\n${JSON.stringify(snapshot, null, 2)}`
            },
            ...historyMessages,
            {
                role: 'user',
                content: String(question || '').trim()
            }
        ];
    }
};

window.YejiMainAiGuize = YejiMainAiGuize;
