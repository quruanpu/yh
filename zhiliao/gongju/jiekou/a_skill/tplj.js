(function registerImageUnderstandingSkill() {
    function isImageCreateIntent(center, rawText) {
        const t = center.lower(rawText);
        return /生成图片|生图|画图|做图|海报|宣传图|主图|包装图|营销图|改图|编辑图片|换背景|加文字|风格化/.test(t);
    }

    function isVideoCreateIntent(center, rawText) {
        const t = center.lower(rawText);
        return /生成视频|生视频|动画|短片|动态画面|动起来|图生视频|视频生成/.test(t);
    }

    function hasDirectImageInput(params = {}) {
        if (!params || typeof params !== 'object') return false;

        if (typeof params.image_url === 'string' && params.image_url.trim()) return true;
        if (Array.isArray(params.image_urls) && params.image_urls.some((x) => String(x || '').trim())) return true;
        if (Array.isArray(params.images) && params.images.some((item) => {
            if (typeof item === 'string') return item.trim().length > 0;
            if (!item || typeof item !== 'object') return false;
            return String(item.image_url || item.url || '').trim().length > 0;
        })) return true;
        if (typeof params.image_ref === 'string' && params.image_ref.trim()) return true;
        if (Array.isArray(params.image_refs) && params.image_refs.some((x) => String(x || '').trim())) return true;

        return false;
    }

    window.ToolSkillDefinitions = window.ToolSkillDefinitions || [];
    window.ToolSkillDefinitions.push({
        id: 'skill.tplj.image_understanding',
        tools: ['understand_product_image'],
        priority: 35,
        promptGuidance:
            '[药品/商品图片识别规则]\n' +
            '- 仅当用户要识别药品、商品、药盒、批准文号、商品编码、厂家，或要匹配商品数据时，使用 understand_product_image。\n' +
            '- 普通图片描述/分析使用 understand_image，不要误用本工具。\n' +
            '- 可选传 keyword 辅助检索；图片来源可用 image_url/image_urls/images，也可用 image_ref: "last" 引用刚上传或已生成图片。\n' +
            '- 若图片主要是发券内容（门店码、手机号、优惠券规格），改用 query_coupon。',
        beforeExecute({ params, context, center }) {
            const base = center.isPlainObject(params)
                ? { ...params }
                : { keyword: center.text(params) };
            const routingText = context?.routingText || context?.latestUserText || center.extractTextLike(base);

            if (isVideoCreateIntent(center, routingText)) {
                return {
                    blocked: true,
                    suggestedTool: 'generate_video',
                    error: '检测到视频生成意图，请改用 generate_video。'
                };
            }
            if (isImageCreateIntent(center, routingText)) {
                return {
                    blocked: true,
                    suggestedTool: 'generate_or_edit_image',
                    error: '检测到图片生成/编辑意图，请改用 generate_or_edit_image。'
                };
            }

            if (!base.keyword) {
                const maybeKeyword = center.text(base.query || base.text || base.content);
                if (maybeKeyword) base.keyword = maybeKeyword;
            }
            delete base.query;
            delete base.text;
            delete base.content;

            const hasUploadedImages = Array.isArray(window.ZhiLiaoModule?.state?.uploadedFiles) &&
                window.ZhiLiaoModule.state.uploadedFiles.some((f) => String(f?.type || '').startsWith('image/'));

            if (!hasUploadedImages && !hasDirectImageInput(base)) {
                return {
                    blocked: true,
                    suggestedTool: 'understand_product_image',
                    error: '图片理解需要图片输入，请先上传图片或传入 image_url/image_urls。'
                };
            }

            return { params: base };
        }
    });
})();
