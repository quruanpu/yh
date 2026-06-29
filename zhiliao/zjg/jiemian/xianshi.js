const ZhiLiaoZjgXianshiModule = (() => {
    const methods = {
        bindResultImagePreview(scope) {
            if (!scope || typeof scope.querySelectorAll !== 'function') return;

            if (window.ZhiLiaoBujuModule && typeof window.ZhiLiaoBujuModule.bindPreviewImages === 'function') {
                window.ZhiLiaoBujuModule.bindPreviewImages(scope);
                return;
            }

            const images = scope.querySelectorAll('img');
            images.forEach((img) => {
                if (img.classList.contains('system-avatar')) return;
                img.dataset.preview = 'image';
                if (!img.style.cursor) img.style.cursor = 'zoom-in';
            });
        },

        renderImageResultCard(textContainer, result, imageTitle = '图片') {
            if (!textContainer || !result || !result.image_url) return;
            const imageUrl = String(result.image_url || '').trim();
            if (!window.ZhiLiaoMessageRendererModule?.isSafeDisplayMediaUrl?.(imageUrl, 'img', 'src')) return;

            const normalizedTitle = String(imageTitle || '').trim();
            const isImageCard = normalizedTitle === '图片' || normalizedTitle === '商品图片';
            const isChartCard = normalizedTitle === '图表';
            const isPureMediaCard = isImageCard || isChartCard;
            const cardShellStyle = isImageCard
                ? 'margin: 16px 0; padding: 12px; background: #f9fafb; border-radius: 8px; display: inline-block; max-width: min(100%, 444px);'
                : (isChartCard
                    ? 'margin: 16px 0; padding: 12px; background: #f9fafb; border-radius: 8px; display: inline-block; max-width: min(100%, 584px);'
                    : 'margin: 16px 0; padding: 12px; background: #f9fafb; border-radius: 8px;');
            const imageStyle = isImageCard
                ? 'max-width: min(100%, 420px); max-height: 320px; width: auto; height: auto; object-fit: contain; border-radius: 8px; display: block; margin: 0; cursor: zoom-in;'
                : (isChartCard
                    ? 'max-width: min(100%, 560px); max-height: 360px; width: auto; height: auto; object-fit: contain; border-radius: 6px; display: block; margin: 0; cursor: zoom-in;'
                    : 'max-width: 100%; border-radius: 4px; display: block; margin: 0 auto; cursor: zoom-in;');

            const cardDiv = document.createElement('div');
            cardDiv.className = 'chart-result';
            const shell = document.createElement('div');
            shell.setAttribute('style', cardShellStyle);
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = normalizedTitle;
            img.dataset.preview = 'image';
            img.setAttribute('style', imageStyle);
            shell.appendChild(img);
            if (!isPureMediaCard) {
                const description = document.createElement('p');
                description.setAttribute('style', 'margin-top: 8px; font-size: 13px; color: #666; text-align: center;');
                description.textContent = result.description || '图片已生成';
                shell.appendChild(description);
            }
            cardDiv.appendChild(shell);

            this.bindResultImagePreview(cardDiv);

            textContainer.parentNode.insertBefore(cardDiv, textContainer);
            this.scrollToBottom();
        },

        renderVideoResultCard(textContainer, result, videoTitle = '视频') {
            if (!textContainer || !result || !result.video_url) return;
            const videoUrl = String(result.video_url || '').trim();
            if (!window.ZhiLiaoMessageRendererModule?.isSafeDisplayMediaUrl?.(videoUrl, 'video', 'src')) return;

            const normalizedTitle = String(videoTitle || '').trim() || '视频';
            const cardDiv = document.createElement('div');
            cardDiv.className = 'chart-result';
            const shell = document.createElement('div');
            shell.setAttribute('style', 'margin: 16px 0; padding: 12px; background: #f9fafb; border-radius: 8px; display: inline-block; max-width: min(100%, 520px);');
            const video = document.createElement('video');
            video.src = videoUrl;
            video.controls = true;
            video.playsInline = true;
            video.setAttribute('style', 'max-width: min(100%, 496px); max-height: 360px; width: 100%; height: auto; object-fit: contain; border-radius: 8px; display: block; margin: 0;');
            video.setAttribute('aria-label', normalizedTitle);
            shell.appendChild(video);
            cardDiv.appendChild(shell);

            textContainer.parentNode.insertBefore(cardDiv, textContainer);
            this.scrollToBottom();
        },

        createMediaTaskCard(task = {}) {
            const messageContainer = document.getElementById('message-container');
            if (!messageContainer) return null;

            const kind = ['image', 'video', 'chart'].includes(task.kind) ? task.kind : 'image';
            const label = this.getMediaArtifactTitle?.(kind) || (kind === 'video' ? '视频' : '图片');
            const icon = kind === 'video' ? 'fa-film' : (kind === 'chart' ? 'fa-chart-pie' : 'fa-image');
            const cardId = task.id || `media-task-${Date.now()}`;
            const previewUrl = String(task.previewUrl || '').trim();
            const messageDiv = document.createElement('div');
            messageDiv.className = 'system-message media-task-message';
            messageDiv.dataset.mediaTaskId = cardId;
            messageDiv.innerHTML = `
                <img src="logo/ai.svg" alt="AI" class="system-avatar">
                <div class="system-text text-gray-700">
                    <div class="media-task-card">
                        <div class="media-task-thumb">
                            <i class="fa-solid ${icon}"></i>
                            <span class="media-task-elapsed" data-role="elapsed">0</span>
                        </div>
                        <div class="media-task-body">
                            <div class="media-task-title">${label}正在生成......</div>
                            <div class="media-task-subtitle">后台任务已加入队列，可继续对话。(｡･∀･)ﾉﾞ</div>
                        </div>
                    </div>
                </div>
            `;
            if (previewUrl) {
                const thumb = messageDiv.querySelector('.media-task-thumb');
                const safePreview = window.ZhiLiaoMessageRendererModule?.isSafeDisplayMediaUrl?.(previewUrl, 'img', 'src');
                if (thumb && safePreview) {
                    thumb.innerHTML = '';
                    const img = document.createElement('img');
                    img.className = 'media-task-preview';
                    img.dataset.preview = 'image';
                    img.src = previewUrl;
                    img.alt = label;
                    thumb.appendChild(img);
                    const elapsed = document.createElement('span');
                    elapsed.className = 'media-task-elapsed';
                    elapsed.dataset.role = 'elapsed';
                    elapsed.textContent = '0';
                    thumb.appendChild(elapsed);
                }
            }
            messageContainer.appendChild(messageDiv);
            this.scrollToBottom();
            return messageDiv;
        },

        updateMediaTaskCard(card, elapsedSeconds = 0, statusText = '') {
            if (!card) return;
            const elapsedEl = card.querySelector('[data-role="elapsed"]');
            if (elapsedEl) elapsedEl.textContent = String(Math.max(0, Number(elapsedSeconds || 0)));
            const subtitleEl = card.querySelector('.media-task-subtitle');
            if (subtitleEl && statusText) subtitleEl.textContent = statusText;
        },

        completeMediaTaskCard(card, result = {}, kind = 'image') {
            if (!card || !card.parentNode) return;
            const systemText = card.querySelector('.system-text');
            if (!systemText) return;
            systemText.innerHTML = '';
            const anchor = document.createElement('div');
            systemText.appendChild(anchor);
            const renderKind = ['image', 'video', 'chart'].includes(kind) ? kind : 'image';
            if (renderKind === 'video') {
                this.renderVideoResultCard(anchor, result, '视频');
            } else {
                this.renderImageResultCard(anchor, result, this.getMediaArtifactTitle?.(renderKind) || '图片');
            }
            anchor.remove();
            this.scrollToBottom();
        },

        failMediaTaskCard(card, errorText = '', kind = 'image') {
            if (!card) return;
            const label = kind === 'video'
                ? '视频生成失败'
                : (kind === 'chart' ? '图表生成失败' : '图片生成/编辑失败');
            const message = this.extractReadableError
                ? this.extractReadableError(errorText, '任务执行失败')
                : String(errorText || '任务执行失败');
            const punctuatedMessage = /[。！？.!?]$/.test(message) ? message : `${message}。`;
            const taskCard = card.querySelector('.media-task-card');
            if (taskCard) taskCard.classList.add('failed');
            const thumb = card.querySelector('.media-task-thumb');
            if (thumb) thumb.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
            const title = card.querySelector('.media-task-title');
            if (title) title.textContent = `${label}：${punctuatedMessage}`;
            const subtitle = card.querySelector('.media-task-subtitle');
            if (subtitle) {
                subtitle.textContent = /队列已满|服务繁忙|稍后重试|queue is full|service unavailable/i.test(message)
                    ? '请稍后重试。'
                    : '请调整提示词或模型配置后重试。';
            }
            this.scrollToBottom();
        },

        finalizeMessage(textContainer, thinkingContainer, content, reasoning_content) {
            this.state.toolCallDepth = 0;
            this.state.lastToolCallSignature = '';
            this.state.repeatedToolCallCount = 0;

            if (reasoning_content) {
                this.finalizeThinkingDisplay(thinkingContainer, reasoning_content);
            } else if (thinkingContainer) {
                thinkingContainer.innerHTML = '';
            }

            const normalizedContent = this.normalizeDisplayText(content);
            textContainer.innerHTML = this.renderFinalMessage(normalizedContent);
            textContainer.dataset.fullText = normalizedContent;
            this.renderMediaArtifactPlaceholders?.(textContainer);

            const messageIndex = this.state.messageHistory.length - 1;
            const actionsDiv = window.ZhiLiaoBujuModule?.createActionButtons?.(messageIndex) || document.createElement('div');
            document.getElementById('message-container').appendChild(actionsDiv);

            this.scrollToBottom();
            this.persistDisplaySnapshot();
        },

        updateThinkingDisplay(container, content) {
            if (!container) return;

            const thinkingId = container.id;
            container.innerHTML = ShendModule.createThinkingHTML(
                thinkingId,
                content,
                (c) => this.renderStreamingMessage(c)
            );

            const thinkingContent = document.getElementById(`${thinkingId}-content`);
            if (thinkingContent) thinkingContent.scrollTop = thinkingContent.scrollHeight;

            this.scrollToBottom();
        },

        finalizeThinkingDisplay(container, content) {
            if (!container) return;

            const duration = ShendModule.getThinkingDuration();
            const thinkingId = 'final-thinking-' + Date.now();

            container.innerHTML = ShendModule.createFinishedHTML(
                thinkingId,
                content,
                duration,
                (c) => this.renderFinalMessage(c)
            );
        },

        updateContentDisplay(container, content) {
            if (!container) return;
            container.innerHTML = this.renderStreamingMessage(this.normalizeDisplayText(content));
            this.scrollToBottom();
        },

        normalizeDisplayText(content) {
            const text = typeof content === 'string' ? content : String(content || '');
            return text.replace(/^(?:[ \t]*\r?\n)+/, '');
        },

        startStatusTimer(container, text, icon = 'fa-spinner fa-spin', color = '#666') {
            if (!container) return null;

            const baseText = this.normalizeDisplayText(text);
            const safeBaseText = this.escapeHtml(baseText);
            const iconClass = `fa-solid ${icon}`;
            const startedAt = Date.now();

            const render = () => {
                const elapsedSec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
                container.innerHTML = `<p style="color: ${color};"><i class="${iconClass}"></i> ${safeBaseText} <span style="opacity: .82;">${elapsedSec}s</span></p>`;
                container.dataset.fullText = `${baseText} ${elapsedSec}s`;
                this.scrollToBottom();
            };

            render();
            const timerId = setInterval(render, 1000);

            return () => {
                clearInterval(timerId);
            };
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

window.ZhiLiaoZjgXianshiModule = ZhiLiaoZjgXianshiModule;
