const ZhiLiaoBujuModule = {
    state: {
        timerInterval: null,
        userScrolledUp: false
    },

    render(container) {
        if (!container) return container;

        const existingChatPage = document.getElementById('page-chat');
        const existingChatFooter = document.getElementById('chat-footer');
        if (existingChatPage && existingChatFooter) {
            return container;
        }

        if ((existingChatPage && !existingChatFooter) || (!existingChatPage && existingChatFooter)) {
            existingChatPage?.remove();
            existingChatFooter?.remove();
        }

        container.insertAdjacentHTML('beforeend', `
            <main id="page-chat" class="zhiliao-page flex-grow flex flex-col pl-3 pr-0 overflow-hidden min-h-0">
                <div id="welcome-screen" class="flex-grow flex flex-col items-center justify-center text-center">
                    <h2 class="text-xl font-bold mb-4">嗨！我是 运小助</h2>
                    <p class="text-gray-500 leading-relaxed max-w-xs">
                        我可以帮你搜索、答疑、写作，请把你的任务交给我吧~
                    </p>
                </div>
                <div id="message-container" class="message-container custom-scrollbar flex-col gap-3 py-4 overflow-y-auto"></div>
            </main>
            <footer id="chat-footer" class="relative gradient-divider-top flex-shrink-0">
                <div id="chat-attachment-tray" class="chat-attachment-tray custom-scrollbar" style="display: none;"></div>
                <div id="chat-input-panel" class="chat-input-panel relative bg-gray-100 rounded-2xl py-2 px-3 flex items-center shadow-sm">
                    <textarea id="message-input" rows="1" placeholder="输入 / 查看命令，或询问小助..."
                        class="custom-scrollbar bg-transparent flex-grow outline-none text-sm text-gray-700 placeholder-gray-400 resize-none overflow-y-auto"
                        style="max-height: 144px; line-height: 1.5;"></textarea>
                </div>
                <input type="file" id="file-input" class="hidden" multiple accept="image/*,video/*,.pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.js,.jsx,.ts,.tsx,.css,.scss,.html,.vue,.py,.java,.cpp,.c,.php,.rb,.go,.rs,.json,.xml,.yaml,.yml,.sql,.sh">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1">
                        <button id="model-button" class="footer-btn flex items-center justify-center rounded-full">
                            <i class="fa-solid fa-layer-group"></i>
                            <span>无模型</span>
                        </button>
                        <button id="think-button" class="footer-btn flex items-center justify-center rounded-full">
                            <i class="fa-solid fa-microchip"></i>
                            <span>思考</span>
                        </button>
                        <button id="upload-button" class="footer-btn rounded-full flex items-center justify-center">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                    </div>
                    <div class="flex items-center gap-1">
                        <button id="new-session-button" class="footer-btn rounded-full flex items-center justify-center" title="新会话" aria-label="新会话">
                            <i class="fa-solid fa-rotate-right"></i>
                        </button>
                        <button id="model-settings-button" class="footer-btn rounded-full flex items-center justify-center" title="模型配置" aria-label="模型配置">
                            <i class="fa-solid fa-gear"></i>
                        </button>
                        <button id="send-button" class="ds-bg-blue text-white rounded-full flex items-center justify-center">
                            <i class="fa-solid fa-arrow-up"></i>
                        </button>
                    </div>
                </div>
            </footer>
        `);
        return container;
    },

    createLoadingHTML(text = '正在回复中......') {
        return `<p style="color: #666;"><i class="fa-solid fa-spinner fa-spin"></i> ${this.escapeHtml(text)}</p>`;
    },

    createStreamingMessage() {
        const messageContainer = document.getElementById('message-container');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message';

        const messageId = 'msg-' + Date.now();
        const thinkingId = 'thinking-' + Date.now();

        messageDiv.innerHTML = `
            <img src="logo/ai.svg" alt="AI" class="system-avatar">
            <div class="system-text text-gray-700">
                <div id="${thinkingId}"></div>
                <div id="${messageId}">${this.createLoadingHTML()}</div>
            </div>
        `;

        messageContainer.appendChild(messageDiv);
        this.scrollToBottom();

        return {
            textContainer: document.getElementById(messageId),
            thinkingContainer: document.getElementById(thinkingId)
        };
    },

    showAnalyzingState(stateType = 'analyzing', fileCount = 1) {
        const messageContainer = document.getElementById('message-container');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message';

        const analysisId = 'analysis-' + Date.now();
        const messageId = 'msg-' + Date.now();
        const thinkingId = 'thinking-' + Date.now();

        let stateHTML;
        if (window.FenxModule) {
            if (stateType === 'uploading' && fileCount > 1) {
                stateHTML = FenxModule.createMultiFileUploadingHTML(analysisId, fileCount);
            } else if (stateType === 'uploading') {
                stateHTML = FenxModule.createUploadingHTML(analysisId);
            } else {
                stateHTML = FenxModule.createAnalyzingHTML(analysisId);
            }
        } else {
            const text = stateType === 'uploading' ? '正在上传文件...' : '正在分析文件...';
            stateHTML = this.createLoadingHTML(text);
        }

        messageDiv.innerHTML = `
            <img src="logo/ai.svg" alt="AI" class="system-avatar">
            <div class="system-text text-gray-700">
                <div id="${thinkingId}"></div>
                <div id="${messageId}">
                    ${stateHTML}
                </div>
            </div>
        `;

        messageContainer.appendChild(messageDiv);
        this.scrollToBottom();

        // Start timer for analysis/upload state.
        if (window.FenxModule) {
            FenxModule.startTiming(analysisId);
            FenxModule.startTimer(analysisId);
        }

        return {
            container: messageDiv,
            textContainer: document.getElementById(messageId),
            thinkingContainer: document.getElementById(thinkingId),
            uploadId: analysisId
        };
    },

    removeAnalyzingState(container) {
        if (!container) return;

        // Clear analysis timer state.
        if (window.FenxModule) {
            FenxModule.clearAnalysis();
        }

        const systemText = container.querySelector('.system-text');
        if (systemText) {
            // Keep containers and swap to loading text.
            const messageContainers = systemText.querySelectorAll('[id^="msg-"]');
            messageContainers.forEach(msgContainer => {
                msgContainer.innerHTML = this.createLoadingHTML();
            });
        }
    },

    createActionButtons(messageIndex) {
        const div = document.createElement('div');
        div.className = 'message-actions';
        div.innerHTML = `
            <button class="action-btn" onclick="ZhiLiaoModule.copyToClipboard(this)" title="复制">
                <i class="fa-regular fa-copy"></i>
            </button>
            <button class="action-btn" onclick="ZhiLiaoModule.regenerateResponse(${messageIndex})" title="重新回复">
                <i class="fa-solid fa-rotate"></i>
            </button>
        `;
        return div;
    },

    updateFileTags(uploadedFiles) {
        window.ZhiLiaoTuopanModule?.setFiles?.(uploadedFiles);
    },

    addUserMessage(text, files = []) {
        const container = document.getElementById('message-container');
        const div = document.createElement('div');
        div.className = 'user-message';

        // Render attached files first.
        if (files.length > 0) {
            const filesHtml = files.map(file => {
                const isImage = file.type.startsWith('image/');
                if (isImage) {
                    const url = URL.createObjectURL(file);
                    return `<div class="message-file"><img src="${url}" alt="${this.escapeAttr(file.name)}" data-preview="image" style="max-width: 200px; border-radius: 8px; cursor: zoom-in;"></div>`;
                } else {
                    const icon = 'fa-file';
                    return `<div class="message-file"><i class="fa-solid ${icon}"></i> ${this.escapeHtml(file.name)}</div>`;
                }
            }).join('');
            div.innerHTML = filesHtml + '<div>' + this.escapeHtml(text) + '</div>';
        } else {
            div.textContent = text;
        }

        container.appendChild(div);
        this.scrollToBottom(true);
    },

    addSystemMessage(text) {
        const container = document.getElementById('message-container');
        const div = document.createElement('div');
        div.className = 'system-message';
        div.innerHTML = `
            <img src="logo/ai.svg" alt="AI" class="system-avatar">
            <div class="system-text text-gray-700">${window.ZhiLiaoMessageRendererModule.renderFinal(text)}</div>
        `;
        container.appendChild(div);
        this.scrollToBottom();
    },

    scrollToBottom(force) {
        const container = document.getElementById('message-container');
        if (!container) return;
        if (force === true) {
            this.state.userScrolledUp = false;
            container.scrollTop = container.scrollHeight;
            return;
        }
        if (this.state.userScrolledUp) return;
        container.scrollTop = container.scrollHeight;
    },

    bindScrollDetection() {
        const container = document.getElementById('message-container');
        if (!container) return;
        container.addEventListener('scroll', () => {
            const threshold = 80;
            const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
            this.state.userScrolledUp = distanceFromBottom > threshold;
        });
    },

    bindPreviewImages(scope) {
        if (!scope || typeof scope.querySelectorAll !== 'function') return;
        const images = scope.querySelectorAll('img');
        images.forEach((img) => {
            if (img.classList.contains('system-avatar')) return;
            img.dataset.preview = 'image';
            if (!img.style.cursor) img.style.cursor = 'zoom-in';
        });
    },

    restoreMessages(messages) {
        const container = document.getElementById('message-container');
        if (!container || !Array.isArray(messages) || messages.length === 0) return;

        for (let i = 0; i < messages.length; i += 1) {
            const msg = messages[i];
            const role = String(msg.role || '').toLowerCase();
            const content = msg.displayContent || msg.content || '';

            if (role === 'user') {
                const div = document.createElement('div');
                div.className = 'user-message';
                if (msg.isHtml) {
                    div.innerHTML = window.ZhiLiaoMessageRendererModule.sanitizeDisplayHtml(content);
                } else {
                    div.textContent = content;
                }
                container.appendChild(div);
                this.bindPreviewImages(div);
            } else if (role === 'assistant' || role === 'system') {
                const div = document.createElement('div');
                div.className = 'system-message';
                const rendered = msg.isHtml
                    ? window.ZhiLiaoMessageRendererModule.sanitizeDisplayHtml(content)
                    : window.ZhiLiaoMessageRendererModule.renderFinal(content);
                div.innerHTML = `
                    <img src="logo/ai.svg" alt="AI" class="system-avatar">
                    <div class="system-text text-gray-700">${rendered}</div>
                `;
                container.appendChild(div);
                this.bindPreviewImages(div);
            } else if (role === 'custom' && msg.isHtml) {
                const wrap = document.createElement('div');
                wrap.innerHTML = window.ZhiLiaoMessageRendererModule.sanitizeDisplayHtml(content);
                while (wrap.firstChild) {
                    container.appendChild(wrap.firstChild);
                }
                this.bindPreviewImages(container);
            }
        }

        this.scrollToBottom(true);
    },

    showToast(message, type = 'warning') {
        if (!window.Tongzhi) {
            console.warn(String(message || ''));
            return;
        }
        const normalizedType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
        const text = String(message || '');
        if (typeof Tongzhi[normalizedType] === 'function') {
            Tongzhi[normalizedType](text);
            return;
        }
        if (typeof Tongzhi.show === 'function') {
            Tongzhi.show(text, normalizedType);
        }
    },

    viewImage(url) {
        if (window.YulanModule && typeof window.YulanModule.show === 'function') {
            window.YulanModule.show(url);
        }
    },

    escapeHtml(text) {
        return window.ZhiLiaoMessageRendererModule.escapeHtml(text);
    },

    escapeAttr(text) {
        return window.ZhiLiaoMessageRendererModule.escapeAttr(text);
    },


    startTiming(timerId) {
        if (window.UtilsModule) {
            window.UtilsModule.Timer.start(timerId);
        }
    },

    getAnalysisDuration(timerId) {
        if (window.UtilsModule) {
            return window.UtilsModule.Timer.getDuration(timerId);
        }
        return 0;
    },

    stopTiming(timerId) {
        let duration = 0;
        if (window.UtilsModule) {
            duration = window.UtilsModule.Timer.stop(timerId);
        }
        if (this.state.timerInterval) {
            clearInterval(this.state.timerInterval);
            this.state.timerInterval = null;
        }
        return duration;
    },

    createMultiFileUploadingHTML(uploadId, fileCount) {
        return `
            <div class="thinking-block">
                <div class="thinking-header">
                    <div class="thinking-header-icon">
                        <div class="spinner"></div>
                    </div>
                    <div class="thinking-header-text">
                        <span id="${uploadId}-progress">正在上传文件：1/${fileCount}</span>
                        <span id="${uploadId}-timer" style="color: #999; margin-left: 4px;">0秒</span>
                    </div>
                </div>
                <div id="${uploadId}-files" style="margin-top: 8px; font-size: 13px; color: #666;"></div>
            </div>
        `;
    },

    createUploadingHTML(uploadId) {
        return `
            <div class="thinking-block">
                <div class="thinking-header">
                    <div class="thinking-header-icon">
                        <div class="spinner"></div>
                    </div>
                    <div class="thinking-header-text">
                        <span>正在上传文件</span>
                        <span id="${uploadId}-timer" style="color: #999; margin-left: 4px;">0秒</span>
                    </div>
                </div>
            </div>
        `;
    },

    createAnalyzingHTML(analysisId) {
        return `
            <div class="thinking-block">
                <div class="thinking-header">
                    <div class="thinking-header-icon">
                        <div class="spinner"></div>
                    </div>
                    <div class="thinking-header-text">
                        <span>正在分析文件</span>
                        <span id="${analysisId}-timer" style="color: #999; margin-left: 4px;">0秒</span>
                    </div>
                </div>
            </div>
        `;
    },

    startTimer(analysisId) {
        const timerElement = document.getElementById(`${analysisId}-timer`);
        if (!timerElement) return;

        this.state.timerInterval = setInterval(() => {
            const duration = this.getAnalysisDuration(analysisId);
            timerElement.textContent = `${duration}秒`;
        }, 1000);
    },

    updateFileProgress(uploadId, current, total) {
        const progressElement = document.getElementById(`${uploadId}-progress`);
        if (progressElement) {
            progressElement.textContent = `正在上传文件：${current}/${total}`;
        }
    },

    updateFileStatus(uploadId, fileName, status, message = '') {
        const filesContainer = document.getElementById(`${uploadId}-files`);
        if (!filesContainer) return;

        const fileId = `${uploadId}-file-${fileName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        let fileElement = document.getElementById(fileId);

        if (!fileElement) {
            fileElement = document.createElement('div');
            fileElement.id = fileId;
            fileElement.style.cssText = 'padding: 4px 0; display: flex; align-items: center; gap: 6px;';
            filesContainer.appendChild(fileElement);
        }

        let icon, color, text;
        if (status === 'uploading') {
            icon = '⏳';
            color = '#666';
            text = `${fileName} - 上传中...`;
        } else if (status === 'success') {
            icon = '✓';
            color = '#10b981';
            text = `${fileName} - 已完成`;
        } else if (status === 'error') {
            icon = '✗';
            color = '#ef4444';
            text = `${fileName} - 失败${message ? ': ' + message : ''}`;
        }

        fileElement.innerHTML = `<span style="color: ${color};">${icon}</span> <span style="color: ${color};">${text}</span>`;
    },

    clearAnalysis() {
        this.stopTiming();
    }
};

window.ZhiLiaoBujuModule = ZhiLiaoBujuModule;

window.FenxModule = ZhiLiaoBujuModule;
