/**
 * 智聊交互逻辑模块
 *
 * 职责：
 * 1. 事件绑定（输入框、按钮、文件上传等）
 * 2. 用户交互处理（粘贴、拖拽、点击等）
 * 3. 文件上传管理
 * 4. 响应控制（停止、重新生成）
 * 5. 剪贴板操作
 *
 * 从 zhiliao/app.js 中提取
 */
const ZhiLiaoJiaohuModule = {
    /**
     * 绑定所有事件
     * @param {Object} moduleState - 模块状态对象
     * @param {Function} sendMessageCallback - 发送消息回调
     */
    bindEvents(moduleState, sendMessageCallback) {
        const textarea = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');
        const thinkButton = document.getElementById('think-button');
        const networkButton = document.getElementById('network-button');
        const uploadButton = document.getElementById('upload-button');
        const fileInput = document.getElementById('file-input');

        // 输入框自动调整高度
        textarea?.addEventListener('input', () => this.autoResizeTextarea(textarea));

        // 回车发送消息（电脑端Enter发送/Shift+Enter换行，手机端Enter换行/按钮发送）
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        textarea?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !isMobileDevice && !e.shiftKey) {
                // 如果指令菜单可见，让指令系统处理回车
                if (window.ZhiLiaoCaidanModule?.state?.isMenuVisible) {
                    return;
                }
                e.preventDefault();
                sendMessageCallback();
            }
        });

        // 粘贴事件处理（支持粘贴图片）
        textarea?.addEventListener('paste', (e) => this.handlePaste(e, moduleState));

        // 拖拽事件处理
        const chatPage = document.getElementById('page-chat');
        chatPage?.addEventListener('dragover', (e) => this.handleDragOver(e));
        chatPage?.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        chatPage?.addEventListener('drop', (e) => this.handleDrop(e, moduleState));

        // 发送按钮点击
        sendButton?.addEventListener('click', () => {
            if (moduleState.isWaitingResponse) {
                this.stopResponse(moduleState);
            } else {
                sendMessageCallback();
            }
        });

        // 思考模式切换
        thinkButton?.addEventListener('click', () => {
            thinkButton.classList.toggle('active');
            moduleState.enableThinking = thinkButton.classList.contains('active');
        });

        // 联网模式切换
        networkButton?.addEventListener('click', () => {
            networkButton.classList.toggle('active');
            moduleState.enableNetwork = networkButton.classList.contains('active');
        });

        // 文件上传按钮
        uploadButton?.addEventListener('click', () => fileInput?.click());
        fileInput?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files, moduleState);
                fileInput.value = '';
            }
        });
    },

    /**
     * 处理文件上传
     * @param {FileList} files - 文件列表
     * @param {Object} moduleState - 模块状态对象
     */
    async handleFileUpload(files, moduleState) {
        const maxFiles = 5;
        const maxSizeMB = 10;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;

        for (const file of files) {
            // 检查文件数量限制
            if (moduleState.uploadedFiles.length >= maxFiles) {
                if (window.ZhiLiaoBujuModule) {
                    ZhiLiaoBujuModule.showToast(`最多上传${maxFiles}个文件`, 'warning');
                }
                break;
            }

            // 检查文件大小限制
            if (file.size > maxSizeBytes) {
                if (window.ZhiLiaoBujuModule) {
                    ZhiLiaoBujuModule.showToast(`文件大小需小于${maxSizeMB}MB`, 'warning');
                }
                continue;
            }

            // 检查文件是否支持
            if (window.FileParserModule && !FileParserModule.isSupported(file.name)) {
                if (window.ZhiLiaoBujuModule) {
                    ZhiLiaoBujuModule.showToast(`不支持的文件格式: ${file.name}`, 'error');
                }
                continue;
            }

            // 添加到上传列表
            moduleState.uploadedFiles.push(file);
        }

        // 更新文件标签显示
        if (window.ZhiLiaoBujuModule) {
            ZhiLiaoBujuModule.updateFileTags(moduleState.uploadedFiles);
        }
    },

    /**
     * 处理粘贴事件
     * @param {ClipboardEvent} e - 粘贴事件
     * @param {Object} moduleState - 模块状态对象
     */
    handlePaste(e, moduleState) {
        const clipboardData = e.clipboardData;
        if (!clipboardData?.items) return;

        const pastedFiles = [];

        // 从 items 获取文件
        for (const item of clipboardData.items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    // 图片重命名
                    if (file.type.startsWith('image/')) {
                        const ext = file.type.split('/')[1] || 'png';
                        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
                        const newFile = new File([file], `粘贴图片_${timestamp}.${ext}`, { type: file.type });
                        pastedFiles.push(newFile);
                    } else {
                        pastedFiles.push(file);
                    }
                }
            }
        }

        // 如果有文件，添加到上传列表
        if (pastedFiles.length > 0) {
            e.preventDefault();
            this.handleFileUpload(pastedFiles, moduleState);
        }
    },

    /**
     * 处理拖拽悬停
     * @param {DragEvent} e - 拖拽事件
     */
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        const chatPage = document.getElementById('page-chat');
        chatPage?.classList.add('drag-over');
    },

    /**
     * 处理拖拽离开
     * @param {DragEvent} e - 拖拽事件
     */
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        const chatPage = document.getElementById('page-chat');
        chatPage?.classList.remove('drag-over');
    },

    /**
     * 处理拖拽放下
     * @param {DragEvent} e - 拖拽事件
     * @param {Object} moduleState - 模块状态对象
     */
    handleDrop(e, moduleState) {
        e.preventDefault();
        e.stopPropagation();
        const chatPage = document.getElementById('page-chat');
        chatPage?.classList.remove('drag-over');

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            this.handleFileUpload(files, moduleState);
        }
    },

    /**
     * 移除文件
     * @param {number} index - 文件索引
     * @param {Object} moduleState - 模块状态对象
     */
    removeFile(index, moduleState) {
        moduleState.uploadedFiles.splice(index, 1);
        if (window.ZhiLiaoBujuModule) {
            ZhiLiaoBujuModule.updateFileTags(moduleState.uploadedFiles);
        }
    },

    /**
     * 自动调整textarea高度
     * @param {HTMLTextAreaElement} textarea - 文本框元素
     */
    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight);
        const maxHeight = lineHeight * 6;
        textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
    },

    /**
     * 更新发送按钮状态
     * @param {boolean} isLoading - 是否加载中
     */
    updateSendButton(isLoading) {
        const sendButton = document.getElementById('send-button');
        if (!sendButton) return;

        sendButton.innerHTML = isLoading ? '<i class="fa-solid fa-stop"></i>' : '<i class="fa-solid fa-arrow-up"></i>';
        sendButton.classList.toggle('bg-red-500', isLoading);
        sendButton.classList.toggle('ds-bg-blue', !isLoading);
    },

    /**
     * 停止响应
     * @param {Object} moduleState - 模块状态对象
     */
    stopResponse(moduleState) {
        if (moduleState.currentAbortController) {
            moduleState.currentAbortController.abort();
            moduleState.currentAbortController = null;
        }
    },

    /**
     * 处理中止的响应
     * @param {HTMLElement} thinkingContainer - 思考容器
     * @param {HTMLElement} textContainer - 文本容器
     * @param {Object} moduleState - 模块状态对象
     */
    handleAbortedResponse(thinkingContainer, textContainer, moduleState) {
        // 深度思考模式：更新思考区域为已停止状态
        if (moduleState.enableThinking && thinkingContainer && thinkingContainer.innerHTML) {
            const thinkingId = 'stopped-thinking-' + Date.now();
            const duration = window.ShendModule?.getThinkingDuration() || 0;

            // 获取当前思考内容
            const currentContent = thinkingContainer.querySelector('.thinking-content');
            const contentHtml = currentContent ? currentContent.innerHTML : '';

            if (window.ShendModule) {
                thinkingContainer.innerHTML = ShendModule.createStoppedHTML(thinkingId, contentHtml, duration);
            }
        }

        // 处理文本内容
        if (textContainer) {
            const currentText = textContainer.innerText || '';
            // 检查是否只有加载动画（没有实际内容）
            const isOnlyLoading = !currentText ||
                currentText.includes('正在回复') ||
                currentText.includes('正在分析') ||
                currentText.includes('正在上传');

            if (isOnlyLoading && !moduleState.enableThinking) {
                // 普通对话模式，显示暂停提示（正常字体样式）
                textContainer.innerHTML = '<p>用户已暂停对话！</p>';
                textContainer.dataset.fullText = '用户已暂停对话！';
            } else if (!isOnlyLoading) {
                // 有实际内容，保存已生成的内容
                textContainer.dataset.fullText = currentText;
                moduleState.messageHistory.push({ role: 'assistant', content: currentText });
            }
        }
    },

    /**
     * 切换思维链显示
     * @param {string} id - 思维链容器ID
     */
    toggleThinking(id) {
        const content = document.getElementById(id);
        const arrow = document.getElementById(id + '-arrow');
        if (!content) return;

        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        if (arrow) arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    },

    /**
     * 复制到剪贴板
     * @param {HTMLElement} button - 复制按钮元素
     */
    async copyToClipboard(button) {
        const actionsDiv = button.closest('.message-actions');
        const systemMessage = actionsDiv.previousElementSibling;
        const textContainer = systemMessage.querySelector('[data-full-text]');
        const text = textContainer ? textContainer.dataset.fullText : systemMessage.querySelector('.system-text').innerText;

        try {
            await navigator.clipboard.writeText(text);
            button.innerHTML = '<i class="fa-solid fa-check"></i>';
            button.classList.add('copied');
            setTimeout(() => {
                button.innerHTML = '<i class="fa-regular fa-copy"></i>';
                button.classList.remove('copied');
            }, 2000);
        } catch (err) {
            alert('复制失败，请手动复制');
        }
    },

    /**
     * 重新回复
     * @param {number} messageIndex - 消息索引
     * @param {Object} moduleState - 模块状态对象
     * @param {Function} streamAPICallback - 流式API回调
     */
    async regenerateResponse(messageIndex, moduleState, streamAPICallback) {
        if (moduleState.isWaitingResponse) return;

        const userMessage = moduleState.messageHistory[messageIndex];
        if (!userMessage || userMessage.role !== 'user') return;

        moduleState.messageHistory = moduleState.messageHistory.slice(0, messageIndex + 1);

        const container = document.getElementById('message-container');
        const messages = container.children;
        while (messages.length > messageIndex + 1) {
            container.removeChild(messages[messages.length - 1]);
        }

        moduleState.isWaitingResponse = true;
        this.updateSendButton(true);

        try {
            const containers = window.ZhiLiaoBujuModule?.createStreamingMessage();
            if (!containers) return;

            await streamAPICallback(containers.textContainer, containers.thinkingContainer);

            const finalText = containers.textContainer.dataset.fullText || containers.textContainer.innerText;
            moduleState.messageHistory.push({ role: 'assistant', content: finalText });
        } catch (error) {
            if (error.name !== 'AbortError') {
                if (window.ZhiLiaoBujuModule) {
                    ZhiLiaoBujuModule.addSystemMessage(`错误: ${error.message}`);
                }
            }
        } finally {
            moduleState.isWaitingResponse = false;
            moduleState.currentAbortController = null;
            this.updateSendButton(false);
        }
    }
};

// 导出模块
window.ZhiLiaoJiaohuModule = ZhiLiaoJiaohuModule;
