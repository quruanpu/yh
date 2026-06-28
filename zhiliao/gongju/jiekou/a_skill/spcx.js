(function registerProductSkill() {
    function hasCouponSignal(text) {
        const t = String(text || '');
        return /\b\d{7}\b/.test(t) ||
            /\bK[A-Za-z]{0,3}\d{4,20}\b/i.test(t) ||
            /\b1[3-9]\d{9}\b/.test(t) ||
            /送券|发券|赠券|送个券|发个券|送下券|发下券/.test(t);
    }

    function hasProductSignal(text) {
        const t = String(text || '');
        return /国药准字|商品编码|药品|药名|厂家|活动商品|查询商品|查商品|查药品/.test(t) ||
            /\b\d{8,10}\b/.test(t);
    }

    function extractProductKeyword(center, text) {
        if (typeof center.extractProductKeyword === 'function') {
            return center.extractProductKeyword(text);
        }
        return center.extractDrugKeyword(text);
    }

    window.ToolSkillDefinitions = window.ToolSkillDefinitions || [];
    window.ToolSkillDefinitions.push({
        id: 'skill.spcx.search_product',
        tools: ['search_product'],
        priority: 30,
        promptGuidance:
            '[商品查询规则]\n' +
            '- 查询商品、药品、商品编码、国药准字、厂家、8~10 位活动 id、活动商品：使用 search_product，keyword 为提取出的查询词。\n' +
            '- 用户要求基于商品信息生成图片/视频时，可先 search_product，再把商品图或商品信息交给生成工具。\n' +
            '- 7 位门店 id、K 开头门店码、11 位手机号、明确发券动词：不要用 search_product，改用 query_coupon。',
        beforeExecute({ params, context, center }) {
            const base = center.isPlainObject(params) ? { ...params } : { keyword: center.text(params) };
            const routingText = center.text(context?.routingText || context?.latestUserText || base.keyword);

            if (hasCouponSignal(routingText) && !hasProductSignal(routingText)) {
                return {
                    blocked: true,
                    suggestedTool: 'query_coupon',
                    error: '检测到发券/门店/手机号意图，请改用 query_coupon。'
                };
            }

            if (!base.keyword) {
                const fallback = center.text(base.query || base.text || base.content || base.message);
                if (fallback) base.keyword = fallback;
            }

            if (!base.keyword) {
                const userText = center.text(context?.latestUserText || '');
                const extractedKeyword = extractProductKeyword(center, userText);
                if (extractedKeyword) base.keyword = extractedKeyword;
            }

            if (!base.keyword) {
                return { blocked: true, error: 'search_product 缺少 keyword，请提供商品名称或编码。' };
            }

            return { params: base };
        }
    });
})();
