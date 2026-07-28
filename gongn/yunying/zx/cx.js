// BI operation query protocol business.
const YejiCxYewu = {
async ensureBiConnection(options = {}) {
    if (this._biConnectionPromise && !options.forceRediscover) return this._biConnectionPromise;
    const promise = this.runBiConnectionCheck(options);
    this._biConnectionPromise = promise;
    try {
        return await promise;
    } finally {
        if (this._biConnectionPromise === promise) this._biConnectionPromise = null;
    }
},

async runBiConnectionCheck(options = {}) {
    const hasCurrentData = this.hasVisibleTableData?.() || false;
    this.state.checking = true;
    if (!hasCurrentData) {
        this.renderSummaryState('正在查询中......');
        this.clearTable('正在查询中......');
    }

    try {
        if (!window.YejiGongju) {
            this.showQueryStateMessage('代理工具未加载。', { hasCurrentData });
            return;
        }

        YejiGongju._onProxyDown = () => {
            this.setConnectionState({ proxyReady: false, tokenValid: false });
            this.showQueryStateMessage('BI代理已断开。', { hasCurrentData: this.hasVisibleTableData?.() || false });
        };
        YejiGongju._on401 = () => {
            this.setConnectionState({ proxyReady: true, tokenValid: false });
            this.showQueryStateMessage('BI登录已过期，请重新登录。', { hasCurrentData: this.hasVisibleTableData?.() || false });
            if (window.LoginModule) LoginModule.open('bi');
        };

        let proxyUrl = await YejiGongju.ensureProxy();

        if (!proxyUrl) {
            this.setConnectionState({ proxyReady: false, tokenValid: false });
            this.showQueryStateMessage('固定 BI 代理不可用。', { hasCurrentData });
            if (options.showToast) this._showToast('固定 BI 代理不可用。', 'error');
            return;
        }

        const status = await YejiGongju.checkProxy(proxyUrl);
        if (!status || status.code !== 0) {
            const reason = status
                ? (status.message || status.msg || status.error || `状态码 ${status.code ?? '异常'}`)
                : '状态接口无响应';
            proxyUrl = await YejiGongju.ensureProxy(3000);
            if (!proxyUrl) {
                this.setConnectionState({ proxyReady: false, tokenValid: false });
                this.showQueryStateMessage(`BI代理不可用：${reason}`, { hasCurrentData });
                if (options.showToast) this._showToast(`BI代理不可用：${reason}`, 'error');
                return;
            }
        }

        this.setConnectionState({ proxyReady: true, tokenValid: false });

        let tokenValid = false;
        const loginResult = await window.LoginModule?.requireCredentials?.('bi', { silent: true });
        if (loginResult?.ok) {
            tokenValid = await YejiGongju.isTokenValid();
        }
        this.setConnectionState({ proxyReady: true, tokenValid });

        if (tokenValid && this.state.isVisible) {
            await this.runDefaultQuery({ resetOffset: true, requireConnection: false });
        } else if (!tokenValid) {
            this.showQueryStateMessage('BI代理已连接，请先完成BI登录。', { hasCurrentData });
        }
    } catch (error) {
        console.error('[yeji] BI连接检测失败', error);
        this.setConnectionState({ proxyReady: false, tokenValid: false });
        this.showQueryStateMessage(`BI连接检测失败：${error.message || '未知错误'}`, { hasCurrentData });
        if (options.showToast) this._showToast('BI 连接检测失败。', 'error');
    } finally {
        this.state.checking = false;
    }
},

showQueryStateMessage(message, options = {}) {
    if (options.hasCurrentData) {
        if (message) this._showToast(message, options.type || 'error');
        return;
    }
    this.renderSummaryState('');
    this.clearTable(message);
},

async tryRecoverBiLoginSilently() {
    try {
        const result = await window.LoginModule?.requireCredentials?.('bi', { silent: true });
        if (!result?.ok) return false;
        const tokenValid = await YejiGongju.isTokenValid();
        this.setConnectionState({ proxyReady: !!(await YejiGongju.ensureProxy?.(3000)), tokenValid });
        return tokenValid;
    } catch (error) {
        console.warn('[yeji] BI登录态自动恢复失败', error);
        return false;
    }
},

async ensureBiReadyForTool(options = {}) {
    if (this.state.proxyReady && this.state.tokenValid) return true;
    await this.ensureBiConnection({ showToast: !!options.showToast });
    if (this.state.proxyReady && this.state.tokenValid) return true;
    return this.tryRecoverBiLoginSilently();
},

async runDefaultQuery({ resetOffset = false, requireConnection = true } = {}) {
    if (this.state.queryLoading) {
        this._pendingDefaultQuery = { resetOffset, requireConnection };
        return;
    }
    if (requireConnection && (!this.state.proxyReady || !this.state.tokenValid)) {
        await this.ensureBiConnection({ showToast: true });
        if (!this.state.proxyReady || !this.state.tokenValid) return;
    }

    if (resetOffset) this.state.offset = 0;
    const hasCurrentData = this.hasVisibleTableData();
    this.state.queryLoading = true;
    const seq = ++this.state.lastRequestSeq;
    this.setQueryBusy(true);
    if (!hasCurrentData) {
        this.renderSummaryState('正在查询中......');
        this.clearTable('正在查询中......');
    }

    try {
        const result = await this.runMainQueryService({
            page: Math.floor(this.state.offset / this.ultra.limit) + 1,
            pageSize: this.ultra.limit,
            inheritCurrent: true
        }, {
            inheritCurrent: true
        });

        if (seq !== this.state.lastRequestSeq) return;
        if (!result?.success) throw new Error(result?.error || '观远 BI 未返回有效数据。');
        if (this._pendingDefaultQuery) return;

        this.applyMainQueryServiceResult(result);
        this.renderUltraResult(result.raw, { preserveSummary: hasCurrentData });
    } catch (error) {
        console.error('[yeji] 出库统计Ultra查询失败', error);
        if (hasCurrentData) {
            this._showToast(`查询失败：${error.message || '未知错误'}`, 'error');
        } else {
            this.renderSummaryState('');
            this.clearTable(`查询失败：${error.message || '未知错误'}`);
        }
    } finally {
        if (seq === this.state.lastRequestSeq) {
            this.state.queryLoading = false;
            this.setQueryBusy(false);
            const pending = this._pendingDefaultQuery;
            this._pendingDefaultQuery = null;
            if (pending) setTimeout(() => this.runDefaultQuery(pending), 0);
        }
    }
},

async loadUltraMetadata() {
    if (this.state.metadataLoaded) return;
    if (this._metadataPromise) return this._metadataPromise;

    this._metadataPromise = this.fetchUltraMetadata();
    try {
        return await this._metadataPromise;
    } finally {
        this._metadataPromise = null;
    }
},

async fetchUltraMetadata() {
    try {
        const data = await this.biGet(`/api/page/${this.ultra.pageId}`);
        const page = data?.response;
        const chart = page?.cards?.find(card =>
            card.cdType === 'CHART' && card.content?.chartType === 'PIVOT_TABLE' && card.cdId === this.ultra.cardId
        ) || page?.cards?.find(card => card.cdType === 'CHART' && card.content?.chartType === 'PIVOT_TABLE');
        const zoneData = chart?.content?.meta?.chartMain?.zoneData;
        if (!zoneData) throw new Error('页面元数据缺少 zoneData。');

        this.setAvailableFields(zoneData.row || this.ultra.rowFields, zoneData.metric || this.ultra.metricFields);
        this.state.columnFields = (zoneData.column?.length ? zoneData.column : this.ultra.columnFields).map(field => ({ ...field }));
        const selectors = this.normalizeSelectorsFromPage(page);
        if (selectors.length) {
            this.state.selectors = selectors;
            this.ensureDefaultDateFilter();
            if (!this.state.quickSearchSelectorId) this.state.quickSearchSelectorId = this.getDefaultQuickSearchSelectorId();
            this.renderQuickSearchSelectOptions();
            this.updateQuickSearchControl();
            if (this.state.filtersOpen) this.renderFilters();
            this.scheduleVisibleFilterOptionsPreload?.();
        }
        this.state.metadataLoaded = true;
    } catch (error) {
        console.warn('[yeji] 出库统计Ultra元数据读取失败，使用内置字段快照', error);
        this.state.metadataLoaded = true;
        this.scheduleVisibleFilterOptionsPreload?.();
    }
},

normalizeFallbackSelectors() {
    return this.ultra.selectors.map(selector => ({
        ...selector,
        content: selector.content || {},
        settings: selector.settings || {},
        fields: (selector.fields || []).map(field => ({ ...field })),
        targetField: selector.fields?.[0] ? { ...selector.fields[0] } : null
    }));
},

normalizeSelectorsFromPage(page) {
    const cards = page?.cards || [];
    return cards
        .filter(card => this.isSelectorCard(card))
        .map(card => this.normalizeSelector(card))
        .filter(selector => selector.selectorType && selector.selectorType !== 'ZONE_ELEMENT');
},

isSelectorCard(card) {
    const type = card.content?.selectorType;
    return card.cdType === 'SELECTOR' || card.cdType === 'TREE_SELECTOR' || !!type;
},

normalizeSelector(card) {
    const content = card.content || {};
    const selectorType = content.selectorType || (card.cdType === 'TREE_SELECTOR' ? 'TREE' : '');
    const source = content.source || {};
    let fields = [];
    if (source.field) fields = [source.field];
    if (source.fieldSeq) fields = source.fieldSeq;

    return {
        cdId: card.cdId,
        name: card.name,
        cdType: card.cdType,
        content,
        settings: card.settings || {},
        selectorType,
        multiSelect: content.multiSelect,
        filterType: content.filterType || (selectorType === 'TIME_MACRO' ? 'BT' : 'IN'),
        fields,
        targetField: this.findTargetField(card, this.ultra.cardId) || fields[0] || null
    };
},

findTargetField(selector, targetCardId) {
    const mappings = selector.settings?.asFilter?.columnMappings || [];
    for (const mapping of mappings) {
        for (const target of mapping.targetFields || []) {
            if (target.cdId === targetCardId) return { ...target };
        }
    }
    return null;
},

resolveFilterField(selector, targetCardId) {
    return this.findTargetField(selector, targetCardId) || selector.targetField || selector.fields?.[0] || null;
},

resolveTreeFieldSeq(selector, targetCardId) {
    const sourceFields = selector.fields || [];
    const mappings = selector.settings?.asFilter?.columnMappings || [];
    if (!mappings.length) return sourceFields;

    const mappedFields = sourceFields.map(sourceField => {
        const mapping = mappings.find(item => this.isSameBiField(item.sourceField, sourceField));
        const target = mapping?.targetFields?.find(field => field.cdId === targetCardId);
        return target ? this.mergeBiField(sourceField, target) : sourceField;
    });
    if (mappedFields.some((field, index) => field?.fdId !== sourceFields[index]?.fdId)) return mappedFields;

    const targetFields = mappings
        .map(mapping => {
            const target = mapping.targetFields?.find(field => field.cdId === targetCardId);
            return target ? this.mergeBiField(mapping.sourceField, target) : null;
        })
        .filter(Boolean);
    return targetFields.length ? targetFields : sourceFields;
},

isSameBiField(left, right) {
    if (!left || !right) return false;
    if (left.fdId && right.fdId) return left.fdId === right.fdId;
    return left.name && right.name && left.name === right.name;
},

mergeBiField(sourceField = {}, targetField = {}) {
    const merged = {
        ...sourceField,
        ...targetField,
        fdType: targetField.fdType || sourceField.fdType || 'STRING',
        metaType: targetField.metaType || sourceField.metaType || 'DIM',
        dsId: targetField.dsId || sourceField.dsId || this.ultra.dsId
    };
    delete merged.cdId;
    return merged;
},

ensureDefaultDateFilter() {
    const dateSelector = this.state.selectors.find(selector => selector.cdId === this.ultra.dateFilter.sourceCdId);
    if (!dateSelector) return;
    if (this.state.clearedTimeSelectors[dateSelector.cdId]) return;
    if (this.state.filterValues[dateSelector.cdId]?.range?.length === 2) return;
    this.state.filterValues[dateSelector.cdId] = {
        macroName: '本月到昨天',
        range: this.getDefaultDateRange()
    };
    this.state.dateRange = this.state.filterValues[dateSelector.cdId].range;
},

buildFilters(targetCardId, options = {}) {
    const context = options.context || this.state;
    const filters = [];
    for (const selector of this.state.selectors) {
        if (!['DS_ELEMENTS', 'TIME_MACRO'].includes(selector.selectorType)) continue;

        const quickValue = this.isQuickSearchSelectorFor(selector, context) ? this.getQuickSearchTextFor(context) : '';
        const value = context.filterValues?.[selector.cdId] || {};
        if (!quickValue && !Object.keys(value).length) continue;

        if (selector.selectorType === 'TIME_MACRO') {
            const range = quickValue ? [quickValue, quickValue] : (value.range || []).filter(Boolean);
            if (range.length !== 2) continue;
            const field = this.resolveFilterField(selector, targetCardId);
            if (!field) continue;
            filters.push({
                name: field.name,
                fdId: field.fdId,
                dsId: this.ultra.dsId,
                cdId: targetCardId,
                fdType: field.fdType || 'DATE',
                filterType: 'BT',
                sourceCdId: selector.cdId,
                filterValue: range,
                ...(!quickValue && value.macroName ? { macroName: value.macroName } : {}),
                displayValue: !quickValue && value.macroName ? [] : range
            });
            continue;
        }

        const selected = (quickValue ? [quickValue] : [
            ...(value.selected || []),
            ...this.splitValues(value.manual || '')
        ]).filter(item => item !== '');
        if (!selected.length) continue;
        const field = this.resolveFilterField(selector, targetCardId);
        if (!field) continue;
        filters.push({
            name: field.name,
            fdId: field.fdId,
            dsId: this.ultra.dsId,
            cdId: targetCardId,
            fdType: field.fdType || selector.fields?.[0]?.fdType || 'STRING',
            filterType: context.excludeMode?.[selector.cdId] ? 'NOT_IN' : (selector.filterType || 'IN'),
            sourceCdId: selector.cdId,
            filterValue: selected,
            displayValue: selected
        });
    }
    return filters;
},

buildTreeFilters(targetCardId, options = {}) {
    const context = options.context || this.state;
    const filters = [];
    for (const selector of this.state.selectors) {
        if (selector.selectorType !== 'TREE') continue;
        const current = context.filterValues?.[selector.cdId] || {};
        const quickValue = this.isQuickSearchSelectorFor(selector, context) ? this.getQuickSearchTextFor(context) : '';
        const manualPaths = this.splitValues(current.manual || '').map(value => this.splitTreePath(value));
        const paths = (quickValue ? [this.splitTreePath(quickValue)] : [
            ...(current.treePaths || []),
            ...manualPaths
        ]).filter(path => path.length);
        if (!paths.length) continue;
        filters.push({
            name: selector.name,
            dsId: this.ultra.dsId,
            cdId: targetCardId,
            sourceCdId: selector.cdId,
            filterType: context.excludeMode?.[selector.cdId] ? 'NOT_IN' : (selector.filterType || 'IN'),
            withPath: selector.content?.withPath !== false,
            fieldSeq: this.resolveTreeFieldSeq(selector, targetCardId),
            filterValue: paths,
            displayValue: paths
        });
    }
    return filters;
},

buildUltraRequestBody(options = {}) {
    const context = options.context || this.state;
    const queryPlan = context.queryPlan || null;
    const rowFields = queryPlan && Array.isArray(queryPlan.rowFields)
        ? queryPlan.rowFields
        : this.getQueryRowFields(context);
    const metricFields = queryPlan && Array.isArray(queryPlan.metricFields)
        ? queryPlan.metricFields
        : this.getQueryMetricFields(context);
    const headerSortings = this.buildHeaderSortings(context, rowFields, metricFields);
    return {
        offset: options.offset ?? this.state.offset,
        limit: options.limit ?? this.ultra.limit,
        filters: this.buildFilters(this.ultra.cardId, { context }),
        treeFilters: this.buildTreeFilters(this.ultra.cardId, { context }),
        dynamicParams: [],
        dynamicFieldFilters: [],
        combinationFilters: [],
        layerTreeFilters: [],
        headerSortings: headerSortings.length ? headerSortings : null,
        rowExpand: null,
        sorting: [],
        name: this.ultra.cardName,
        zoneFilter: {
            zoneData: {
                row: rowFields,
                column: this.state.columnFields,
                metric: metricFields,
                sorting: []
            }
        },
        taskRequestId: this.makeTaskId()
    };
},

buildHeaderSortings(context = this.state, rowFields = [], metricFields = []) {
    const sort = this.normalizeMainSort(context?.mainSort);
    if (!sort) return [];

    const rowIndex = rowFields.findIndex(field => this.isSameSortField(field, sort));
    if (rowIndex >= 0) {
        return [{
            order: sort.order,
            zoneId: 'row',
            index: rowIndex,
            sortField: `c${rowIndex}`
        }];
    }

    const metricIndex = metricFields.findIndex(field => this.isSameSortField(field, sort));
    if (metricIndex < 0) return [];
    const index = rowFields.length + metricIndex;
    return [{
        order: sort.order,
        zoneId: 'column',
        index,
        sortField: `c${index}`,
        mIndex: metricIndex
    }];
},

normalizeMainSort(sort = null) {
    if (!sort || typeof sort !== 'object') return null;
    const order = sort.order === 'asc' ? 'asc' : sort.order === 'desc' ? 'desc' : '';
    const fieldKey = String(sort.fieldKey || sort.key || '').trim();
    const fieldName = String(sort.fieldName || sort.name || '').trim();
    if (!order || (!fieldKey && !fieldName)) return null;
    return { fieldKey, fieldName, order };
},

isSameSortField(field = {}, sort = {}) {
    const fieldKey = String(field.key || '').trim();
    if (sort.fieldKey && fieldKey && sort.fieldKey === fieldKey) return true;
    const names = [
        field.name,
        field.alias,
        field.title,
        field.originTitle,
        this.getRowFieldDisplayName?.(field),
        this.getMetricFieldDisplayName?.(field)
    ].map(value => String(value || '').trim()).filter(Boolean);
    return !!sort.fieldName && names.includes(sort.fieldName);
},

setMainSort(sort = null) {
    this.state.mainSort = this.normalizeMainSort(sort);
},

resolveMainSortFromButton(button) {
    if (!button) return null;
    const current = this.normalizeMainSort(this.state.mainSort);
    const fieldKey = String(button.dataset.mainSortField || '').trim();
    const fieldName = String(button.dataset.mainSortName || '').trim();
    const sameField = current && (
        (fieldKey && current.fieldKey === fieldKey) ||
        (!fieldKey && fieldName && current.fieldName === fieldName)
    );
    const order = sameField && current.order === 'desc' ? 'asc' : 'desc';
    return { fieldKey, fieldName, order };
},

handleMainSortClick(button) {
    const sort = this.resolveMainSortFromButton(button);
    if (!sort) return;
    this.setMainSort(sort);
    this.state.offset = 0;
    this.runDefaultQuery({ resetOffset: false, requireConnection: true });
},

async biGet(path) {
    const proxyUrl = window.YejiGongju?.getProxyUrl?.() || '';
    if (!proxyUrl) throw new Error('未找到 BI 代理地址。');

    const headers = {
        Accept: 'application/json',
        ...(window.YejiConfig?.headers || {})
    };
    const bi = this.getBiLogin();
    if (bi?.token) headers['X-BI-Token'] = bi.tokenSig ? `${bi.token}|${bi.tokenSig}` : bi.token;

    const resp = await window.YejiGongju._fetchProxy(proxyUrl, path, {
        method: 'GET',
        headers,
        credentials: 'include'
    });
    if (resp.status === 401) {
        window.YejiGongju?._on401?.();
        throw new Error('BI 登录已过期。');
    }
    if (!resp.ok) throw new Error(`GET ${path} 返回 ${resp.status}`);
    return resp.json();
},

getBiLogin() {
    return window.LoginModule?.getLocalLogin?.('bi') || {};
},

makeTaskId() {
    return Math.random().toString(36).slice(2, 14) + Date.now().toString(36).slice(-6);
},
};

window.YejiCxYewu = YejiCxYewu;

