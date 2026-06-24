const ZhiLiaoJiaohuModule = {
    state: {
        fileDropNavigationGuardBound: false
    },

    bindEvents(moduleState, sendMessageCallback) {
        const textarea = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');
        const thinkButton = document.getElementById('think-button');
        const uploadButton = document.getElementById('upload-button');
        const fileInput = document.getElementById('file-input');

        if (thinkButton) {
            thinkButton.classList.toggle('active', moduleState.enableThinking === true);
        }

        // Auto-resize textarea while typing.
        textarea?.addEventListener('input', () => this.autoResizeTextarea(textarea));

        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        textarea?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !isMobileDevice && !e.shiftKey) {
                // If command menu is open, let it handle Enter.
                if (window.ZhiLiaoCaidanModule?.state?.isMenuVisible) {
                    return;
                }
                e.preventDefault();
                sendMessageCallback();
            }
        });

        textarea?.addEventListener('paste', (e) => this.handlePaste(e, moduleState));

        const sendArea = document.getElementById('chat-footer');
        sendArea?.addEventListener('dragover', (e) => this.handleDragOver(e));
        sendArea?.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        sendArea?.addEventListener('drop', (e) => this.handleDrop(e, moduleState));
        this.bindFileDropNavigationGuard();

        sendButton?.addEventListener('click', () => {
            if (moduleState.isWaitingResponse) {
                this.stopResponse(moduleState);
            } else {
                sendMessageCallback();
            }
        });

        // Toggle thinking mode.
        thinkButton?.addEventListener('click', () => {
            thinkButton.classList.toggle('active');
            moduleState.enableThinking = thinkButton.classList.contains('active');
        });

        uploadButton?.addEventListener('click', () => fileInput?.click());
        fileInput?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files, moduleState);
                fileInput.value = '';
            }
        });

        const newSessionButton = document.getElementById('new-session-button');
        newSessionButton?.addEventListener('click', () => {
            window.ZhiLiaoModule?.startNewSession?.();
        });
    },

    async handleFileUpload(files, moduleState) {
        const maxFiles = 5;
        const maxSizeMB = 10;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;

        for (const file of files) {
            if (moduleState.uploadedFiles.length >= maxFiles) {
                window.ZhiLiaoBujuModule?.showToast?.(`最多上传 ${maxFiles} 个文件`, 'warning');
                break;
            }

            if (file.size > maxSizeBytes) {
                window.ZhiLiaoBujuModule?.showToast?.(`文件大小需小于${maxSizeMB}MB`, 'warning');
                continue;
            }

            if (window.FileParserModule && !FileParserModule.isSupported(file.name)) {
                window.ZhiLiaoBujuModule?.showToast?.(`不支持的文件格式: ${file.name}`, 'error');
                continue;
            }

            moduleState.uploadedFiles.push(file);
        }

        window.ZhiLiaoBujuModule?.updateFileTags?.(moduleState.uploadedFiles);
    },

    handlePaste(e, moduleState) {
        const clipboardData = e.clipboardData;
        if (!clipboardData?.items) return;

        const pastedFiles = [];

        for (const item of clipboardData.items) {
            if (item.kind !== 'file') continue;
            const file = item.getAsFile();
            if (!file) continue;

            if (file.type.startsWith('image/')) {
                const ext = file.type.split('/')[1] || 'png';
                const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
                const newFile = new File([file], `粘贴图片_${timestamp}.${ext}`, { type: file.type });
                pastedFiles.push(newFile);
            } else {
                pastedFiles.push(file);
            }
        }

        if (pastedFiles.length > 0) {
            e.preventDefault();
            this.handleFileUpload(pastedFiles, moduleState);
        }
    },

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget?.classList.add('drag-over');
    },

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        const target = e.currentTarget;
        const next = e.relatedTarget;
        if (!target || (next && target.contains(next))) return;
        target.classList.remove('drag-over');
    },

    handleDrop(e, moduleState) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget?.classList.remove('drag-over');

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            this.handleFileUpload(files, moduleState);
        }
    },

    preventFileDropNavigation(e) {
        const types = Array.from(e.dataTransfer?.types || []);
        if (!types.includes('Files')) return;
        e.preventDefault();
    },

    bindFileDropNavigationGuard() {
        if (this.state.fileDropNavigationGuardBound) return;
        document.addEventListener('dragover', (e) => this.preventFileDropNavigation(e));
        document.addEventListener('drop', (e) => this.preventFileDropNavigation(e));
        this.state.fileDropNavigationGuardBound = true;
    },

    removeFile(index, moduleState) {
        moduleState.uploadedFiles.splice(index, 1);
        window.ZhiLiaoBujuModule?.updateFileTags?.(moduleState.uploadedFiles);
    },

    autoResizeTextarea(textarea) {
        if (!textarea) return;
        textarea.style.height = 'auto';
        const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight);
        const maxHeight = lineHeight * 6;
        textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
    },

    updateSendButton(isLoading) {
        const sendButton = document.getElementById('send-button');
        if (!sendButton) return;

        sendButton.innerHTML = isLoading ? '<i class="fa-solid fa-stop"></i>' : '<i class="fa-solid fa-arrow-up"></i>';
        sendButton.classList.toggle('bg-red-500', isLoading);
        sendButton.classList.toggle('ds-bg-blue', !isLoading);
    },

    stopResponse(moduleState) {
        if (moduleState.currentAbortController) {
            moduleState.currentAbortController.abort();
            moduleState.currentAbortController = null;
        }
    },

    handleAbortedResponse(thinkingContainer, textContainer, moduleState) {
        if (moduleState.enableThinking && thinkingContainer && thinkingContainer.innerHTML) {
            const thinkingId = 'stopped-thinking-' + Date.now();
            const duration = window.ShendModule?.getThinkingDuration() || 0;
            const currentContent = thinkingContainer.querySelector('.thinking-content');
            const contentHtml = currentContent ? currentContent.innerHTML : '';
            const stoppedHtml = window.ShendModule?.createStoppedHTML?.(thinkingId, contentHtml, duration);
            if (stoppedHtml) thinkingContainer.innerHTML = stoppedHtml;
        }

        if (!textContainer) return;

        const currentText = textContainer.innerText || '';
        const isOnlyLoading = !currentText ||
            currentText.includes('正在回复') ||
            currentText.includes('正在分析') ||
            currentText.includes('正在上传') ||
            currentText.includes('正在处理');

        if (isOnlyLoading && !moduleState.enableThinking) {
            textContainer.innerHTML = '<p>用户已暂停对话！</p>';
            textContainer.dataset.fullText = '用户已暂停对话！';
            return;
        }

        if (!isOnlyLoading && moduleState.enableThinking !== true) {
            textContainer.dataset.fullText = currentText;
            moduleState.messageHistory.push({ role: 'assistant', content: currentText });
        }
    },

    toggleThinking(id) {
        const content = document.getElementById(id);
        const arrow = document.getElementById(id + '-arrow');
        if (!content) return;

        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        if (arrow) arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    },

    async copyToClipboard(button) {
        const actionsDiv = button.closest('.message-actions');
        const systemMessage = actionsDiv?.previousElementSibling;
        if (!systemMessage) return;

        const payload = this.buildClipboardPayload(systemMessage);

        try {
            await this.writeClipboardPayload(payload);
            this.markCopySuccess(button);
        } catch {
            window.ZhiLiaoBujuModule?.showToast?.('复制失败，请重试。', 'error');
        }
    },

    buildClipboardPayload(systemMessage) {
        const textContainer = systemMessage.querySelector('[data-full-text]');
        const systemText = systemMessage.querySelector('.system-text');
        const plainText = textContainer
            ? (textContainer.dataset.fullText || '')
            : (systemText?.innerText || '');
        const htmlText = window.ZhiLiaoMessageRendererModule.buildClipboardHtml(systemText, plainText);

        return {
            plainText: plainText || '',
            htmlText: htmlText || ''
        };
    },

    async writeClipboardPayload({ plainText = '', htmlText = '' } = {}) {
        if (navigator.clipboard?.write && window.ClipboardItem && htmlText) {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/plain': new Blob([plainText], { type: 'text/plain' }),
                        'text/html': new Blob([htmlText], { type: 'text/html' })
                    })
                ]);
                return;
            } catch {
                // Fall back to plain text below.
            }
        }

        await navigator.clipboard.writeText(plainText || '');
    },

    markCopySuccess(button) {
        button.innerHTML = '<i class="fa-solid fa-check"></i>';
        button.classList.add('copied');
        setTimeout(() => {
            button.innerHTML = '<i class="fa-regular fa-copy"></i>';
            button.classList.remove('copied');
        }, 2000);
    },

    async regenerateResponse(messageIndex, moduleState, streamAPICallback) {
        if (moduleState.isWaitingResponse) return;

        const userMessage = moduleState.messageHistory[messageIndex];
        if (!userMessage || userMessage.role !== 'user') return;

        moduleState.messageHistory = moduleState.messageHistory.slice(0, messageIndex + 1);

        const container = document.getElementById('message-container');
        const messages = container?.children;
        if (messages) {
            while (messages.length > messageIndex + 1) {
                container.removeChild(messages[messages.length - 1]);
            }
        }

        moduleState.isWaitingResponse = true;
        this.updateSendButton(true);

        try {
            const containers = window.ZhiLiaoBujuModule?.createStreamingMessage();
            if (!containers) return;

            const streamResult = await streamAPICallback(containers.textContainer, containers.thinkingContainer);
            const finalText = containers.textContainer.dataset.fullText || containers.textContainer.innerText;
            if (!streamResult?.historyCommitted) {
                const assistantMessage = window.ZhiLiaoModule?.createAssistantHistoryMessage
                    ? window.ZhiLiaoModule.createAssistantHistoryMessage(finalText, streamResult)
                    : { role: 'assistant', content: finalText };
                moduleState.messageHistory.push(assistantMessage);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                window.ZhiLiaoBujuModule?.addSystemMessage?.(`错误: ${error.message}`);
            }
        } finally {
            moduleState.isWaitingResponse = false;
            moduleState.currentAbortController = null;
            this.updateSendButton(false);
        }
    }
};

window.ZhiLiaoJiaohuModule = ZhiLiaoJiaohuModule;
