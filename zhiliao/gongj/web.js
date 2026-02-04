// 联网搜索模块 - 基于智谱官方 Web Search API
const WebSearchModule = {
    // 配置
    config: {
        apiKey: window.ZhiLiaoConfig?.api.key || 'b19c0371e3af4b5b83c6682baff9ac30.ruRGrlPzrOZ5YjAp',
        apiUrl: 'https://open.bigmodel.cn/api/paas/v4/web_search',
        timeout: 30000,
        // 默认搜索参数（平衡型配置）
        defaultParams: {
            search_engine: 'search_std',        // 智谱基础版
            search_intent: false,                // 直接搜索
            count: 10,                           // 返回10条结果
            search_recency_filter: 'noLimit',    // 不限时间
            content_size: 'medium'               // 摘要信息
        }
    },

    // 状态
    state: {
        isSearching: false,
        lastSearchResult: null
    },

    // 执行搜索
    async search(query, options = {}) {
        if (!query || !query.trim()) {
            return { success: false, error: '搜索关键词不能为空' };
        }

        this.state.isSearching = true;

        try {
            // 构建请求参数（合并默认参数和用户参数）
            const requestBody = {
                search_query: query.trim(),
                search_engine: options.search_engine || this.config.defaultParams.search_engine,
                search_intent: options.search_intent !== undefined ? options.search_intent : this.config.defaultParams.search_intent,
                count: options.count || this.config.defaultParams.count,
                search_recency_filter: options.search_recency_filter || this.config.defaultParams.search_recency_filter,
                content_size: options.content_size || this.config.defaultParams.content_size
            };

            // 如果指定了域名过滤，添加到请求中
            if (options.search_domain_filter) {
                requestBody.search_domain_filter = options.search_domain_filter;
            }

            const response = await fetch(this.config.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `HTTP ${response.status}`);
            }

            const result = await response.json();
            this.state.lastSearchResult = result;

            return {
                success: true,
                data: result
            };

        } catch (error) {
            console.error('联网搜索失败:', error);
            return { success: false, error: error.message };
        } finally {
            this.state.isSearching = false;
        }
    },

    // 获取搜索结果列表
    getSearchResults(result) {
        if (!result?.success || !result?.data?.search_result) {
            return [];
        }
        return result.data.search_result;
    },

    // 格式化搜索结果为 Markdown（用于AI总结）
    formatResultsForAI(result) {
        const searchResults = this.getSearchResults(result);
        if (searchResults.length === 0) {
            return '未找到相关搜索结果';
        }

        let content = '以下是搜索结果：\n\n';
        searchResults.forEach((item, index) => {
            content += `${index + 1}. **${item.title}**\n`;
            content += `   ${item.content}\n`;
            content += `   来源: ${item.media || '网络'}\n`;
            if (item.publish_date) {
                content += `   发布时间: ${item.publish_date}\n`;
            }
            content += `   链接: ${item.link}\n\n`;
        });

        return content;
    },

    // 格式化引用来源为 Markdown
    formatReferencesMarkdown(searchResults) {
        if (!searchResults || searchResults.length === 0) return '';

        let md = '\n\n---\n**参考来源：**\n';
        searchResults.slice(0, 5).forEach((item, index) => {
            const title = item.title || '未知标题';
            const source = item.media || '网络';
            md += `${index + 1}. [${title}](${item.link}) - ${source}\n`;
        });
        return md;
    }
};

// 导出模块
window.WebSearchModule = WebSearchModule;
