(function setupShengshiToolModule() {
    const core = window.ShengshiToolCoreModule || {};
    const candidate = window.ShengshiToolCandidateModule || {};

    const ShengshiToolModule = {
        ...core,
        ...candidate,

        missingDependencies() {
            const required = [
                'text',
                'resolveEndpoint',
                'getPrimaryVideoConfig',
                'normalizeVideoImages',
                'mergeVideoImages',
                'resolveVideoReferenceImages',
                'sanitizeBusinessParams',
                'validateBusinessParams',
                'postJson',
                'unwrapResponsePayload',
                'normalizeVideoResponse',
                'parseResponseMessage'
            ];
            return required.filter((name) => typeof this[name] !== 'function');
        },

        isReady() {
            return this.missingDependencies().length === 0;
        },

        buildSuccessResult(cfg, statusCode, video, payload) {
            const videoUrl = this.text(video.video_url || '');
            const mediaRef = videoUrl && window.ZhiLiaoModule?.registerMediaResource
                ? window.ZhiLiaoModule.registerMediaResource('video', videoUrl, {
                    source: 'generate_video',
                    model: cfg.model,
                    configId: cfg.configId,
                    configName: cfg.configName
                })
                : null;
            return {
                success: true,
                action: 'generate',
                route: 'video_generation',
                model: cfg.model,
                config_id: cfg.configId,
                config_name: cfg.configName,
                status_code: Number(statusCode || 200),
                video_url: videoUrl,
                videos: Array.isArray(video.videos) ? video.videos : [],
                video_ref: this.text(mediaRef?.ref || ''),
                video_refs: mediaRef?.ref ? [mediaRef.ref] : [],
                video_id: video.video_id || '',
                task_id: video.task_id || '',
                status_url: video.status_url || '',
                status: video.status || '',
                output: payload
            };
        },

        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms || 0))));
        },

        isRunningStatus(status) {
            const text = this.text(status).toLowerCase();
            if (!text) return true;
            return ['queued', 'queueing', 'pending', 'running', 'processing', 'submitted', 'created', 'in_progress'].includes(text);
        },

        isFailedStatus(status) {
            const text = this.text(status).toLowerCase();
            return ['failed', 'error', 'cancelled', 'canceled', 'rejected', 'timeout'].includes(text);
        },

        isRetriableVideoCreateError(result = {}) {
            const statusCode = Number(result.statusCode || result.status_code || 0);
            const message = this.text(result.error || result.message).toLowerCase();
            if (statusCode === 503 || statusCode === 429 || statusCode === 408 || statusCode === 524) return true;
            return /queue is full|serviceunavailable|service unavailable|temporarily unavailable|服务繁忙|稍后重试|\"code\"\s*:\s*\"?503\"?/.test(message);
        },

        getVideoCreateBusyMessage(result = {}) {
            return this.isRetriableVideoCreateError(result)
                ? '上游队列已满，请稍后重试。'
                : '';
        },

        async requestVideo(endpoint, requestPayload, timeoutMs) {
            const response = await this.postJson(endpoint, requestPayload, timeoutMs);
            if (!response.ok) {
                const message = response.networkError || this.parseResponseMessage(response.status, response.json, response.text);
                return {
                    ok: false,
                    error: message,
                    statusCode: Number(response.status || 0),
                    payload: {}
                };
            }

            const parsed = this.unwrapResponsePayload(response.json, response.text);
            return {
                ok: true,
                statusCode: Number(response.status || 200),
                payload: parsed,
                video: this.normalizeVideoResponse(parsed)
            };
        },

        isVideoPollingActive(control = {}) {
            const taskId = this.text(control.mediaTaskId);
            if (!taskId) return true;
            if (!window.ZhiLiaoModule || typeof window.ZhiLiaoModule.isMediaTaskActive !== 'function') return true;
            return window.ZhiLiaoModule.isMediaTaskActive(taskId, control.mediaSessionId || '');
        },

        async pollVideoTask(endpoint, baseRequestPayload, cfg, initialVideo, control = {}) {
            const videoId = this.text(initialVideo.video_id);
            const taskId = this.text(initialVideo.task_id);
            if (!videoId && !taskId) return null;

            const intervalMs = 5000;
            for (;;) {
                if (!this.isVideoPollingActive(control)) {
                    return {
                        ok: false,
                        statusCode: 0,
                        error: '视频任务已取消',
                        cancelled: true
                    };
                }

                await this.sleep(intervalMs);
                if (!this.isVideoPollingActive(control)) {
                    return {
                        ok: false,
                        statusCode: 0,
                        error: '视频任务已取消',
                        cancelled: true
                    };
                }

                const queryPayload = {
                    ...baseRequestPayload,
                    payload: {
                        model: cfg.model,
                        mode: 'query',
                        ...(videoId ? { video_id: videoId } : { task_id: taskId })
                    }
                };
                const result = await this.requestVideo(endpoint, queryPayload, 0);
                if (!result.ok) return result;
                if (result.video?.video_url) return result;
                if (this.isFailedStatus(result.video?.status)) return result;
                if (!this.isRunningStatus(result.video?.status)) return result;
            }
        },

        async generateVideo(params = {}) {
            const missing = this.missingDependencies();
            if (missing.length > 0) {
                return { success: false, error: `生视频工具模块未就绪：${missing.join(', ')}` };
            }

            const endpoint = this.resolveEndpoint();
            if (!endpoint) return { success: false, error: '视频代理地址未配置' };

            let cfg;
            try {
                cfg = await this.getPrimaryVideoConfig();
            } catch (error) {
                return { success: false, error: this.text(error?.message || error) || '读取视频模型配置失败' };
            }

            const normalizedParams = { ...(params || {}) };
            const hasExplicitImageRef = this.text(normalizedParams.image_ref) ||
                (Array.isArray(normalizedParams.image_refs) && normalizedParams.image_refs.length > 0);
            const hasExplicitImageInput = normalizedParams.image ||
                normalizedParams.image_url ||
                (Array.isArray(normalizedParams.image_urls) && normalizedParams.image_urls.length > 0) ||
                (Array.isArray(normalizedParams.images) && normalizedParams.images.length > 0) ||
                hasExplicitImageRef ||
                this.text(normalizedParams.first_frame) ||
                this.text(normalizedParams.last_frame);
            if (!hasExplicitImageInput && normalizedParams._fromAI === true) {
                const latestImage = window.ZhiLiaoModule?.getLatestMediaResource?.('image') ||
                    window.ShengtuToolModule?.state?.imagePool?.slice?.(-1)?.[0] ||
                    null;
                if (latestImage?.ref || latestImage?.image_url || latestImage?.url) {
                    normalizedParams.image_ref = latestImage.ref || 'last';
                }
            }
            const explicitImages = this.mergeVideoImages(
                this.normalizeVideoImages(normalizedParams.images),
                this.normalizeVideoImages([
                    normalizedParams.image,
                    normalizedParams.image_url,
                    ...(Array.isArray(normalizedParams.image_urls) ? normalizedParams.image_urls : [])
                ].filter((item) => item !== undefined && item !== null && item !== ''))
            );
            const refResolved = await this.resolveVideoReferenceImages(normalizedParams);
            if (refResolved.unresolved.length > 0) {
                return {
                    success: false,
                    error: `无效 image_ref：${refResolved.unresolved.join(', ')}。请使用 last、img_数字，或直接传入图片 URL。`,
                    status_code: 400
                };
            }
            const mergedImages = this.mergeVideoImages(explicitImages, refResolved.images);
            if (mergedImages.length > 0) {
                normalizedParams.images = mergedImages;
                delete normalizedParams.image;
                delete normalizedParams.image_url;
                delete normalizedParams.image_urls;
                delete normalizedParams.image_ref;
                delete normalizedParams.image_refs;
            }

            if (typeof normalizedParams.first_frame === 'string' && this.text(normalizedParams.first_frame) && !this.isHttpUrl(normalizedParams.first_frame) && !this.isDataImageUrl(normalizedParams.first_frame)) {
                const firstFrame = await this.resolveVideoReferenceImages({ image_ref: normalizedParams.first_frame });
                if (firstFrame.images.length > 0) {
                    normalizedParams.first_frame = firstFrame.images[0].image_url;
                } else {
                    return {
                        success: false,
                        error: `无效 first_frame：${this.text(normalizedParams.first_frame)}。请使用 last、img_数字，或直接传入图片 URL。`,
                        status_code: 400
                    };
                }
            }
            if (typeof normalizedParams.last_frame === 'string' && this.text(normalizedParams.last_frame) && !this.isHttpUrl(normalizedParams.last_frame) && !this.isDataImageUrl(normalizedParams.last_frame)) {
                const lastFrame = await this.resolveVideoReferenceImages({ image_ref: normalizedParams.last_frame });
                if (lastFrame.images.length > 0) {
                    normalizedParams.last_frame = lastFrame.images[0].image_url;
                } else {
                    return {
                        success: false,
                        error: `无效 last_frame：${this.text(normalizedParams.last_frame)}。请使用 last、img_数字，或直接传入图片 URL。`,
                        status_code: 400
                    };
                }
            }

            const businessPayload = this.sanitizeBusinessParams(normalizedParams);
            const validateError = this.validateBusinessParams(businessPayload);
            if (validateError) return { success: false, error: validateError };

            const control = {
                mediaTaskId: this.text(params?._mediaTaskId),
                mediaSessionId: this.text(params?._mediaSessionId)
            };
            const requestPayload = {
                provider: cfg.provider || 'agnes',
                capability: 'video_generation',
                action: 'video_generation',
                url: cfg.url,
                key: cfg.key,
                model: cfg.model,
                payload: {
                    ...businessPayload,
                    model: cfg.model
                },
                options: {}
            };

            if (!this.isVideoPollingActive(control)) {
                return {
                    success: false,
                    cancelled: true,
                    error: '视频任务已取消',
                    status_code: 0
                };
            }

            const created = await this.requestVideo(endpoint, requestPayload, 0);
            if (!created.ok) {
                if (created.cancelled === true) {
                    return {
                        success: false,
                        cancelled: true,
                        error: created.error || '视频任务已取消',
                        status_code: created.statusCode
                    };
                }
                return {
                    success: false,
                    error: this.getVideoCreateBusyMessage(created) || created.error,
                    error_type: this.isRetriableVideoCreateError(created) ? 'upstream_queue_full' : '',
                    status_code: created.statusCode
                };
            }

            let parsed = created.payload;
            let video = created.video;
            if (!video.video_url && (video.video_id || video.task_id)) {
                const polled = await this.pollVideoTask(endpoint, requestPayload, cfg, video, control);
                if (polled?.ok && polled.video?.video_url) {
                    parsed = polled.payload;
                    video = polled.video;
                } else if (polled && polled.ok === false) {
                    if (polled.cancelled === true) {
                        return {
                            success: false,
                            cancelled: true,
                            error: polled.error || '视频任务已取消',
                            status_code: polled.statusCode
                        };
                    }
                    return {
                        success: false,
                        error: polled.error,
                        status_code: polled.statusCode
                    };
                } else if (polled?.video && this.isFailedStatus(polled.video.status)) {
                    return {
                        success: false,
                        error: `视频任务失败：${polled.video.status}`,
                        status_code: polled.statusCode || created.statusCode
                    };
                }
            }

            if (video.video_url) {
                return this.buildSuccessResult(cfg, created.statusCode, video, parsed);
            }

            if (video.video_id || video.task_id) {
                const statusText = this.text(video.status) || '处理中';
                return {
                    success: false,
                    error: `视频任务已创建，但暂未返回可播放链接。当前状态：${statusText}`,
                    status_code: created.statusCode,
                    video_id: video.video_id,
                    task_id: video.task_id,
                    status: statusText
                };
            }

            return {
                success: false,
                error: '上游返回成功，但未解析到视频结果或任务ID',
                status_code: created.statusCode
            };
        },

        registerTools() {
            if (!window.ToolRegistry || this.state.registered) return;
            if (!this.isReady()) {
                const missing = this.missingDependencies();
                console.warn('ShengshiToolModule dependencies missing:', missing.join(', '));
                return;
            }

            ToolRegistry.register({
                id: 'generate_video',
                name: '视频生成',
                command: '@视频生成',
                icon: 'fa-solid fa-film',
                registerType: 'ai',
                description: '根据文本提示词生成视频。仅在用户明确要求生成视频、动画、短片时调用。',
                parameters: {
                    type: 'object',
                    properties: {
                        prompt: { type: 'string', description: '必填，优化后的完整视频提示词（主体+动作+场景+镜头+风格+时长）' },
                        duration: { type: 'string', description: '可选，统一时长参数。后端会转换为 Agnes 官方可识别的帧数/帧率；默认约 5s 横向' },
                        quality: { type: 'string', description: '可选，通用质量提示；是否生效由具体模型决定' },
                        mode: { type: 'string', description: '可选，通用视频任务模式，如 keyframes；后端会按厂商协议转换' },
                        video_mode: { type: 'string', description: '可选，通用视频任务模式别名，如 keyframes、ti2vid' },
                        size: { type: 'string', description: '可选，画幅或尺寸，如 16:9、9:16、1280x720' },
                        resolution: { type: 'string', description: '可选，清晰度，如 720p、1080p' },
                        width: { type: 'integer', description: '可选，视频宽度；后端会按 Agnes 官方支持的尺寸归一化' },
                        height: { type: 'integer', description: '可选，视频高度；后端会按 Agnes 官方支持的尺寸归一化' },
                        num_frames: { type: 'integer', description: '可选，视频帧数；后端会按 Agnes 官方约束处理' },
                        frame_rate: { type: 'string', description: '可选，帧率；后端会按 Agnes 官方约束处理' },
                        fps: { type: 'string', description: '可选，帧率；若同时未传 frame_rate，会自动映射为 frame_rate' },
                        seed: { type: 'string', description: '可选，随机种子' },
                        num_inference_steps: { type: 'integer', description: '可选，推理步数；具体是否生效由模型决定' },
                        negative_prompt: { type: 'string', description: '可选，负向提示词；用于描述需要避免的内容' },
                        image_url: { type: 'string', description: '可选，参考图 URL；用于图生视频或首帧参考' },
                        image_urls: {
                            type: 'array',
                            description: '可选，多个参考图 URL；具体支持数量由所选模型决定'
                        },
                        images: {
                            type: 'array',
                            description: '可选，参考图列表，格式如 [{"image_url":"https://..."}]；统一后端会按厂商协议转换'
                        },
                        image_ref: { type: 'string', description: '可选，引用会话图片池，如 last、img_3；用于把已生成/已上传图片作为参考' },
                        image_refs: { type: 'array', description: '可选，多个会话图片引用，如 ["last","img_2"]' },
                        first_frame: { type: 'string', description: '可选，首帧参考图 URL' },
                        last_frame: { type: 'string', description: '可选，尾帧参考图 URL' },
                        extra_body: { type: 'object', description: '可选，统一网关透传扩展参数；仅在明确需要模型专属参数时使用' },
                        delivery_mode: {
                            type: 'string',
                            enum: ['card_only', 'await_then_reply'],
                            description: '交付方式。纯生成只展示视频用 card_only；需要生成后继续分析、写说明或在回复中插入视频用 await_then_reply。'
                        }
                    },
                    required: ['prompt']
                },
                handler: async (toolParams) => this.generateVideo(toolParams)
            });

            this.state.registered = true;
            window.ZhiLiaoLog?.debug?.('ShengshiToolModule registered: generate_video');
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

    window.ShengshiToolModule = ShengshiToolModule;
    ShengshiToolModule.init();
})();
