// Trend AI assistant rules: build a read-only payload from the current trend panel.
const YejiPlcxQsAiGuize = {
    buildSnapshot({ context = null, rows = [] } = {}) {
        const isRate = context?.trendModel === 'rate';
        const cleanRows = (rows || [])
            .filter(row => row && !row.loading)
            .map(row => isRate ? this.buildRateRow(row) : this.buildValueRow(row));
        const latest = cleanRows[cleanRows.length - 1] || null;
        const summary = isRate
            ? this.buildRateSummary(rows)
            : this.buildValueSummary(rows);

        return {
            modelType: isRate ? 'rate' : 'value',
            projectName: context?.rowName || '',
            metricName: context?.metricName || '',
            dateField: context?.dateInfo?.name || '',
            dateRange: context?.dateInfo?.range || [],
            rateDependency: isRate ? {
                numeratorName: context?.rateMeta?.numeratorName || '',
                denominatorName: context?.rateMeta?.denominatorName || ''
            } : null,
            templateNames: (context?.templates || []).map(tpl => tpl.name || '未命名模板'),
            latest,
            summary,
            rows: cleanRows
        };
    },

    buildValueRow(row = {}) {
        return {
            date: row.label || '',
            weekday: row.weekday || '',
            queryProgress: window.YejiPlcxQsGuize?.formatPercent?.(row.queryProgress) || '-',
            target: row.targetText || '-',
            dailyActual: row.dailyActualText || '-',
            cumulativeActual: row.actualText || '-',
            achievement: window.YejiPlcxQsGuize?.formatPercent?.(row.achievement) || '-',
            progressGap: window.YejiPlcxQsGuize?.formatPercent?.(row.gap, true) || '-',
            progressMultiplier: window.YejiPlcxQsGuize?.formatRatio?.(row.pace) || '-',
            dailyCompletionStrength: window.YejiPlcxQsGuize?.formatRatio?.(row.speed) || '-',
            industryProgress: window.YejiPlcxQsGuize?.formatPercent?.(row.industryProgress) || '-',
            industryWeightReason: row.industryWeightReason || '-',
            industryExpectedCumulative: this.formatValue(row.industryExpectedValue, row.displayFormat),
            industryRhythmGap: this.formatValue(row.industryGapValue, row.displayFormat),
            industryRhythmMultiplier: window.YejiPlcxQsGuize?.formatRatio?.(row.industryPace) || '-',
            targetGap: this.formatValue(row.targetGapValue, row.displayFormat),
            remainingWeightedDailyNeed: this.formatValue(row.remainingWeightedDailyNeed, row.displayFormat),
            baselineWeightedDailyAverage: this.formatValue(row.baselineWeightedDailyAvg, row.displayFormat),
            cumulativeWeightedDailyAverage: this.formatValue(row.cumulativeWeightedDailyAvg, row.displayFormat),
            recentWeightedDailyAverage: this.formatValue(row.recentWeightedDailyAvg, row.displayFormat),
            trendWeightedDailyAverage: this.formatValue(row.trendWeightedDailyAvg, row.displayFormat),
            historyTrendEnhanced: row.historyTrendEnhanced ? '是' : '否',
            historyTrendBasis: row.historyTrendBasis || '-',
            historyTrendForecastValue: this.formatValue(row.historyTrendForecastValue, row.displayFormat),
            historyTrendCompletionRatio: window.YejiPlcxQsGuize?.formatPercent?.(row.historyTrendCompletionRatio) || '-',
            historyTrendReferences: this.formatHistoryTrendReferences(row.historyTrendReferences),
            forecastLowValue: this.formatValue(row.forecastLowValue, row.displayFormat),
            forecastFinalValue: this.formatValue(row.forecastFinalValue, row.displayFormat),
            forecastHighValue: this.formatValue(row.forecastHighValue, row.displayFormat),
            forecastAchievement: window.YejiPlcxQsGuize?.formatPercent?.(row.forecastAchievement) || '-',
            forecastTargetDiff: this.formatValue(row.forecastTargetDiff, row.displayFormat),
            pressureIndex: window.YejiPlcxQsGuize?.formatRatio?.(row.pressureIndex) || '-',
            forecastStatus: row.forecastStatus || '-',
            diagnosisScore: this.formatScore(row.diagnosisScore),
            businessLevel: row.businessLevel || '-',
            mainReason: row.mainReason || '-',
            actionSuggestion: row.actionSuggestion || '-',
            decisionConfidence: row.decisionConfidence || '-'
        };
    },

    buildValueSummary(rows = []) {
        const completed = (rows || []).filter(row => row && !row.loading);
        const latest = completed[completed.length - 1] || null;
        if (!latest) return { status: '趋势数据加载中' };
        return {
            latestDate: latest.label || '',
            target: latest.targetText || '-',
            cumulativeActual: latest.actualText || '-',
            achievement: window.YejiPlcxQsGuize?.formatPercent?.(latest.achievement) || '-',
            queryProgress: window.YejiPlcxQsGuize?.formatPercent?.(latest.queryProgress) || '-',
            progressGap: window.YejiPlcxQsGuize?.formatPercent?.(latest.gap, true) || '-',
            progressMultiplier: window.YejiPlcxQsGuize?.formatRatio?.(latest.pace) || '-',
            dailyCompletionStrength: window.YejiPlcxQsGuize?.formatRatio?.(latest.speed) || '-',
            industryProgress: window.YejiPlcxQsGuize?.formatPercent?.(latest.industryProgress) || '-',
            industryWeightReason: latest.industryWeightReason || '-',
            industryExpectedCumulative: this.formatValue(latest.industryExpectedValue, latest.displayFormat),
            industryRhythmGap: this.formatValue(latest.industryGapValue, latest.displayFormat),
            industryRhythmMultiplier: window.YejiPlcxQsGuize?.formatRatio?.(latest.industryPace) || '-',
            targetGap: this.formatValue(latest.targetGapValue, latest.displayFormat),
            remainingWeightedDailyNeed: this.formatValue(latest.remainingWeightedDailyNeed, latest.displayFormat),
            baselineWeightedDailyAverage: this.formatValue(latest.baselineWeightedDailyAvg, latest.displayFormat),
            cumulativeWeightedDailyAverage: this.formatValue(latest.cumulativeWeightedDailyAvg, latest.displayFormat),
            recentWeightedDailyAverage: this.formatValue(latest.recentWeightedDailyAvg, latest.displayFormat),
            trendWeightedDailyAverage: this.formatValue(latest.trendWeightedDailyAvg, latest.displayFormat),
            historyTrendEnhanced: latest.historyTrendEnhanced ? '是' : '否',
            historyTrendBasis: latest.historyTrendBasis || '-',
            historyTrendForecastValue: this.formatValue(latest.historyTrendForecastValue, latest.displayFormat),
            historyTrendCompletionRatio: window.YejiPlcxQsGuize?.formatPercent?.(latest.historyTrendCompletionRatio) || '-',
            historyTrendReferences: this.formatHistoryTrendReferences(latest.historyTrendReferences),
            forecastLowValue: this.formatValue(latest.forecastLowValue, latest.displayFormat),
            forecastFinalValue: this.formatValue(latest.forecastFinalValue, latest.displayFormat),
            forecastHighValue: this.formatValue(latest.forecastHighValue, latest.displayFormat),
            forecastAchievement: window.YejiPlcxQsGuize?.formatPercent?.(latest.forecastAchievement) || '-',
            forecastTargetDiff: this.formatValue(latest.forecastTargetDiff, latest.displayFormat),
            pressureIndex: window.YejiPlcxQsGuize?.formatRatio?.(latest.pressureIndex) || '-',
            forecastStatus: latest.forecastStatus || '-',
            diagnosisScore: this.formatScore(latest.diagnosisScore),
            businessLevel: latest.businessLevel || '-',
            mainReason: latest.mainReason || '-',
            actionSuggestion: latest.actionSuggestion || '-',
            decisionConfidence: latest.decisionConfidence || '-'
        };
    },

    buildRateRow(row = {}) {
        return {
            date: row.label || '',
            weekday: row.weekday || '',
            queryProgress: window.YejiPlcxQsGuize?.formatPercent?.(row.queryProgress) || '-',
            direction: row.directionText || '-',
            targetRate: row.targetText || '-',
            dailyNumerator: row.dailyNumeratorText || '-',
            cumulativeNumerator: row.cumNumeratorText || '-',
            dailyDenominator: row.dailyDenominatorText || '-',
            cumulativeDenominator: row.cumDenominatorText || '-',
            dailyRate: row.dailyActualText || '-',
            dailyTargetGap: window.YejiPlcxQsLfxGuize?.formatPoint?.(row.dailyTargetGap, true) || '-',
            cumulativeRate: row.actualText || '-',
            cumulativeTargetGap: window.YejiPlcxQsLfxGuize?.formatPoint?.(row.cumulativeTargetGap, true) || '-',
            effectiveTargetGap: window.YejiPlcxQsLfxGuize?.formatPoint?.(row.cumulativeEffectiveGap, true) || '-',
            targetStatus: row.cumulativeTargetStatus || '-',
            rateChange: window.YejiPlcxQsLfxGuize?.formatPoint?.(row.rateChange, true) || '-',
            numeratorContribution: window.YejiPlcxQsLfxGuize?.formatPoint?.(row.numeratorContribution, true) || '-',
            denominatorContribution: window.YejiPlcxQsLfxGuize?.formatPoint?.(row.denominatorContribution, true) || '-',
            mainDriver: row.mainDriver || '-',
            baseReliability: row.baseReliability || '-',
            mainReason: row.mainReason || '-',
            actionSuggestion: row.actionSuggestion || '-'
        };
    },

    buildRateSummary(rows = []) {
        const completed = (rows || []).filter(row => row && !row.loading);
        const latest = completed[completed.length - 1] || null;
        if (!latest) {
            return {
                status: '趋势数据加载中'
            };
        }
        return {
            latestDate: latest.label || '',
            direction: latest.directionText || '-',
            targetRate: latest.targetText || '-',
            cumulativeRate: latest.actualText || '-',
            cumulativeTargetGap: window.YejiPlcxQsLfxGuize?.formatPoint?.(latest.cumulativeTargetGap, true) || '-',
            effectiveTargetGap: window.YejiPlcxQsLfxGuize?.formatPoint?.(latest.cumulativeEffectiveGap, true) || '-',
            targetStatus: latest.cumulativeTargetStatus || '-',
            rateChange: window.YejiPlcxQsLfxGuize?.formatPoint?.(latest.rateChange, true) || '-',
            numeratorContribution: window.YejiPlcxQsLfxGuize?.formatPoint?.(latest.numeratorContribution, true) || '-',
            denominatorContribution: window.YejiPlcxQsLfxGuize?.formatPoint?.(latest.denominatorContribution, true) || '-',
            mainDriver: latest.mainDriver || '-',
            baseReliability: latest.baseReliability || '-',
            mainReason: latest.mainReason || '-',
            actionSuggestion: latest.actionSuggestion || '-'
        };
    },

    joinText(...parts) {
        return parts
            .map(item => String(item || '').trim())
            .filter(item => item && item !== '-')
            .join(' ') || '-';
    },

    formatValue(value, format = null) {
        if (value == null || value === '') return '-';
        const numeric = Number(String(value).replace(/,/g, '').trim());
        if (!Number.isFinite(numeric)) return String(value);
        if (format?.specifier?.includes('%')) {
            const places = Number(format.decimalPlaces ?? 2);
            const divisor = Number(format.divideDataBy ?? 1) || 1;
            return `${((numeric / divisor) * 100).toFixed(places)}%`;
        }
        if (Math.abs(numeric) >= 10000) return `${(numeric / 10000).toFixed(2)}万`;
        return numeric.toLocaleString('zh-CN', {
            minimumFractionDigits: Number(format?.decimalPlaces ?? 0),
            maximumFractionDigits: Number(format?.decimalPlaces ?? 2)
        });
    },

    formatScore(value) {
        const numeric = Number(String(value ?? '').replace(/,/g, '').trim());
        return Number.isFinite(numeric) ? String(Math.round(numeric)) : '-';
    },

    formatHistoryTrendReferences(references = []) {
        if (!Array.isArray(references) || !references.length) return '-';
        return references.slice(0, 3).map(item => ({
            name: item.label || '-',
            baselineDate: item.progressDate || '-',
            matchType: item.baselineMatchType || '-',
            matchScore: this.formatScore(item.baselineScore),
            completionRatio: window.YejiPlcxQsGuize?.formatPercent?.(item.completionRatio) || '-'
        }));
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
                    '任务总纲：你是林默，一名医药行业业务数据分析师，服务药品流通和医药电商经营分析场景。你的任务不是泛泛聊天，而是在指标详解弹窗内，帮助用户从当前已经查询出的 BI 指标数据中发现关键变化、判断达成压力、解释波动原因，并给出稳健的短期观察和预测。',
                    '角色卡：林默的专业能力是业务数据挖掘、节奏诊断、异常归因、目标达成判断和经营风险提醒。林默的行动方式是先抓最重要的业务信号，再用数据证据解释，最后给出下一步该盯什么。林默的世界观是数据必须服务经营决策，不能为了显得聪明而制造不确定信息。林默的表达声音是克制、直接、清楚、可靠，像一位熟悉业务的真人同事。',
                    '数据边界：你只能使用当前指标详解面板已经查询出来的数据、私有只读补充查询工具返回的同口径时间段数据，以及本系统内置的行业节奏规则。禁止声称自己访问了数据库、后台系统、其它页面、联网资料或当前面板和私有工具之外的数据。没有真实数据支撑的内容不能编造，不能为了完整而补数字，不能把经验判断说成已发生事实。数据不足时直接说明当前数据不足，并指出还需要哪个日期节点、指标、活动背景或节假日信息。',
                    '数据证据优先级：第一优先使用当前面板快照中的真实数据；第二优先使用你刚刚通过私有工具查询到的同口径真实数据；第三才使用内置行业节奏规则做背景解释。凡是涉及具体数值、涨跌幅、同环比变化、某日期表现、某时间段强弱对比的结论，都必须能在当前面板快照或工具查询结果中找到依据。行业规则只能解释可能原因和观察方向，不能替代真实数据。',
                    '私有工具边界：当前指标详解面板提供只读业务壳查询工具。你可以传入模板、筛选、排除模式、日期字段、日期范围、指标字段和目标范围；未传模板、指标或目标时，可以沿用当前指标详解面板口径。值模型、率模型、依赖字段、目标值、达成率、节奏和预测都必须由指标详解业务壳计算，你不能自己替代面板算法。工具结果只用于同期、环比或自定义口径参考，不会改变当前弹窗表格。若使用工具结果，必须说明查询口径和时间段，不要说成其它维度数据。跨周期对比时重点看实际值、率值、节奏变化和趋势信号，目标相关判断要保守。',
                    '必须调用工具的场景：当用户要求或暗示上月同期、去年同期、环比、同比、历史对比、任意日期区间、多日期对比、某几天表现、补充历史参考、对比另一段时间，且当前面板快照没有覆盖这些日期时，必须先调用私有工具查询对应时间段，不能只凭经验或行业规律回答。用户问得不明确但明显需要历史数据时，先基于当前面板日期范围推导最合理的同口径日期区间并查询；如果无法推导准确日期，再说明需要用户补充日期，不要杜撰。',
                    '工具使用策略：根据用户描述判断是否需要补充查询。若当前面板数据已经足够回答，不要为了显得复杂而调用工具。若问题需要同环比或历史参考，必须查询，不要光说不做。工具支持单轮最多 31 个不同日期区间并发补查，可以按用户问题一次性补查多个时间段。系统不按查询次数限制你的分析，你可以根据分析需要多轮调用工具，直到获得足够真实数据再回复。若一次工具结果不够，不要猜测，要继续查询更合适的同口径时间段，或者明确说明还缺少哪些日期数据。每次补查都必须围绕用户问题服务，优先查询最能支撑判断的时间段，避免无意义重复查询。',
                    '日期推导规则：工具入参必须是明确的 YYYY-MM-DD 开始日期和结束日期。推导上月同期时，优先使用当前面板日期范围向前平移一个自然月，并处理月末不存在日期的情况；推导去年同期时，优先向前平移一年；推导环比时，优先选择与当前面板相同天数、紧邻当前区间之前的日期段。查询多个时间段时，每个时间段都要保证开始日期不晚于结束日期。日期不确定时不要猜测成具体数据结论。',
                    '工具结果使用规则：拿到工具结果后，先核对工具返回的 queryTime、modelType、metricName 和当前面板口径是否一致，再进行分析。若工具返回失败、空数据或日期不完整，要明确说明该时间段查询不足，不能把失败结果当成 0。对比时要说明当前区间和补查区间分别是什么，尽量使用实际值、累计值、当日值、率值、达成率、节奏差、预测判断等已有字段，不要创造不存在的新字段。',
                    '分析流程：先给结论，判断当前节奏是偏强、正常、偏弱、修复中还是风险上升。再给依据，说明目标、实际、达成率、时间进度、当日表现、累计表现之间的关系。然后做归因，判断影响来自目标压力、当日波动、累计趋势、周内节奏、月内节奏、节假日、大促活动或淡旺季。最后给观察点，告诉用户接下来应该重点看哪个日期、指标或变化。',
                    '值模型规则：当 modelType 为 value 时，第一阶段先基于目标、当日值、累计值、达成率、时间进度、进度差、进度倍率和当日完成强度判断线性达成情况；第二阶段再基于行业进度、权重说明、行业预期累计、行业节奏差、行业节奏倍率、目标缺口和剩余加权日均判断医药行业加权节奏和剩余压力；第三阶段基于基准加权日均、累计加权日均、近期加权日均、趋势加权日均、历史趋势校准、预测区间、预测月底值、预测达成率、预测目标差、压力指数和预测判断评估月底结果。历史趋势校准只代表系统同口径补查到的上月环期、去年同期或上上月同期趋势形状参与了预测，不代表直接平均历史销售额。第四阶段基于诊断分、综合等级、关键原因、建议动作和判断置信度做最终经营诊断。先说明线性结论，再说明行业节奏修正，然后给预测判断，最后用经营诊断收束。不要只复述数字，要指出数字背后的业务含义。',
                    '率模型规则：当 modelType 为 rate 时，只做第一阶段解释，不做行业节奏预测。必须基于目标率、方向、依赖字段、业务基数字段、当日率、累计率、原始目标差、方向修正差、达标判断、率变化、依赖字段贡献、业务基数贡献、主导因素、基数可靠性、关键原因和建议动作分析。利润率类指标通常越高越好，费用率类指标通常越低越好。分析率指标时必须先看方向，再看具体依赖字段和业务基数，再看基数可靠性。回复时不要使用笼统术语，必须说具体字段名称，例如边际利润、不含税金额、配送费、人工费、平台费。不要把每日率简单平均，不要把率变化简单等同于销售额变化，也不要把费用率偏高误判为正向信号。',
                    '行业月节奏：1个月是主要绩效周期，1周是主要促销周期。通常月初更强，越靠近月末销售越容易走弱。第1周通常最好，第2周回落，第3周可能小幅修复，第4周通常再回落，也可能与第2周、第3周差距不大。若当月1日与星期一重叠，月初大促和周一大促可能叠加形成更强高点；若第1周不完整，月初加持会减弱，遇到周六或周日开月时更可能延后到下周一释放。',
                    '行业周节奏：星期一通常是周促最高峰，尤其月初完整周的星期一容易形成高点，后续周一可能逐步衰减。星期二较星期一明显回落，但通常仍高于星期五。星期三是连锁大促小高峰，仅次于星期一。星期四延续星期三但略回落，月后段可能接近或超过星期二。星期五继续回落但通常高于星期日。星期六拼团可能小幅拉升，但多数情况下持平或更低。星期日通常是一周低点。',
                    '特殊经营因素：法定节假日通常显著压低销售，假期效应优先于月内和周内规律。平台或集团大促会抬升销售，并可能弱化常规节奏。2月后到7月、8月通常逐步走弱，7月、8月容易处于低谷；9月到次年1月通常逐步走强。使用这些规则时要明确这是内置业务背景判断，不是当前面板之外的新数据。',
                    '预测原则：可以给短期趋势判断，但必须保守，并且必须能从当前已查询数据、时间进度、周内节奏、月内节奏或行业规则中找到依据。不要做确定性承诺，不要给绝对化结论。优先使用可能、倾向于、需要观察、风险上升、节奏偏弱、节奏偏强、修复信号这类表达。',
                    '回复风格：直接以林默的身份回复，不要自称 AI。使用书面语和业务分析风格，简洁、稳、有判断力。回复要有一点真人同事的温度，可以适度安抚或提醒，例如这组数据的关键信号已经比较清楚，这个风险点值得提前盯住，但不要夸张、不要表演化、不要闲聊。',
                    '回复格式：不得使用 Markdown 格式。不要使用星号、井号、反引号、代码块、表格、分割线、箭头、表情符号或其它特殊装饰符号。按自然段回复，段落间距清晰。需要分点时使用第一，第二，第三，这类中文自然表达。中文标点适当，业务必要的数字、百分比、日期、指标名称和单位可以保留。'
                ].join('\n')
            },
            {
                role: 'user',
                content: `当前指标详解面板数据快照如下：\n${JSON.stringify(snapshot, null, 2)}`
            },
            ...historyMessages,
            {
                role: 'user',
                content: String(question || '').trim()
            }
        ];
    }
};

window.YejiPlcxQsAiGuize = YejiPlcxQsAiGuize;
