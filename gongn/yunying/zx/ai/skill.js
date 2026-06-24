// BI skill runtime: loads BI query skill docs on demand and composes prompt extensions.
const YejiBiSkillRuntime = {
    basePath: (() => {
        const fallback = 'gongn/yunying/skill/bi-query-skill/';
        const scriptUrl = typeof document !== 'undefined'
            ? (document.currentScript?.src || '')
            : '';
        if (!scriptUrl) return fallback;
        try {
            return new URL('../../skill/bi-query-skill/', scriptUrl).href;
        } catch {
            return fallback;
        }
    })(),

    state: {
        docs: new Map(),
        failedDocs: new Set(),
        manifestItems: [],
        lastContext: null
    },

    essentialDocs: [
        'references/09-运行时编排.md',
        'references/06-回答规范.md',
        'references/07-错误处理.md'
    ],

    text(value) {
        if (typeof value === 'string') return value.trim();
        if (value === null || value === undefined) return '';
        return String(value).trim();
    },

    normalize(value) {
        return this.text(value).toLowerCase();
    },

    unique(values = []) {
        return Array.from(new Set(values.map(item => this.text(item)).filter(Boolean)));
    },

    async fetchDoc(path = '') {
        const key = this.text(path);
        if (!key) return '';
        if (this.state.docs.has(key)) return this.state.docs.get(key);
        if (this.state.failedDocs.has(key)) return '';

        try {
            const response = await fetch(this.basePath + key, { cache: 'no-cache' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            this.state.docs.set(key, text.trim());
            return this.state.docs.get(key);
        } catch (error) {
            console.warn('[yeji] BI skill 文档加载失败', key, error);
            this.state.failedDocs.add(key);
            return '';
        }
    },

    getDoc(path = '') {
        return this.state.docs.get(this.text(path)) || '';
    },

    async loadManifest() {
        const raw = await this.fetchDoc('manifest.md');
        this.state.manifestItems = this.parseManifest(raw);
        return this.state.manifestItems;
    },

    parseManifest(markdown = '') {
        return String(markdown || '')
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.startsWith('|') && /`(?:scenarios|methods)\//.test(line))
            .map(line => {
                const cells = line
                    .split('|')
                    .map(cell => cell.trim())
                    .filter(Boolean);
                const pathMatch = line.match(/`([^`]+)`/);
                return {
                    name: cells[0] || '',
                    triggers: this.splitTriggerText(cells[1] || ''),
                    path: pathMatch ? pathMatch[1] : '',
                    kind: pathMatch?.[1]?.startsWith('methods/') ? 'method' : 'scenario'
                };
            })
            .filter(item => item.name && item.path);
    },

    splitTriggerText(text = '') {
        return this.unique(String(text || '')
            .replace(/`/g, '')
            .split(/[、,，;；/／\s]+|或|和|及/)
            .map(item => item.trim())
            .filter(item => item && item !== '---'));
    },

    collectTemplates(snapshot = {}) {
        const output = [];
        const push = item => {
            const name = this.text(item?.name || item?.activeTemplateName || item);
            const key = this.text(item?.key || item?.activeTemplateKey || '');
            if (name) output.push({ name, key });
        };

        (snapshot.contexts || []).forEach(context => {
            const templates = context?.templates;
            if (Array.isArray(templates)) {
                templates.forEach(push);
                return;
            }
            if (templates?.activeTemplateName) push({
                name: templates.activeTemplateName,
                key: templates.activeTemplateKey
            });
            if (Array.isArray(templates?.availableTemplates)) {
                templates.availableTemplates.forEach(push);
            }
        });

        return output;
    },

    matchTemplateText(question = '', snapshot = {}) {
        const text = this.normalize(question);
        if (!text) return false;
        return this.collectTemplates(snapshot).some(template => {
            const name = this.normalize(template.name);
            return name && text.includes(name);
        });
    },

    scoreScenario(item = {}, question = '', snapshot = {}) {
        const text = this.normalize(question);
        if (!text) return 0;

        let score = 0;
        if (item.name && text.includes(this.normalize(item.name))) score += 8;

        (item.triggers || []).forEach(trigger => {
            const keyword = this.normalize(trigger);
            if (keyword && text.includes(keyword)) score += keyword.length >= 4 ? 5 : 3;
        });

        if (item.name === '模板查询' && this.matchTemplateText(question, snapshot)) score += 9;
        if (item.name === '模板对比' && /对比|比较|排名|谁好|哪个/.test(text)) score += 4;
        if (item.name === '目标达成' && /目标|达成率|完成率|差额|进度|压力/.test(text)) score += 8;
        if (item.name === '趋势分析' && /趋势|节奏|预测|按日|累计|为什么|原因|诊断/.test(text)) score += 7;
        if (item.name === '客户查询' && /客户|药店|客户编码|药店id|药师帮/.test(text)) score += 7;
        if (item.name === '商品查询' && /商品|品种|spuid|乐药|编码|厂家|通用名/.test(text)) score += 7;
        if (item.name === '区域分析' && /区域|省份|城市|省内|省外|地区/.test(text)) score += 7;
        if (item.name === '活动分析' && /活动|优惠|券|补贴|促销/.test(text)) score += 7;
        if (item.name === '订单单据查询' && /订单|单据|单号|出库单|开票单|运单|批号|快递/.test(text)) score += 7;

        return score;
    },

    selectScenarios(question = '', snapshot = {}) {
        const items = this.state.manifestItems || [];
        return items
            .filter(item => item.kind !== 'method')
            .map(item => ({ ...item, score: this.scoreScenario(item, question, snapshot) }))
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
    },

    selectMethods(question = '', snapshot = {}) {
        const items = this.state.manifestItems || [];
        return items
            .filter(item => item.kind === 'method')
            .map(item => {
                let score = this.scoreScenario(item, question, snapshot);
                if (item.name === '同环比分析' && this.isTimeCompareQuestion(question)) score += 10;
                return { ...item, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 2);
    },

    isTimeCompareQuestion(question = '') {
        return /同比|环比|同环比|同期|环期|去年同期|上月同期|上月|去年|上年|上期|上周|时间对比|增量|掉量|变化/.test(this.normalize(question));
    },

    isMainDetailIntent(question = '') {
        return /客户|药店|客户编码|药店id|药师帮|商品|品种|spuid|乐药|编码|厂家|通用名|明细|单据|订单|客户贡献|商品贡献|品种贡献|贡献客户|贡献商品|采购结构|分页|排序/.test(this.normalize(question));
    },

    isBatchIntent(question = '') {
        return /模板|项目|目标|达成率|完成率|差额|进度|排名|汇总|合并模板/.test(this.normalize(question));
    },

    isTrendIntent(question = '') {
        return /指标|趋势|节奏|预测|按日|累计|压力|诊断|月底/.test(this.normalize(question));
    },

    getActiveScope(snapshot = {}) {
        return this.text(snapshot.activeContext?.scope || 'main-query') || 'main-query';
    },

    selectMethodPaths(question = '', snapshot = {}) {
        const methods = this.selectMethods(question, snapshot);
        if (!methods.length) return [];

        const paths = [];
        methods.forEach(method => {
            if (method.name === '同环比分析') {
                paths.push(...this.selectTimeCompareMethodPaths(method.path, question, snapshot));
                return;
            }
            paths.push(method.path);
        });
        return this.unique(paths);
    },

    selectTimeCompareMethodPaths(indexPath = 'methods/同环比分析/方法索引.md', question = '', snapshot = {}) {
        const paths = [indexPath];
        const scope = this.getActiveScope(snapshot);
        const wantsMain = this.isMainDetailIntent(question);
        const wantsBatch = this.isBatchIntent(question);
        const wantsTrend = this.isTrendIntent(question);

        if (scope === 'trend-detail') {
            paths.push('methods/同环比分析/指标详解同环比.md');
            if (wantsMain) paths.push('methods/同环比分析/主查询同环比.md');
            if (wantsBatch) paths.push('methods/同环比分析/BI查询同环比.md');
            return paths;
        }
        if (scope === 'batch-query') {
            paths.push('methods/同环比分析/BI查询同环比.md');
            if (wantsMain) paths.push('methods/同环比分析/主查询同环比.md');
            if (wantsTrend) paths.push('methods/同环比分析/指标详解同环比.md');
            return paths;
        }
        if (wantsTrend && !wantsMain) {
            paths.push('methods/同环比分析/指标详解同环比.md');
            return paths;
        }
        if (wantsBatch && !wantsMain) {
            paths.push('methods/同环比分析/BI查询同环比.md');
            return paths;
        }
        paths.push('methods/同环比分析/主查询同环比.md');
        return paths;
    },

    selectReferences(scenarios = [], question = '', methodPaths = []) {
        const names = new Set(scenarios.map(item => item.name));
        const text = this.normalize(question);
        const refs = [];

        if (/字段|筛选|查询字段|聚合字段|品种|通用名|单号|活动id|客户|商品|区域/.test(text)) {
            refs.push('references/01-字段字典.md');
        }
        if (/参数|工具|queries|并发|分页|排序|templatekey|templatename|rowfields|metricfields|字段|筛选|聚合/.test(text)) {
            refs.push('references/02-工具协议.md');
        }
        if (names.has('客户查询') || names.has('商品查询') || names.has('区域分析') || names.has('活动分析') || names.has('订单单据查询') || methodPaths.some(path => path.includes('主查询同环比'))) {
            refs.push('references/03-主查询.md');
        }
        if (names.has('模板查询') || names.has('模板对比') || names.has('目标达成') || methodPaths.some(path => path.includes('BI查询同环比'))) {
            refs.push('references/04-BI查询.md');
        }
        if (names.has('趋势分析') || names.has('目标达成') || methodPaths.some(path => path.includes('指标详解同环比'))) {
            refs.push('references/05-指标详解.md');
        }

        return this.unique(refs);
    },

    async preparePrompt({ question = '', snapshot = {} } = {}) {
        await Promise.all(this.essentialDocs.map(path => this.fetchDoc(path)));
        await this.loadManifest();

        const scenarios = this.selectScenarios(question, snapshot);
        const methodPaths = this.selectMethodPaths(question, snapshot);
        const references = this.selectReferences(scenarios, question, methodPaths);
        await Promise.all([
            ...scenarios.map(item => this.fetchDoc(item.path)),
            ...methodPaths.map(path => this.fetchDoc(path)),
            ...references.map(path => this.fetchDoc(path))
        ]);

        this.state.lastContext = {
            question: this.text(question),
            activeScope: this.getActiveScope(snapshot),
            scenarioPaths: scenarios.map(item => item.path),
            scenarioNames: scenarios.map(item => item.name),
            methodPaths,
            referencePaths: references
        };
        return this.state.lastContext;
    },

    buildPrompt({ question = '', snapshot = {} } = {}) {
        const normalizedQuestion = this.text(question);
        const activeScope = this.getActiveScope(snapshot);
        const selected = this.selectScenarios(question, snapshot);
        const methodPaths = this.selectMethodPaths(question, snapshot);
        const fallbackContext = {
            question: normalizedQuestion,
            activeScope,
            scenarioPaths: selected.map(item => item.path),
            scenarioNames: selected.map(item => item.name),
            methodPaths,
            referencePaths: this.selectReferences(
                selected,
                question,
                methodPaths
            )
        };
        const context = this.state.lastContext?.question === normalizedQuestion
            && this.state.lastContext?.activeScope === activeScope
            ? this.state.lastContext
            : fallbackContext;
        const sections = [
            this.buildBasePrompt(snapshot),
            this.buildDocSection('运行时编排', ['references/09-运行时编排.md']),
            this.buildDocSection('回答与错误规范', [
                'references/06-回答规范.md',
                'references/07-错误处理.md'
            ]),
            this.buildDocSection('命中场景 Skill', context.scenarioPaths || []),
            this.buildDocSection('命中分析方法', context.methodPaths || []),
            this.buildDocSection('按需工具与字段参考', context.referencePaths || [])
        ].filter(Boolean);

        const methodNames = (context.methodPaths || [])
            .map(path => path.split('/').slice(-1)[0]?.replace(/\.md$/, ''))
            .filter(Boolean);
        if (context.scenarioNames?.length || methodNames.length) {
            const names = [...(context.scenarioNames || []), ...methodNames];
            sections.splice(1, 0, `本轮问题命中的 BI skill：${names.join('、')}。这些文档只提供专业规则；你仍必须先按通用工作流理解问题并规划路径。`);
        } else {
            sections.splice(1, 0, '本轮问题没有强命中特定业务场景。请按 BI 运行时编排理解、规划、查询和复核；不要为了套用 skill 而强行选择场景。');
        }

        return sections.join('\n\n');
    },

    buildBasePrompt(snapshot = {}) {
        const permissions = (snapshot.activePermissions || []).join('、') || '主查询页面查询权限';
        const range = (snapshot.dateDefaults?.defaultCurrentRange || []).join(' 至 ') || '本月1日至昨天';
        const activeContext = snapshot.activeContext || {};
        const activeTitle = this.text(activeContext.title) || '主查询页面';
        const preferredTool = this.text(activeContext.preferredTool) || 'yeji_main_query_page';
        return [
            '你是林默，一名医药行业业务数据分析师，服务 BI 查询、BI查询面板和指标详解场景。',
            '你现在是整个 BI 查询模块的通用助手。你的职责是先理解用户真实业务目标，再基于当前快照和只读工具结果进行分析。',
            `当前已开放权限：${permissions}。默认日期字段为出库日期；未指定日期时，默认当前期参考区间为 ${range}。`,
            `当前默认分析上下文：${activeTitle}；优先工具：${preferredTool}。除非用户明确要求其它口径，或当前工具无法取得必要证据，否则先基于当前上下文规划查询。`,
            '凡是涉及金额、客户、模板、排名、达成率、趋势、同环比、增量或掉量的结论，必须先调用只读工具取得结果。没有工具结果时，只能说明需要查询或缺少条件，不能直接输出任何具体数值、客户名称、排名或经营结论。',
            '当前快照只是入口和上下文，不是最终数据边界。涉及具体数值、涨跌、排名、对比、目标、预测、趋势和原因诊断时，必须优先用工具补查真实数据；只有工具也无法查询或关键条件缺失时，才说明缺少哪些信息。',
            '主查询工具适合明细、分页、排序、字段组合、主查询模板和客户/商品/区域/活动/单据拆分。BI查询工具适合模板汇总、模板对比、目标、达成率和合并模板。指标详解工具适合按日节点、节奏、目标压力、值模型、率模型和预测诊断。',
            '工具只读，不会改变页面表格、筛选、目标或弹窗状态。不同工具结果只能在回答中并列解释，不能跨工具混算。',
            '回复格式：不得使用 Markdown 格式。不要使用星号、井号、反引号、代码块、表格、分割线、箭头、表情符号或其它特殊装饰符号。按自然段回复，总分总结结构，层次清晰，逻辑连贯。'
        ].join('\n');
    },

    buildDocSection(title = '', paths = []) {
        const parts = this.unique(paths)
            .map(path => {
                const doc = this.getDoc(path);
                return doc ? `【${path}】\n${doc}` : '';
            })
            .filter(Boolean);
        if (!parts.length) return '';
        return `【${title}】\n${parts.join('\n\n')}`;
    }
};

window.YejiBiSkillRuntime = YejiBiSkillRuntime;
