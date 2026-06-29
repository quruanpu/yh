// BI batch query AI private query service: read-only parameterized panel shell.
const YejiPlcxAiGjChaxun = {
    async queryPanel(app, params = {}) {
        if (!await app?.ensureBiReadyForTool?.()) {
            throw new Error('BI代理或登录态不可用，无法执行 BI 查询工具。');
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
        const result = await app.runBatchQueryService(params, {
            inheritFilters: true,
            forceTemplates: true
        });
        const dateInfo = app.getBatchTargetInfoFromDateValues(result.input?.dateValues || {});
        const rowStatus = this.buildRowStatus(result.rows);
        return {
            success: rowStatus.failed < rowStatus.total,
            queryTime: dateInfo ? {
                startDate: dateInfo.startDate,
                endDate: dateInfo.endDate,
                dateField: dateInfo.sourceName
            } : null,
            rowStatus,
            lockedContext: this.buildLockedContext(app, result),
            snapshot: result.snapshot
        };
    },

    buildLockedContext(app, result = {}) {
        const input = result.input || {};
        return {
            fieldNames: (input.displayMetricFields || []).map(field => app.getMetricFieldDisplayName(field)),
            templateNames: (input.templates || []).map(tpl => tpl.name || '未命名模板'),
            templateKeys: (input.templates || []).map(tpl => tpl._key || ''),
            targetKey: input.targetRange?.key || '',
            includeChildren: input.includeChildren !== false
        };
    },

    buildRowStatus(rows = []) {
        const total = (rows || []).length;
        const failed = (rows || []).filter(row => row.error).length;
        return {
            total,
            success: Math.max(0, total - failed),
            failed
        };
    }
};

window.YejiPlcxAiGjChaxun = YejiPlcxAiGjChaxun;
