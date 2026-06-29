(function registerToolCenterSkill() {
    function text(value) {
        if (value === null || value === undefined) return '';
        return String(value).trim();
    }

    function uniqueStrings(values = []) {
        const out = [];
        const seen = new Set();
        for (let i = 0; i < values.length; i += 1) {
            const v = text(values[i]);
            if (!v) continue;
            const k = v.toLowerCase();
            if (seen.has(k)) continue;
            seen.add(k);
            out.push(v);
        }
        return out;
    }

    function pickKeyword(base = {}) {
        const direct = text(base.keyword || base.query || base.q || base.search || base.intent_text || base.text || base.content || base.message);
        if (direct) return direct;

        if (Array.isArray(base.keywords)) {
            for (let i = 0; i < base.keywords.length; i += 1) {
                const item = text(base.keywords[i]);
                if (item) return item;
            }
        }

        return '';
    }

    function clampLimit(value, fallback = 50) {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(1, Math.min(300, Math.floor(n)));
    }

    function isHttpUrl(value) {
        return /^https?:\/\//i.test(text(value));
    }

    window.ToolSkillDefinitions = window.ToolSkillDefinitions || [];

    window.ToolSkillDefinitions.push({
        id: 'skill.gzx.manage_tool_center_item',
        tools: ['manage_tool_center_item'],
        priority: 31,
        promptGuidance:
            '[工具中心规则]\n' +
            '- 用户找系统内工具、网址、官网、入口、登录地址、任务工具推荐时，先调用 manage_tool_center_item。\n' +
            '- 工具中心只查数据库，不联网、不代替用户做推荐结论；结果要按 name/description/tags/link 与用户意图筛选。\n' +
            '- count=0 时按结果中的 retry_keywords 重试 1~3 轮；仍无结果再用 full_scan_params 拉全量筛选。\n' +
            '- 只有工具中心链路完成且用户明确要求联网时，才转 search_web。',
        beforeExecute({ params, context, center }) {
            const base = center.isPlainObject(params)
                ? { ...params }
                : (text(params) ? { keyword: text(params) } : {});
            const next = { ...base };

            next.keyword = pickKeyword(base) || center.text(context?.latestUserText);
            if (isHttpUrl(next.keyword)) {
                return {
                    blocked: true,
                    suggestedTool: 'fetch_web_page',
                    error: '检测到明确 URL，请改用 fetch_web_page 抓取网页内容。'
                };
            }

            next.limit = clampLimit(base.limit, next.keyword ? 50 : 300);
            if (!next.keyword && next.limit < 100) {
                next.limit = 300;
            }

            delete next.action;
            delete next.create;
            delete next.update;
            delete next.delete;
            delete next.remove;
            return { params: next };
        },
        afterExecute({ result, params, center }) {
            if (!center.isPlainObject(result)) return;
            if (result.success !== true) return;
            if (center.text(result.action) !== 'list_items') return;

            const keyword = center.text(params?.keyword || result.keyword || '');
            const count = Number(result.count || 0);

            if (keyword && count === 0) {
                const retryKeywords = uniqueStrings(result.retry_keywords || []).slice(0, 3);
                return {
                    result: {
                        ...result,
                        query_strategy_hint: {
                            phase: 'retry_then_full_scan',
                            must_continue_tool_center: true,
                            instruction: '当前关键词未命中。先按 retry_keywords 重试 1-3 轮；仍未命中再用 full_scan_params 拉取全量后逐条筛选。',
                            retry_keywords: retryKeywords,
                            full_scan_params: center.isPlainObject(result.full_scan_params)
                                ? result.full_scan_params
                                : { keyword: '', limit: 300 }
                        }
                    }
                };
            }

            if (count > 0) {
                return {
                    result: {
                        ...result,
                        result_filter_hint: {
                            instruction: '请基于用户意图筛选结果，只保留语义一致的工具；语义不一致项应跳过。',
                            compare_fields: ['name', 'description', 'tags', 'link']
                        }
                    }
                };
            }
        }
    });
})();
