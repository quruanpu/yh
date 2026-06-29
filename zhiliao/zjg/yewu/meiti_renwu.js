const ZhiLiaoZjgMeitiRenwuModule = (() => {
    const methods = {
        initMediaTaskState() {
            if (!Array.isArray(this.state.mediaTaskQueue)) this.state.mediaTaskQueue = [];
            if (typeof this.state.mediaTaskRunning !== 'boolean') this.state.mediaTaskRunning = false;
            if (!Number.isInteger(this.state.mediaTaskSeq)) this.state.mediaTaskSeq = 1;
            if (typeof this.state.mediaTaskActiveId !== 'string') this.state.mediaTaskActiveId = '';
            if (this.state.mediaTaskActiveTask && typeof this.state.mediaTaskActiveTask !== 'object') {
                this.state.mediaTaskActiveTask = null;
            }
        },

        getMediaTaskKind(toolName) {
            return this.getMediaArtifactKind?.(toolName) || (this.isVideoToolName?.(toolName) ? 'video' : 'image');
        },

        getMediaTaskLabel(kind) {
            return this.getMediaArtifactTitle?.(kind) || (kind === 'video' ? '视频' : '图片');
        },

        enqueueMediaTask(toolName, params = {}, sessionId = '', policy = {}) {
            this.initMediaTaskState();
            const normalizedPolicy = policy && typeof policy === 'object'
                ? policy
                : this.buildMediaTaskPolicy?.(toolName, params, '') || {};
            const kind = normalizedPolicy.kind || this.getMediaTaskKind(toolName);
            const label = this.getMediaTaskLabel(kind);
            let resolveCompletion = null;
            const completion = new Promise((resolve) => {
                resolveCompletion = resolve;
            });
            const task = {
                id: `media-task-${Date.now()}-${this.state.mediaTaskSeq}`,
                seq: this.state.mediaTaskSeq,
                kind,
                label,
                toolName,
                params: params && typeof params === 'object' ? { ...params } : {},
                sessionId,
                deliveryMode: this.normalizeDeliveryMode?.(normalizedPolicy.deliveryMode || params?.delivery_mode || params?.deliveryMode) || 'card_only',
                policy: normalizedPolicy,
                previewUrl: this.extractMediaTaskPreviewUrl(kind, params),
                createdAt: Date.now(),
                startedAt: 0,
                timerId: null,
                card: null,
                completion,
                resolveCompletion
            };
            this.state.mediaTaskSeq += 1;
            task.card = this.createMediaTaskCard?.(task) || null;
            this.startMediaTaskTimer(task);
            this.state.mediaTaskQueue.push(task);
            this.runNextMediaTask();
            return {
                success: true,
                queued: true,
                task_id: task.id,
                media_kind: kind,
                delivery_mode: task.deliveryMode,
                status: 'queued',
                message: `${label}生成任务已加入后台队列`,
                completion
            };
        },

        resolveStaleMediaTask(task, reason = '媒体任务所属会话已切换') {
            if (!task) return;
            this.stopMediaTaskTimer(task);
            task.card?.remove?.();
            task.resolveCompletion?.({
                success: false,
                task_id: task.id || '',
                media_kind: task.kind || 'image',
                stale: true,
                error: reason
            });
        },

        resetMediaTaskState(reason = '媒体任务所属会话已切换') {
            this.initMediaTaskState();
            const pendingTasks = Array.isArray(this.state.mediaTaskQueue)
                ? [...this.state.mediaTaskQueue]
                : [];
            pendingTasks.forEach((task) => this.resolveStaleMediaTask(task, reason));
            if (this.state.mediaTaskActiveTask) {
                this.resolveStaleMediaTask(this.state.mediaTaskActiveTask, reason);
            }
            this.state.mediaTaskQueue = [];
            this.state.mediaTaskRunning = false;
            this.state.mediaTaskActiveId = '';
            this.state.mediaTaskActiveTask = null;
            this.state.mediaTaskSeq = 1;
        },

        extractMediaTaskPreviewUrl(kind, params = {}) {
            const pickUrl = (value) => {
                const text = String(value || '').trim();
                if (/^(https?:\/\/|data:image\/)/i.test(text)) return text;
                return '';
            };
            const pickImageRefUrl = (value) => {
                const token = String(value || '').trim();
                if (!token) return '';
                const resolved = this.resolveMediaRef?.('image', token) ||
                    window.ShengtuToolModule?.resolveImageRefToken?.(token) ||
                    null;
                return pickUrl(resolved?.url || resolved?.image_url || '');
            };
            const pickFromImages = (images = []) => {
                for (let i = 0; i < images.length; i += 1) {
                    const item = images[i];
                    const found = typeof item === 'string'
                        ? (pickUrl(item) || pickImageRefUrl(item))
                        : pickUrl(item?.image_url || item?.url) || pickImageRefUrl(item?.image_ref || item?.ref);
                    if (found) return found;
                }
                return '';
            };

            if (kind === 'chart') {
                return '';
            }

            if (kind === 'video') {
                return pickUrl(params.image_url) ||
                    pickImageRefUrl(params.image_ref) ||
                    pickFromImages(Array.isArray(params.image_refs) ? params.image_refs : []) ||
                    pickFromImages(Array.isArray(params.images) ? params.images : []) ||
                    pickFromImages(Array.isArray(params.image_urls) ? params.image_urls : []) ||
                    pickUrl(params.first_frame) ||
                    pickImageRefUrl(params.first_frame) ||
                    pickUrl(params.last_frame) ||
                    pickImageRefUrl(params.last_frame);
            }

            const direct = pickUrl(params.image_url) || pickImageRefUrl(params.image_ref);
            if (direct) return direct;
            return pickFromImages(Array.isArray(params.image_refs) ? params.image_refs : []) ||
                pickFromImages(Array.isArray(params.images) ? params.images : []) ||
                pickFromImages(Array.isArray(params.image_urls) ? params.image_urls : []);
        },

        startMediaTaskTimer(task) {
            if (!task) return;
            const render = () => {
                const elapsed = Math.floor((Date.now() - task.createdAt) / 1000);
                const statusText = task.startedAt
                    ? '后台正在生成，可继续对话。(｡･∀･)ﾉﾞ'
                    : '后台排队中，可继续对话。(｡･∀･)ﾉﾞ';
                this.updateMediaTaskCard?.(task.card, elapsed, statusText);
            };
            render();
            task.timerId = setInterval(render, 1000);
        },

        stopMediaTaskTimer(task) {
            if (task?.timerId) {
                clearInterval(task.timerId);
                task.timerId = null;
            }
        },

        async runNextMediaTask() {
            this.initMediaTaskState();
            if (this.state.mediaTaskRunning) return;
            const task = this.state.mediaTaskQueue.shift();
            if (!task) return;

            this.state.mediaTaskRunning = true;
            this.state.mediaTaskActiveId = task.id;
            this.state.mediaTaskActiveTask = task;
            task.startedAt = Date.now();
            this.updateMediaTaskCard?.(task.card, Math.floor((Date.now() - task.createdAt) / 1000), '后台正在生成，可继续对话。(｡･∀･)ﾉﾞ');

            try {
                const result = await this.executeMediaTask(task);
                await this.finishMediaTask(task, result);
            } catch (error) {
                this.failMediaTask(task, this.getErrorMessage?.(error) || error?.message || '任务执行失败');
                task.resolveCompletion?.({
                    success: false,
                    task_id: task.id,
                    media_kind: task.kind,
                    error: this.getErrorMessage?.(error) || error?.message || '任务执行失败'
                });
            } finally {
                this.stopMediaTaskTimer(task);
                if (this.state.mediaTaskActiveId === task.id) {
                    this.state.mediaTaskRunning = false;
                    this.state.mediaTaskActiveId = '';
                    this.state.mediaTaskActiveTask = null;
                    this.persistDisplaySnapshot?.();
                    this.runNextMediaTask();
                }
            }
        },

        async executeMediaTask(task) {
            if (!window.ToolRegistry || typeof ToolRegistry.executeTool !== 'function') {
                return { success: false, error: '工具模块未加载' };
            }
            const params = {
                ...(task.params || {}),
                _fromAI: true,
                _mediaTaskId: task.id || '',
                _mediaSessionId: task.sessionId || ''
            };
            return ToolRegistry.executeTool(task.toolName, params, task.sessionId);
        },

        isMediaTaskActive(taskId = '', sessionId = '') {
            this.initMediaTaskState();
            const id = String(taskId || '').trim();
            if (!id) return false;
            const expectedSessionId = String(sessionId || '').trim();
            const currentSessionId = String(this.state.sessionId || '').trim();
            if (expectedSessionId && currentSessionId && expectedSessionId !== currentSessionId) return false;
            if (this.state.mediaTaskActiveId === id) return true;
            return Array.isArray(this.state.mediaTaskQueue) &&
                this.state.mediaTaskQueue.some((task) => task?.id === id);
        },

        async finishMediaTask(task, result = {}) {
            const kind = ['image', 'video', 'chart'].includes(task?.kind) ? task.kind : 'image';
            if (task?.sessionId && this.state.sessionId && task.sessionId !== this.state.sessionId) {
                task?.card?.remove?.();
                task?.resolveCompletion?.({
                    success: false,
                    task_id: task?.id || '',
                    media_kind: kind,
                    stale: true,
                    error: '媒体任务所属会话已切换'
                });
                return;
            }

            const hasMedia = kind === 'video'
                ? Boolean(result?.success && result?.video_url && !result?.error)
                : Boolean(result?.success && result?.image_url && !result?.error);

            if (!hasMedia) {
                const message = kind === 'video'
                    ? this.getVideoToolFailureMessage?.(result)
                    : this.getImageToolFailureMessage?.(result);
                const errorText = message || result?.error || '未返回有效媒体结果';
                this.failMediaTask(task, errorText);
                task?.resolveCompletion?.({
                    success: false,
                    task_id: task?.id || '',
                    media_kind: kind,
                    error: errorText
                });
                return;
            }

            const defaultDescription = `${this.getMediaArtifactTitle?.(kind) || '媒体'}已生成`;
            const finalResult = kind === 'video'
                ? {
                    video_url: result.video_url
                }
                : {
                    image_url: result.image_url,
                    description: result.description || defaultDescription,
                    chart_type: result.chart_type || '',
                    width: result.width,
                    height: result.height
                };
            const artifact = this.registerMediaArtifact?.(kind, finalResult, {
                toolName: task.toolName,
                title: this.getMediaArtifactTitle?.(kind),
                description: finalResult.description
            });
            const summary = artifact
                ? this.buildMediaArtifactSummary?.(artifact, task.deliveryMode)
                : null;

            if (task.deliveryMode === 'await_then_reply') {
                task.card?.remove?.();
            } else {
                this.completeMediaTaskCard?.(task.card, finalResult, kind);
            }

            const completionResult = {
                success: true,
                task_id: task.id,
                media_kind: kind,
                delivery_mode: task.deliveryMode,
                artifact,
                summary
            };
            task.resolveCompletion?.(completionResult);
        },

        failMediaTask(task, errorText) {
            this.failMediaTaskCard?.(task?.card, errorText, task?.kind || 'image');
        },

        buildQueuedMediaToolResult(toolName, queuedResult = {}) {
            const kind = queuedResult.media_kind || this.getMediaTaskKind(toolName);
            const deliveryMode = this.normalizeDeliveryMode?.(queuedResult.delivery_mode) ||
                queuedResult.delivery_mode ||
                'card_only';
            if (deliveryMode === 'card_only') {
                return {
                    success: true,
                    queued: true,
                    media_kind: kind,
                    delivery_mode: deliveryMode,
                    status: queuedResult.status || 'queued',
                    suppress_followup: true
                };
            }

            return {
                success: true,
                queued: true,
                task_id: queuedResult.task_id || '',
                media_kind: kind,
                delivery_mode: deliveryMode,
                status: queuedResult.status || 'queued',
                message: queuedResult.message || `${this.getMediaTaskLabel(kind)}生成任务已加入后台队列`
            };
        },

        removeEmptyToolMessage(textContainer, thinkingContainer, fallbackText = '') {
            if (thinkingContainer) thinkingContainer.innerHTML = '';
            if (textContainer) {
                textContainer.innerHTML = '';
                textContainer.dataset.fullText = fallbackText;
            }
            const messageNode = textContainer?.closest?.('.system-message');
            const systemText = textContainer?.closest?.('.system-text');
            const hasRenderedContent = systemText
                ? Array.from(systemText.children || []).some((child) => {
                    if (child === textContainer || child === thinkingContainer) return false;
                    return Boolean(
                        child.matches?.('.zhiliao-cx-inline-result, .chart-result') ||
                        String(child.textContent || '').trim() ||
                        child.children?.length
                    );
                })
                : false;

            if (hasRenderedContent) {
                thinkingContainer?.remove?.();
                textContainer?.remove?.();
                return;
            }

            if (messageNode && messageNode.parentNode) {
                messageNode.remove();
            }
        }
    };

    return {
        methods,
        applyTo(appModule) {
            if (!appModule || typeof appModule !== 'object') return appModule;
            Object.assign(appModule, methods);
            return appModule;
        }
    };
})();

window.ZhiLiaoZjgMeitiRenwuModule = ZhiLiaoZjgMeitiRenwuModule;
