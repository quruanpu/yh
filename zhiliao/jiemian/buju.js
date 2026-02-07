/**
 * 智聊界面布局模块
 *
 * 职责：
 * 1. 渲染页面结构（HTML生成）
 * 2. 创建消息容器（用户消息、系统消息、流式消息）
 * 3. 显示状态提示（上传中、分析中、加载中）
 * 4. 渲染Markdown内容
 * 5. 显示Toast提示
 * 6. 图片查看器
 *
 * 从 zhiliao/app.js 中提取
 */
const ZhiLiaoBujuModule = {
    // 状态管理（从fenx.js迁移）
    state: {
        timerInterval: null
    },

    /**
     * 渲染页面主结构
     * @param {HTMLElement} container - 容器元素
     * @returns {HTMLElement} 渲染后的容器
     */
    render(container) {
        container.innerHTML = `
            <main id="page-chat" class="zhiliao-page flex-grow flex flex-col pl-3 pr-0 overflow-hidden min-h-0">
                <div id="welcome-screen" class="flex-grow flex flex-col items-center justify-center text-center">
                    <h2 class="text-xl font-bold mb-4">嗨！我是 运小助~</h2>
                    <p class="text-gray-500 leading-relaxed max-w-xs">
                        我可以帮你搜索、答疑、写作，请把你的任务交给我吧~
                    </p>
                </div>
                <div id="message-container" class="message-container custom-scrollbar flex-col gap-3 py-4 overflow-y-auto"></div>
            </main>
            <footer id="chat-footer" class="relative gradient-divider-top flex-shrink-0">
                <div id="file-tags-container" class="file-tags-container" style="display: none;"></div>
                <div class="relative bg-gray-100 rounded-2xl py-2 px-3 flex items-center shadow-sm">
                    <textarea id="message-input" rows="1" placeholder="输入 / 查看命令，或询问小助..."
                        class="custom-scrollbar bg-transparent flex-grow outline-none text-sm text-gray-700 placeholder-gray-400 resize-none overflow-y-auto"
                        style="max-height: 144px; line-height: 1.5;"></textarea>
                </div>
                <input type="file" id="file-input" class="hidden" multiple accept="image/*,video/*,.pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.js,.jsx,.ts,.tsx,.css,.scss,.html,.vue,.py,.java,.cpp,.c,.php,.rb,.go,.rs,.json,.xml,.yaml,.yml,.sql,.sh">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1">
                        <button id="think-button" class="footer-btn flex items-center justify-center rounded-full">
                            <i class="fa-solid fa-microchip"></i>
                            <span>思考</span>
                        </button>
                        <button id="network-button" class="footer-btn flex items-center justify-center rounded-full">
                            <i class="fa-solid fa-globe"></i>
                            <span>联网</span>
                        </button>
                        <button id="upload-button" class="footer-btn rounded-full flex items-center justify-center">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                    </div>
                    <button id="send-button" class="ds-bg-blue text-white rounded-full flex items-center justify-center">
                        <i class="fa-solid fa-arrow-up"></i>
                    </button>
                </div>
            </footer>
        `;
        return container;
    },

    /**
     * 创建流式消息容器
     * @returns {Object} 包含textContainer和thinkingContainer的对象
     */
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
                <div id="${messageId}"></div>
            </div>
        `;

        messageContainer.appendChild(messageDiv);
        this.scrollToBottom();

        return {
            textContainer: document.getElementById(messageId),
            thinkingContainer: document.getElementById(thinkingId)
        };
    },

    /**
     * 显示文件处理状态（返回可复用的消息容器）
     * @param {string} stateType - 状态类型（'analyzing' | 'uploading'）
     * @param {number} fileCount - 文件数量
     * @returns {Object} 包含容器和ID的对象
     */
    showAnalyzingState(stateType = 'analyzing', fileCount = 1) {
        const messageContainer = document.getElementById('message-container');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message';

        const analysisId = 'analysis-' + Date.now();
        const messageId = 'msg-' + Date.now();
        const thinkingId = 'thinking-' + Date.now();

        // 根据状态类型和文件数量选择显示内容
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
            stateHTML = `<p style="color: #666;"><i class="fa-solid fa-spinner fa-spin"></i> ${text}</p>`;
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

        // 启动计时器
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

    /**
     * 移除文件分析状态（只移除分析文本，保留容器供AI回复使用）
     * @param {HTMLElement} container - 容器元素
     */
    removeAnalyzingState(container) {
        if (!container) return;

        // 清理计时器
        if (window.FenxModule) {
            FenxModule.clearAnalysis();
        }

        // 只清空分析状态的文本内容，保留thinking和message容器
        const systemText = container.querySelector('.system-text');
        if (systemText) {
            // 找到message容器并清空其内容，同时显示"正在回复"状态
            const messageContainers = systemText.querySelectorAll('[id^="msg-"]');
            messageContainers.forEach(msgContainer => {
                msgContainer.innerHTML = '<p style="color: #666;"><i class="fa-solid fa-spinner fa-spin"></i> 正在回复...</p>';
            });
        }
    },

    /**
     * 创建操作按钮
     * @param {number} messageIndex - 消息索引
     * @returns {HTMLElement} 操作按钮容器
     */
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

    /**
     * 更新文件标签显示
     * @param {Array} uploadedFiles - 上传的文件列表
     */
    updateFileTags(uploadedFiles) {
        const container = document.getElementById('file-tags-container');
        if (!container) return;

        if (uploadedFiles.length === 0) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        container.style.display = 'flex';
        container.innerHTML = '';

        uploadedFiles.forEach((file, index) => {
            const isImage = file.type.startsWith('image/');
            const icon = isImage ? 'fa-image' : 'fa-file';

            const tag = document.createElement('div');
            tag.className = 'file-tag';

            // 图标（图片可点击预览）
            const iconEl = document.createElement('i');
            iconEl.className = `fa-solid ${icon}`;
            if (isImage) {
                iconEl.className += ' yulan-clickable';
                iconEl.style.cursor = 'zoom-in';
                const url = URL.createObjectURL(file);
                iconEl.onclick = (e) => {
                    e.stopPropagation();
                    window.showImagePreview?.(url);
                };
            }
            tag.appendChild(iconEl);

            // 文件名
            const nameEl = document.createElement('span');
            nameEl.textContent = file.name;
            tag.appendChild(nameEl);

            // 删除按钮
            const removeBtn = document.createElement('button');
            removeBtn.className = 'file-tag-remove';
            removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            removeBtn.onclick = () => ZhiLiaoModule.removeFile(index);
            tag.appendChild(removeBtn);

            container.appendChild(tag);
        });
    },

    /**
     * 添加用户消息
     * @param {string} text - 消息文本
     * @param {Array} files - 文件列表
     */
    addUserMessage(text, files = []) {
        const container = document.getElementById('message-container');
        const div = document.createElement('div');
        div.className = 'user-message';

        // 如果有文件，先显示文件
        if (files.length > 0) {
            const filesHtml = files.map(file => {
                const isImage = file.type.startsWith('image/');
                if (isImage) {
                    const url = URL.createObjectURL(file);
                    return `<div class="message-file"><img src="${url}" alt="${file.name}" style="max-width: 200px; border-radius: 8px; cursor: pointer;" onclick="ZhiLiaoBujuModule.viewImage('${url}')"></div>`;
                } else {
                    const icon = 'fa-file';
                    return `<div class="message-file"><i class="fa-solid ${icon}"></i> ${file.name}</div>`;
                }
            }).join('');
            div.innerHTML = filesHtml + '<div>' + this.escapeHtml(text) + '</div>';
        } else {
            div.textContent = text;
        }

        container.appendChild(div);
        this.scrollToBottom();
    },

    /**
     * 添加系统消息
     * @param {string} text - 消息文本
     */
    addSystemMessage(text) {
        const container = document.getElementById('message-container');
        const div = document.createElement('div');
        div.className = 'system-message';
        div.innerHTML = `
            <img src="logo/ai.svg" alt="AI" class="system-avatar">
            <div class="system-text text-gray-700">${this.renderMarkdown(text)}</div>
        `;
        container.appendChild(div);
        this.scrollToBottom();
    },

    /**
     * 滚动到底部
     */
    scrollToBottom() {
        const container = document.getElementById('message-container');
        if (container) container.scrollTop = container.scrollHeight;
    },

    /**
     * Toast 提示（左下角滑出）
     * @param {string} message - 提示消息
     * @param {string} type - 提示类型（'warning' | 'error' | 'success' | 'info'）
     */
    showToast(message, type = 'warning') {
        // 创建或获取 toast 容器
        let container = document.getElementById('zhiliao-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'zhiliao-toast-container';
            document.body.appendChild(container);
        }

        // 创建 toast 元素
        const toast = document.createElement('div');
        toast.className = `zhiliao-toast zhiliao-toast-${type}`;

        const icons = {
            warning: 'fa-triangle-exclamation',
            error: 'fa-circle-xmark',
            success: 'fa-circle-check',
            info: 'fa-circle-info'
        };

        toast.innerHTML = `
            <i class="fa-solid ${icons[type] || icons.warning}"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // 触发动画
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // 3秒后自动消失
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    /**
     * 查看图片（全屏遮罩，支持缩放和拖拽）
     * @param {string} url - 图片URL
     */
    viewImage(url) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999;overflow:hidden;';

        // 关闭按钮
        const closeBtn = document.createElement('div');
        closeBtn.style.cssText = 'position:absolute;top:16px;right:16px;width:36px;height:36px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:20px;color:#fff;z-index:10000;';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => overlay.remove();

        // 图片
        const img = document.createElement('img');
        img.src = url;
        img.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:90%;max-height:90%;object-fit:contain;cursor:grab;';

        let scale = 1, posX = 0, posY = 0;
        const minScale = 0.5, maxScale = 5;

        const updateTransform = () => {
            img.style.transform = `translate(calc(-50% + ${posX}px), calc(-50% + ${posY}px)) scale(${scale})`;
        };

        // 鼠标滚轮缩放
        overlay.onwheel = (e) => {
            e.preventDefault();
            scale += e.deltaY > 0 ? -0.2 : 0.2;
            scale = Math.max(minScale, Math.min(maxScale, scale));
            updateTransform();
        };

        // 鼠标拖拽
        let isDragging = false, startX = 0, startY = 0;
        img.onmousedown = (e) => {
            isDragging = true;
            startX = e.clientX - posX;
            startY = e.clientY - posY;
            img.style.cursor = 'grabbing';
        };
        overlay.onmousemove = (e) => {
            if (!isDragging) return;
            posX = e.clientX - startX;
            posY = e.clientY - startY;
            updateTransform();
        };
        overlay.onmouseup = () => {
            isDragging = false;
            img.style.cursor = 'grab';
        };

        // 手机触屏
        let lastDist = 0, lastX = 0, lastY = 0, touching = false;
        overlay.ontouchstart = (e) => {
            if (e.touches.length === 2) {
                lastDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
            } else if (e.touches.length === 1) {
                touching = true;
                lastX = e.touches[0].pageX;
                lastY = e.touches[0].pageY;
            }
        };
        overlay.ontouchmove = (e) => {
            e.preventDefault();
            if (e.touches.length === 2) {
                const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
                scale *= dist / lastDist;
                scale = Math.max(minScale, Math.min(maxScale, scale));
                lastDist = dist;
                updateTransform();
            } else if (e.touches.length === 1 && touching) {
                posX += e.touches[0].pageX - lastX;
                posY += e.touches[0].pageY - lastY;
                lastX = e.touches[0].pageX;
                lastY = e.touches[0].pageY;
                updateTransform();
            }
        };
        overlay.ontouchend = () => { touching = false; };

        overlay.appendChild(img);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);
    },

    /**
     * HTML转义
     * @param {string} text - 原始文本
     * @returns {string} 转义后的文本
     */
    escapeHtml(text) {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    /**
     * 部分 Markdown 渲染（用于流式输出）
     * @param {string} text - Markdown文本
     * @returns {string} HTML字符串
     */
    renderMarkdownPartial(text) {
        return this.escapeHtml(text).replace(/\n/g, '<br>');
    },

    /**
     * Markdown 渲染（完整版）
     * @param {string} text - Markdown文本
     * @returns {string} HTML字符串
     */
    renderMarkdown(text) {
        let html = this.escapeHtml(text).replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
            `<pre><code class="language-${lang}">${code.trim()}</code></pre>`);
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // 处理链接 [text](url) - 在新窗口打开，蓝色显示
        html = html.replace(/\[([^\]]+)\]\(([^)]*)\)/g, (_, text, url) => {
            if (!url || url.trim() === '') {
                // URL为空，只显示文字
                return text;
            }
            // 恢复URL中被转义的字符
            const decodedUrl = url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            return `<a href="${decodedUrl}" target="_blank" rel="noopener noreferrer" style="color: #3d6dff; text-decoration: underline;">${text}</a>`;
        });
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        if (!html.startsWith('<pre>') && !html.startsWith('<p>')) {
            html = '<p>' + html + '</p>';
        }
        return html;
    },

    // ========== 文件分析状态显示方法（从fenx.js迁移）==========

    /**
     * 开始计时
     * @param {string} timerId - 计时器ID
     */
    startTiming(timerId) {
        if (window.UtilsModule) {
            window.UtilsModule.Timer.start(timerId);
        }
    },

    /**
     * 获取分析时长（秒）
     * @param {string} timerId - 计时器ID
     * @returns {number} 时长（秒）
     */
    getAnalysisDuration(timerId) {
        if (window.UtilsModule) {
            return window.UtilsModule.Timer.getDuration(timerId);
        }
        return 0;
    },

    /**
     * 停止计时
     * @param {string} timerId - 计时器ID
     * @returns {number} 时长（秒）
     */
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

    /**
     * 创建多文件上传中的 HTML（带进度和动态计时）
     * @param {string} uploadId - 上传ID
     * @param {number} fileCount - 文件数量
     * @returns {string} HTML字符串
     */
    createMultiFileUploadingHTML(uploadId, fileCount) {
        return `
            <div class="thinking-block">
                <div class="thinking-header">
                    <div class="thinking-header-icon">
                        <div class="spinner"></div>
                    </div>
                    <div class="thinking-header-text">
                        <span id="${uploadId}-progress">正在上传文件（0/${fileCount}）</span>
                        <span id="${uploadId}-timer" style="color: #999; margin-left: 4px;">0秒</span>
                    </div>
                </div>
                <div id="${uploadId}-files" style="margin-top: 8px; font-size: 13px; color: #666;"></div>
            </div>
        `;
    },

    /**
     * 创建单文件上传中的 HTML（带动态计时）
     * @param {string} uploadId - 上传ID
     * @returns {string} HTML字符串
     */
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

    /**
     * 创建分析中的 HTML（带动态计时）
     * @param {string} analysisId - 分析ID
     * @returns {string} HTML字符串
     */
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

    /**
     * 启动动态计时器
     * @param {string} analysisId - 分析ID
     */
    startTimer(analysisId) {
        const timerElement = document.getElementById(`${analysisId}-timer`);
        if (!timerElement) return;

        this.state.timerInterval = setInterval(() => {
            const duration = this.getAnalysisDuration(analysisId);
            timerElement.textContent = `${duration}秒`;
        }, 1000);
    },

    /**
     * 更新多文件上传进度
     * @param {string} uploadId - 上传ID
     * @param {number} current - 当前进度
     * @param {number} total - 总数
     */
    updateFileProgress(uploadId, current, total) {
        const progressElement = document.getElementById(`${uploadId}-progress`);
        if (progressElement) {
            progressElement.textContent = `正在上传文件（${current}/${total}）`;
        }
    },

    /**
     * 更新文件状态列表
     * @param {string} uploadId - 上传ID
     * @param {string} fileName - 文件名
     * @param {string} status - 状态（uploading/success/error）
     * @param {string} message - 消息
     */
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

    /**
     * 清除分析状态
     */
    clearAnalysis() {
        this.stopTiming();
    }
};

// 导出模块
window.ZhiLiaoBujuModule = ZhiLiaoBujuModule;

// 兼容层：保持FenxModule的引用（从fenx.js迁移）
window.FenxModule = ZhiLiaoBujuModule;
