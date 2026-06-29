// BI main page AI private query service: delegates to the main query service shell.
const YejiMainAiGjChaxun = {
    async queryPage(app, params = {}) {
        if (!await app?.ensureBiReadyForTool?.()) {
            throw new Error('BI代理或登录态不可用，无法执行主查询工具。');
        }

        const queries = window.YejiAiApp.normalizeQueryBatch(params);
        if (queries.length > 1) {
            const results = await window.YejiAiApp.runConcurrentQueries(queries, item => this.querySinglePage(app, item));
            return {
                success: true,
                queryCount: results.length,
                results
            };
        }
        return this.querySinglePage(app, queries[0] || {});
    },

    async querySinglePage(app, params = {}) {
        const result = await app.runMainQueryService(params, {
            inheritCurrent: params.inheritCurrent === true
        });
        return this.buildToolResult(result);
    },

    buildToolResult(result = {}) {
        if (!result.success) {
            return {
                success: false,
                error: result.error || '主查询失败。'
            };
        }
        return {
            success: true,
            page: result.page,
            pageSize: result.pageSize,
            sort: result.sort,
            template: result.template,
            totalCount: result.totalCount,
            hasMoreData: result.hasMoreData,
            summary: result.summary,
            rows: result.tableRows || []
        };
    }
};

window.YejiMainAiGjChaxun = YejiMainAiGjChaxun;
