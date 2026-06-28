(function setupShengtuToolModule() {
    const core = window.ShengtuToolCoreModule || {};
    const candidate = window.ShengtuToolCandidateModule || {};
    const http = window.ShengtuToolHttpModule || {};

    const ShengtuToolModule = {
        ...core,
        ...candidate,
        ...http,

        missingDependencies() {
            const required = [
                'text',
                'normalizeAction',
                'normalizeRoute',
                'resolveEndpoint',
                'getPrimaryImageConfig',
                'normalizeImages',
                'sanitizeBusinessParams',
                'validateBusinessParams',
                'resolveTimeoutMs',
                'postJson',
                'unwrapResponsePayload',
                'normalizeImageResponse',
                'parseResponseMessage'
            ];
            return required.filter((name) => typeof this[name] !== 'function');
        },

        isReady() {
            return this.missingDependencies().length === 0;
        },

        initImagePoolState() {
            if (!this.state || typeof this.state !== 'object') this.state = {};
            if (!Array.isArray(this.state.imagePool)) this.state.imagePool = [];
            if (!Number.isInteger(this.state.nextImageRefIndex) || this.state.nextImageRefIndex < 1) {
                this.state.nextImageRefIndex = 1;
            }
            if (!Number.isInteger(this.state.maxImagePoolSize) || this.state.maxImagePoolSize < 4) {
                this.state.maxImagePoolSize = 24;
            }
        },

        isValidImageUrl(value) {
            const url = this.text(value);
            if (!url) return false;
            if (/^https?:\/\//i.test(url)) return true;
            return /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(url);
        },

        getImageItemKey(item = {}) {
            const imageUrl = this.text(item?.image_url);
            if (imageUrl) return `url:${imageUrl}`;
            const fileId = this.text(item?.file_id);
            if (fileId) return `file:${fileId}`;
            const dataB64 = this.text(item?.data_b64);
            if (dataB64) return `b64:${dataB64.slice(0, 64)}:${dataB64.length}`;
            return '';
        },

        normalizeRefTokens(rawValue) {
            if (Array.isArray(rawValue)) {
                return rawValue.map((item) => this.text(item)).filter(Boolean);
            }
            const single = this.text(rawValue);
            if (!single) return [];
            return single
                .split(/[,\n;]/g)
                .map((item) => this.text(item))
                .filter(Boolean);
        },

        resolveImageRefToken(token) {
            const t = this.text(token);
            if (!t) return null;
            if (this.isValidImageUrl(t)) return { image_url: t, ref: '' };

            this.initImagePoolState();
            if (this.state.imagePool.length === 0) return null;

            const lowerToken = t.toLowerCase();
            if (lowerToken === 'last' || lowerToken === 'latest') {
                const last = this.state.imagePool[this.state.imagePool.length - 1];
                if (last?.image_url) return { image_url: last.image_url, ref: last.ref || '' };
                return null;
            }

            const byRef = this.state.imagePool.find((item) => this.text(item?.ref) === t);
            if (byRef?.image_url) return { image_url: byRef.image_url, ref: byRef.ref || '' };
            return null;
        },

        resolveImagesByRefs(params = {}) {
            const tokens = [
                ...this.normalizeRefTokens(params?.image_ref),
                ...this.normalizeRefTokens(params?.image_refs)
            ];
            const unresolved = [];
            const refs = [];
            const images = [];

            for (let i = 0; i < tokens.length; i += 1) {
                const hit = this.resolveImageRefToken(tokens[i]);
                if (!hit || !this.isValidImageUrl(hit.image_url)) {
                    unresolved.push(tokens[i]);
                    continue;
                }
                images.push({ image_url: hit.image_url });
                if (hit.ref) refs.push(hit.ref);
            }

            const merged = [];
            const seen = new Set();
            for (let i = 0; i < images.length; i += 1) {
                const url = this.text(images[i]?.image_url);
                if (!url || seen.has(url)) continue;
                seen.add(url);
                merged.push({ image_url: url });
            }

            const uniqueRefs = [];
            const refSet = new Set();
            for (let i = 0; i < refs.length; i += 1) {
                const ref = this.text(refs[i]);
                if (!ref || refSet.has(ref)) continue;
                refSet.add(ref);
                uniqueRefs.push(ref);
            }

            return {
                tokens,
                unresolved,
                images: merged,
                refs: uniqueRefs
            };
        },

        mergeImages(primary = [], secondary = []) {
            const merged = [];
            const seen = new Set();
            const append = (list) => {
                if (!Array.isArray(list)) return;
                for (let i = 0; i < list.length; i += 1) {
                    const item = list[i] || {};
                    const key = this.getImageItemKey(item);
                    if (!key || seen.has(key)) continue;
                    seen.add(key);
                    if (this.text(item.image_url)) {
                        merged.push({ image_url: this.text(item.image_url) });
                    } else if (this.text(item.file_id)) {
                        merged.push({ file_id: this.text(item.file_id) });
                    } else if (this.text(item.data_b64)) {
                        merged.push({
                            name: this.text(item.name) || `img_${merged.length + 1}.png`,
                            mime: this.text(item.mime) || 'image/png',
                            data_b64: this.text(item.data_b64)
                        });
                    }
                }
            };

            append(primary);
            append(secondary);
            return merged;
        },

        normalizeDirectImageInputs(params = {}) {
            const candidates = [];
            if (this.text(params?.image_url)) candidates.push(params.image_url);
            if (Array.isArray(params?.image_urls)) candidates.push(...params.image_urls);
            return this.normalizeImages(candidates);
        },

        storeImagesInPool(imageUrls = [], meta = {}) {
            this.initImagePoolState();
            const urls = Array.isArray(imageUrls) ? imageUrls : [];
            const refs = [];

            for (let i = 0; i < urls.length; i += 1) {
                const imageUrl = this.text(urls[i]);
                if (!this.isValidImageUrl(imageUrl)) continue;

                const existing = this.state.imagePool.find((item) => this.text(item?.image_url) === imageUrl);
                if (existing) {
                    existing.touched_at = Date.now();
                    existing.last_action = this.text(meta?.action);
                    existing.last_route = this.text(meta?.route);
                    existing.last_model = this.text(meta?.model);
                    refs.push(existing.ref);
                    continue;
                }

                const ref = `img_${this.state.nextImageRefIndex}`;
                this.state.nextImageRefIndex += 1;
                this.state.imagePool.push({
                    ref,
                    image_url: imageUrl,
                    created_at: Date.now(),
                    touched_at: Date.now(),
                    last_action: this.text(meta?.action),
                    last_route: this.text(meta?.route),
                    last_model: this.text(meta?.model)
                });
                refs.push(ref);
            }

            const maxSize = Number(this.state.maxImagePoolSize || 24);
            if (this.state.imagePool.length > maxSize) {
                this.state.imagePool = this.state.imagePool.slice(this.state.imagePool.length - maxSize);
            }

            window.SessionDB?.saveImagePool?.(this.state.imagePool);
            return refs.filter(Boolean);
        },

        buildImagePoolHint(limit = 6) {
            this.initImagePoolState();
            if (this.state.imagePool.length === 0) {
                return '当前会话暂无可用参考图。请先生成图片，或在本次编辑参数中直接传入 images。';
            }

            const recent = this.state.imagePool.slice(-Math.max(1, Number(limit || 6)));
            const refs = recent.map((item) => this.text(item?.ref)).filter(Boolean);
            if (refs.length === 0) {
                return '当前会话暂无可用参考图。';
            }

            const latestRef = refs[refs.length - 1];
            return `可用图片引用：${refs.join(', ')}。编辑时可传 image_ref: "last" 或 image_ref: "${latestRef}"。`;
        },

        async getSessionRecentImageItems(limit = 6) {
            try {
                const db = window.DBModule;
                const sessionId = this.text(window.ZhiLiaoModule?.state?.sessionId);
                if (!db || typeof db.getSessionFiles !== 'function' || !sessionId) return [];

                const files = await db.getSessionFiles(sessionId);
                if (!Array.isArray(files) || files.length === 0) return [];

                const out = [];
                const seen = new Set();
                for (let i = files.length - 1; i >= 0; i -= 1) {
                    const file = files[i] || {};
                    if (this.text(file.type).toLowerCase() !== 'image') continue;
                    const url = this.text(file.url);
                    if (!this.isValidImageUrl(url) || seen.has(url)) continue;
                    seen.add(url);
                    out.push({ image_url: url });
                    if (out.length >= Math.max(1, Number(limit || 6))) break;
                }
                return out;
            } catch {
                return [];
            }
        },

        buildSuccessResult(action, route, cfg, statusCode, image, payload, imageRefs = [], sizeMeta = null) {
            const imageUrls = Array.isArray(image?.image_urls)
                ? image.image_urls
                : (image?.image_url ? [image.image_url] : []);

            return {
                success: true,
                action,
                route,
                model: cfg.model,
                config_id: cfg.configId,
                config_name: cfg.configName,
                status_code: Number(statusCode || 200),
                image_url: image.image_url || '',
                image_urls: imageUrls,
                image_ref: this.text(imageRefs?.[0] || ''),
                image_refs: Array.isArray(imageRefs) ? imageRefs.filter((ref) => this.text(ref)) : [],
                description: action === 'edit' ? '图片编辑完成(,,･∀･)ﾉ゛' : '图片生成完成(,,･∀･)ﾉ゛',
                requested_size: this.text(sizeMeta?.input || ''),
                final_size: this.text(payload?.size || ''),
                size_adjusted: sizeMeta?.adjusted === true,
                size_adjust_reason: this.text(sizeMeta?.reason || ''),
                image_pool_hint: this.buildImagePoolHint(6),
                output: payload
            };
        },

        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms || 0))));
        },

        isRunningStatus(status = '') {
            const text = this.text(status).toLowerCase();
            if (!text) return true;
            return ['pending', 'queued', 'queueing', 'running', 'processing', 'in_progress', 'submitted', 'created', 'starting'].includes(text);
        },

        isFailedStatus(status = '') {
            const text = this.text(status).toLowerCase();
            return ['failed', 'fail', 'error', 'canceled', 'cancelled', 'rejected', 'timeout', 'expired'].includes(text);
        },

        async requestImage(endpoint, requestPayload, timeoutMs) {
            const response = await this.postJson(endpoint, requestPayload, timeoutMs);
            if (!response.ok) {
                const message = response.networkError || this.parseResponseMessage(response.status, response.json, response.text);
                return {
                    ok: false,
                    error: message,
                    statusCode: Number(response.status || 0),
                    payload: {},
                    image: { image_url: '', image_urls: [] },
                    task: {}
                };
            }

            const parsed = this.unwrapResponsePayload(response.json, response.text);
            if (parsed?.success === false) {
                return {
                    ok: false,
                    error: this.parseResponseMessage(response.status, parsed, response.text),
                    statusCode: Number(response.status || 200),
                    payload: parsed,
                    image: { image_url: '', image_urls: [] },
                    task: this.normalizeImageTask(parsed)
                };
            }
            return {
                ok: true,
                statusCode: Number(response.status || 200),
                payload: parsed,
                image: this.normalizeImageResponse(parsed, requestPayload),
                task: this.normalizeImageTask(parsed)
            };
        },

        async pollImageTask(endpoint, baseRequestPayload, cfg, initialTask, outputFormat) {
            const taskId = this.text(initialTask.task_id);
            const imageId = this.text(initialTask.image_id);
            if (!taskId && !imageId) return null;

            const intervalMs = 3000;
            const totalTimeoutMs = this.resolveTimeoutMs({
                timeout_ms: baseRequestPayload.options?.timeout_ms
            });
            const maxRounds = Math.max(1, Math.ceil(totalTimeoutMs / intervalMs));
            let lastResult = null;

            for (let round = 0; round < maxRounds; round += 1) {
                await this.sleep(intervalMs);
                const queryPayload = {
                    ...baseRequestPayload,
                    payload: {
                        model: cfg.model,
                        mode: 'query',
                        output_format: outputFormat || baseRequestPayload.payload?.output_format || 'png',
                        ...(imageId ? { image_id: imageId } : { task_id: taskId })
                    }
                };
                const result = await this.requestImage(endpoint, queryPayload, baseRequestPayload.options?.timeout_ms);
                lastResult = result;
                if (!result.ok) return result;
                if (result.image?.image_url) return result;
                if (this.isFailedStatus(result.task?.status)) return result;
                if (!this.isRunningStatus(result.task?.status)) return result;
            }

            if (lastResult) {
                lastResult.timedOut = true;
                return lastResult;
            }
            return {
                ok: true,
                timedOut: true,
                statusCode: 200,
                payload: {},
                image: { image_url: '', image_urls: [] },
                task: {
                    task_id: taskId,
                    image_id: imageId,
                    status: this.text(initialTask.status) || 'processing'
                }
            };
        },

        async generateOrEditImage(params = {}) {
            this.initImagePoolState();
            const missing = this.missingDependencies();
            if (missing.length > 0) {
                return { success: false, error: `生图工具模块未就绪：${missing.join(', ')}` };
            }

            let action = this.normalizeAction(params?.action);
            if (!action) {
                return { success: false, error: '缺少 action。请传入 generate 或 edit。' };
            }

            const normalizedParams = { ...(params || {}) };
            const directImages = this.normalizeDirectImageInputs(normalizedParams);
            if (directImages.length > 0) {
                normalizedParams.images = this.mergeImages(this.normalizeImages(normalizedParams.images), directImages);
                delete normalizedParams.image_url;
                delete normalizedParams.image_urls;
            }

            if (action === 'generate') {
                const hasImageInputs =
                    this.normalizeImages(normalizedParams.images).length > 0 ||
                    this.normalizeRefTokens(normalizedParams?.image_ref).length > 0 ||
                    this.normalizeRefTokens(normalizedParams?.image_refs).length > 0 ||
                    Boolean(this.normalizeMask(normalizedParams?.mask));
                if (hasImageInputs) {
                    action = 'edit';
                }
            }

            if (action === 'edit') {
                const explicitImages = this.normalizeImages(normalizedParams.images);
                const refResolved = this.resolveImagesByRefs(normalizedParams);
                let mergedImages = this.mergeImages(explicitImages, refResolved.images);
                if (mergedImages.length === 0) {
                    const sessionImages = await this.getSessionRecentImageItems(6);
                    if (sessionImages.length > 0) {
                        mergedImages = this.mergeImages(mergedImages, sessionImages);
                    }
                }
                normalizedParams.images = mergedImages;

                if (mergedImages.length === 0) {
                    const unresolvedHint = refResolved.unresolved.length > 0
                        ? `无效 image_ref：${refResolved.unresolved.join(', ')}。`
                        : '';
                    const poolHint = this.buildImagePoolHint(6);
                    return {
                        success: false,
                        error: `编辑图片需要 \`images\` 或 \`image_ref\`。${unresolvedHint} ${poolHint}`.trim(),
                        status_code: 400
                    };
                }
            }

            const sanitizeOut = this.sanitizeBusinessParams(action, normalizedParams);
            const businessPayload = sanitizeOut?.payload || {};
            const uploadImages = Array.isArray(sanitizeOut?.uploadImages) ? sanitizeOut.uploadImages : [];
            const uploadMask = sanitizeOut?.uploadMask || null;
            const sizeMeta = sanitizeOut?.sizeMeta || null;
            const validateError = this.validateBusinessParams(action, businessPayload, uploadImages, uploadMask);
            if (validateError) return { success: false, error: validateError };

            const endpoint = this.resolveEndpoint();
            if (!endpoint) return { success: false, error: '图片代理地址未配置' };

            let cfg;
            try {
                cfg = await this.getPrimaryImageConfig();
            } catch (error) {
                return { success: false, error: this.text(error?.message || error) || '读取图片模型配置失败' };
            }

            const route = this.normalizeRoute(action);
            const timeoutMs = this.resolveTimeoutMs(params);
            const requestPayload = {
                provider: cfg.provider || 'openai',
                capability: 'image_generation',
                action: 'image_generation',
                url: cfg.url,
                key: cfg.key,
                model: cfg.model,
                payload: {
                    ...businessPayload,
                    model: cfg.model,
                    route
                },
                options: {
                    timeout_ms: timeoutMs
                }
            };
            if (uploadImages.length > 0) requestPayload.payload.images = uploadImages;
            if (uploadMask) requestPayload.payload.mask = uploadMask;
            if (action === 'edit') {
                requestPayload.payload.mode = 'edit';
            } else {
                requestPayload.payload.mode = 'generate';
            }

            const created = await this.requestImage(endpoint, requestPayload, timeoutMs);
            if (!created.ok) {
                return {
                    success: false,
                    error: created.error,
                    status_code: created.statusCode
                };
            }

            let parsed = created.payload;
            let image = created.image;
            let task = created.task;

            if (!image.image_url && (task.task_id || task.image_id)) {
                const polled = await this.pollImageTask(endpoint, requestPayload, cfg, task, businessPayload.output_format);
                if (polled?.ok && polled.image?.image_url) {
                    parsed = polled.payload;
                    image = polled.image;
                    task = polled.task;
                } else if (polled && polled.ok === false) {
                    return {
                        success: false,
                        error: polled.error,
                        status_code: polled.statusCode
                    };
                } else if (polled?.task && this.isFailedStatus(polled.task.status)) {
                    return {
                        success: false,
                        error: `图片任务失败：${polled.task.status}`,
                        status_code: polled.statusCode || created.statusCode,
                        task_id: task.task_id,
                        image_id: task.image_id
                    };
                } else if (polled?.timedOut === true) {
                    const statusText = this.text(polled.task?.status || task.status) || '处理中';
                    return {
                        success: false,
                        error: `图片任务仍在生成中：${statusText}`,
                        status_code: polled.statusCode || created.statusCode,
                        task_id: task.task_id,
                        image_id: task.image_id
                    };
                }
            }

            if (image.image_url) {
                const capturedUrls = Array.isArray(image.image_urls) && image.image_urls.length > 0
                    ? image.image_urls
                    : [image.image_url];
                const imageRefs = this.storeImagesInPool(capturedUrls, {
                    action,
                    route,
                    model: cfg.model
                });
                return this.buildSuccessResult(action, route, cfg, created.statusCode, image, parsed, imageRefs, sizeMeta);
            }

            return {
                success: false,
                error: '上游返回成功，但未解析到图片结果',
                status_code: Number(created.statusCode || 200),
                task_id: task.task_id || '',
                image_id: task.image_id || '',
                task_status: task.status || '',
                response_shape: this.describeResponseShape?.(parsed) || ''
            };
        },

        registerTools() {
            if (!window.ToolRegistry || this.state.registered) return;
            if (!this.isReady()) {
                const missing = this.missingDependencies();
                console.warn('ShengtuToolModule dependencies missing:', missing.join(', '));
                return;
            }

            ToolRegistry.register({
                id: 'generate_or_edit_image',
                name: '图片生成与编辑',
                command: '@图片生成',
                icon: 'fa-solid fa-image',
                registerType: 'ai',
                description: '生成或编辑图片。单图一次调用；多张独立图（漫画、系列）多次调用，每次一张，image_ref:"last"可引用上一张。',
                parameters: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['generate', 'edit'],
                            description: '必填：generate 生图；edit 编辑'
                        },
                        prompt: { type: 'string', description: '必填，优化后的完整提示词（主体描述+风格+构图+画幅+关键细节），不要只传用户原文' },
                        images: {
                            type: 'array',
                            description: '编辑可传，参考图列表，格式：[{"image_url":"..."}]'
                        },
                        image_url: { type: 'string', description: '编辑可传，单张参考图 URL 或 data URL；工具会归一到 images' },
                        image_urls: { type: 'array', description: '编辑可传，多张参考图 URL；工具会归一到 images' },
                        image_ref: { type: 'string', description: '编辑可传，引用会话图片池（如 last、img_3）' },
                        image_refs: { type: 'array', description: '编辑可传，多个图片引用（如 ["img_2","img_5"]）' },
                        mask: {
                            description: '编辑可选，蒙版（字符串 URL/dataURI，或对象 {"image_url":"..."}）'
                        },
                        size: {
                            type: 'string',
                            description: '默认 auto；若指定请用 WIDTHxHEIGHT（如 1024x1536）。建议由模型按规则生成合法尺寸（如宽高为 16 倍数、像素预算在可用范围内）。'
                        },
                        quality: { type: 'string', description: '默认 auto' },
                        output_format: { type: 'string', description: '默认 png' },
                        response_format: { type: 'string', description: '默认 url，可传 b64_json' },
                        background: { type: 'string', description: '默认 auto' },
                        moderation: { type: 'string', description: '默认 auto' },
                        output_compression: { type: 'integer', description: '默认 90，范围 0-100（仅 jpeg/webp 生效）' },
                        input_fidelity: { type: 'string', description: '默认 high' },
                        timeout_ms: { type: 'integer', description: '可选，上游超时毫秒，最大 300000' },
                        delivery_mode: {
                            type: 'string',
                            enum: ['card_only', 'await_then_reply'],
                            description: '交付方式。纯生成/编辑只展示图片用 card_only；需要生成后继续分析、写说明或在回复中插入图片用 await_then_reply。'
                        }
                    },
                    required: ['action', 'prompt']
                },
                handler: async (toolParams) => this.generateOrEditImage(toolParams)
            });

            this.state.registered = true;
            window.ZhiLiaoLog?.debug?.('ShengtuToolModule registered: generate_or_edit_image');
        },

        init() {
            const tryRegister = () => {
                if (!window.ToolRegistry || !this.isReady()) {
                    setTimeout(tryRegister, 120);
                    return;
                }
                this.registerTools();
            };
            tryRegister();
        }
    };

    window.ShengtuToolModule = ShengtuToolModule;
    ShengtuToolModule.init();
})();
