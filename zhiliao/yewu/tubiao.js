/**
 * 图表生成业务模块
 *
 * 职责：
 * 1. 使用Chart.js生成图表
 * 2. 返回Base64图片数据
 * 3. 支持多种图表类型（柱状图、折线图、饼图、散点图）
 * 4. 动态加载Chart.js库
 *
 * 从 zhiliao/gongj/chart.js 迁移
 */
const ChartGeneratorModule = {
    // 配置
    config: {
        defaultWidth: 800,
        defaultHeight: 600,
        chartJsUrl: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
    },

    // 状态
    state: {
        chartJsLoaded: false,
        loadingPromise: null
    },

    /**
     * 初始化（加载Chart.js库）
     * @returns {Promise<boolean>} 是否加载成功
     */
    async init() {
        if (this.state.chartJsLoaded) {
            return true;
        }

        if (this.state.loadingPromise) {
            return this.state.loadingPromise;
        }

        this.state.loadingPromise = new Promise((resolve, reject) => {
            if (typeof Chart !== 'undefined') {
                this.state.chartJsLoaded = true;
                resolve(true);
                return;
            }

            const script = document.createElement('script');
            script.src = this.config.chartJsUrl;
            script.onload = () => {
                this.state.chartJsLoaded = true;
                console.log('Chart.js 加载成功');
                resolve(true);
            };
            script.onerror = () => {
                reject(new Error('Chart.js 加载失败'));
            };
            document.head.appendChild(script);
        });

        return this.state.loadingPromise;
    },

    /**
     * 生成图表并返回Base64 DataURL
     * @param {string} chartType - 图表类型（'bar' | 'line' | 'pie' | 'scatter'）
     * @param {Array} labels - 标签数组
     * @param {Array} values - 数值数组
     * @param {Object} options - 配置选项
     * @returns {Promise<Object>} 生成结果
     */
    async generateChart(chartType, labels, values, options = {}) {
        try {
            await this.init();

            const canvas = document.createElement('canvas');
            canvas.width = options.width || this.config.defaultWidth;
            canvas.height = options.height || this.config.defaultHeight;

            const ctx = canvas.getContext('2d');
            const chartConfig = this.buildChartConfig(chartType, labels, values, options);
            const chart = new Chart(ctx, chartConfig);

            await new Promise(resolve => setTimeout(resolve, 100));

            const dataUrl = canvas.toDataURL('image/png');
            chart.destroy();

            return {
                success: true,
                image_url: dataUrl,
                width: canvas.width,
                height: canvas.height
            };
        } catch (error) {
            console.error('图表生成失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    /**
     * 构建Chart.js配置
     * @param {string} chartType - 图表类型
     * @param {Array} labels - 标签数组
     * @param {Array} values - 数值数组
     * @param {Object} options - 配置选项
     * @returns {Object} Chart.js配置对象
     */
    buildChartConfig(chartType, labels, values, options) {
        return {
            type: this.mapChartType(chartType),
            data: {
                labels: labels,
                datasets: [{
                    label: options.label || '数据',
                    data: values,
                    backgroundColor: this.getColors(chartType, values.length),
                    borderColor: this.getBorderColors(chartType, values.length),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: !!options.title,
                        text: options.title || '',
                        font: { size: 18 }
                    },
                    legend: {
                        display: chartType === 'pie',
                        position: 'right'
                    }
                },
                scales: this.getScalesConfig(chartType)
            }
        };
    },

    /**
     * 映射图表类型
     * @param {string} type - 图表类型
     * @returns {string} Chart.js图表类型
     */
    mapChartType(type) {
        const typeMap = { 'bar': 'bar', 'line': 'line', 'pie': 'pie', 'scatter': 'scatter' };
        return typeMap[type] || 'bar';
    },

    /**
     * 获取颜色配置
     * @param {string} chartType - 图表类型
     * @param {number} count - 数据点数量
     * @returns {string|Array} 颜色配置
     */
    getColors(chartType, count) {
        const colors = [
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(153, 102, 255, 0.6)',
            'rgba(255, 159, 64, 0.6)',
            'rgba(199, 199, 199, 0.6)',
            'rgba(83, 102, 255, 0.6)',
            'rgba(255, 99, 255, 0.6)',
            'rgba(99, 255, 132, 0.6)'
        ];
        return chartType === 'pie' ? colors.slice(0, count) : colors[0];
    },

    /**
     * 获取边框颜色
     * @param {string} chartType - 图表类型
     * @param {number} count - 数据点数量
     * @returns {string|Array} 边框颜色配置
     */
    getBorderColors(chartType, count) {
        const colors = [
            'rgba(54, 162, 235, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
            'rgba(199, 199, 199, 1)',
            'rgba(83, 102, 255, 1)',
            'rgba(255, 99, 255, 1)',
            'rgba(99, 255, 132, 1)'
        ];
        return chartType === 'pie' ? colors.slice(0, count) : colors[0];
    },

    /**
     * 获取坐标轴配置
     * @param {string} chartType - 图表类型
     * @returns {Object} 坐标轴配置
     */
    getScalesConfig(chartType) {
        if (chartType === 'pie') return {};
        return {
            y: { beginAtZero: true, ticks: { font: { size: 12 } } },
            x: { ticks: { font: { size: 12 } } }
        };
    }
};

// 导出模块
window.ChartGeneratorModule = ChartGeneratorModule;
