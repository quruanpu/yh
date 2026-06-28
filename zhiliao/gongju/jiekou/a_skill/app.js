(function setupToolSkillCenter() {
    const ToolSkillCenterModule = {
        state: {
            initialized: false,
            skills: [],
            loadedSkillIds: new Set()
        },

        text(value) {
            if (typeof value === 'string') return value.trim();
            if (value === null || value === undefined) return '';
            return String(value).trim();
        },

        lower(value) {
            return this.text(value).toLowerCase();
        },

        isPlainObject(value) {
            return value && typeof value === 'object' && !Array.isArray(value);
        },

        extractTextLike(value) {
            if (value === null || value === undefined) return '';
            if (typeof value === 'string') return value.trim();
            if (typeof value === 'number' || typeof value === 'boolean') return String(value);

            if (Array.isArray(value)) {
                return value.map((item) => this.extractTextLike(item)).filter(Boolean).join('\n').trim();
            }

            if (typeof value === 'object') {
                const fields = [value.text, value.content, value.prompt, value.message];
                for (let i = 0; i < fields.length; i += 1) {
                    const t = this.text(fields[i]);
                    if (t) return t;
                }
                try {
                    return JSON.stringify(value);
                } catch {
                    return '';
                }
            }

            return '';
        },

        getLatestUserText() {
            const history = Array.isArray(window.ZhiLiaoModule?.state?.messageHistory)
                ? window.ZhiLiaoModule.state.messageHistory
                : [];
            for (let i = history.length - 1; i >= 0; i -= 1) {
                const item = history[i];
                if (!item || item.role !== 'user') continue;
                const text = this.extractTextLike(item.content);
                if (text) return text;
            }
            return '';
        },

        getRoutingText(params = {}) {
            const userText = this.getLatestUserText();
            const promptText = this.extractTextLike(params?.prompt);
            return [userText, promptText].filter(Boolean).join('\n').trim();
        },

        extractFirstHttpUrl(rawText) {
            const text = this.text(rawText);
            if (!text) return '';
            const match = text.match(/https?:\/\/[^\s<>"'`]+/i);
            return match ? match[0] : '';
        },

        hasImageSource(params = {}) {
            return (
                (Array.isArray(params?.images) && params.images.length > 0) ||
                (Array.isArray(params?.image_urls) && params.image_urls.length > 0) ||
                (typeof params?.image_ref === 'string' && params.image_ref.trim()) ||
                (Array.isArray(params?.image_refs) && params.image_refs.length > 0) ||
                (typeof params?.image_url === 'string' && params.image_url.trim())
            );
        },

        inferImageAction(params = {}) {
            const action = this.lower(params?.action);
            if (action === 'edit' || action === 'edits') return 'edit';
            if (action === 'generate' || action === 'generation' || action === 'generations' || action === 'create') {
                return 'generate';
            }
            return this.hasImageSource(params) ? 'edit' : 'generate';
        },

        isChartIntentText(text) {
            const t = this.lower(text);
            if (!t) return false;
            return (
                /图表|统计图|可视化|柱状图|折线图|饼图|散点图|雷达图|趋势图|x轴|y轴/.test(t) ||
                /bar chart|line chart|pie chart|scatter plot|data visualization|dashboard/.test(t)
            );
        },

        isDrugIntentText(text) {
            const t = this.lower(text);
            if (!t) return false;
            return (
                /药品|药盒|药物|国药准字|otc|处方药|rx|批准文号|药名/.test(t) ||
                /胶囊|颗粒|片剂|口服液|滴眼液|注射液|软膏|乳膏|喷雾剂|糖浆/.test(t)
            );
        },

        isImageEditIntentText(params = {}, text = '') {
            if (this.inferImageAction(params) === 'edit') return true;
            const t = this.lower(text);
            if (!t) return false;
            return (
                /编辑|修改|改成|换成|替换|重绘|抠图|去背景|加字|调色|修图|润色|扩图/.test(t) ||
                /edit|modify|retouch|inpaint|replace|remove background|change/.test(t)
            );
        },

        cleanProductKeywordCandidate(value) {
            let text = this.text(value);
            if (!text) return '';

            text = text
                .replace(/^(?:用|拿|基于|根据)\s*/g, '')
                .replace(/^(?:药品|商品|产品|货品)?(?:主体|名称|关键词|关键字)?[为是叫:：\s]+/g, '')
                .replace(/^(?:药品|药名|商品|品名|产品)[：:：\s]*/g, '')
                .replace(/(?:并|然后|再)?(?:帮我|给我|请)?(?:生成|制作|做|设计|出|画)(?:一张|一个)?(?:宣传图|海报|主图|包装图|详情图|商品图|药品图|营销图|促销图).*$/g, '')
                .replace(/(?:特价|价格|售价|活动价|到手价|卖|只要|仅需|优惠价)[：:：\s]*(?:￥|¥)?\d+(?:\.\d+)?(?:元)?/g, '')
                .replace(/[，,。；;！!?？、\s]+$/g, '')
                .replace(/^[，,。；;！!?？、\s]+/g, '')
                .trim();

            if (!text || text.length < 2 || text.length > 40) return '';
            if (/^(?:宣传图|海报|主图|包装图|详情图|商品图|药品图|营销图|促销图)$/i.test(text)) return '';
            return text;
        },

        extractProductKeywordCandidates(text) {
            const t = this.text(text);
            const candidates = [];
            const push = (value) => {
                const item = this.cleanProductKeywordCandidate(value);
                if (!item || candidates.includes(item)) return;
                candidates.push(item);
            };

            if (!t) return candidates;

            const approvalMatches = t.match(/国药准字[0-9a-zA-Z]+/ig) || [];
            approvalMatches.forEach(push);

            const codeMatches = t.match(/\b[A-Za-z]{1,8}\d{3,12}\b/g) || [];
            codeMatches.forEach(push);

            const activityMatches = t.match(/\b\d{8,10}\b/g) || [];
            activityMatches.forEach(push);

            const labeledMatches = t.matchAll(/(?:药品|药名|商品|品名|产品|货品)[：:：\s]*([\u4e00-\u9fa5A-Za-z0-9()（）\-]{2,40})/g);
            for (const match of labeledMatches) push(match[1]);

            const queryMatches = t.matchAll(/(?:查询|查一下|查找|搜索|检索|找一下|找)([^，,。；;！!?？\n]{2,50})/g);
            for (const match of queryMatches) push(match[1]);

            const useMatches = t.matchAll(/(?:用|拿|基于|根据)([^，,。；;！!?？\n]{2,50}?)(?:生成|制作|做|设计|出|画)/g);
            for (const match of useMatches) push(match[1]);

            const medicineMatches = t.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,30}(?:片|胶囊|颗粒|口服液|滴眼液|注射液|软膏|乳膏|喷雾剂|糖浆)/g) || [];
            medicineMatches
                .slice()
                .sort((a, b) => b.length - a.length)
                .forEach(push);

            const brandNameMatches = t.match(/\b[A-Za-z0-9]{2,}[\u4e00-\u9fa5]{1,16}(?:片|胶囊|颗粒|口服液|滴眼液|注射液|软膏|乳膏|喷雾剂|糖浆)?/g) || [];
            brandNameMatches.forEach(push);

            const quotedMatches = t.matchAll(/[“"「《](.{2,24})[”"」》]/g);
            for (const match of quotedMatches) push(match[1]);

            return candidates;
        },

        extractProductKeyword(text) {
            return this.extractProductKeywordCandidates(text)[0] || '';
        },

        extractDrugKeyword(text) {
            return this.extractProductKeyword(text);
        },

        pickFirstImageUrlFromProduct(product) {
            if (!this.isPlainObject(product)) return '';
            const candidates = [product.image_url, product.logoUrl, product.logo, product.drugLogo];
            if (Array.isArray(product.image_urls)) candidates.push(...product.image_urls);
            if (Array.isArray(product.picUrlList)) candidates.push(...product.picUrlList);

            for (let i = 0; i < candidates.length; i += 1) {
                const url = this.text(candidates[i]);
                if (/^https?:\/\//i.test(url)) return url;
            }
            return '';
        },

        buildDrugPrompt(basePrompt, product) {
            const prompt = this.extractTextLike(basePrompt) || '请基于药品信息生成宣传图';
            if (!this.isPlainObject(product)) return prompt;
            const promptText = this.text(prompt);

            const toPriceText = (value) => {
                if (value === null || value === undefined || value === '') return '';
                const num = Number(value);
                if (Number.isFinite(num)) return String(num);
                const text = this.text(value);
                return text;
            };

            const pickDefaultPrice = () => {
                const candidates = [
                    product.unitPrice,
                    product.chainPrice,
                    product.unitPrice1,
                    product.unitPrice2,
                    product.unitPrice7,
                    product.unitPrice9
                ];
                for (let i = 0; i < candidates.length; i += 1) {
                    const p = toPriceText(candidates[i]);
                    if (p) return p;
                }
                return '';
            };

            const facts = [];
            const pushFact = (label, value) => {
                const v = this.text(value);
                if (v) facts.push(`${label}：${v}`);
            };
            const userAsked = (pattern) => pattern.test(promptText);

            pushFact('价格', pickDefaultPrice());
            pushFact('商品名称', product.drugName || product.appName);
            pushFact('商品规格', product.pack);
            pushFact('效期', product.validDate || product.endDateStr);

            if (userAsked(/批准文号|国药准字/i)) pushFact('批准文号', product.approval);
            if (userAsked(/厂家|厂商|生产企业|生产厂家/i)) pushFact('厂家', product.factoryName);
            if (userAsked(/商品编码|药品编码|编码|货号|sku|spu/i)) pushFact('商品编码', product.provDrugCode);

            const rules = [
                '如果用户明确指定了字段值（如价格、名称、规格、效期等），以用户指定为准。',
                '用户未指定时，默认只使用：价格、商品名称、商品规格、效期。',
                '批准文号、厂家、商品编码等其它查询字段默认不用于海报；只有用户明确要求展示时才使用。',
                '仅使用可确认的信息，不编造缺失字段。'
            ];

            if (facts.length === 0) {
                return `${prompt}\n\n【生成规则】\n- ${rules.join('\n- ')}`;
            }

            return `${prompt}\n\n【生成规则】\n- ${rules.join('\n- ')}\n\n【药品查询信息】\n- ${facts.join('\n- ')}`;
        },

        register(skill) {
            if (!this.isPlainObject(skill) || !this.text(skill.id)) return false;

            const normalized = {
                id: this.text(skill.id),
                tools: Array.isArray(skill.tools) ? skill.tools.map((x) => this.text(x)).filter(Boolean) : ['*'],
                priority: Number.isFinite(Number(skill.priority)) ? Number(skill.priority) : 100,
                promptGuidance: this.text(skill.promptGuidance),
                beforeExecute: typeof skill.beforeExecute === 'function' ? skill.beforeExecute : null,
                afterExecute: typeof skill.afterExecute === 'function' ? skill.afterExecute : null
            };

            const index = this.state.skills.findIndex((x) => x.id === normalized.id);
            if (index >= 0) {
                this.state.skills[index] = normalized;
            } else {
                this.state.skills.push(normalized);
            }

            this.state.skills.sort((a, b) => a.priority - b.priority);
            return true;
        },

        loadDefinitions() {
            const defs = Array.isArray(window.ToolSkillDefinitions) ? window.ToolSkillDefinitions : [];
            defs.forEach((skill) => {
                const id = this.text(skill?.id);
                if (!id || this.state.loadedSkillIds.has(id)) return;
                if (this.register(skill)) this.state.loadedSkillIds.add(id);
            });
        },

        getMatchedSkills(toolId) {
            const id = this.text(toolId);
            return this.state.skills.filter((skill) => {
                if (!Array.isArray(skill.tools) || skill.tools.length === 0) return true;
                return skill.tools.includes('*') || skill.tools.includes(id);
            });
        },

        buildSystemPromptExtension() {
            this.loadDefinitions();
            const lines = this.state.skills.map((x) => this.text(x.promptGuidance)).filter(Boolean);
            const unique = Array.from(new Set(lines));
            if (unique.length === 0) return '';
            return ['[Skill路由规则]', ...unique].join('\n\n');
        },

        buildRuntimeContext(toolId, params, context = {}) {
            const runtime = this.isPlainObject(context) ? { ...context } : {};
            runtime.toolId = this.text(toolId);
            runtime.latestUserText = this.getLatestUserText();
            runtime.routingText = this.getRoutingText(params);
            return runtime;
        },

        async beforeExecute(toolId, params, context = {}) {
            this.loadDefinitions();
            let nextParams = this.isPlainObject(params) ? { ...params } : params;
            const runtime = this.buildRuntimeContext(toolId, nextParams, context);
            const skills = this.getMatchedSkills(toolId);
            const artifacts = [];

            for (let i = 0; i < skills.length; i += 1) {
                const skill = skills[i];
                if (typeof skill.beforeExecute !== 'function') continue;

                const out = await skill.beforeExecute({
                    toolId,
                    params: nextParams,
                    context: runtime,
                    center: this
                });

                if (!this.isPlainObject(out)) continue;

                if (out.blocked === true) {
                    return {
                        blocked: true,
                        error: this.text(out.error) || '工具调用被 skill 策略阻止',
                        suggestedTool: this.text(out.suggestedTool)
                    };
                }

                if (Object.prototype.hasOwnProperty.call(out, 'params')) {
                    nextParams = out.params;
                }

                if (Array.isArray(out.artifacts)) {
                    out.artifacts.forEach((item) => {
                        if (this.isPlainObject(item)) artifacts.push(item);
                    });
                }
            }

            return { blocked: false, params: nextParams, artifacts };
        },

        async afterExecute(toolId, params, result, context = {}) {
            this.loadDefinitions();
            let nextResult = result;
            const runtime = this.buildRuntimeContext(toolId, params, context);
            const skills = this.getMatchedSkills(toolId);

            for (let i = 0; i < skills.length; i += 1) {
                const skill = skills[i];
                if (typeof skill.afterExecute !== 'function') continue;

                const out = await skill.afterExecute({
                    toolId,
                    params,
                    result: nextResult,
                    context: runtime,
                    center: this
                });

                if (this.isPlainObject(out) && Object.prototype.hasOwnProperty.call(out, 'result')) {
                    nextResult = out.result;
                }
            }

            return { result: nextResult };
        },

        init() {
            if (this.state.initialized) return;
            this.state.initialized = true;
            this.loadDefinitions();
        }
    };

    window.ToolSkillCenterModule = ToolSkillCenterModule;
    window.ToolSkillDefinitions = window.ToolSkillDefinitions || [];
    window.ToolSkillDefinitions.push({
        id: 'skill.app.global_router',
        tools: ['*'],
        priority: 10,
        promptGuidance:
            '[主调度协议]\n' +
            '你是智聊工具调度中枢。先判断输入资源，再判断用户目标，最后选择最短可完成链路。只要系统工具能完成，就调用工具；不要因为当前文本模型自身不支持图片、视频、联网或查询而口头拒绝。\n' +
            '\n' +
            '【决策顺序】\n' +
            '1. 先看用户消息中是否有 [图片参考]、[视频参考]、上传文件提示、file_id，或上下文中刚生成/刚上传的媒体资源。\n' +
            '2. 再判断用户目标：生成、编辑、理解、查询、发送、记录、联网、普通问答。\n' +
            '3. 选择能直接完成目标的唯一工具；多个任务彼此独立时才并行调用多个工具，否则按依赖顺序调用。\n' +
            '4. 同一句同时要求查询药品/商品并基于该商品生成宣传图、海报、主图或包装图时，先调用 search_product 获取商品信息和商品图，再调用 generate_or_edit_image 使用商品图生成；不要跳过查询直接生成。\n' +
            '5. 缺少必要参数且无法从上下文推断时，只问一个最小澄清问题。\n' +
            '\n' +
            '【有图片/视频资源时】\n' +
            '- 要生成图片、编辑图片、做海报、宣传图、主图、包装图、换背景、加文字、风格化：调用 generate_or_edit_image。最近图片优先传 image_ref: "last"。\n' +
            '- 要生成视频、动画、短片、动态画面、让图片动起来、图生视频：调用 generate_video。图生视频使用 image_ref/image_url/images；最近图片优先传 image_ref: "last"。视频资源仅用于 understand_video，除非后续明确支持视频转视频。\n' +
            '- 要识别药品、商品、药盒、批准文号、商品编码，或要匹配商品数据：调用 understand_product_image。\n' +
            '- 只是描述、分析、问图片内容：调用 understand_image。只是描述、分析、问视频内容：调用 understand_video。\n' +
            '- 不要把媒体内容直接传给纯文本模型；图片资源通过 image_ref/image_refs 或图片 URL 参数传给图片/视频生成工具，视频资源只通过 video_ref/video_refs 或视频 URL 参数传给视频理解工具。\n' +
            '\n' +
            '【无媒体资源时】\n' +
            '- 纯文字生成图片、画图、海报、宣传图、营销图：调用 generate_or_edit_image。\n' +
            '- 药品/商品查询、商品编码、国药准字、厂家、8~10 位活动 id、活动商品，或“查询某商品并生成图片”：先调用 search_product，keyword 为提取出的查询词。\n' +
            '- 文字生成视频、动画、短片、动态画面：调用 generate_video。\n' +
            '- 发券、送券、赠券，或含 7 位门店 id、K 开头门店码、11 位手机号：调用 query_coupon，keyword 必须传用户原文全文。\n' +
            '- 查看活动、活动列表、有哪些优惠券、共享优惠券：调用 query_coupon，可不传 keyword。\n' +
            '- 仅查询商品、药品、商品编码、国药准字、厂家、8~10 位活动 id、活动商品：调用 search_product，keyword 为提取出的查询词。\n' +
            '- 上传文件/附件/文档/表格/PDF 内容问题：先调用 get_file_list，再按需读文件或搜索文件内容。\n' +
            '- 记住、保存、查询、修改、删除账号密码或备忘信息：调用 manage_notebook_node。\n' +
            '- 找系统内工具、网址、入口、登录地址：先调用 manage_tool_center_item。\n' +
            '- 明确要求联网、网页搜索、最新、实时、新闻：调用 search_web。明确给出 URL：调用 fetch_web_page。\n' +
            '- 数据可视化、统计图、柱状图、折线图、饼图：调用 generate_chart_from_statistics。\n' +
            '- 上述都不匹配时，正常文本回答。\n' +
            '\n' +
            '【冲突优先级】\n' +
            '- 媒体生成 > 媒体理解。\n' +
            '- 药品/商品图片识别 > 普通图片理解。\n' +
            '- 发券信号（7 位门店 id、K 开头门店码、11 位手机号、明确发券动词） > 商品查询。\n' +
            '- 活动 id 查商品、商品编码、国药准字、药品名、厂家名 > 发券。\n' +
            '- 工具中心检索 > 联网搜索，除非用户明确要求联网。\n' +
            '\n' +
            '【媒体产物交付】\n' +
            '- 图片、视频、图表纯生成时使用 delivery_mode=card_only，结果由前端卡片直接展示，不要再文字复述链接。\n' +
            '- 用户要求生成后继续分析、解读、总结、写文案、写报告，或要求把结果放进回答中的指定位置时，使用 delivery_mode=await_then_reply。\n' +
            '- await_then_reply 完成后，系统会提供 artifact_id 和 [[media:...]] 占位符；需要插入媒体结果时只输出该占位符，不要输出原始链接、data URL、base64 或 Markdown 图片。'
    });

    ToolSkillCenterModule.init();
})();



