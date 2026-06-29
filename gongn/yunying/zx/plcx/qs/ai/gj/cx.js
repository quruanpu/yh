// Trend AI private tool query service: read-only parameterized trend panel shell.
const YejiPlcxQsAiGjChaxun = {
    async queryPanel(app, params = {}) {
        if (!await app?.ensureBiReadyForTool?.()) {
            throw new Error('BI代理或登录态不可用，无法执行指标详解工具。');
        }
        const queries = window.YejiAiApp.normalizeQueryBatch(params);
        if (queries.length > 1) {
            const results = await window.YejiAiApp.runConcurrentQueries(queries, item => this.querySingle(app, item));
            return {
                success: true,
                queryCount: results.length,
                results
            };
        }
        return this.querySingle(app, queries[0] || {});
    },

    async querySingle(app, params = {}) {
        const result = await app.runTrendQueryService(params, {
            inheritFilters: true,
            forceTemplates: true
        });
        return {
            success: true,
            queryTime: {
                startDate: result.context?.dateInfo?.range?.[0] || '',
                endDate: result.context?.dateInfo?.range?.[1] || '',
                dateField: result.context?.dateInfo?.name || ''
            },
            lockedContext: this.buildLockedContext(result.context),
            snapshot: result.snapshot
        };
    },

    buildLockedContext(context = {}) {
        return {
            modelType: context.trendModel === 'rate' ? 'rate' : 'value',
            projectName: context.rowName || '',
            metricName: context.metricName || '',
            dateField: context.dateInfo?.name || '',
            targetKey: context.targetRangeKey || '',
            templateNames: (context.templates || []).map(tpl => tpl.name || '未命名模板'),
            templateKeys: (context.templates || []).map(tpl => tpl._key || ''),
            rateDependency: context.trendModel === 'rate' ? {
                dependencyField: context.rateMeta?.numeratorName || '',
                businessBaseField: context.rateMeta?.denominatorName || ''
            } : null
        };
    }
};

window.YejiPlcxQsAiGjChaxun = YejiPlcxQsAiGjChaxun;
