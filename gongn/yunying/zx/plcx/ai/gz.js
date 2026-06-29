// BI batch query AI rules: snapshot and prompt helpers for the query panel.
const YejiPlcxAiGuize = {
    panelId: 'batch-query',

    buildSnapshot(app = window.YejiModule, options = {}) {
        const metricFields = app?.getBatchDisplayMetricFields?.() || app?.getBatchQueryMetricFields?.() || [];
        const rawRows = app?.state?.batchQueryRows || [];
        const rows = this.buildRows(app, rawRows, metricFields, options);
        return {
            panelId: this.panelId,
            scope: 'bi-batch',
            title: 'BI查询',
            dateText: app?.getBatchQueryDateText?.() || '',
            queryContext: this.buildQueryContext(app),
            targets: this.buildTargetSnapshot(app),
            templates: (app?.state?.batchQueryTemplateSnapshot || app?.state?.templates || []).map(tpl => ({
                key: tpl._key || '',
                name: tpl.name || '未命名模板'
            })),
            fields: metricFields.map(field => ({
                key: field.key || '',
                name: app?.getMetricFieldDisplayName?.(field) || field.name || field.title || ''
            })),
            rows
        };
    },

    buildRows(app, sourceRows = [], metricFields = [], options = {}) {
        const rows = app?.buildBatchDisplayRows?.(sourceRows, metricFields, { includeChildren: !!options.includeChildren })
            || sourceRows
            || [];
        const targetRange = app?.getActiveBatchTargetRange?.();
        const limit = Number(options.limit || 120);
        return rows.slice(0, limit).map(row => this.buildRow(app, row, metricFields, targetRange));
    },

    buildRow(app, row = {}, metricFields = [], targetRange = null) {
        const metrics = {};
        metricFields.forEach(field => {
            const name = app?.getMetricFieldDisplayName?.(field) || field.name || field.title || field.key || '';
            const enabled = app?.isBatchRowMetricEnabled?.(row, field.key) !== false;
            const rawValue = enabled ? row.valuesByKey?.[field.key] : '';
            const targetValue = targetRange
                ? app?.getBatchTargetValueForDisplayRow?.(row, name, targetRange)
                : '';
            metrics[name] = {
                value: row.error
                    ? '查询失败'
                    : (row.loading ? '查询中' : (enabled ? app?.formatBatchQueryValue?.(rawValue, row.formatsByKey?.[field.key]) || '-' : '-')),
                target: targetRange
                    ? (window.YejiPlcxMbGongju?.formatTargetValue?.(
                        targetValue,
                        value => app?.formatBatchQueryValue?.(value, null),
                        name
                    ) || '-')
                    : '-',
                achievement: targetRange && !row.loading && !row.error && enabled
                    ? (window.YejiPlcxMbGongju?.formatAchievement?.(
                        window.YejiPlcxMbGongju?.calcAchievement?.(rawValue, targetValue, name)
                    ) || '-')
                    : '-'
            };
        });

        return {
            key: row.key || '',
            name: row.name || '未命名模板',
            displayType: row.displayType || 'single',
            loading: !!row.loading,
            error: !!row.error,
            rawKeys: (row.rawRows?.length ? row.rawRows : [row]).map(item => item.key).filter(Boolean),
            metrics
        };
    },

    buildQueryContext(app) {
        return {
            dateValues: app?.clonePlain?.(app?.state?.batchQueryDateValues || app?.getCurrentDateFilterValues?.() || {}) || {},
            fieldConfig: app?.clonePlain?.(app?.state?.batchQueryFieldConfig || app?.getBatchQueryFieldConfig?.() || {}) || {},
            activeTargetKey: app?.state?.batchQueryActiveTargetKey || '',
            queryLoading: !!app?.state?.batchQueryLoading
        };
    },

    buildTargetSnapshot(app) {
        const target = app?.getActiveBatchTargetRange?.();
        if (!target) return null;
        return {
            key: target.key || '',
            label: target.label || target.key || '',
            startDate: target.startDate || '',
            endDate: target.endDate || ''
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
                content: [
                    '你是林默，一名医药行业业务数据分析师，只服务 BI 查询面板业务壳。',
                    '只能使用当前面板快照和 BI 查询面板只读工具返回的数据。不能声称访问数据库、后台、其它页面或联网资料。',
                    '当用户要求模板汇总、目标达成、合并模板、历史对比、任意日期区间、多模板或多指标对比，并且当前面板没有覆盖这些口径时，必须先调用工具补查，不能只凭经验回答。',
                    '工具可传入模板、筛选、排除模式、日期字段、日期范围、聚合字段、目标范围和是否返回合并子项。所有计算必须由 BI 查询面板业务壳完成，不能自己计算目标、达成率或合并模板。工具只读，不会改变筛选条件、字段配置、目标口径或页面状态。',
                    '分析时要先给结论，再用模板、字段、目标和达成率等真实数据说明依据，最后给观察建议。工具失败或空数据不能当成 0。',
                    '回复格式：不得使用 Markdown 格式。不要使用星号、井号、反引号、代码块、表格、分割线、箭头、表情符号或其它特殊装饰符号。按自然段回复，需要分点时使用第一，第二，第三这类中文表达。'
                ].join('\n')
            },
            {
                role: 'user',
                content: `当前 BI 查询面板数据快照如下：\n${JSON.stringify(snapshot, null, 2)}`
            },
            ...historyMessages,
            {
                role: 'user',
                content: String(question || '').trim()
            }
        ];
    }
};

window.YejiPlcxAiGuize = YejiPlcxAiGuize;
