(function registerMediaUnderstandingSkill() {
    function hasImageObject(text) {
        return /图片|图像|照片|图|海报|宣传图|主图|包装图|营销图|商品图/.test(text);
    }

    function hasImageCreateVerb(text) {
        return /生成|生图|画|做|制作|创建|设计|出一张|来一张/.test(text);
    }

    function hasImageEditVerb(text) {
        return /改图|编辑|修改|换背景|加文字|风格化|重绘|修图|抠图|去背景|替换/.test(text);
    }

    function isImageCreateIntent(center, text) {
        const t = center.lower(text);
        if (/生图|画图|做图|改图|编辑图片/.test(t)) return true;
        return hasImageObject(t) && (hasImageCreateVerb(t) || hasImageEditVerb(t));
    }

    function isVideoCreateIntent(center, text) {
        const t = center.lower(text);
        if (/生成视频|生视频|图生视频|视频生成|动起来/.test(t)) return true;
        const hasVideoObject = /视频|动画|短片|动态画面/.test(t);
        const hasVideoCreateVerb = /生成|制作|创建|做|输出|转成|变成/.test(t);
        return hasVideoObject && hasVideoCreateVerb;
    }

    window.ToolSkillDefinitions = window.ToolSkillDefinitions || [];
    window.ToolSkillDefinitions.push({
        id: 'skill.mtlj.media_understanding',
        tools: ['understand_image', 'understand_video'],
        priority: 18,
        promptGuidance:
            '[媒体理解规则]\n' +
            '- 普通看图、描述图片、根据图片回答问题：使用 understand_image。\n' +
            '- 普通看视频、描述视频、根据视频回答问题：使用 understand_video。\n' +
            '- 识别药品/商品/药盒/批准文号/商品编码，或需要匹配商品数据：不要用普通媒体理解，改用 understand_product_image。\n' +
            '- 用户要求生成、编辑、做海报、生成视频、让图片动起来时，不用理解工具，改走 generate_or_edit_image 或 generate_video。\n' +
            '- 刚上传或刚生成的图片优先传 image_ref: "last"；刚上传或刚生成的视频优先传 video_ref: "last"。',
        beforeExecute({ toolId, params, context, center }) {
            const routingText = context?.routingText || context?.latestUserText || center.extractTextLike(params);
            if (center.isChartIntentText(routingText)) {
                return {
                    blocked: true,
                    suggestedTool: 'generate_chart_from_statistics',
                    error: '检测到图表需求，请改用 generate_chart_from_statistics。'
                };
            }
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
            return { params };
        }
    });
})();
