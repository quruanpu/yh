(function setupMediaUnderstandingToolModule() {
    const MediaUnderstandingToolModule = {
        config: {
            imageSystemPrompt: '你是通用图片理解助手。请根据用户问题准确描述图片内容、关键信息、文字、场景和可见细节；不要编造不可见内容。',
            videoSystemPrompt: '你是通用视频理解助手。请根据用户问题准确描述视频内容、关键动作、场景、时间线和可见细节；不要编造不可见内容。',
            imageUserPrompt: '请理解这张图片，并回答用户问题。',
            videoUserPrompt: '请理解这个视频，并回答用户问题。',
            maxTokens: 1600,
            temperature: 0.2
        },

        text(value) {
            return typeof value === 'string' ? value.trim() : (value == null ? '' : String(value).trim());
        },

        isPlainObject(value) {
            return value && typeof value === 'object' && !Array.isArray(value);
        },

        isHttpUrl(value) {
            return /^https?:\/\//i.test(this.text(value));
        },

        isDataImageUrl(value) {
            return /^data:image\/[a-z0-9.+-]+;base64,/i.test(this.text(value));
        },

        isDataVideoUrl(value) {
            return /^data:video\/[a-z0-9.+-]+;base64,/i.test(this.text(value));
        },

        isValidMediaUrl(kind, value) {
            if (this.isHttpUrl(value)) return true;
            return kind === 'video' ? this.isDataVideoUrl(value) : this.isDataImageUrl(value);
        },

        normalizeTokenList(value) {
            if (Array.isArray(value)) {
                return value.map((item) => this.text(item)).filter(Boolean);
            }
            const single = this.text(value);
            if (!single) return [];
            return single.split(/[,\n;；，]/g).map((item) => this.text(item)).filter(Boolean);
        },

        appendUnique(out, seen, kind, value) {
            const url = this.text(value);
            if (!this.isValidMediaUrl(kind, url) || seen.has(url)) return;
            seen.add(url);
            out.push(url);
        },

        collectDirectMediaUrls(kind, params = {}) {
            const out = [];
            const seen = new Set();
            const directKey = kind === 'video' ? 'video_url' : 'image_url';
            const pluralKey = kind === 'video' ? 'video_urls' : 'image_urls';
            const listKey = kind === 'video' ? 'videos' : 'images';

            this.appendUnique(out, seen, kind, params[directKey]);
            if (Array.isArray(params[pluralKey])) {
                params[pluralKey].forEach((item) => this.appendUnique(out, seen, kind, item));
            }
            if (Array.isArray(params[listKey])) {
                params[listKey].forEach((item) => {
                    if (this.isPlainObject(item)) {
                        this.appendUnique(out, seen, kind, item[directKey] || item.url);
                    } else {
                        this.appendUnique(out, seen, kind, item);
                    }
                });
            }
            return out;
        },

        collectRefMediaUrls(kind, params = {}) {
            const out = [];
            const seen = new Set();
            const refKey = kind === 'video' ? 'video_ref' : 'image_ref';
            const refsKey = kind === 'video' ? 'video_refs' : 'image_refs';
            const tokens = [
                ...this.normalizeTokenList(params[refKey]),
                ...this.normalizeTokenList(params[refsKey])
            ];

            tokens.forEach((token) => {
                const resolved = window.ZhiLiaoModule?.resolveMediaRef?.(kind, token) ||
                    (kind === 'image' ? window.ShengtuToolModule?.resolveImageRefToken?.(token) : null) ||
                    null;
                this.appendUnique(out, seen, kind, resolved?.url || resolved?.image_url || resolved?.video_url || '');
            });
            return out;
        },

        getUploadedMediaFiles(kind) {
            const uploaded = Array.isArray(window.ZhiLiaoModule?.state?.uploadedFiles)
                ? window.ZhiLiaoModule.state.uploadedFiles
                : [];
            const prefix = kind === 'video' ? 'video/' : 'image/';
            return uploaded.filter((file) => String(file?.type || '').startsWith(prefix));
        },

        clearUploadedMediaFiles(kind) {
            if (!window.ZhiLiaoModule?.state) return;
            const prefix = kind === 'video' ? 'video/' : 'image/';
            window.ZhiLiaoModule.state.uploadedFiles = (window.ZhiLiaoModule.state.uploadedFiles || [])
                .filter((file) => !String(file?.type || '').startsWith(prefix));
            window.ZhiLiaoBujuModule?.updateFileTags?.(window.ZhiLiaoModule.state.uploadedFiles);
        },

        buildPrompt(kind, params = {}) {
            const question = this.text(params.question || params.prompt || params.keyword || params.text);
            const fallback = kind === 'video' ? this.config.videoUserPrompt : this.config.imageUserPrompt;
            return question || fallback;
        },

        async buildContent(kind, params = {}, uploadedFiles = [], directUrls = []) {
            const prompt = this.buildPrompt(kind, params);
            if (uploadedFiles.length > 0) {
                const parseData = await window.ZhiLiaoModule.parseFiles(uploadedFiles, null, {
                    includeResults: false
                });
                const fileIds = Array.isArray(parseData?.fileIds) ? parseData.fileIds : [];
                return window.ZhiLiaoModule.buildMultimodalContent(prompt, uploadedFiles, fileIds);
            }

            const mediaType = kind === 'video' ? 'video_url' : 'image_url';
            const mediaKey = kind === 'video' ? 'video_url' : 'image_url';
            const content = [{ type: 'text', text: prompt }];
            directUrls.forEach((url) => {
                content.push({
                    type: mediaType,
                    [mediaKey]: { url }
                });
            });
            return content;
        },

        async buildModelRequest(kind, messages = []) {
            if (!window.ZhiLiaoMoxingXieyiGongchangModule?.buildRequest) {
                throw new Error('模型协议工厂未加载');
            }

            const capability = kind === 'video' ? 'video_understanding' : 'image_understanding';
            const request = await window.ZhiLiaoMoxingXieyiGongchangModule.buildRequest({
                capability,
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
                capability,
                model: this.text(request?.modelOption?.model),
                configId: this.text(request?.modelOption?.configId),
                configName: this.text(request?.modelOption?.configName)
            };
        },

        parseJsonSafe(rawText) {
            try {
                return JSON.parse(String(rawText || ''));
            } catch {
                return null;
            }
        },

        parseGatewayError(response, responseJson, responseText) {
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

        async callUnderstandingModel(kind, userContent) {
            const systemPrompt = kind === 'video'
                ? this.config.videoSystemPrompt
                : this.config.imageSystemPrompt;
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ];
            const resolved = await this.buildModelRequest(kind, messages);
            const response = await fetch(resolved.request.endpoint, {
                method: 'POST',
                headers: resolved.request.headers,
                body: JSON.stringify(resolved.request.requestBody)
            });
            const responseText = await response.text().catch(() => '');
            const responseJson = this.parseJsonSafe(responseText);
            if (!response.ok) {
                throw new Error(this.parseGatewayError(response, responseJson, responseText));
            }

            const payload = responseJson && typeof responseJson === 'object' && Object.prototype.hasOwnProperty.call(responseJson, 'body')
                ? responseJson.body
                : (responseJson || {});
            const content = window.ZhiLiaoMoxingXieyiGongchangModule.parseResponseContent(
                resolved.capability,
                payload
            );

            return {
                content: this.text(content),
                capability: resolved.capability,
                model: resolved.model,
                config_id: resolved.configId,
                config_name: resolved.configName
            };
        },

        async understand(kind, params = {}) {
            const mediaKind = kind === 'video' ? 'video' : 'image';
            const fromAI = params?._fromAI === true;
            const uploadedFiles = this.getUploadedMediaFiles(mediaKind);
            const directUrls = [
                ...this.collectDirectMediaUrls(mediaKind, params),
                ...this.collectRefMediaUrls(mediaKind, params)
            ];
            const uniqueUrls = Array.from(new Set(directUrls));

            if (uploadedFiles.length === 0 && uniqueUrls.length === 0) {
                const label = mediaKind === 'video' ? '视频' : '图片';
                return { success: false, error: `缺少${label}输入：请上传${label}或传入资源引用。` };
            }

            if (!fromAI) {
                const title = mediaKind === 'video' ? '@视频理解' : '@图片理解';
                window.ZhiLiaoModule?.addUserMessage?.(title);
            }

            const fileSnapshot = uploadedFiles.slice();
            if (fileSnapshot.length > 0) this.clearUploadedMediaFiles(mediaKind);

            try {
                const userContent = await this.buildContent(mediaKind, params, fileSnapshot, uniqueUrls);
                const result = await this.callUnderstandingModel(mediaKind, userContent);
                return {
                    success: true,
                    media_kind: mediaKind,
                    answer: result.content,
                    content: result.content,
                    capability: result.capability,
                    model: result.model,
                    config_id: result.config_id,
                    config_name: result.config_name
                };
            } catch (error) {
                return {
                    success: false,
                    media_kind: mediaKind,
                    error: this.text(error?.message || error) || '媒体理解失败'
                };
            }
        },

        registerTools() {
            if (!window.ToolRegistry || this.state?.registered) return;
            this.state = this.state || {};
            ToolRegistry.register({
                id: 'understand_image',
                name: '通用图片理解',
                command: '@通用图片理解',
                icon: 'fa-solid fa-eye',
                registerType: 'ai',
                description: '通用理解图片内容，回答图片相关问题。商品/药品识别匹配请使用 understand_product_image。',
                parameters: {
                    type: 'object',
                    properties: {
                        question: { type: 'string', description: '可选，针对图片要回答的问题' },
                        prompt: { type: 'string', description: '可选，question 的别名' },
                        image_url: { type: 'string', description: '可选，图片 URL 或 data URL' },
                        image_urls: { type: 'array', description: '可选，多个图片 URL' },
                        images: { type: 'array', description: '可选，图片对象列表，格式如 [{"image_url":"..."}]' },
                        image_ref: { type: 'string', description: '可选，会话图片引用，如 last、img_3' },
                        image_refs: { type: 'array', description: '可选，多个会话图片引用，如 ["last","img_2"]' }
                    },
                    required: []
                },
                handler: async (toolParams) => this.understand('image', toolParams)
            });

            ToolRegistry.register({
                id: 'understand_video',
                name: '通用视频理解',
                command: '@通用视频理解',
                icon: 'fa-solid fa-film',
                registerType: 'ai',
                description: '通用理解视频内容，回答视频相关问题。',
                parameters: {
                    type: 'object',
                    properties: {
                        question: { type: 'string', description: '可选，针对视频要回答的问题' },
                        prompt: { type: 'string', description: '可选，question 的别名' },
                        video_url: { type: 'string', description: '可选，视频 URL 或 data URL' },
                        video_urls: { type: 'array', description: '可选，多个视频 URL' },
                        videos: { type: 'array', description: '可选，视频对象列表，格式如 [{"video_url":"..."}]' },
                        video_ref: { type: 'string', description: '可选，会话视频引用，如 last、vid_2' },
                        video_refs: { type: 'array', description: '可选，多个会话视频引用，如 ["last","vid_2"]' }
                    },
                    required: []
                },
                handler: async (toolParams) => this.understand('video', toolParams)
            });

            this.state.registered = true;
            window.ZhiLiaoLog?.debug?.('MediaUnderstandingToolModule registered: understand_image, understand_video');
        },

        init() {
            const tryRegister = () => {
                if (!window.ToolRegistry || !window.ZhiLiaoMoxingXieyiGongchangModule) {
                    setTimeout(tryRegister, 120);
                    return;
                }
                this.registerTools();
            };
            tryRegister();
        }
    };

    window.MediaUnderstandingToolModule = MediaUnderstandingToolModule;
    MediaUnderstandingToolModule.init();
})();
