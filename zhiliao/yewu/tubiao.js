/**
 * 图表生成业务模块
 *
 * 职责：
 * 1. 使用 ECharts 生成专业 BI 图表
 * 2. 将图表导出为 Base64 图片数据
 * 3. 统一规整简单数组和结构化明细数据
 * 4. 保持对外返回 image_url，由智聊消息区统一渲染
 */
const ChartGeneratorModule = {
    config: {
        defaultWidth: 960,
        defaultHeight: 600,
        echartsUrl: 'https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js',
        maxRows: 300,
        maxCategories: 80,
        palette: [
            '#3d6dff',
            '#12b886',
            '#f59f00',
            '#f06595',
            '#15aabf',
            '#845ef7',
            '#ff7b54',
            '#40c057',
            '#748ffc'
        ],
        surfaceColor: '#f6f8fc',
        panelColor: '#ffffff',
        textColor: '#172033',
        mutedTextColor: '#667085',
        gridLineColor: '#edf1f7'
    },

    state: {
        echartsLoaded: false,
        loadingPromise: null
    },

    async init() {
        if (this.state.echartsLoaded || window.echarts) {
            this.state.echartsLoaded = true;
            return true;
        }

        if (this.state.loadingPromise) {
            return this.state.loadingPromise;
        }

        this.state.loadingPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = this.config.echartsUrl;
            script.onload = () => {
                this.state.echartsLoaded = true;
                window.ZhiLiaoLog?.debug?.('ECharts 加载成功。');
                resolve(true);
            };
            script.onerror = () => reject(new Error('ECharts 加载失败。'));
            document.head.appendChild(script);
        });

        return this.state.loadingPromise;
    },

    async generateChart(chartType, labels, values, options = {}) {
        return this.generate({
            ...options,
            chart_type: chartType,
            labels,
            values
        });
    },

    async generate(request = {}) {
        let container = null;
        let chart = null;

        try {
            await this.init();

            const normalized = this.normalizeRequest(request);
            const option = this.prepareStaticExportOption(this.buildOption(normalized));
            const width = normalized.width;
            const height = normalized.height;
            container = this.createRenderContainer(width, height);
            chart = window.echarts.init(container, null, {
                renderer: 'canvas',
                width,
                height
            });

            chart.setOption(option, true);
            this.flushChartRender(chart);

            const imageUrl = chart.getDataURL({
                type: 'png',
                pixelRatio: 2,
                backgroundColor: '#ffffff'
            });

            return {
                success: true,
                image_url: imageUrl,
                chart_type: normalized.chartType,
                width,
                height
            };
        } catch (error) {
            console.error('图表生成失败:', error);
            return {
                success: false,
                error: error?.message || '图表生成失败。'
            };
        } finally {
            if (chart && typeof chart.dispose === 'function') {
                chart.dispose();
            }
            if (container && typeof container.remove === 'function') {
                container.remove();
            }
        }
    },

    prepareStaticExportOption(option = {}) {
        return {
            ...option,
            animation: false,
            animationDuration: 0,
            animationDurationUpdate: 0
        };
    },

    flushChartRender(chart) {
        const renderer = chart?.getZr?.();
        if (!renderer || typeof renderer.flush !== 'function') {
            throw new Error('ECharts 渲染器未就绪，无法导出图表。');
        }
        renderer.flush();
    },

    normalizeRequest(request = {}) {
        const base = request && typeof request === 'object' ? request : {};
        const chartType = this.normalizeChartType(base.chart_type || base.chartType || base.type);
        const width = this.normalizePositiveInteger(base.width, this.config.defaultWidth, 480, 1600);
        const height = this.normalizePositiveInteger(base.height, this.config.defaultHeight, 320, 1200);
        const title = this.normalizeText(base.title) || '统计图表';
        const subtitle = this.normalizeText(base.subtitle);
        const dataset = this.normalizeDataset(base);

        if (dataset.categories.length === 0) {
            throw new Error('图表数据不能为空。');
        }
        if (dataset.categories.length > this.config.maxCategories) {
            throw new Error(`图表分类过多，请筛选到 ${this.config.maxCategories} 项以内。`);
        }

        return {
            chartType,
            title,
            subtitle,
            width,
            height,
            dataset,
            stack: Boolean(base.stack || chartType === 'stacked_bar'),
            smooth: base.smooth !== false,
            area: Boolean(base.area || chartType === 'area'),
            label: base.label !== false,
            theme: this.normalizeText(base.theme) || 'business'
        };
    },

    normalizeDataset(request) {
        if (Array.isArray(request.rows) && request.rows.length > 0) {
            return this.normalizeRowsDataset(request);
        }
        return this.normalizeArrayDataset(request);
    },

    normalizeArrayDataset(request) {
        const labels = this.pickArray(request.labels, request.categories, request.x, request.x_axis, request.xAxis)
            .map((item) => this.normalizeText(item) || '未命名');
        const directSeries = this.normalizeDirectSeries(request.series, labels);

        if (directSeries.length > 0) {
            return {
                categories: labels,
                series: directSeries
            };
        }

        const values = this.pickArray(request.values, request.data, request.y, request.y_axis, request.yAxis)
            .map((item) => this.normalizeNumber(item));
        const seriesName = this.normalizeText(request.series_name || request.label || request.measure || request.y_field) || '数值';
        if (labels.length === 0 || values.length === 0 || labels.length !== values.length) {
            throw new Error('labels 和 values 必须是等长非空数组。');
        }
        if (values.some((item) => !Number.isFinite(item))) {
            throw new Error('values 必须全部是有效数字。');
        }

        return {
            categories: labels,
            series: [{
                name: seriesName,
                data: values
            }]
        };
    },

    normalizeDirectSeries(rawSeries, labels = []) {
        if (!Array.isArray(rawSeries) || labels.length === 0) return [];

        return rawSeries
            .map((item, index) => {
                if (!item || typeof item !== 'object' || !Array.isArray(item.data)) return null;
                const data = item.data.map((value) => this.normalizeNumber(value));
                if (data.length !== labels.length || data.some((value) => !Number.isFinite(value))) return null;
                return {
                    name: this.normalizeText(item.name || item.label || `系列${index + 1}`),
                    data
                };
            })
            .filter(Boolean);
    },

    normalizeRowsDataset(request) {
        const rows = request.rows
            .filter((row) => row && typeof row === 'object')
            .slice(0, this.config.maxRows);
        const dimensions = this.pickArray(request.dimensions, request.dimension_fields);
        const measures = this.pickArray(request.measures, request.measure_fields);
        const xField = this.normalizeText(request.x_field || request.xField || dimensions[0]);
        const yField = this.normalizeText(request.y_field || request.yField || measures[0]);
        const groupField = this.normalizeText(request.group_field || request.groupField || dimensions[1]);

        if (!xField || (!yField && measures.length === 0)) {
            throw new Error('rows 数据需要指定 x_field 和 y_field，或提供 dimensions 与 measures。');
        }

        if (!groupField && measures.length > 1) {
            return this.normalizeMultiMeasureRows(rows, xField, measures);
        }

        const categoryOrder = [];
        const categorySet = new Set();
        const seriesMap = new Map();

        rows.forEach((row) => {
            const category = this.normalizeText(row[xField]) || '未命名';
            const seriesName = groupField ? (this.normalizeText(row[groupField]) || '其他') : (this.normalizeText(yField) || '数值');
            const value = this.normalizeNumber(row[yField]);
            if (!Number.isFinite(value)) return;

            if (!categorySet.has(category)) {
                categorySet.add(category);
                categoryOrder.push(category);
            }
            if (!seriesMap.has(seriesName)) {
                seriesMap.set(seriesName, new Map());
            }
            const bucket = seriesMap.get(seriesName);
            bucket.set(category, (bucket.get(category) || 0) + value);
        });

        const series = Array.from(seriesMap.entries()).map(([name, valueMap]) => ({
            name,
            data: categoryOrder.map((category) => valueMap.get(category) || 0)
        }));

        return {
            categories: categoryOrder,
            series
        };
    },

    normalizeMultiMeasureRows(rows, xField, measures) {
        const categoryOrder = [];
        const categorySet = new Set();
        const seriesMap = new Map(measures.map((field) => [field, new Map()]));

        rows.forEach((row) => {
            const category = this.normalizeText(row[xField]) || '未命名';
            if (!categorySet.has(category)) {
                categorySet.add(category);
                categoryOrder.push(category);
            }
            measures.forEach((field) => {
                const value = this.normalizeNumber(row[field]);
                if (!Number.isFinite(value)) return;
                const bucket = seriesMap.get(field);
                bucket.set(category, (bucket.get(category) || 0) + value);
            });
        });

        const series = Array.from(seriesMap.entries()).map(([name, valueMap]) => ({
            name,
            data: categoryOrder.map((category) => valueMap.get(category) || 0)
        }));

        return {
            categories: categoryOrder,
            series
        };
    },

    buildOption(model) {
        const type = model.chartType;
        const base = this.createBaseOption(model);

        if (type === 'pie') return this.buildPieOption(base, model);
        if (type === 'funnel') return this.buildFunnelOption(base, model);
        if (type === 'radar') return this.buildRadarOption(base, model);
        if (type === 'scatter') return this.buildScatterOption(base, model);

        return this.buildAxisOption(base, model);
    },

    createBaseOption(model) {
        const hasLegend = model.dataset.series.length > 1 || model.chartType === 'pie';
        return {
            backgroundColor: this.config.surfaceColor,
            color: this.config.palette,
            graphic: this.createPanelGraphic(model),
            title: {
                text: model.title,
                subtext: model.subtitle,
                left: 42,
                top: 30,
                textStyle: {
                    color: this.config.textColor,
                    fontSize: 24,
                    fontWeight: 700,
                    lineHeight: 32
                },
                subtextStyle: {
                    color: this.config.mutedTextColor,
                    fontSize: 13,
                    lineHeight: 20
                }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow',
                    shadowStyle: { color: 'rgba(61, 109, 255, 0.08)' }
                },
                confine: true,
                borderWidth: 0,
                backgroundColor: 'rgba(17, 24, 39, 0.88)',
                textStyle: { color: '#ffffff', fontSize: 12 },
                extraCssText: 'box-shadow: 0 12px 30px rgba(15, 23, 42, .18); border-radius: 8px;',
                valueFormatter: (value) => this.formatNumber(value)
            },
            legend: {
                show: hasLegend,
                top: 38,
                right: 42,
                type: 'scroll',
                icon: 'roundRect',
                itemWidth: 12,
                itemHeight: 8,
                itemGap: 14,
                textStyle: { color: '#344054', fontSize: 12 }
            },
            grid: {
                left: 76,
                right: 56,
                top: hasLegend ? 116 : 104,
                bottom: this.getBottomGridSize(model.dataset.categories.length),
                containLabel: true
            },
            textStyle: {
                fontFamily: 'Inter, "Microsoft YaHei", Arial, sans-serif'
            },
            animationDuration: 850,
            animationEasing: 'quarticOut'
        };
    },

    createPanelGraphic(model) {
        return [
            {
                type: 'rect',
                left: 20,
                top: 20,
                right: 20,
                bottom: 20,
                silent: true,
                shape: { r: 18 },
                style: {
                    fill: this.config.panelColor,
                    shadowBlur: 24,
                    shadowColor: 'rgba(31, 41, 55, 0.10)',
                    shadowOffsetY: 10
                },
                z: -10
            },
            {
                type: 'rect',
                left: 20,
                top: 20,
                right: 20,
                bottom: 20,
                silent: true,
                shape: { r: 18 },
                style: {
                    fill: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 1,
                        y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(61, 109, 255, 0.05)' },
                            { offset: 0.48, color: 'rgba(255, 255, 255, 0)' },
                            { offset: 1, color: model.chartType === 'pie' ? 'rgba(18, 184, 134, 0.06)' : 'rgba(21, 170, 191, 0.05)' }
                        ]
                    }
                },
                z: -9
            }
        ];
    },

    buildAxisOption(option, model) {
        const isLine = model.chartType === 'line' || model.chartType === 'area';
        const axisType = isLine ? 'line' : 'bar';
        return {
            ...option,
            xAxis: {
                type: 'category',
                data: model.dataset.categories,
                axisTick: { alignWithLabel: true },
                axisLine: { lineStyle: { color: '#d9e0eb' } },
                axisLabel: {
                    color: this.config.mutedTextColor,
                    fontSize: 12,
                    interval: this.getAxisLabelInterval(model.dataset.categories.length),
                    rotate: this.getAxisLabelRotate(model.dataset.categories.length),
                    hideOverlap: true,
                    margin: 14,
                    formatter: (value) => this.truncateLabel(value, 12)
                }
            },
            yAxis: {
                type: 'value',
                splitNumber: 5,
                splitLine: { lineStyle: { color: this.config.gridLineColor, type: 'dashed' } },
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: {
                    color: this.config.mutedTextColor,
                    fontSize: 12,
                    formatter: (value) => this.formatCompactNumber(value)
                }
            },
            series: model.dataset.series.map((item, index) => ({
                name: item.name,
                type: axisType,
                data: item.data,
                stack: model.stack ? 'total' : undefined,
                smooth: isLine ? model.smooth : undefined,
                symbol: isLine ? 'circle' : undefined,
                symbolSize: isLine ? 7 : undefined,
                showSymbol: isLine ? model.dataset.categories.length <= 18 : undefined,
                lineStyle: isLine ? { width: 3, cap: 'round' } : undefined,
                areaStyle: model.area ? {
                    opacity: 0.18,
                    color: this.createAreaGradient(index)
                } : undefined,
                barMaxWidth: axisType === 'bar' ? 42 : undefined,
                barMinHeight: axisType === 'bar' ? 2 : undefined,
                itemStyle: axisType === 'bar'
                    ? {
                        borderRadius: model.stack ? 0 : [8, 8, 2, 2],
                        color: this.createBarGradient(index)
                    }
                    : undefined,
                label: axisType === 'bar' && model.label ? {
                    show: model.dataset.categories.length <= 20,
                    position: 'top',
                    color: '#344054',
                    fontSize: 11,
                    fontWeight: 600,
                    formatter: (params) => this.formatCompactNumber(params.value)
                } : undefined,
                emphasis: {
                    focus: 'series',
                    itemStyle: {
                        shadowBlur: 14,
                        shadowColor: 'rgba(61, 109, 255, 0.22)'
                    }
                }
            }))
        };
    },

    buildPieOption(option, model) {
        const firstSeries = model.dataset.series[0] || { data: [] };
        return {
            ...option,
            tooltip: {
                trigger: 'item',
                valueFormatter: (value) => this.formatNumber(value)
            },
            legend: {
                ...option.legend,
                orient: 'vertical',
                top: 104,
                right: 44
            },
            series: [{
                name: firstSeries.name,
                type: 'pie',
                radius: ['44%', '70%'],
                center: ['42%', '58%'],
                avoidLabelOverlap: true,
                itemStyle: {
                    borderColor: '#ffffff',
                    borderWidth: 3,
                    shadowBlur: 12,
                    shadowColor: 'rgba(31, 41, 55, 0.10)'
                },
                label: {
                    color: '#344054',
                    fontSize: 12,
                    fontWeight: 600,
                    formatter: (params) => `${this.truncateLabel(params.name, 10)}\n${params.percent}%`
                },
                labelLine: {
                    length: 14,
                    length2: 10,
                    smooth: true,
                    lineStyle: { color: '#cbd5e1' }
                },
                emphasis: {
                    scaleSize: 8,
                    itemStyle: {
                        shadowBlur: 18,
                        shadowColor: 'rgba(31, 41, 55, 0.20)'
                    }
                },
                data: model.dataset.categories.map((name, index) => ({
                    name,
                    value: firstSeries.data[index] || 0
                }))
            }]
        };
    },

    buildFunnelOption(option, model) {
        const firstSeries = model.dataset.series[0] || { data: [] };
        return {
            ...option,
            tooltip: {
                trigger: 'item',
                valueFormatter: (value) => this.formatNumber(value)
            },
            legend: {
                ...option.legend,
                show: false
            },
            series: [{
                name: firstSeries.name,
                type: 'funnel',
                left: '12%',
                top: 108,
                bottom: 52,
                width: '76%',
                minSize: '18%',
                maxSize: '100%',
                sort: 'descending',
                gap: 6,
                label: {
                    color: this.config.textColor,
                    fontSize: 13,
                    fontWeight: 600,
                    formatter: (params) => `${params.name}  ${this.formatCompactNumber(params.value)}`
                },
                itemStyle: {
                    borderColor: '#fff',
                    borderWidth: 3,
                    shadowBlur: 12,
                    shadowColor: 'rgba(31, 41, 55, 0.10)'
                },
                data: model.dataset.categories.map((name, index) => ({
                    name,
                    value: firstSeries.data[index] || 0
                }))
            }]
        };
    },

    buildRadarOption(option, model) {
        const maxValue = Math.max(
            ...model.dataset.series.flatMap((item) => item.data),
            1
        );
        return {
            ...option,
            tooltip: { trigger: 'item' },
            legend: {
                ...option.legend,
                top: 78,
                right: 42
            },
            radar: {
                center: ['50%', '60%'],
                radius: '58%',
                splitNumber: 4,
                axisName: {
                    color: '#344054',
                    fontSize: 12,
                    fontWeight: 600,
                    formatter: (value) => this.truncateLabel(value, 8)
                },
                splitLine: { lineStyle: { color: '#e5eaf2' } },
                splitArea: {
                    areaStyle: {
                        color: ['rgba(61, 109, 255, 0.035)', 'rgba(18, 184, 134, 0.035)']
                    }
                },
                axisLine: { lineStyle: { color: '#d9e0eb' } },
                indicator: model.dataset.categories.map((name) => ({
                    name,
                    max: Math.ceil(maxValue * 1.2)
                }))
            },
            series: [{
                type: 'radar',
                data: model.dataset.series.map((item) => ({
                    name: item.name,
                    value: item.data,
                    areaStyle: { opacity: 0.18 },
                    lineStyle: { width: 3 },
                    symbol: 'circle',
                    symbolSize: 6
                }))
            }]
        };
    },

    buildScatterOption(option, model) {
        const firstSeries = model.dataset.series[0] || { data: [] };
        return {
            ...option,
            xAxis: {
                type: 'category',
                data: model.dataset.categories,
                axisLine: { lineStyle: { color: '#d9e0eb' } },
                axisLabel: {
                    color: this.config.mutedTextColor,
                    formatter: (value) => this.truncateLabel(value, 12)
                }
            },
            yAxis: {
                type: 'value',
                splitLine: { lineStyle: { color: this.config.gridLineColor, type: 'dashed' } },
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: {
                    color: this.config.mutedTextColor,
                    formatter: (value) => this.formatCompactNumber(value)
                }
            },
            series: [{
                name: firstSeries.name,
                type: 'scatter',
                symbolSize: (value) => {
                    const n = Array.isArray(value) ? Number(value[1]) : Number(value);
                    return Math.max(8, Math.min(34, Math.sqrt(Math.abs(n || 0)) * 2));
                },
                itemStyle: {
                    color: this.createRadialGradient(0),
                    shadowBlur: 12,
                    shadowColor: 'rgba(61, 109, 255, 0.20)'
                },
                data: firstSeries.data,
                emphasis: {
                    scale: true,
                    itemStyle: {
                        shadowBlur: 18,
                        shadowColor: 'rgba(61, 109, 255, 0.30)'
                    }
                }
            }]
        };
    },

    createRenderContainer(width, height) {
        const container = document.createElement('div');
        container.style.width = `${width}px`;
        container.style.height = `${height}px`;
        container.style.position = 'fixed';
        container.style.left = '-10000px';
        container.style.top = '-10000px';
        container.style.pointerEvents = 'none';
        container.setAttribute('aria-hidden', 'true');
        document.body.appendChild(container);
        return container;
    },

    normalizeChartType(type) {
        const text = this.normalizeText(type).toLowerCase();
        const map = {
            bar: 'bar',
            column: 'bar',
            line: 'line',
            pie: 'pie',
            donut: 'pie',
            doughnut: 'pie',
            scatter: 'scatter',
            area: 'area',
            stacked_bar: 'stacked_bar',
            stack: 'stacked_bar',
            funnel: 'funnel',
            radar: 'radar'
        };
        if (map[text]) return map[text];
        if (/柱|条形/.test(text)) return 'bar';
        if (/折线|趋势/.test(text)) return 'line';
        if (/饼|占比|构成/.test(text)) return 'pie';
        if (/散点|相关/.test(text)) return 'scatter';
        if (/面积/.test(text)) return 'area';
        if (/堆叠/.test(text)) return 'stacked_bar';
        if (/漏斗|转化/.test(text)) return 'funnel';
        if (/雷达/.test(text)) return 'radar';
        return 'bar';
    },

    createBarGradient(index = 0) {
        const color = this.config.palette[index % this.config.palette.length];
        return {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
                { offset: 0, color },
                { offset: 1, color: this.mixColor(color, '#ffffff', 0.52) }
            ]
        };
    },

    createAreaGradient(index = 0) {
        const color = this.config.palette[index % this.config.palette.length];
        return {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
                { offset: 0, color: this.toRgba(color, 0.42) },
                { offset: 1, color: this.toRgba(color, 0.02) }
            ]
        };
    },

    createRadialGradient(index = 0) {
        const color = this.config.palette[index % this.config.palette.length];
        return {
            type: 'radial',
            x: 0.4,
            y: 0.35,
            r: 0.75,
            colorStops: [
                { offset: 0, color: this.mixColor(color, '#ffffff', 0.22) },
                { offset: 1, color }
            ]
        };
    },

    getBottomGridSize(categoryCount = 0) {
        if (categoryCount > 16) return 96;
        if (categoryCount > 8) return 78;
        return 64;
    },

    getAxisLabelRotate(categoryCount = 0) {
        if (categoryCount > 16) return 45;
        if (categoryCount > 8) return 28;
        return 0;
    },

    getAxisLabelInterval(categoryCount = 0) {
        if (categoryCount <= 12) return 0;
        if (categoryCount <= 24) return 1;
        return Math.ceil(categoryCount / 18);
    },

    truncateLabel(value, maxLength = 12) {
        const text = this.normalizeText(value);
        if (text.length <= maxLength) return text;
        return `${text.slice(0, Math.max(1, maxLength - 1))}…`;
    },

    toRgba(hex, alpha = 1) {
        const rgb = this.hexToRgb(hex);
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    },

    mixColor(hex, targetHex, ratio = 0.5) {
        const from = this.hexToRgb(hex);
        const to = this.hexToRgb(targetHex);
        const mix = (a, b) => Math.round(a + (b - a) * ratio);
        return `rgb(${mix(from.r, to.r)}, ${mix(from.g, to.g)}, ${mix(from.b, to.b)})`;
    },

    hexToRgb(hex) {
        const value = this.normalizeText(hex).replace('#', '');
        const normalized = value.length === 3
            ? value.split('').map((item) => item + item).join('')
            : value.padEnd(6, '0').slice(0, 6);
        return {
            r: parseInt(normalized.slice(0, 2), 16) || 0,
            g: parseInt(normalized.slice(2, 4), 16) || 0,
            b: parseInt(normalized.slice(4, 6), 16) || 0
        };
    },

    pickArray(...values) {
        for (let i = 0; i < values.length; i += 1) {
            if (Array.isArray(values[i]) && values[i].length > 0) return values[i];
        }
        return [];
    },

    normalizeText(value) {
        return String(value ?? '').trim();
    },

    normalizeNumber(value) {
        if (typeof value === 'number') return value;
        const text = String(value ?? '').replace(/,/g, '').trim();
        if (!text) return Number.NaN;
        const match = text.match(/-?\d+(?:\.\d+)?/);
        return match ? Number(match[0]) : Number.NaN;
    },

    normalizePositiveInteger(value, fallback, min, max) {
        const n = Math.round(Number(value));
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
    },

    formatNumber(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return String(value ?? '');
        return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
    },

    formatCompactNumber(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return String(value ?? '');
        const abs = Math.abs(n);
        if (abs >= 100000000) return `${(n / 100000000).toFixed(2)}亿`;
        if (abs >= 10000) return `${(n / 10000).toFixed(2)}万`;
        return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
    }
};

window.ChartGeneratorModule = ChartGeneratorModule;
