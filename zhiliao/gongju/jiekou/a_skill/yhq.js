(function registerCouponSkill() {
    function hasCouponSignal(text) {
        if (!text) return false;
        if (/\b\d{7}\b/.test(text)) return true;
        if (/\bK[A-Za-z]{0,3}\d{4,20}\b/i.test(text)) return true;
        if (/\b1[3-9]\d{9}\b/.test(text)) return true;
        if (/送券|发券|赠券|送个券|发个券|送下券|发下券/.test(text)) return true;
        return false;
    }

    function hasProductQuerySignal(text) {
        const t = String(text || '');
        return /国药准字|商品编码|药品|药名|厂家|活动商品|查询商品|查商品|查药品/.test(t) ||
            /\b\d{8,10}\b/.test(t);
    }

    window.ToolSkillDefinitions = window.ToolSkillDefinitions || [];
    window.ToolSkillDefinitions.push({
        id: 'skill.yhq.query_coupon',
        tools: ['query_coupon'],
        priority: 30,
        promptGuidance:
            '[活动/发券规则]\n' +
            '- 查看活动、活动列表、有哪些优惠券、共享优惠券：使用 query_coupon，可不传 keyword。\n' +
            '- 发券、送券、赠券，或含 7 位门店 id、K 开头门店码、11 位手机号：使用 query_coupon，keyword 必须传用户原文全文，禁止拆分、提取、改写。\n' +
            '- 8~10 位活动 id 查询商品、商品编码、国药准字、药品名、厂家名：不要用 query_coupon，改用 search_product。',
        beforeExecute({ params, context, center }) {
            const base = center.isPlainObject(params) ? { ...params } : {};
            const keyword = center.text(base.keyword);
            const latestUserText = center.text(context?.latestUserText || '');
            const routingText = center.text(context?.routingText || latestUserText || keyword);

            if (hasProductQuerySignal(routingText) && !hasCouponSignal(routingText)) {
                return {
                    blocked: true,
                    suggestedTool: 'search_product',
                    error: '检测到商品/活动商品查询意图，请改用 search_product。'
                };
            }

            if (context?.source === 'command') {
                return { params: { ...base, keyword } };
            }

            if (hasCouponSignal(routingText) && latestUserText) {
                return { params: { ...base, keyword: latestUserText } };
            }

            return { params: { ...base, keyword } };
        }
    });
})();
