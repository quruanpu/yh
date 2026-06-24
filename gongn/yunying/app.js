/**
 * BI运营查询模块 - 出库统计Ultra默认查询
 *
 * 保持原BI查询页布局与按钮位置，只替换数据查询协议为观远自助查询：
 * 默认出库日期为本月第一天到前一天，上方卡片使用观远总计行，下方表格显示默认字段。
 */
const YejiModule = {
    ultra: window.YejiConfig?.ultra || null,

    state: {
        isVisible: false,
        proxyReady: false,
        tokenValid: false,
        checking: false,
        queryLoading: false,
        metadataLoaded: false,
        offset: 0,
        totalCount: 0,
        hasMoreData: false,
        summarySnapshot: null,
        lastRequestSeq: 0,
        filtersOpen: false,
        filterOpen: {},
        filterScroll: {},
        filterValues: {},
        filterSearch: {},
        batchOpen: {},
        excludeMode: {},
        selectorOptions: {},
        selectorLoading: {},
        expandedTree: {},
        selectors: [],
        quickSearchSelectorId: '',
        quickSearchValue: '',
        templates: [],
        templatesLoaded: false,
        activeTemplateKey: '',
        batchQueryOpen: false,
        batchQueryLoading: false,
        batchQueryRows: [],
        batchQueryRowMap: null,
        batchQueryMetricFields: [],
        batchQueryDisplayMetricFields: [],
        batchQueryFieldConfig: null,
        batchQueryDateValues: null,
        batchQueryTemplateSnapshot: [],
        batchQueryCache: {},
        batchQueryPendingRefresh: false,
        batchMergedOpen: {},
        batchQueryTargets: { ranges: {} },
        batchQueryActiveTargetKey: '',
        batchQueryTargetPickerOpen: false,
        batchQueryTargetsLoaded: false,
        batchQueryTargetUploading: false,
        batchTargetFile: null,
        batchTrendSeq: 0,
        batchTrendContext: null,
        batchTrendRows: [],
        batchTrendError: '',
        batchTrendRenderScheduled: false,
        biAiOpen: false,
        biAiMessages: [],
        biAiDraft: '',
        biAiLoading: false,
        biAiSeq: 0,
        biAiToolStatus: null,
        biAiAutoFollow: true,
        biAiScrollTop: null,
        filterPreloadStarted: false,
        clearedTimeSelectors: {},
        availableRowFields: [],
        availableMetricFields: [],
        fieldConfig: {},
        fieldConfigDraft: null,
        mainSort: { fieldKey: 'nebZXyfTkXXEVuOZOzmokaMJ', fieldName: '出库日期', order: 'desc' },
        columnFields: [],
        dateRange: [],
        domains: {}
    },

    ...window.YejiSxYewu,
    ...window.YejiPzYewu,
    ...window.YejiMbYewu,
    ...window.YejiPlcxMbYewu,
    ...window.YejiPlcxHbYewu,
    ...window.YejiPlcxJhYewu,
    ...window.YejiPlcxFwYewu,
    ...window.YejiPlcxYewu,
    ...window.YejiPlcxQsSuanfaYewu,
    ...window.YejiPlcxQsZfxYewu,
    ...window.YejiPlcxQsLfxYewu,
    ...window.YejiPlcxQsYewu,
    ...window.YejiCxFwYewu,
    ...window.YejiCxYewu,
    ...window.YejiJgYewu,

    async init() {
        this.ultra = this.ultra || window.YejiConfig?.ultra || null;
        if (!this.ultra) {
            console.error('[yeji] 出库统计 Ultra 配置未加载。');
            return;
        }
        await this.loadCoreModules();
        this.checkBiModuleReady();
        this.resetUltraState();
        this.refreshStateDomains();
        this.render();
        this.bindEvents();
        this.registerAiAdapters();
        AppFramework.setModuleInstance('yunying', this);
    },

    async loadCoreModules() {
        await Promise.all([
            ...this.getStyleScriptList().map(item => this._loadScript(item.src, item.onload)),
            this.loadAiCoreModules()
        ]);
        Object.assign(this, window.YejiBiAiYewu || {});
    },

    getStyleScriptList() {
        const base = 'gongn/yunying/';
        return [
            { src: base + 'ys/kapian.js', onload: () => window.KapianYejiYangshi?.inject?.() },
            { src: base + 'ys/biaoge.js', onload: () => window.BiaogeYangshi?.inject?.() },
            { src: base + 'ys/ultra.js', onload: () => window.YejiUltraYangshi?.inject?.() }
        ];
    },

    _loadScript(src, onload) {
        return new Promise((resolve, reject) => {
            const finish = () => {
                try {
                    onload?.();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };

            const fail = () => reject(new Error(`脚本加载失败：${src}`));

        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (existing.dataset.loading === '1' && existing.dataset.loaded !== '1') {
                existing.addEventListener('load', finish, { once: true });
                existing.addEventListener('error', fail, { once: true });
            } else {
                finish();
            }
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.dataset.loading = '1';
        script.onload = () => {
            script.dataset.loaded = '1';
            delete script.dataset.loading;
            finish();
        };
        script.onerror = fail;
        document.head.appendChild(script);
        });
    },

    async loadAiCoreModules() {
        const base = 'gongn/yunying/zx/ai/';
        if (!window.YejiAiApp?.ensureCore?.()) {
            await this.loadScriptList([
                base + 'gz.js',
                base + 'yw.js',
                base + 'app.js'
            ]);
        }
        await this.loadScriptList(this.getBiAiScriptList(base));
    },

    getBiAiScriptList(base = 'gongn/yunying/zx/ai/') {
        const trendBase = 'gongn/yunying/zx/plcx/qs/ai/';
        const batchBase = 'gongn/yunying/zx/plcx/ai/';
        const mainBase = base + 'main/';
        const unifiedBase = base + 'ty/';
        return [
            base + 'skill.js',
            trendBase + 'gz.js',
            trendBase + 'gj/gz.js',
            trendBase + 'gj/cx.js',
            trendBase + 'gj/app.js',
            batchBase + 'gz.js',
            batchBase + 'gj/gz.js',
            batchBase + 'gj/cx.js',
            batchBase + 'gj/app.js',
            mainBase + 'gz.js',
            mainBase + 'gj/gz.js',
            mainBase + 'gj/cx.js',
            mainBase + 'gj/app.js',
            unifiedBase + 'gz.js',
            unifiedBase + 'yw.js',
            unifiedBase + 'app.js'
        ];
    },

    async loadScriptList(scripts = []) {
        for (const src of scripts) {
            await this._loadScript(src);
        }
    },

    registerAiAdapters() {
        window.YejiBiAiApp?.register?.(this);
    },

    refreshStateDomains() {
        this.state.domains = this.createStateDomains();
        return this.state.domains;
    },

    getStateDomain(name) {
        const domains = this.state.domains?.[name]
            ? this.state.domains
            : this.refreshStateDomains();
        return domains?.[name] || this.state;
    },

    getConnectionState() {
        return this.getStateDomain('connection');
    },

    checkBiModuleReady() {
        const requiredGlobals = [
            'YejiConfig',
            'YejiGongju',
            'YejiCxFwGuize',
            'YejiCxFwYewu',
            'YejiCxYewu',
            'YejiJgYewu',
            'YejiPlcxYewu',
            'YejiPlcxFwYewu',
            'YejiAiApp',
            'YejiBiAiApp'
        ];
        const missing = requiredGlobals.filter(name => !window[name]);
        if (missing.length) {
            console.warn('[yeji] BI module dependencies missing:', missing.join(', '));
        }
        return {
            ready: missing.length === 0,
            missing
        };
    },

    createStateDomains() {
        return {
            connection: this.createStateDomain(['proxyReady', 'tokenValid', 'checking', 'metadataLoaded']),
            main: this.createStateDomain([
                'queryLoading', 'offset', 'totalCount', 'hasMoreData', 'summarySnapshot',
                'lastRequestSeq', 'mainSort', 'columnFields', 'dateRange'
            ]),
            filters: this.createStateDomain([
                'filtersOpen', 'filterOpen', 'filterScroll', 'filterValues', 'filterSearch',
                'batchOpen', 'excludeMode', 'selectorOptions', 'selectorLoading', 'expandedTree',
                'selectors', 'quickSearchSelectorId', 'quickSearchValue', 'filterPreloadStarted',
                'clearedTimeSelectors', 'composingFilterSearch', 'filterPreloadScheduled'
            ]),
            templates: this.createStateDomain([
                'templates', 'templatesLoaded', 'activeTemplateKey',
                'templateDrag', 'suppressTemplateClick'
            ]),
            fields: this.createStateDomain(['availableRowFields', 'availableMetricFields', 'fieldConfig', 'fieldConfigDraft']),
            batch: this.createStateDomain([
                'batchQueryOpen', 'batchQueryLoading', 'batchQueryRows', 'batchQueryRowMap',
                'batchQueryMetricFields', 'batchQueryDisplayMetricFields', 'batchQueryFieldConfig',
                'batchQueryDateValues', 'batchQueryTemplateSnapshot', 'batchQueryCache',
                'batchQueryPendingRefresh', 'batchMergedOpen', 'batchQueryTargets',
                'batchQueryActiveTargetKey', 'batchQueryTargetPickerOpen', 'batchQueryTargetsLoaded',
                'batchQueryTargetUploading', 'batchTargetFile'
            ]),
            trend: this.createStateDomain([
                'batchTrendSeq', 'batchTrendContext', 'batchTrendRows',
                'batchTrendError', 'batchTrendRenderScheduled',
                'batchTrendForecastSeq', 'batchTrendForecastChecking'
            ]),
            ai: this.createStateDomain([
                'biAiOpen', 'biAiMessages', 'biAiDraft', 'biAiLoading', 'biAiSeq',
                'biAiToolStatus', 'biAiAutoFollow', 'biAiScrollTop'
            ]),
            ui: this.createStateDomain(['isVisible'])
        };
    },

    createStateDomain(keys = []) {
        const domain = {};
        keys.forEach(key => {
            Object.defineProperty(domain, key, {
                enumerable: true,
                configurable: false,
                get: () => this.state[key],
                set: value => {
                    this.state[key] = value;
                }
            });
        });
        return domain;
    },

    resetUltraState() {
        this.state.availableRowFields = window.YejiPzGongju.orderRowFields(
            window.YejiPzGongju.cloneFields(window.YejiPzShuju?.rowFields || this.ultra.rowFields)
        );
        this.state.availableMetricFields = window.YejiPzGongju.orderMetricFields(
            window.YejiPzGongju.cloneFields(window.YejiPzShuju?.metricFields || this.ultra.metricFields)
        );
        this.state.fieldConfig = this.getDefaultFieldConfig();
        this.state.fieldConfigDraft = null;
        this.state.mainSort = { fieldKey: 'nebZXyfTkXXEVuOZOzmokaMJ', fieldName: '出库日期', order: 'desc' };
        this.state.columnFields = this.ultra.columnFields.map(field => ({ ...field }));
        this.state.dateRange = this.getDefaultDateRange();
        this.state.selectors = this.normalizeFallbackSelectors();
        this.state.filterOpen = {};
        this.state.filterSearch = {};
        this.state.batchOpen = {};
        this.state.excludeMode = {};
        this.state.selectorOptions = {};
        this.state.selectorLoading = {};
        this.state.expandedTree = {};
        this.state.quickSearchSelectorId = this.getDefaultQuickSearchSelectorId();
        this.state.quickSearchValue = '';
        this.state.templates = [];
        this.state.templatesLoaded = false;
        this.state.activeTemplateKey = '';
        this.state.batchQueryOpen = false;
        this.state.batchQueryLoading = false;
        this.state.batchQueryRows = [];
        this.state.batchQueryRowMap = null;
        this.state.batchQueryMetricFields = [];
        this.state.batchQueryDisplayMetricFields = [];
        this.state.batchQueryFieldConfig = null;
        this.state.batchQueryDateValues = null;
        this.state.batchQueryTemplateSnapshot = [];
        this.state.batchQueryCache = {};
        this.state.batchQueryPendingRefresh = false;
        this.state.batchMergedOpen = {};
        this.state.batchQueryTargets = { ranges: {} };
        this.state.batchQueryActiveTargetKey = '';
        this.state.batchQueryTargetPickerOpen = false;
        this.state.batchQueryTargetsLoaded = false;
        this.state.batchQueryTargetUploading = false;
        this.state.batchTargetFile = null;
        this.state.batchTrendSeq = 0;
        this.state.batchTrendContext = null;
        this.state.batchTrendRows = [];
        this.state.batchTrendError = '';
        this.state.batchTrendRenderScheduled = false;
        this.state.biAiOpen = false;
        this.state.biAiMessages = [];
        this.state.biAiDraft = '';
        this.state.biAiLoading = false;
        this.state.biAiSeq = 0;
        this.state.biAiToolStatus = null;
        this.state.biAiAutoFollow = true;
        this.state.biAiScrollTop = null;
        this.state.filterPreloadStarted = false;
        this.state.clearedTimeSelectors = {};
        this.state.filterValues = {
            [this.ultra.dateFilter.sourceCdId]: {
                macroName: '本月到昨天',
                range: this.state.dateRange
            }
        };
        this.state.offset = 0;
        this.state.totalCount = 0;
        this.state.hasMoreData = false;
        this.state.summarySnapshot = null;
        this.refreshStateDomains();
    },

    render() {
        if (document.getElementById('page-yeji')) return;

        const container = document.getElementById('module-container');
        container.insertAdjacentHTML('beforeend', `
            <main id="page-yeji" class="yeji-page" style="display:none;">
                <div class="yeji-scroll">
                    <div class="yeji-search-container">
                        <div class="yeji-search-box">
                            <div class="yeji-search-input-wrapper">
                                <input type="text" id="yeji-search-input" class="yeji-search-input"
                                    placeholder="${this.escapeHtml(this.getQuickSearchPlaceholder())}" autocomplete="off" />
                                <button type="button" class="yeji-search-clear" id="yeji-search-clear" style="display:none;">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                            <span class="yeji-quick-selector-wrap">
                                <select id="yeji-quick-selector" class="yeji-quick-selector" title="快捷筛选字段">
                                    ${this.renderQuickSearchOptions()}
                                </select>
                                <button type="button" id="yeji-quick-selector-btn" class="yeji-quick-selector-btn" title="快捷筛选字段">
                                    <span id="yeji-quick-selector-label">${this.escapeHtml(this.getQuickSearchSelectedLabel())}</span>
                                </button>
                                <i class="fa-solid fa-caret-down yeji-quick-selector-arrow"></i>
                                <div id="yeji-quick-selector-panel" class="yeji-quick-selector-panel" hidden></div>
                            </span>
                            <button type="button" class="yeji-filter-toggle" id="yeji-filter-toggle" title="筛选">
                                <i class="fa-solid fa-filter"></i>
                            </button>
                            <div class="yeji-tpl-wrap">
                                <button type="button" id="yeji-tpl-btn" class="yeji-tpl-btn">
                                    <i class="fa-solid fa-bookmark"></i>
                                    模板
                                    <i class="fa-solid fa-caret-down yeji-tpl-arrow" style="font-size:10px"></i>
                                </button>
                                <div id="yeji-tpl-panel" class="yeji-tpl-panel" style="display:none"></div>
                            </div>
                            <button type="button" class="yeji-search-btn" id="yeji-search-btn">
                                <i class="fa-solid fa-magnifying-glass"></i>
                            </button>
                        </div>
                    </div>

                    <section class="yeji-summary-bar">
                        <div class="yeji-summary-inner">
                            <div class="yeji-summary-cards" id="yeji-summary-cards"></div>
                        </div>
                    </section>

                        <div class="yeji-table-zone">
                            <div class="yeji-table-wrap" id="yeji-table-wrap"></div>
                    </div>
                    <div id="yeji-pager-wrap"></div>
                </div>

                <div class="yeji-batch-modal" id="yeji-batch-modal" hidden>
                    <div class="yeji-batch-modal-backdrop"></div>
                    <div class="yeji-batch-dialog" role="dialog" aria-modal="true" aria-label="BI汇总查询">
                        <div class="yeji-batch-header">
                            <div class="yeji-batch-title">
                                <span>BI查询</span>
                                <small id="yeji-batch-title-meta"></small>
                            </div>
                            <div class="yeji-modal-actions-wrap">
                                ${window.YejiHudongModule?.renderActions('batch') || ''}
                                <button type="button" class="yeji-batch-close" id="yeji-batch-close" title="关闭">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        </div>
                        <div class="yeji-batch-body" id="yeji-batch-body"></div>
                    </div>
                </div>

                <div class="yeji-filter-modal" id="yeji-filter-modal" hidden>
                    <div class="yeji-filter-modal-backdrop"></div>
                    <div class="yeji-filter-dialog" role="dialog" aria-modal="true" aria-label="筛选条件">
                        <div class="yeji-filter-dialog-header">
                            <div class="yeji-filter-dialog-title">筛选条件</div>
                            <button type="button" class="yeji-filter-dialog-close" data-close-filter-modal title="关闭">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div class="yeji-filter-dialog-body" id="yeji-filter-dialog-body"></div>
                        <div class="yeji-filter-dialog-footer">
                            <button type="button" class="yeji-filter-mini" id="yeji-filter-reset">清空</button>
                            <div class="yeji-filter-dialog-actions">
                                <button type="button" class="yeji-filter-mini" id="yeji-template-add">添加模板</button>
                                <button type="button" class="yeji-filter-mini primary" id="yeji-filter-apply">确认查询</button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        `);

        this.injectLayoutFixStyles();
        this.updateQuickSearchControl();
        this.renderFilters();
        this.renderSummaryState('正在查询中......');
        this.clearTable('正在查询中......');
        this.updateDateText();
        this.renderBiAiSurface?.();
    },

    injectLayoutFixStyles() {
        if (window.YejiUltraYangshi?.inject) {
            window.YejiUltraYangshi.inject();
            return;
        }
        this._loadScript('gongn/yunying/ys/ultra.js', () => window.YejiUltraYangshi?.inject?.());
    },

    bindEvents() {
        document.getElementById('yeji-filter-toggle')?.addEventListener('click', () => {
            this.openFilterModal();
        });

        document.querySelector('.yeji-summary-inner')?.addEventListener('wheel', event => {
            const wrap = event.currentTarget;
            if (!wrap || wrap.scrollWidth <= wrap.clientWidth) return;
            event.preventDefault();
            wrap.scrollLeft += event.deltaY || event.deltaX;
        }, { passive: false });

        document.getElementById('yeji-table-wrap')?.addEventListener('click', event => {
            const button = event.target.closest('[data-main-sort-field]');
            if (!button) return;
            this.handleMainSortClick(button);
        });

        document.getElementById('yeji-batch-close')?.addEventListener('click', () => {
            this.closeBatchQueryModal();
        });
        window.YejiHudongModule?.bind(document.getElementById('yeji-batch-modal'), {
            dialogSelector: '.yeji-batch-dialog'
        });

        document.getElementById('yeji-tpl-btn')?.addEventListener('click', event => {
            event.stopPropagation();
            if (event.target.closest('[data-template-clear-active]')) {
                this.clearActiveTemplateAndQueryDefault();
                return;
            }
            this.toggleTemplatePanel();
        });

        document.getElementById('yeji-search-btn')?.addEventListener('click', () => {
            this.state.quickSearchValue = document.getElementById('yeji-search-input')?.value || '';
            this.runDefaultQuery({ resetOffset: true, requireConnection: true });
        });

        document.getElementById('yeji-quick-selector')?.addEventListener('change', (event) => {
            this.chooseQuickSearchSelector(event.target.value);
        });

        document.getElementById('yeji-quick-selector-btn')?.addEventListener('click', event => {
            event.stopPropagation();
            this.toggleQuickSearchDropdown();
        });

        document.getElementById('yeji-search-input')?.addEventListener('input', (event) => {
            this.clearActiveTemplate();
            this.state.quickSearchValue = event.target.value;
            const clear = document.getElementById('yeji-search-clear');
            if (clear) clear.style.display = this.getQuickSearchText() ? 'flex' : 'none';
            this.renderFilters();
        });

        document.getElementById('yeji-search-input')?.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            this.state.quickSearchValue = event.target.value || '';
            this.runDefaultQuery({ resetOffset: true, requireConnection: true });
        });

        document.getElementById('yeji-search-clear')?.addEventListener('click', () => {
            this.clearActiveTemplate();
            const input = document.getElementById('yeji-search-input');
            if (input) input.value = '';
            this.state.quickSearchValue = '';
            const clear = document.getElementById('yeji-search-clear');
            if (clear) clear.style.display = 'none';
            this.renderFilters();
        });

        document.querySelectorAll('[data-close-filter-modal]').forEach(el => {
            el.addEventListener('click', () => this.closeFilterModal());
        });

        document.getElementById('yeji-filter-reset')?.addEventListener('click', () => {
            this.clearActiveTemplate();
            this.resetFilterValues();
        });

        document.getElementById('yeji-template-add')?.addEventListener('click', () => {
            this.showTemplateNameDialog();
        });

        document.getElementById('yeji-filter-apply')?.addEventListener('click', () => {
            this.closeFilterModal();
            this.runDefaultQuery({ resetOffset: true, requireConnection: true });
        });

        if (!this._biLoginBound) {
            this._biLoginBound = true;
            document.addEventListener('loginSuccess', async (event) => {
                if (event.detail?.system === 'BI' && this.state.isVisible) {
                    this._showToast('BI 登录成功。', 'success');
                    await this.ensureBiConnection({ showToast: false });
                }
            });
        }

        if (!this._filterDocBound) {
            this._filterDocBound = true;
            document.addEventListener('click', (event) => {
                const templatePanel = document.getElementById('yeji-tpl-panel');
                if (templatePanel && templatePanel.style.display !== 'none' && !event.target.closest('.yeji-tpl-wrap')) {
                    templatePanel.style.display = 'none';
                }
                if (!event.target.closest('.yeji-quick-selector-wrap')) {
                    this.closeQuickSearchDropdown();
                }
                if (
                    event.target.closest('[data-filter-popover]') ||
                    event.target.closest('[data-filter-toggle]') ||
                    event.target.closest('#yeji-filter-toggle')
                ) return;
                if (!Object.values(this.state.filterOpen).some(Boolean)) return;
                this.state.filterOpen = {};
                this.renderFilters();
            });
        }
    },

    bindPagerEvents() {
        document.getElementById('yeji-prev')?.addEventListener('click', () => {
            if (this.state.offset <= 0) return;
            this.state.offset = Math.max(0, this.state.offset - this.ultra.limit);
            this.runDefaultQuery({ resetOffset: false, requireConnection: true });
        });
        document.getElementById('yeji-next')?.addEventListener('click', () => {
            if (!this.state.hasMoreData) return;
            this.state.offset += this.ultra.limit;
            this.runDefaultQuery({ resetOffset: false, requireConnection: true });
        });
        document.querySelectorAll('#yeji-pager-wrap [data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = Number(btn.dataset.page);
                if (!page || page < 1) return;
                this.state.offset = (page - 1) * this.ultra.limit;
                this.runDefaultQuery({ resetOffset: false, requireConnection: true });
            });
        });
        document.getElementById('yeji-jump')?.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            const page = Number(event.target.value);
            const totalPages = Math.max(1, Math.ceil(this.state.totalCount / this.ultra.limit));
            if (!page || page < 1 || page > totalPages) return;
            this.state.offset = (page - 1) * this.ultra.limit;
            this.runDefaultQuery({ resetOffset: false, requireConnection: true });
        });
    },

    setConnectionState({ proxyReady, tokenValid }) {
        const connectionState = this.getConnectionState();
        if (typeof proxyReady === 'boolean') connectionState.proxyReady = proxyReady;
        if (typeof tokenValid === 'boolean') connectionState.tokenValid = tokenValid;
        const proxyConnected = connectionState.proxyReady;
        const queryReady = connectionState.proxyReady && connectionState.tokenValid;

        document.querySelectorAll('.yeji-conn-dot').forEach(dot => {
            dot.classList.toggle('connected', proxyConnected);
            dot.classList.toggle('disconnected', !proxyConnected);
        });

        if (queryReady && this.state.batchQueryOpen && this.state.batchQueryPendingRefresh && !this.state.batchQueryLoading) {
            this.state.batchQueryPendingRefresh = false;
            setTimeout(() => this.runBatchTemplateQuery({ forceRefresh: true }), 0);
        }
    },

    updateProxyStatus() {
        const connectionState = this.getConnectionState();
        this.setConnectionState({
            proxyReady: !!localStorage.getItem('bi_proxy_url'),
            tokenValid: connectionState.tokenValid
        });
    },

    setQueryBusy(isBusy) {
        const btn = document.getElementById('yeji-search-btn');
        if (btn) {
            btn.disabled = isBusy;
            btn.innerHTML = isBusy
                ? '<i class="fa-solid fa-spinner fa-spin"></i>'
                : '<i class="fa-solid fa-magnifying-glass"></i>';
        }
    },

    updateDateText() {
        // 日期范围继续作为默认查询条件使用，界面不再单独展示提示行。
    },

    async show() {
        const page = document.getElementById('page-yeji');
        if (!page) return;
        page.style.display = 'flex';
        this.state.isVisible = true;
        this.renderBiAiSurface?.();
        const connectionState = this.getConnectionState();
        if (!connectionState.proxyReady || !connectionState.tokenValid || !this.hasVisibleTableData?.()) {
            this.ensureBiConnection();
        }
    },

    hide() {
        const page = document.getElementById('page-yeji');
        if (page) page.style.display = 'none';
        this.state.isVisible = false;
        document.querySelectorAll('[data-bi-ai-root]').forEach(node => node.remove());
    }
};

AppFramework.register({
    id: 'yunying',
    name: 'BI运营查询',
    icon: 'fa-solid fa-chart-line',
    path: 'gongn/yunying',
    order: 3
});

YejiModule.init();
window.YejiModule = YejiModule;



