/**
 * 联网工具模块
 * 目标：
 * 1) 把联网能力做成标准工具，供任意协议模型统一调用。
 * 2) 对接独立 Server_api 云函数（search / fetch）。
 */

const NetworkToolModule = {
    config: {
        defaultEndpoint: 'https://1317825751-iw2m0lz7e9.ap-guangzhou.tencentscf.com',
        requestTimeoutMs: 20000,
        maxResults: 10,
        maxSnippetChars: 300,
        maxPageChars: 4000
    },

    state: {
        registered: false
    },

    resolveEndpoint() {
        const configured = String(window.ZhiLiaoConfig?.cloudFunction?.networkToolUrl || '').trim();
        const endpoint = configured || this.config.defaultEndpoint;
        return endpoint.replace(/\/+$/, '');
    },

    clampInt(value, min, max, fallback) {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, Math.floor(n)));
    },

    normalizeText(value) {
        if (typeof value === 'string') return value.trim();
        if (value === undefined || value === null) return '';
        return String(value).trim();
    },

    normalizeSnippet(text) {
        const source = this.normalizeText(text).replace(/\s+/g, ' ');
        if (!source) return '';
        if (source.length <= this.config.maxSnippetChars) return source;
        return source.slice(0, this.config.maxSnippetChars) + '...';
    },

    normalizeUrl(url) {
        const value = this.normalizeText(url);
        if (!value) return '';
        try {
            const parsed = new URL(value);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
            return parsed.toString();
        } catch {
            return '';
        }
    },

    async postAction(action, payload = {}) {
        const endpoint = this.resolveEndpoint();
        if (!endpoint) {
            throw new Error('联网工具地址未配置');
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action, ...payload }),
                signal: controller.signal
            });

            let json = null;
            try {
                json = await response.json();
            } catch {
                throw new Error('联网服务返回了非 JSON 数据');
            }

            if (!response.ok) {
                const message = this.normalizeText(json?.error || json?.message) || `HTTP ${response.status}`;
                throw new Error(message);
            }

            return json || {};
        } catch (error) {
            if (error?.name === 'AbortError') {
                throw new Error('联网工具请求超时');
            }
            throw error;
        } finally {
            clearTimeout(timer);
        }
    },

    normalizeSearchResults(rawResults = [], maxResults = 8) {
        if (!Array.isArray(rawResults)) return [];
        return rawResults
            .slice(0, maxResults)
            .map((item) => {
                const title = this.normalizeText(item?.title);
                const url = this.normalizeUrl(item?.url);
                const snippet = this.normalizeSnippet(item?.snippet || item?.content);
                const domain = this.normalizeText(item?.domain);
                return { title, url, snippet, domain };
            })
            .filter((item) => item.url || item.title || item.snippet);
    },

    async searchWeb(params = {}) {
        const query = this.normalizeText(params?.query || params?.keyword || params);
        if (!query) {
            return { success: false, error: '缺少 query 参数' };
        }

        const sourceInput = this.normalizeText(params?.source).toLowerCase();
        const source = ['serper', 'baidu', 'bing'].includes(sourceInput) ? sourceInput : 'auto';
        const maxResults = this.clampInt(params?.max_results, 1, this.config.maxResults, 8);
        const fetchPages = params?.fetch_pages === true;
        const fetchCount = this.clampInt(params?.fetch_count, 1, 3, 2);

        const payload = { query };
        if (source !== 'auto') payload.source = source;

        const searchData = await this.postAction('search', payload);
        const results = this.normalizeSearchResults(searchData?.results, maxResults);

        const out = {
            success: true,
            query,
            source,
            count: results.length,
            results
        };

        if (!fetchPages || results.length === 0) {
            return out;
        }

        const pages = [];
        const targets = results.slice(0, fetchCount);
        for (let i = 0; i < targets.length; i += 1) {
            const item = targets[i];
            if (!item.url) continue;
            try {
                const page = await this.postAction('fetch', { url: item.url });
                const content = this.normalizeText(page?.content);
                pages.push({
                    url: item.url,
                    length: Number(page?.length) || content.length,
                    content:
                        content.length > this.config.maxPageChars
                            ? content.slice(0, this.config.maxPageChars) + '...'
                            : content
                });
            } catch (error) {
                pages.push({
                    url: item.url,
                    error: this.normalizeText(error?.message || error)
                });
            }
        }

        out.pages = pages;
        return out;
    },

    async fetchWebPage(params = {}) {
        const url = this.normalizeUrl(params?.url || params);
        if (!url) {
            return { success: false, error: '缺少有效的 url 参数' };
        }

        const page = await this.postAction('fetch', { url });
        const content = this.normalizeText(page?.content);

        return {
            success: true,
            url,
            length: Number(page?.length) || content.length,
            content:
                content.length > this.config.maxPageChars
                    ? content.slice(0, this.config.maxPageChars) + '...'
                    : content
        };
    },

    registerTools() {
        if (!window.ToolRegistry || this.state.registered) return;

        ToolRegistry.register({
            id: 'search_web',
            name: '联网搜索',
            command: '@联网搜索',
            icon: 'fa-solid fa-globe',
            registerType: 'ai',
            description: '联网搜索关键词并返回结果列表，可选抓取部分结果正文。',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: '搜索关键词' },
                    source: {
                        type: 'string',
                        enum: ['auto', 'serper', 'baidu', 'bing'],
                        description: '搜索源，默认 auto'
                    },
                    max_results: {
                        type: 'integer',
                        description: '返回条数，1-10，默认 8'
                    },
                    fetch_pages: {
                        type: 'boolean',
                        description: '是否抓取前几条结果正文'
                    },
                    fetch_count: {
                        type: 'integer',
                        description: '抓取正文数量，1-3，默认 2'
                    }
                },
                required: ['query']
            },
            handler: async (params) => this.searchWeb(params)
        });

        ToolRegistry.register({
            id: 'fetch_web_page',
            name: '网页抓取',
            command: '@网页抓取',
            icon: 'fa-solid fa-link',
            registerType: 'ai',
            description: '抓取单个网页正文内容。',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: '完整网页 URL（http/https）' }
                },
                required: ['url']
            },
            handler: async (params) => this.fetchWebPage(params)
        });

        this.state.registered = true;
        window.ZhiLiaoLog?.debug?.('联网工具已注册: search_web / fetch_web_page');
    },

    init() {
        const tryRegister = () => {
            if (!window.ToolRegistry) {
                setTimeout(tryRegister, 120);
                return;
            }
            this.registerTools();
        };
        tryRegister();
    }
};

window.NetworkToolModule = NetworkToolModule;
NetworkToolModule.init();
