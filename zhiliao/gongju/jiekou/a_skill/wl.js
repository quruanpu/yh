(function registerWebSearchSkill() {
    function text(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim();
    }

    function lower(value) {
        return text(value).toLowerCase();
    }

    function isHttpUrl(value) {
        return /^https?:\/\//i.test(text(value));
    }

    function isPrivateHost(hostname = '') {
        const host = lower(hostname).replace(/^\[|\]$/g, '');
        if (!host) return true;
        if (host === 'localhost' || host.endsWith('.local')) return true;
        if (host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') return true;
        if (/^10\./.test(host)) return true;
        if (/^192\.168\./.test(host)) return true;
        const private172 = host.match(/^172\.(\d{1,2})\./);
        if (private172) {
            const part = Number(private172[1]);
            if (part >= 16 && part <= 31) return true;
        }
        return false;
    }

    function isSafePublicUrl(value) {
        if (!isHttpUrl(value)) return false;
        try {
            const parsed = new URL(text(value));
            return !isPrivateHost(parsed.hostname);
        } catch {
            return false;
        }
    }

    function pickRoutingText(center, context = {}, params = {}, fallbackQuery = '') {
        const fields = [
            context?.routingText,
            context?.latestUserText,
            params?.query,
            params?.keyword,
            params?.text,
            params?.content,
            params?.message,
            fallbackQuery
        ];

        const out = [];
        for (let i = 0; i < fields.length; i += 1) {
            const t = center.text(fields[i]);
            if (t) out.push(t);
        }
        return out.join('\n');
    }

    function isExplicitWebIntent(rawText) {
        const t = lower(rawText);
        if (!t) return false;
        return (
            /联网|网上查|网络上查|网页搜索|搜网页|用百度|用谷歌|用bing|google一下|web search|search web|browse|最新|实时|新闻/.test(t) ||
            (/\blatest\b/.test(t) && /版本|价格|新闻|政策|法规|日期|release|version|price|news|policy/.test(t))
        );
    }

    function isToolNeedIntent(rawText) {
        const t = lower(rawText);
        if (!t) return false;

        const requestSignal = /我想|我要|需要|帮我|推荐|找|有没有|适合|怎么做|在哪|给我|i want|need|help me|recommend|find|what should i use/.test(t);
        const toolSignal = /工具|软件|应用|app|网站|网址|官网|入口|登录|平台|插件|扩展|客户端|链接|地址/.test(t);
        const addressSignal = /地址|链接|网址|官网|入口|登录|登陆|在哪/.test(t);
        const taskTypeSignal = /录屏|截图|剪辑|压缩|转换|翻译|识别|画图|流程图|协作|远程|ssh|文档|表格|笔记|自动化|二维码|qr code|screen record|workflow|diagram/.test(t);

        if (toolSignal && (requestSignal || addressSignal)) return true;
        if (taskTypeSignal && (requestSignal || addressSignal)) return true;
        if (taskTypeSignal && t.length <= 24 && !isExplicitWebIntent(t)) return true;
        return false;
    }

    window.ToolSkillDefinitions = window.ToolSkillDefinitions || [];

    window.ToolSkillDefinitions.push({
        id: 'skill.wl.search_web',
        tools: ['search_web'],
        priority: 35,
        promptGuidance:
            '联网查询只在用户明确要求“联网/网页搜索/查最新实时信息”时使用 search_web。若是找工具、官网、网址、登录入口、任务完成方式，应先走工具中心 manage_tool_center_item，并完成“关键词重试+全量扫描”链路后再考虑联网。',
        beforeExecute({ params, context, center }) {
            const base = center.isPlainObject(params) ? { ...params } : { query: center.text(params) };
            const query = center.text(base.query || base.keyword || base.text || base.content) || center.text(context?.latestUserText);
            const routingText = pickRoutingText(center, context, base, query);

            if (!query) {
                return {
                    blocked: true,
                    suggestedTool: 'search_web',
                    error: 'search_web 缺少 query，请提供搜索关键词。'
                };
            }

            const embeddedUrl = center.extractFirstHttpUrl(routingText);
            if (embeddedUrl) {
                return {
                    blocked: true,
                    suggestedTool: 'fetch_web_page',
                    error: '检测到明确 URL，请改用 fetch_web_page 抓取正文。'
                };
            }

            if (isToolNeedIntent(routingText) && !isExplicitWebIntent(routingText)) {
                return {
                    blocked: true,
                    suggestedTool: 'manage_tool_center_item',
                    error: '检测到工具需求意图，请先查询工具中心（可按关键词重试，仍无结果再全量扫描）；如确需联网，请明确提出“联网查询”。'
                };
            }

            if (isHttpUrl(query)) {
                return {
                    blocked: true,
                    suggestedTool: 'fetch_web_page',
                    error: '检测到明确 URL，请改用 fetch_web_page 抓取正文。'
                };
            }

            if (query.length > 180) {
                return {
                    blocked: true,
                    suggestedTool: 'search_web',
                    error: 'search_web 的 query 过长，请先提炼为简短搜索关键词。'
                };
            }

            return {
                params: {
                    ...base,
                    query
                }
            };
        }
    });

    window.ToolSkillDefinitions.push({
        id: 'skill.wl.fetch_web_page',
        tools: ['fetch_web_page'],
        priority: 35,
        promptGuidance:
            '已知 URL 的网页正文抓取使用 fetch_web_page，url 必须是 http/https。',
        beforeExecute({ params, context, center }) {
            const base = center.isPlainObject(params) ? { ...params } : { url: center.text(params) };
            let url = center.text(base.url || base.link || base.query || base.text || base.content);
            if (!url) {
                url = center.extractFirstHttpUrl(context?.latestUserText || '');
            }

            if (!isSafePublicUrl(url)) {
                return {
                    blocked: true,
                    suggestedTool: 'search_web',
                    error: 'fetch_web_page 需要有效的公网 http/https URL；如果只有关键词请先用 search_web。'
                };
            }

            return {
                params: {
                    ...base,
                    url
                }
            };
        }
    });
})();
