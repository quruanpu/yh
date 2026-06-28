(function registerImageCreateEditSkill() {
    function isHttpUrl(text) {
        return /^https?:\/\//i.test(String(text || '').trim());
    }

    function isPosterIntent(text) {
        return /宣传图|海报|主图|包装图|详情图|商品图|药品图|营销图|促销图/i.test(String(text || ''));
    }

    function needsProductImageContext(text) {
        return /药品|药盒|药物|商品|产品|货品|商品图|药品图|主图|包装图|商品编码|spu|sku/i.test(String(text || ''));
    }

    function firstProduct(result) {
        const list = Array.isArray(result?.products) ? result.products : [];
        const firstCardIndex = Number(result?.first_card_index);
        if (Number.isInteger(firstCardIndex) && firstCardIndex >= 0 && firstCardIndex < list.length) {
            return list[firstCardIndex];
        }
        return list.length > 0 ? list[0] : null;
    }

    function collectImageRefs(result) {
        const refs = [];
        const push = (value) => {
            const ref = String(value || '').trim();
            if (!ref || refs.includes(ref)) return;
            refs.push(ref);
        };
        push(result?.first_card_image_ref);
        push(result?.image_ref);
        if (Array.isArray(result?.image_refs)) result.image_refs.forEach(push);
        return refs;
    }

    function parseJsonSafe(raw) {
        try {
            return JSON.parse(String(raw || ''));
        } catch {
            return null;
        }
    }

    function hasDirectImageSource(params = {}) {
        const imageUrl = String(params?.image_url || '').trim();
        if (/^https?:\/\//i.test(imageUrl)) return true;

        if (Array.isArray(params?.image_urls)) {
            for (let i = 0; i < params.image_urls.length; i += 1) {
                const url = String(params.image_urls[i] || '').trim();
                if (/^https?:\/\//i.test(url)) return true;
            }
        }

        if (Array.isArray(params?.images)) {
            for (let i = 0; i < params.images.length; i += 1) {
                const item = params.images[i];
                if (typeof item === 'string' && /^https?:\/\//i.test(item.trim())) return true;
                if (item && typeof item === 'object' && /^https?:\/\//i.test(String(item.image_url || item.url || '').trim())) {
                    return true;
                }
            }
        }

        return false;
    }

    function buildSizeFromWidthHeight(params = {}) {
        const width = Number(params?.width);
        const height = Number(params?.height);
        if (!Number.isFinite(width) || !Number.isFinite(height)) return '';
        if (width <= 0 || height <= 0) return '';
        return `${Math.floor(width)}x${Math.floor(height)}`;
    }

    function collectDirectImageItems(params = {}) {
        const out = [];
        const seen = new Set();
        const append = (raw) => {
            const url = String(raw || '').trim();
            if (!/^https?:\/\//i.test(url)) return;
            if (seen.has(url)) return;
            seen.add(url);
            out.push({ image_url: url });
        };

        append(params?.image_url);

        if (Array.isArray(params?.image_urls)) {
            for (let i = 0; i < params.image_urls.length; i += 1) {
                append(params.image_urls[i]);
            }
        }

        if (Array.isArray(params?.images)) {
            for (let i = 0; i < params.images.length; i += 1) {
                const item = params.images[i];
                if (typeof item === 'string') {
                    append(item);
                    continue;
                }
                if (item && typeof item === 'object') {
                    append(item.image_url || item.url);
                }
            }
        }

        return out;
    }

    function normalizeRefTokens(params = {}) {
        const tokens = [];
        const pushTokens = (raw) => {
            if (Array.isArray(raw)) {
                for (let i = 0; i < raw.length; i += 1) {
                    const t = String(raw[i] || '').trim();
                    if (t) tokens.push(t);
                }
                return;
            }
            const text = String(raw || '').trim();
            if (!text) return;
            const parts = text.split(/[,\n;]/g);
            for (let i = 0; i < parts.length; i += 1) {
                const t = String(parts[i] || '').trim();
                if (t) tokens.push(t);
            }
        };

        pushTokens(params?.image_ref);
        pushTokens(params?.image_refs);
        return tokens;
    }

    function isLikelyValidRefToken(token) {
        const t = String(token || '').trim().toLowerCase();
        if (!t) return false;
        if (t === 'last' || t === 'latest') return true;
        return /^img_[1-9]\d*$/.test(t);
    }

    function pushCandidate(candidates, value) {
        const key = String(value || '').trim();
        if (!key) return;
        if (candidates.includes(key)) return;
        candidates.push(key);
    }

    function extractCodeLikeCandidates(text) {
        const out = [];
        const t = String(text || '');

        const mixed = t.match(/\b[A-Za-z]{1,8}\d{2,12}\b/g) || [];
        for (let i = 0; i < mixed.length; i += 1) {
            pushCandidate(out, mixed[i]);
        }

        const approval = t.match(/国药准字[0-9a-zA-Z]+/ig) || [];
        for (let i = 0; i < approval.length; i += 1) {
            pushCandidate(out, approval[i]);
        }

        const pureIds = t.match(/\b\d{5,12}\b/g) || [];
        for (let i = 0; i < pureIds.length; i += 1) {
            pushCandidate(out, pureIds[i]);
        }

        return out;
    }

    function buildLookupCandidates(next, context, center) {
        const candidates = [];
        const routingText = String(context?.routingText || context?.latestUserText || '');

        pushCandidate(candidates, next.keyword);
        if (typeof center.extractProductKeywordCandidates === 'function') {
            center.extractProductKeywordCandidates(routingText).forEach((item) => pushCandidate(candidates, item));
            center.extractProductKeywordCandidates(next.prompt).forEach((item) => pushCandidate(candidates, item));
        } else {
            pushCandidate(candidates, center.extractDrugKeyword(next.prompt));
            pushCandidate(candidates, center.extractDrugKeyword(routingText));
        }

        const fromPromptCode = extractCodeLikeCandidates(next.prompt);
        const fromRouteCode = extractCodeLikeCandidates(routingText);

        for (let i = 0; i < fromPromptCode.length; i += 1) {
            pushCandidate(candidates, fromPromptCode[i]);
        }
        for (let i = 0; i < fromRouteCode.length; i += 1) {
            pushCandidate(candidates, fromRouteCode[i]);
        }

        return candidates;
    }

    function readRecentProductContext(center) {
        const history = Array.isArray(window.ZhiLiaoModule?.state?.messageHistory)
            ? window.ZhiLiaoModule.state.messageHistory
            : [];

        for (let i = history.length - 1; i >= 0; i -= 1) {
            const item = history[i];
            if (!item || item.role !== 'tool') continue;

            const toolName = center.text(item.name);
            if (toolName !== 'search_product' && toolName !== 'understand_product_image') continue;

            const payload = parseJsonSafe(item.content);
            if (!payload || payload.success !== true) continue;

            const found = buildProductContextFromResult(toolName, payload, center);
            if (found) return found;
        }

        return null;
    }

    function buildProductContextFromResult(toolName, result, center) {
        if (toolName !== 'search_product' && toolName !== 'understand_product_image') return null;
        if (!result || result.success !== true) return null;

        const product = firstProduct(result);
        const imageUrl =
            center.text(result.first_card_image_url) ||
            center.text(result.image_url) ||
            center.pickFirstImageUrlFromProduct(product);
        const imageRefs = collectImageRefs(result);
        if (!isHttpUrl(imageUrl) && imageRefs.length === 0) return null;

        return {
            tool: toolName,
            imageUrl,
            imageRef: imageRefs[0] || '',
            imageRefs,
            product: product && typeof product === 'object' ? product : null
        };
    }

    function readPriorProductContext(context, center) {
        const list = Array.isArray(context?.priorToolResults) ? context.priorToolResults : [];
        for (let i = list.length - 1; i >= 0; i -= 1) {
            const item = list[i] || {};
            const found = buildProductContextFromResult(center.text(item.functionName), item.result, center);
            if (found) return found;
        }
        return null;
    }

    async function lookupProductByCandidates(candidates, context, center) {
        if (!window.ToolRegistry || typeof window.ToolRegistry.executeTool !== 'function') {
            return { ok: false, reason: 'tool_registry_unavailable' };
        }

        const maxAttempts = 2;
        const timeoutMs = 3000;
        const runWithTimeout = async (promise) => {
            let timeoutId = null;
            const timeout = new Promise(resolve => {
                timeoutId = setTimeout(() => resolve(null), timeoutMs);
            });
            try {
                return await Promise.race([promise, timeout]);
            } finally {
                if (timeoutId) clearTimeout(timeoutId);
            }
        };

        for (let i = 0; i < Math.min(candidates.length, maxAttempts); i += 1) {
            const keyword = center.text(candidates[i]);
            if (!keyword) continue;

            const result = await runWithTimeout(
                window.ToolRegistry.executeTool(
                    'search_product',
                    { keyword, _fromAI: true, _skipSkill: true },
                    { sessionId: context?.sessionId || '', sourceTool: 'generate_or_edit_image' }
                )
            );

            if (!result || result.success !== true) continue;

            const product = firstProduct(result);
            const imageUrl =
                center.text(result.first_card_image_url) ||
                center.text(result.image_url) ||
                center.pickFirstImageUrlFromProduct(product);
            const imageRefs = collectImageRefs(result);
            if (!isHttpUrl(imageUrl) && imageRefs.length === 0) continue;

            return {
                ok: true,
                keyword,
                result,
                imageUrl,
                imageRef: imageRefs[0] || '',
                imageRefs,
                product: product && typeof product === 'object' ? product : null
            };
        }

        return { ok: false, reason: 'no_matched_product' };
    }

    window.ToolSkillDefinitions = window.ToolSkillDefinitions || [];
    window.ToolSkillDefinitions.push({
        id: 'skill.tpsc.generate_or_edit_image',
        tools: ['generate_or_edit_image'],
        priority: 20,
        promptGuidance:
            '[图片生成/编辑规则]\n' +
            '- 用户要求画图、生图、生成海报/宣传图/主图/包装图/营销图，或要求改图、换背景、加文字、风格化：使用 generate_or_edit_image。\n' +
            '- 图表/统计可视化需求改用 generate_chart_from_statistics。\n' +
            '- 无参考图时 action=generate；有图片/参考图/蒙版/改图意图时 action=edit。\n' +
            '- 单张成品图一次调用；多元素合成到一张图也一次调用并在 prompt 描述布局；多张独立图片才多次调用。\n' +
            '- 刚上传或刚生成图片时，优先传 image_ref: "last"；直接 URL 可放入 images: [{"image_url":"..."}]。\n' +
            '- prompt 要整理为主体、风格、构图、画幅、关键细节；未指定尺寸时 size=auto。\n' +
            '- 药品/商品宣传图需要商品图时，先 search_product 或使用最近商品图片，再以 edit 生成。\n' +
            '- 基于查询商品生成海报时，默认只使用价格、商品名称、商品规格、效期；批准文号、厂家、商品编码等字段只有用户明确要求展示时才使用。\n' +
            '- 纯生成/编辑图片时 delivery_mode=card_only；用户要求生成后继续分析、说明、写文案或在回复中编排图片时 delivery_mode=await_then_reply。续写时如需插入图片，只输出系统提供的 [[media:...]] 占位符，不要输出图片链接、data URL 或 base64。',
        async beforeExecute({ params, context, center }) {
            const next = center.isPlainObject(params) ? { ...params } : {};
            const routingText = context?.routingText || context?.latestUserText || '';
            const posterIntent = isPosterIntent(routingText);
            const productImageContext = needsProductImageContext(routingText);

            if (!center.text(next.size)) {
                const fromWidthHeight = buildSizeFromWidthHeight(next);
                next.size = fromWidthHeight || 'auto';
            }

            delete next.width;
            delete next.height;

            if (center.isChartIntentText(routingText)) {
                return {
                    blocked: true,
                    suggestedTool: 'generate_chart_from_statistics',
                    error: '检测到图表需求，请改用 generate_chart_from_statistics。'
                };
            }

            const isDrugIntent = center.isDrugIntentText(routingText);
            const isEditIntent = center.isImageEditIntentText(next, routingText);
            let hasAnyImageSource = center.hasImageSource(next);
            let hasDirectSource = hasDirectImageSource(next);
            const refTokens = normalizeRefTokens(next);
            const hasInvalidRefOnly =
                refTokens.length > 0 &&
                !hasDirectSource &&
                refTokens.some((token) => !isLikelyValidRefToken(token));

            if (hasInvalidRefOnly) {
                delete next.image_ref;
                delete next.image_refs;
                hasAnyImageSource = center.hasImageSource(next);
                hasDirectSource = hasDirectImageSource(next);
            }

            const candidates = buildLookupCandidates(next, context, center);
            const hasProductLookupIntent = /查询|查一下|查找|搜索|检索|找一下/.test(String(routingText || '')) &&
                posterIntent &&
                candidates.length > 0;

            if (hasAnyImageSource && !hasProductLookupIntent) {
                if (isEditIntent || posterIntent || productImageContext) {
                    next.action = 'edit';
                }
                return { params: next };
            }

            if (!isDrugIntent && !productImageContext && !hasProductLookupIntent) {
                if (isEditIntent && hasDirectSource) return { params: next };
                return { params: next };
            }

            const applyProductImageContext = (source) => {
                const merged = { ...next };
                merged.action = 'edit';
                merged.prompt = center.buildDrugPrompt(next.prompt, source.product);
                const directImages = collectDirectImageItems(merged);
                const imageRefs = Array.isArray(source.imageRefs) ? source.imageRefs : [];
                if (source.imageRef || imageRefs.length > 0) {
                    merged.image_ref = source.imageRef || imageRefs[0];
                    if (imageRefs.length > 1) merged.image_refs = imageRefs;
                } else if (isHttpUrl(source.imageUrl) && !directImages.some((item) => item.image_url === source.imageUrl)) {
                    directImages.push({ image_url: source.imageUrl });
                }
                if (directImages.length > 0) {
                    merged.images = directImages;
                    delete merged.image_url;
                    delete merged.image_urls;
                }
                return { params: merged };
            };

            const priorProduct = readPriorProductContext(context, center);
            if (priorProduct && (isHttpUrl(priorProduct.imageUrl) || priorProduct.imageRef)) {
                return applyProductImageContext(priorProduct);
            }

            const recentProduct = readRecentProductContext(center);
            if (recentProduct && (isHttpUrl(recentProduct.imageUrl) || recentProduct.imageRef)) {
                return applyProductImageContext(recentProduct);
            }

            const lookup = await lookupProductByCandidates(candidates, context, center);
            if (lookup.ok) {
                const out = applyProductImageContext(lookup);
                return {
                    ...out,
                    artifacts: [{
                        type: 'tool_result',
                        tool: 'search_product',
                        result: lookup.result
                    }]
                };
            }

            if ((isDrugIntent || productImageContext || hasProductLookupIntent) && posterIntent && !hasAnyImageSource) {
                const hint = candidates.length > 0 ? `可尝试关键词：${candidates.slice(0, 3).join('、')}` : '请提供可查询的药品编码/药品名/批准文号';
                return {
                    blocked: true,
                    suggestedTool: 'search_product',
                    error: `未匹配到可用商品图，无法直接生成药品宣传图。${hint}`
                };
            }

            return { params: next };
        }
    });
})();
