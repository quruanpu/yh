const ZhiLiaoZjgYituModule = (() => {
    const methods = {
        normalizeIntentText(value) {
            const raw = String(value || '').toLowerCase();
            if (!raw) return '';
            return raw
                .replace(/[\u3000\t\r\n]+/g, ' ')
                .replace(/[，。！？、；：:（）()【】\[\]<>《》“”‘'"'`~!@#$%^&*+=|\\/]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        },

        extractUserQueryText(content) {
            if (typeof content === 'string') return content.trim();
            if (!Array.isArray(content)) return '';

            const texts = [];
            for (let i = 0; i < content.length; i += 1) {
                const block = content[i];
                if (!block || typeof block !== 'object') continue;
                if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
                    texts.push(block.text.trim());
                }
            }
            return texts.join('\n').trim();
        },

        isExplicitWebSearchIntent(rawText) {
            const t = this.normalizeIntentText(rawText);
            if (!t) return false;
            return /联网|网上查|网络上查|网页搜索|搜网页|用百度|用谷歌|用bing|google一下|web search|search web|browse|latest|最新|实时|新闻/.test(t);
        },

        isToolCenterNeedIntent(rawText) {
            const t = this.normalizeIntentText(rawText);
            if (!t) return false;

            const requestSignal = /我想|我要|需要|帮我|给我|找|推荐|有没有|在哪|怎么|适合|用什么|可以用什么|i want|need|help me|recommend|find/.test(t);
            const toolSignal = /工具|软件|应用|app|网站|网址|官网|入口|登录|登陆|平台|插件|扩展|客户端|链接|地址/.test(t);
            const addressSignal = /地址|链接|网址|官网|入口|登录|登陆|在哪/.test(t);
            const taskTypeSignal = /录屏|截图|剪辑|压缩|转换|翻译|识别|流程图|协作|远程|ssh|二维码|qr code|screen record|workflow|diagram/.test(t);

            if (toolSignal && (requestSignal || addressSignal)) return true;
            if (taskTypeSignal && (requestSignal || addressSignal)) return true;
            if (taskTypeSignal && t.length <= 24 && !this.isExplicitWebSearchIntent(t)) return true;
            return false;
        },

        shouldPrefetchToolCenter(content) {
            if (Array.isArray(content)) return false;
            const raw = this.extractUserQueryText(content);
            const normalized = this.normalizeIntentText(raw);
            if (!normalized) return false;
            if (this.isExplicitWebSearchIntent(normalized)) return false;
            if (/https?:\/\//i.test(raw)) return false;
            return this.isToolCenterNeedIntent(normalized);
        },

        extractToolCenterKeyword(rawText) {
            const normalized = this.normalizeIntentText(rawText);
            if (!normalized) return '';

            const cleaned = normalized
                .replace(/(我想|我要|需要|帮我|给我|请|麻烦|推荐一下|推荐|找一下|找|查询|查找|搜一下|搜|有没有|能不能|可以|一下|一个|一些|适合|用什么|我用什么)/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            const compact = (cleaned || normalized)
                .replace(/(工具|软件|网站|网址|官网|入口|登录|登陆|链接|地址)+$/g, '')
                .trim();

            return (compact || cleaned || normalized).slice(0, 48);
        },

        truncateTextForPrompt(value, maxLength = 80) {
            const text = String(value || '').trim();
            if (!text) return '';
            if (!Number.isFinite(maxLength) || maxLength <= 0) return text;
            return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
        },

        formatToolCenterItemsForPrompt(items = [], maxItems = 40) {
            const list = Array.isArray(items) ? items.slice(0, maxItems) : [];
            if (list.length === 0) return '（无）';

            const lines = [];
            for (let i = 0; i < list.length; i += 1) {
                const row = list[i] || {};
                const name = this.truncateTextForPrompt(row.name || '', 40) || '未命名';
                const link = this.truncateTextForPrompt(row.link || row.url || '', 140);
                const desc = this.truncateTextForPrompt(row.description || '', 80);
                const tags = Array.isArray(row.tags) ? row.tags.slice(0, 5).join('、') : '';
                const parts = [name];
                if (link) parts.push(`链接:${link}`);
                if (desc) parts.push(`说明:${desc}`);
                if (tags) parts.push(`标签:${tags}`);
                lines.push(`${i + 1}. ${parts.join(' | ')}`);
            }
            return lines.join('\n');
        },

        buildToolCenterPrefetchContext(result, keyword = '') {
            if (!result || typeof result !== 'object') return '';
            const count = Number(result.count || 0);
            const total = Number(result.total_items || 0);
            const retryKeywords = Array.isArray(result.retry_keywords) ? result.retry_keywords.slice(0, 8) : [];
            const fullScanParams = result.full_scan_params && typeof result.full_scan_params === 'object'
                ? result.full_scan_params
                : { keyword: '', limit: 300 };

            const primaryItems = Array.isArray(result.items) ? result.items : [];
            const fallbackItems = Array.isArray(result.fallback_all_items) ? result.fallback_all_items : [];
            const chosenItems = count > 0 ? primaryItems : fallbackItems;
            const preview = this.formatToolCenterItemsForPrompt(chosenItems, 40);

            const hintLines = [
                '[系统路由补充]',
                '已完成工具中心预查询。请优先基于下方工具中心数据回答，不要先联网推荐。',
                `查询关键词: ${keyword || this.extractReadableError(result.keyword, '') || '（空）'}`,
                `命中数量: ${count} / 总量: ${total}`
            ];

            if (retryKeywords.length > 0) {
                hintLines.push(`重试关键词: ${retryKeywords.join('、')}`);
            }

            hintLines.push(`全量扫描参数: ${JSON.stringify(fullScanParams)}`);
            hintLines.push('筛选要求: 仅保留与用户需求语义一致的工具；不一致项跳过。');
            hintLines.push('工具中心预览数据:');
            hintLines.push(preview);
            return hintLines.join('\n');
        },

        async maybeInjectToolCenterContext(message) {
            if (!this.shouldPrefetchToolCenter(message)) {
                return { message, prefetched: false };
            }

            const executeTool = window.ToolRegistry?.executeTool;
            if (typeof executeTool !== 'function') {
                return { message, prefetched: false };
            }

            const rawText = this.extractUserQueryText(message);
            const keyword = this.extractToolCenterKeyword(rawText);
            if (!keyword) return { message, prefetched: false };

            let toolResult = null;
            try {
                toolResult = await executeTool(
                    'manage_tool_center_item',
                    { keyword, limit: 80, _fromAI: true, _skipSkill: true },
                    this.state.sessionId
                );
            } catch (error) {
                this.logWarn('工具中心预查询失败', this.getErrorMessage(error));
                return { message, prefetched: false };
            }

            if (!toolResult || toolResult.success !== true) {
                return { message, prefetched: false };
            }

            const contextText = this.buildToolCenterPrefetchContext(toolResult, keyword);
            if (!contextText) return { message, prefetched: false };

            if (typeof message === 'string') {
                return {
                    message: `${message}\n\n${contextText}`,
                    prefetched: true
                };
            }

            if (Array.isArray(message)) {
                const next = [...message, { type: 'text', text: contextText }];
                return { message: next, prefetched: true };
            }

            return { message, prefetched: false };
        }
    };

    return {
        methods,
        applyTo(appModule) {
            if (!appModule || typeof appModule !== 'object') return appModule;
            Object.assign(appModule, methods);
            return appModule;
        }
    };
})();

window.ZhiLiaoZjgYituModule = ZhiLiaoZjgYituModule;
