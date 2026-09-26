(function registerChartSkill() {
    const CHART_TYPES = new Set(['bar', 'line', 'pie', 'scatter', 'area', 'stacked_bar', 'funnel', 'radar']);

    function text(center, value) {
        return center.text(value);
    }

    function lower(center, value) {
        return center.lower(value);
    }

    function normalizeChartType(center, rawType, params = {}) {
        const t = lower(center, rawType);
        if (CHART_TYPES.has(t)) return t;

        const joined = [
            t,
            text(center, params.title),
            text(center, params.intent),
            Array.isArray(params.dimensions) ? params.dimensions.join(' ') : '',
            Array.isArray(params.measures) ? params.measures.join(' ') : ''
        ].join(' ');

        if (/饼|占比|构成|份额|比例|pie|donut/.test(joined)) return 'pie';
        if (/折线|趋势|走势|按日|按月|按周|时间|line/.test(joined)) return 'line';
        if (/面积|area/.test(joined)) return 'area';
        if (/散点|相关|分布|scatter/.test(joined)) return 'scatter';
        if (/堆叠|stack/.test(joined)) return 'stacked_bar';
        if (/漏斗|转化|阶段|funnel/.test(joined)) return 'funnel';
        if (/雷达|能力|画像|radar/.test(joined)) return 'radar';
        return 'bar';
    }

    function firstArray(...values) {
        for (let i = 0; i < values.length; i += 1) {
            if (Array.isArray(values[i]) && values[i].length > 0) return values[i];
        }
        return [];
    }

    function normalizeNumber(value) {
        if (typeof value === 'number') return value;
        const textValue = String(value ?? '').replace(/,/g, '').trim();
        if (!textValue) return Number.NaN;
        const match = textValue.match(/-?\d+(?:\.\d+)?/);
        return match ? Number(match[0]) : Number.NaN;
    }

    function normalizeRows(center, rows) {
        if (!Array.isArray(rows)) return [];
        return rows.filter((row) => center.isPlainObject(row));
    }

    function normalizeArrayMode(center, base) {
        const labels = firstArray(base.labels, base.categories, base.x, base.x_axis, base.xAxis)
            .map((item) => text(center, item) || '未命名');
        const series = normalizeSeries(center, base.series, labels);
        const values = firstArray(base.values, base.data, base.y, base.y_axis, base.yAxis)
            .map((item) => normalizeNumber(item));
        return { labels, values, series };
    }

    function normalizeSeries(center, rawSeries, labels) {
        if (!Array.isArray(rawSeries) || labels.length === 0) return [];
        return rawSeries
            .map((item, index) => {
                if (!center.isPlainObject(item) || !Array.isArray(item.data)) return null;
                const data = item.data.map((value) => normalizeNumber(value));
                if (data.length !== labels.length || data.some((value) => !Number.isFinite(value))) return null;
                return {
                    name: text(center, item.name || item.label || `系列${index + 1}`),
                    data
                };
            })
            .filter(Boolean);
    }

    function hasRowsMode(base) {
        return Array.isArray(base.rows) && base.rows.length > 0;
    }

    function validateRowsMode(center, base) {
        const rows = normalizeRows(center, base.rows);
        const dimensions = firstArray(base.dimensions, base.dimension_fields).map((item) => text(center, item)).filter(Boolean);
        const measures = firstArray(base.measures, base.measure_fields).map((item) => text(center, item)).filter(Boolean);
        const xField = text(center, base.x_field || base.xField || dimensions[0]);
        const yField = text(center, base.y_field || base.yField || measures[0]);

        if (rows.length === 0) {
            return { error: 'rows 必须是非空对象数组。' };
        }
        if (!xField || !yField) {
            return { error: 'rows 模式需要提供 x_field 与 y_field，或提供 dimensions 与 measures。' };
        }
        if (rows.every((row) => !Object.prototype.hasOwnProperty.call(row, xField))) {
            return { error: `rows 中未找到 x_field 字段：${xField}。` };
        }
        if (rows.every((row) => !Object.prototype.hasOwnProperty.call(row, yField))) {
            return { error: `rows 中未找到 y_field 字段：${yField}。` };
        }

        return {
            params: {
                ...base,
                rows,
                dimensions,
                measures,
                x_field: xField,
                y_field: yField
            }
        };
    }

    function validateArrayMode(center, base) {
        const { labels, values, series } = normalizeArrayMode(center, base);
        if (labels.length > 0 && series.length > 0) {
            return {
                params: {
                    ...base,
                    labels,
                    series
                }
            };
        }
        if (labels.length === 0 || values.length === 0 || labels.length !== values.length) {
            return { error: '请提供等长非空的 labels 与 values，或提供 labels 与 series，或改用 rows、x_field、y_field。' };
        }
        if (values.some((item) => !Number.isFinite(item))) {
            return { error: 'values 必须全部是有效数字。' };
        }
        return {
            params: {
                ...base,
                labels,
                values
            }
        };
    }

    window.ToolSkillDefinitions = window.ToolSkillDefinitions || [];
    window.ToolSkillDefinitions.push({
        id: 'skill.tbsc.generate_chart',
        tools: ['generate_chart_from_statistics'],
        priority: 25,
        promptGuidance:
            '[图表生成规则]\n' +
            '- 统计图、数据可视化、图表、柱状图、折线图、饼图、散点图、漏斗图、雷达图等需求，调用 generate_chart_from_statistics，不要调用生图工具。\n' +
            '- 数据来自查询结果、文件解析结果或用户给出的表格时，优先整理为 rows，并提供 x_field、y_field；存在分组对比时再提供 group_field。\n' +
            '- 简单数据可以使用 labels 与 values；多系列数据可以使用 labels 与 series；labels 与每组 data 必须等长且非空。\n' +
            '- 排行、对比、Top N：优先 bar；时间趋势：优先 line 或 area；构成占比：优先 pie；多系列构成：优先 stacked_bar；转化步骤：优先 funnel；多维画像：优先 radar；相关性分布：优先 scatter。\n' +
            '- 标题要简洁准确，体现对象、指标和时间范围；不要把图表解释写进 title。\n' +
            '- 图表只用于真实统计数据，可视化需求不要编造数据；数据不足时先查询、读取文件或向用户确认。\n' +
            '- BI 图表字段建议：维度放客户、品种、月份、日期、区域、类型等；指标放含税金额、利润、数量、订单数、增长额、增长率等。\n' +
            '- 默认生成精致商务 BI 风格图表；不要额外编造颜色、背景、字体等视觉参数，除非用户明确要求。\n' +
            '- 分类过多时先聚合 Top N 或筛选关键项，优先展示 5~20 个核心分类；不要把几十上百项直接塞进图表。\n' +
            '- 多指标对比优先用 series 或 rows + measures；同环比、本期/同期/环期对比优先用多系列柱状图或折线图。\n' +
            '- 饼图只用于少量分类占比，分类超过 8 项时优先改用柱状图。\n' +
            '- 纯生成图表时 delivery_mode=card_only；用户要求生成后继续分析、说明、总结、写报告或在回复中编排图表时 delivery_mode=await_then_reply。\n' +
            '- 工具成功后图表会由前端卡片自动展示；最终回复只做文字说明。若需要把图表放在回复某处，只输出系统提供的 [[media:...]] 占位符，不要输出 Markdown 图片、链接、相对图片路径、data URL 或 base64。',
        beforeExecute({ params, center }) {
            const base = center.isPlainObject(params) ? { ...params } : {};
            const chartType = normalizeChartType(center, base.chart_type || base.type || base.chartType, base);

            if (!CHART_TYPES.has(chartType)) {
                return {
                    blocked: true,
                    suggestedTool: 'generate_chart_from_statistics',
                    error: 'chart_type 不合法。'
                };
            }

            const validated = hasRowsMode(base)
                ? validateRowsMode(center, base)
                : validateArrayMode(center, base);

            if (validated.error) {
                return {
                    blocked: true,
                    suggestedTool: 'generate_chart_from_statistics',
                    error: validated.error
                };
            }

            const nextParams = {
                ...validated.params,
                chart_type: chartType
            };

            if (chartType === 'pie') {
                const values = Array.isArray(nextParams.values)
                    ? nextParams.values
                    : [];
                if (values.some((item) => Number(item) < 0)) {
                    return {
                        blocked: true,
                        suggestedTool: 'generate_chart_from_statistics',
                        error: '饼图不支持负数，请改用柱状图或折线图。'
                    };
                }
            }

            return { params: nextParams };
        }
    });
})();
