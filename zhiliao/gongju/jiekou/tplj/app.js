function initTpljToolModule() {
    if (!window.ToolRegistry || !window.GongjuApi || !window.ZhiLiaoModule) {
        setTimeout(initTpljToolModule, 120);
        return;
    }

    ToolRegistry.register({
        id: 'understand_product_image',
        name: '图片理解',
        command: '@图片理解',
        icon: 'fa-solid fa-camera-retro',
        registerType: 'ai',
        description: '识别上传图片中的药品/商品关键信息，并自动匹配商品数据返回。',
        parameters: {
            type: 'object',
            properties: {
                keyword: {
                    type: 'string',
                    description: '可选，辅助关键词（如药品名/商品编码/批准文号）'
                },
                image_url: {
                    type: 'string',
                    description: '可选，图片 URL（未上传图片时可直接传）'
                },
                image_urls: {
                    type: 'array',
                    description: '可选，多个图片 URL'
                },
                images: {
                    type: 'array',
                    description: '可选，图片对象列表，格式 [{"image_url":"..."}]'
                },
                image_ref: {
                    type: 'string',
                    description: '可选，引用会话图片资源，如 last、img_3'
                },
                image_refs: {
                    type: 'array',
                    description: '可选，多个会话图片引用，如 ["last","img_2"]'
                }
            },
            required: []
        },
        handler: (params) => TpljToolModule.handleQuery(params)
    });

    window.ZhiLiaoLog?.debug?.('TpljToolModule registered: understand_product_image');
}

const TpljToolModule = {
    config: {
        systemPrompt: `你是药品图片识别专家，请从图片中提取可检索药品/商品的核心信息。

请只返回 JSON：{"code":"","drugId":"","approval":"","name":"","factory":""}

字段说明：
- code: 商品编码（优先字母+数字编码）
- drugId: 药品ID（纯数字）
- approval: 批准文号（如国药准字）
- name: 药品名称（通用名或商品名）
- factory: 生产厂家（完整企业名）

只填写你能从图片中确认的信息，不确定留空。`,
        userPrompt: '请识别图片中的药品/商品信息，并严格按 JSON 返回可识别字段。',
        maxTokens: 300,
        temperature: 0.2
    },

    text(value) {
        return typeof value === 'string' ? value.trim() : (value == null ? '' : String(value).trim());
    },

    isPlainObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    },

    normalizeKeyword(value) {
        return this.text(value);
    },

    isHttpUrl(value) {
        return /^https?:\/\//i.test(this.text(value));
    },

    isDataImage(value) {
        return /^data:image\/[a-z0-9.+-]+;base64,/i.test(this.text(value));
    },

    isValidImageUrl(value) {
        return this.isHttpUrl(value) || this.isDataImage(value);
    },

    getUploadedImageFiles() {
        const uploaded = Array.isArray(window.ZhiLiaoModule?.state?.uploadedFiles)
            ? window.ZhiLiaoModule.state.uploadedFiles
            : [];
        return uploaded.filter((f) => String(f?.type || '').startsWith('image/'));
    },

    clearUploadedImages() {
        if (window.ZhiLiaoModule?.state) window.ZhiLiaoModule.state.uploadedFiles = [];
        window.ZhiLiaoBujuModule?.updateFileTags?.([]);
    },

    normalizeImageUrls(params = {}) {
        const out = [];
        const seen = new Set();
        const append = (value) => {
            const url = this.text(value);
            if (!this.isValidImageUrl(url) || seen.has(url)) return;
            seen.add(url);
            out.push(url);
        };

        append(params.image_url);
        if (Array.isArray(params.image_urls)) {
            params.image_urls.forEach(append);
        }
        if (Array.isArray(params.images)) {
            params.images.forEach((item) => {
                if (this.isPlainObject(item)) {
                    append(item.image_url || item.url);
                } else {
                    append(item);
                }
            });
        }
        const appendRef = (value) => {
            const token = this.text(value);
            if (!token) return;
            const resolved = window.ZhiLiaoModule?.resolveMediaRef?.('image', token) ||
                window.ShengtuToolModule?.resolveImageRefToken?.(token) ||
                null;
            append(resolved?.url || resolved?.image_url || '');
        };
        appendRef(params.image_ref);
        if (Array.isArray(params.image_refs)) {
            params.image_refs.forEach(appendRef);
        }

        return out;
    },

    async buildUserContent(keyword, imageFiles = [], directImageUrls = []) {
        const extraKeyword = this.text(keyword);
        const promptText = extraKeyword
            ? `${this.config.userPrompt}\n\n辅助关键词：${extraKeyword}`
            : this.config.userPrompt;

        if (Array.isArray(imageFiles) && imageFiles.length > 0) {
            const parseData = await window.ZhiLiaoModule.parseFiles(imageFiles, null, {
                includeResults: false
            });
            const fileIds = Array.isArray(parseData?.fileIds) ? parseData.fileIds : [];
            return window.ZhiLiaoModule.buildMultimodalContent(promptText, imageFiles, fileIds);
        }

        const content = [{ type: 'text', text: promptText }];
        directImageUrls.forEach((url) => {
            content.push({
                type: 'image_url',
                image_url: { url }
            });
        });
        return content;
    },

    async resolveModelRequest(messages = []) {
        if (!window.ZhiLiaoMoxingXieyiGongchangModule?.buildRequest) {
            throw new Error('模型协议工厂未加载');
        }

        const request = await window.ZhiLiaoMoxingXieyiGongchangModule.buildRequest({
            capability: 'image_understanding',
            messages,
            systemPrompt: '',
            maxTokens: this.config.maxTokens,
            temperature: this.config.temperature,
            stream: false,
            enableThinking: false,
            enableTools: false
        });

        return {
            request,
            routeType: 'image_understanding',
            model: this.text(request?.modelOption?.model),
            configId: this.text(request?.modelOption?.configId),
            configName: this.text(request?.modelOption?.configName)
        };
    },

    toRequestErrorMessage(response, responseJson, responseText) {
        const fromJson = this.text(
            responseJson?.error?.message ||
            responseJson?.message ||
            responseJson?.detail ||
            responseJson?.error ||
            ''
        );
        if (fromJson) return fromJson;

        const fromText = this.text(responseText);
        if (fromText) return fromText.length > 280 ? `${fromText.slice(0, 280)}...` : fromText;

        return `HTTP ${Number(response?.status || 0)}`;
    },

    tryParseJson(text) {
        const raw = this.text(text);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    },

    async callVisionModel(userContent) {
        const messages = [
            { role: 'system', content: this.config.systemPrompt },
            { role: 'user', content: userContent }
        ];

        const resolved = await this.resolveModelRequest(messages);
        const request = resolved.request;

        const response = await fetch(request.endpoint, {
            method: 'POST',
            headers: request.headers,
            body: JSON.stringify(request.requestBody)
        });

        const responseText = await response.text().catch(() => '');
        const responseJson = this.tryParseJson(responseText);

        if (!response.ok) {
            throw new Error(this.toRequestErrorMessage(response, responseJson, responseText));
        }

        const parsed = responseJson || {};
        const rawBody = parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'body')
            ? parsed.body
            : parsed;

        if (!window.ZhiLiaoMoxingXieyiGongchangModule?.parseResponseContent) {
            throw new Error('模型响应解析器未加载');
        }

        const content = window.ZhiLiaoMoxingXieyiGongchangModule.parseResponseContent(
            request.capability || 'image_understanding',
            rawBody
        );

        return {
            content: this.text(content),
            routeType: resolved.routeType,
            model: resolved.model,
            configId: resolved.configId,
            configName: resolved.configName
        };
    },

    parseResponse(aiResponse) {
        const fallback = { code: '', drugId: '', approval: '', name: '', factory: '' };
        const text = this.text(aiResponse);
        if (!text) return fallback;

        try {
            const clean = text
                .replace(/```json\s*/gi, '')
                .replace(/```\s*/g, '')
                .trim();
            const match = clean.match(/\{[\s\S]*\}/);
            if (match) {
                const obj = JSON.parse(match[0]);
                return { ...fallback, ...obj };
            }
        } catch (_error) {
            // ignore and fallback below
        }

        return { ...fallback, name: text };
    },

    buildCandidates(keyword, info) {
        const candidates = [];
        const push = (value, type) => {
            const kw = this.text(value);
            if (!kw) return;
            if (candidates.some((item) => item.keyword === kw)) return;
            candidates.push({ keyword: kw, type });
        };

        const isNotPrice = (value) => {
            const raw = this.text(value);
            if (!raw) return false;
            if (/^\d+\.\d+$/.test(raw)) return false;
            if (/^[¥￥]\d/.test(raw)) return false;
            return true;
        };

        push(keyword, '用户指定');
        if (isNotPrice(info?.code)) push(info.code, '商品编码');
        if (isNotPrice(info?.drugId)) push(info.drugId, '药品ID');
        if (this.text(info?.approval).length >= 5 && isNotPrice(info?.approval)) push(info.approval, '批准文号');
        push(info?.name, '药品名称');
        push(info?.factory, '生产厂家');

        return candidates;
    },

    async queryByCandidates(candidates = []) {
        for (let i = 0; i < candidates.length; i += 1) {
            const item = candidates[i];
            const result = await window.GongjuApi.searchProducts(item.keyword, [], -1, {
                includeImages: true
            });

            if (!result?.success || !Array.isArray(result.data) || result.data.length === 0) {
                continue;
            }

            const products = result.data.slice();
            products.sort((a, b) => {
                const costA = parseFloat(a?.totalCost) || 0;
                const costB = parseFloat(b?.totalCost) || 0;
                return costB - costA;
            });

            return {
                success: true,
                keyword: item.keyword,
                type: item.type,
                products,
                summary: result.summary || null
            };
        }

        return { success: false, error: '暂未匹配到商品信息' };
    },

    extractFirstImageUrl(product) {
        if (!this.isPlainObject(product)) return '';

        const candidates = [];
        const add = (value) => {
            const url = this.text(value);
            if (!this.isHttpUrl(url)) return;
            candidates.push(url);
        };

        add(product.image_url);
        add(product.logoUrl);
        add(product.logo);
        add(product.drugLogo);
        if (Array.isArray(product.image_urls)) product.image_urls.forEach(add);
        if (Array.isArray(product.picUrlList)) product.picUrlList.forEach(add);

        return candidates[0] || '';
    },

    addUserMessageWithImages(text, imageFiles = []) {
        const container = document.getElementById('message-container');
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'user-message';

        const textSpan = document.createElement('span');
        textSpan.textContent = text;
        div.appendChild(textSpan);

        if (Array.isArray(imageFiles) && imageFiles.length > 0) {
            const imageContainer = document.createElement('div');
            imageContainer.style.cssText = 'display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;';

            imageFiles.forEach((file) => {
                const img = document.createElement('img');
                const url = URL.createObjectURL(file);
                img.src = url;
                img.style.cssText = 'max-width:60px;max-height:60px;border-radius:4px;object-fit:cover;';
                img.className = 'yulan-clickable';
                imageContainer.appendChild(img);
            });

            div.appendChild(imageContainer);
        }

        container.appendChild(div);
    },

    async handleQuery(params) {
        const base = typeof params === 'string' ? { keyword: params } : (params || {});
        const fromAI = base._fromAI === true;
        const keyword = this.normalizeKeyword(base.keyword);

        const uploadedImages = this.getUploadedImageFiles();
        const directImageUrls = this.normalizeImageUrls(base);

        if (uploadedImages.length === 0 && directImageUrls.length === 0) {
            if (!fromAI) {
                window.ZhiLiaoModule?.addUserMessage?.('@图片理解');
                const container = window.ZhiLiaoModule?.createStreamingMessage?.().textContainer || null;
                if (container) {
                    container.innerHTML = '<p>请先上传图片，或传入 image_url 后再进行图片理解。</p>';
                }
                window.ZhiLiaoModule?.scrollToBottom?.();
            }
            return { success: false, error: '缺少图片输入：请上传图片或传入 image_url/image_urls' };
        }

        if (!fromAI) {
            const title = keyword ? `@图片理解 ${keyword}` : '@图片理解';
            if (uploadedImages.length > 0) {
                this.addUserMessageWithImages(title, uploadedImages);
            } else {
                window.ZhiLiaoModule?.addUserMessage?.(title);
            }
        }

        const imageFilesSnapshot = uploadedImages.slice();
        if (imageFilesSnapshot.length > 0) {
            this.clearUploadedImages();
        }

        let statusContainer = null;
        if (!fromAI) {
            statusContainer = window.ZhiLiaoModule?.createStreamingMessage?.().textContainer || null;
            if (statusContainer) {
                statusContainer.innerHTML = '<span style="color:#666;"><i class="fa-solid fa-spinner fa-spin"></i> 正在识别图片...</span>';
                window.ZhiLiaoModule?.scrollToBottom?.();
            }
        }

        try {
            const userContent = await this.buildUserContent(keyword, imageFilesSnapshot, directImageUrls);
            const aiResult = await this.callVisionModel(userContent);
            const recognized = this.parseResponse(aiResult.content);
            const candidates = this.buildCandidates(keyword, recognized);

            if (candidates.length === 0) {
                throw new Error('未识别到可检索的药品信息');
            }

            if (statusContainer) {
                statusContainer.innerHTML = '<span style="color:#666;"><i class="fa-solid fa-spinner fa-spin"></i> 正在匹配商品信息...</span>';
                window.ZhiLiaoModule?.scrollToBottom?.();
            }

            const matched = await this.queryByCandidates(candidates);
            if (!matched.success) {
                throw new Error(matched.error || '暂未匹配到商品信息');
            }

            if (statusContainer) {
                statusContainer.closest('.system-message')?.remove();
            }

            if (!fromAI && window.ChaxunYsModule?.renderResults) {
                window.ChaxunYsModule.renderResults(matched.products, matched.summary);
            }

            const imageUrl = this.extractFirstImageUrl(matched.products[0]);

            return {
                success: true,
                count: matched.products.length,
                products: matched.products,
                summary: matched.summary,
                render_cards: true,
                image_url: imageUrl,
                description: imageUrl ? '商品图片（图片理解返回）' : '',
                recognized,
                matched_keyword: matched.keyword,
                matched_type: matched.type,
                model_route: aiResult.routeType,
                model: aiResult.model,
                model_config_id: aiResult.configId,
                model_config_name: aiResult.configName
            };
        } catch (error) {
            const message = this.text(error?.message || error) || '图片理解失败';
            if (statusContainer) {
                statusContainer.innerHTML = `<p style="color:#ef4444;">${message}</p>`;
                window.ZhiLiaoModule?.scrollToBottom?.();
            }
            return { success: false, error: message };
        }
    }
};

window.TpljToolModule = TpljToolModule;
initTpljToolModule();
