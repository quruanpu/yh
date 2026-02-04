// 智聊模块 - 完全独立的AI聊天模块
// 文件MIME类型映射
const MEDIA_TYPES = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'txt': 'text/plain',
    'md': 'text/markdown'
};

const ZhiLiaoModule = {
    // AI 配置
    config: {
        apiKey: window.ZhiLiaoConfig?.api.key || 'b19c0371e3af4b5b83c6682baff9ac30.ruRGrlPzrOZ5YjAp',
        apiUrl: window.ZhiLiaoConfig?.api.baseUrl || 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        systemPrompt: `你是运小助，由运小助团队创造的小助手。我温暖细腻又专业，会认真理解你的需求，说话自然亲切。

【回复风格】
用书面化、口语化的自然语句回复，像朋友聊天一样。
结构清晰但不依赖特殊符号，用emoji和换行来组织内容。
语气亲切有温度，结尾可以加互动提问。

【格式规范】
可以用emoji作为小标题分隔（如📅、🍜、📌、💡）
列表直接换行，不用特殊符号
层级用缩进表示，简洁明了

【禁止使用】
不用 # ## ### 等markdown标题
不用 ** *** 等加粗符号
不用 → • 等列表符号
不用「」这类书名号包裹
不用代码块展示普通文本

【回复示例】
📊 文件分析结果

这是一份10月促销活动表，包含57种药品。

主要信息：
活动时间：10月15日
优惠力度：全场98折
药品数量：57种
价格区间：9.75元 - 156元

需要我帮你生成价格分布图吗？😊

【文件处理】
默认只分析当前上传的文件
如果你提到"之前的"、"对比一下"等，我会主动查看历史文件

【图表生成】
必须调用工具生成，不在文字里描述
数据已知时直接调用 generate_chart_from_statistics

【药品图片识别】
当用户上传药品/商品图片时：
1. 识别图片中的商品编码、药品名称或国药准字号
2. 识别到信息后，立即调用 search_product 工具查询，不要先描述识别结果
3. 工具会自动展示商品卡片，你只需在卡片后简短确认即可
4. 如果图片模糊无法识别，再提示用户重新拍摄`,
        maxTokens: 16384,
        temperature: 0.7,
        maxHistoryRounds: window.ZhiLiaoConfig?.message.maxHistoryRounds || 10, // 保留最近10轮对话
        maxHistoryTokens: window.ZhiLiaoConfig?.message.maxTokens || 80000 // 历史消息最大token数
    },

    // 模块状态
    state: {
        messageHistory: [],
        isWaitingResponse: false,
        enableThinking: false,
        enableNetwork: false,
        currentAbortController: null,
        container: null,
        isVisible: false,
        uploadedFiles: [], // 存储上传的文件
        sessionId: null // 当前会话ID
    },

    // 初始化模块
    async init() {
        this.loadSubModules();
        this.render();
        this.bindEvents();

        // 初始化数据库
        if (window.DBModule) {
            await DBModule.init();

            // 自动清理1小时前的旧数据（每次刷新清理）
            try {
                const hoursToKeep = window.ZhiLiaoConfig?.cleanup.hoursToKeep || 1;
                const cleanupResult = await DBModule.cleanupOldData(hoursToKeep);
                if (cleanupResult.success && (cleanupResult.deletedFiles > 0 || cleanupResult.deletedMessages > 0)) {
                    console.log(`自动清理完成（保留${hoursToKeep}小时内数据）:`, cleanupResult);
                }
            } catch (error) {
                console.error('自动清理失败:', error);
            }
        }

        // 生成会话ID（简化版：不需要持久化会话）
        this.state.sessionId = 'session-' + Date.now();

        // 初始化指令系统
        setTimeout(() => {
            if (window.ZhiLiaoCaidanModule) {
                ZhiLiaoCaidanModule.init();
            }
        }, 500);

        AppFramework.setModuleInstance('zhiliao', this);
    },

    // 加载子模块
    loadSubModules() {
        const basePath = 'zhiliao/gongj/';
        // 注意：db.js 必须在列表中，否则文件上传功能会因为 DBModule 未加载而失败
        const modules = ['db.js', 'jiex.js', 'shend.js', 'web.js', 'fenx.js', 'lishi.js', 'chart.js'];

        modules.forEach(mod => {
            if (!document.querySelector(`script[src="${basePath}${mod}"]`)) {
                const script = document.createElement('script');
                script.src = basePath + mod;
                document.head.appendChild(script);
            }
        });

        // 加载指令系统
        const caidanPath = 'zhiliao/gongj/caidan/';
        // CSS
        if (!document.querySelector(`link[href="${caidanPath}caidan.css"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = caidanPath + 'caidan.css';
            document.head.appendChild(link);
        }
        // JS模块
        ['app.js', 'huodong/jx.js', 'huodong/hd.js', 'chaxun/cx.js'].forEach(mod => {
            if (!document.querySelector(`script[src="${caidanPath}${mod}"]`)) {
                const script = document.createElement('script');
                script.src = caidanPath + mod;
                document.head.appendChild(script);
            }
        });

        // 查询命令CSS
        if (!document.querySelector(`link[href="${caidanPath}chaxun/cx.css"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = caidanPath + 'chaxun/cx.css';
            document.head.appendChild(link);
        }

        // 商品查询模块CSS（复用卡片样式）
        if (!document.querySelector('link[href="gongn/chaxun/gg.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'gongn/chaxun/gg.css';
            document.head.appendChild(link);
        }
    },

    // 渲染页面结构
    render() {
        const container = document.getElementById('module-container');
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
        this.state.container = container;
    },

    // 绑定事件
    bindEvents() {
        const textarea = document.getElementById('message-input');
        const sendButton = document.getElementById('send-button');
        const thinkButton = document.getElementById('think-button');
        const networkButton = document.getElementById('network-button');
        const uploadButton = document.getElementById('upload-button');
        const fileInput = document.getElementById('file-input');

        textarea?.addEventListener('input', () => this.autoResizeTextarea(textarea));
        textarea?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !AppFramework.isMobile && !e.shiftKey) {
                // 如果指令菜单可见，让指令系统处理回车
                if (window.ZhiLiaoCaidanModule?.state?.isMenuVisible) {
                    return;
                }
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 粘贴事件处理（支持粘贴图片）
        textarea?.addEventListener('paste', (e) => this.handlePaste(e));

        // 拖拽事件处理
        const chatPage = document.getElementById('page-chat');
        chatPage?.addEventListener('dragover', (e) => this.handleDragOver(e));
        chatPage?.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        chatPage?.addEventListener('drop', (e) => this.handleDrop(e));

        sendButton?.addEventListener('click', () => {
            if (this.state.isWaitingResponse) {
                this.stopResponse();
            } else {
                this.sendMessage();
            }
        });

        thinkButton?.addEventListener('click', () => {
            thinkButton.classList.toggle('active');
            this.state.enableThinking = thinkButton.classList.contains('active');
        });

        networkButton?.addEventListener('click', () => {
            networkButton.classList.toggle('active');
            this.state.enableNetwork = networkButton.classList.contains('active');
        });

        uploadButton?.addEventListener('click', () => fileInput?.click());
        fileInput?.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files);
                fileInput.value = '';
            }
        });
    },

    // 显示模块
    show() {
        this.state.isVisible = true;
        document.getElementById('page-chat')?.style.setProperty('display', 'flex');
        document.getElementById('chat-footer')?.style.setProperty('display', 'flex');
    },

    // 隐藏模块
    hide() {
        this.state.isVisible = false;
        document.getElementById('page-chat')?.style.setProperty('display', 'none');
        document.getElementById('chat-footer')?.style.setProperty('display', 'none');
    },

    // 处理文件上传
    async handleFileUpload(files) {
        const maxFiles = 5;
        const maxSizeMB = 10;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;

        for (const file of files) {
            // 检查文件数量限制
            if (this.state.uploadedFiles.length >= maxFiles) {
                this.showToast(`最多上传${maxFiles}个文件`, 'warning');
                break;
            }

            // 检查文件大小限制
            if (file.size > maxSizeBytes) {
                this.showToast(`文件大小需小于${maxSizeMB}MB`, 'warning');
                continue;
            }

            // 检查文件是否支持
            if (window.FileParserModule && !FileParserModule.isSupported(file.name)) {
                this.showToast(`不支持的文件格式: ${file.name}`, 'error');
                continue;
            }

            // 添加到上传列表
            this.state.uploadedFiles.push(file);
        }

        // 更新文件标签显示
        this.updateFileTags();
    },

    // 处理粘贴事件
    handlePaste(e) {
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
            this.handleFileUpload(pastedFiles);
        }
    },

    // 处理拖拽悬停
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        const chatPage = document.getElementById('page-chat');
        chatPage?.classList.add('drag-over');
    },

    // 处理拖拽离开
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        const chatPage = document.getElementById('page-chat');
        chatPage?.classList.remove('drag-over');
    },

    // 处理拖拽放下
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        const chatPage = document.getElementById('page-chat');
        chatPage?.classList.remove('drag-over');

        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            this.handleFileUpload(files);
        }
    },

    // 更新文件标签显示
    updateFileTags() {
        const container = document.getElementById('file-tags-container');
        if (!container) return;

        if (this.state.uploadedFiles.length === 0) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        container.style.display = 'flex';
        container.innerHTML = this.state.uploadedFiles.map((file, index) => {
            const isImage = file.type.startsWith('image/');
            const icon = isImage ? 'fa-image' : 'fa-file';
            return `
                <div class="file-tag">
                    <i class="fa-solid ${icon}"></i>
                    <span>${file.name}</span>
                    <button class="file-tag-remove" onclick="ZhiLiaoModule.removeFile(${index})">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        }).join('');
    },

    // 移除文件
    removeFile(index) {
        this.state.uploadedFiles.splice(index, 1);
        this.updateFileTags();
    },

    // 自动调整textarea高度
    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight);
        const maxHeight = lineHeight * 6;
        textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
    },

    // 更新发送按钮状态
    updateSendButton(isLoading) {
        const sendButton = document.getElementById('send-button');
        if (!sendButton) return;

        sendButton.innerHTML = isLoading ? '<i class="fa-solid fa-stop"></i>' : '<i class="fa-solid fa-arrow-up"></i>';
        sendButton.classList.toggle('bg-red-500', isLoading);
        sendButton.classList.toggle('ds-bg-blue', !isLoading);
    },

    // 停止响应
    stopResponse() {
        if (this.state.currentAbortController) {
            this.state.currentAbortController.abort();
            this.state.currentAbortController = null;
        }
    },

    // 处理中止的响应
    handleAbortedResponse(thinkingContainer, textContainer) {
        // 深度思考模式：更新思考区域为已停止状态
        if (this.state.enableThinking && thinkingContainer && thinkingContainer.innerHTML) {
            const thinkingId = 'stopped-thinking-' + Date.now();
            const duration = ShendModule.getThinkingDuration();

            // 获取当前思考内容
            const currentContent = thinkingContainer.querySelector('.thinking-content');
            const contentHtml = currentContent ? currentContent.innerHTML : '';

            thinkingContainer.innerHTML = ShendModule.createStoppedHTML(thinkingId, contentHtml, duration);
        }

        // 处理文本内容
        if (textContainer) {
            const currentText = textContainer.innerText || '';
            // 检查是否只有加载动画（没有实际内容）
            const isOnlyLoading = !currentText ||
                currentText.includes('正在回复') ||
                currentText.includes('正在分析') ||
                currentText.includes('正在上传');

            if (isOnlyLoading && !this.state.enableThinking) {
                // 普通对话模式，显示暂停提示（正常字体样式）
                textContainer.innerHTML = '<p>用户已暂停对话！</p>';
                textContainer.dataset.fullText = '用户已暂停对话！';
            } else if (!isOnlyLoading) {
                // 有实际内容，保存已生成的内容
                textContainer.dataset.fullText = currentText;
                this.state.messageHistory.push({ role: 'assistant', content: currentText });
            }
        }
    },

    // 发送消息
    async sendMessage() {
        const textarea = document.getElementById('message-input');
        const message = textarea?.value.trim();
        const hasFiles = this.state.uploadedFiles.length > 0;

        // 如果指令菜单可见且有匹配项，选择指令而不是发送消息（修复手机端回车问题）
        if (window.ZhiLiaoCaidanModule?.state?.isMenuVisible) {
            const { filteredCommands, selectedIndex } = ZhiLiaoCaidanModule.state;
            if (filteredCommands.length > 0) {
                ZhiLiaoCaidanModule.selectCommand(filteredCommands[selectedIndex]);
                return;
            }
        }

        if ((!message && !hasFiles) || this.state.isWaitingResponse) {
            if (!message && !hasFiles) {
                textarea.value = '';
                textarea.style.height = 'auto';
            }
            return;
        }

        // 检查是否有选中的优惠券（优先处理）
        if (message && window.ZhiLiaoHdCommand?.state?.selectedCoupons?.length > 0) {
            textarea.value = '';
            textarea.style.height = 'auto';
            await ZhiLiaoHdCommand.sendSelectedCoupons(message);
            return;
        }

        // 检查是否为指令（以 @ 开头）
        if (message && window.ZhiLiaoCaidanModule?.checkAndExecuteCommand(message)) {
            textarea.value = '';
            textarea.style.height = 'auto';
            return;
        }

        const welcomeScreen = document.getElementById('welcome-screen');
        const messageContainer = document.getElementById('message-container');

        if (welcomeScreen?.style.display !== 'none') {
            welcomeScreen.style.display = 'none';
            messageContainer?.classList.add('active');
        }

        // 保存当前上传的文件
        const currentFiles = [...this.state.uploadedFiles];

        // 显示用户消息（包含文件）
        this.addUserMessage(message || '请分析当前文件！', currentFiles);
        textarea.value = '';
        textarea.style.height = 'auto';

        // 清空文件列表
        this.state.uploadedFiles = [];
        this.updateFileTags();

        // 处理文件解析
        let fileIds = [];
        let analysisContainers = null;
        if (currentFiles.length > 0) {
            // 显示上传状态（区分单文件和多文件）
            analysisContainers = this.showAnalyzingState('uploading', currentFiles.length);
            const parseData = await this.parseFiles(currentFiles, analysisContainers.uploadId);
            fileIds = parseData.fileIds;
            // 清空上传状态文本，保留容器供AI使用
            this.removeAnalyzingState(analysisContainers.container);
        }

        // 检测是否需要分组调用（避免混合文件类型导致API错误）
        let needGroupedCall = false;
        let fileGroups = [];

        if (fileIds.length > 0 && currentFiles.length > 0) {
            fileGroups = this.groupFilesByType(currentFiles, fileIds);
            // 如果有多个不同类型的组，需要分组调用
            needGroupedCall = fileGroups.length > 1;
        }

        // 构建多模态消息（使用标准content数组格式）
        let userContent;
        if (fileIds.length > 0 && currentFiles.length > 0) {
            userContent = await this.buildMultimodalContent(message, currentFiles, fileIds);
        } else {
            userContent = message;
        }

        // 分组调用时，只保存纯文本到历史（避免多模态内容残留）
        if (needGroupedCall) {
            // 构建文件摘要文本
            const filesSummary = currentFiles.map(f => f.name).join('、');
            const textOnlyContent = message || `请分析这些文件：${filesSummary}`;
            this.state.messageHistory.push({ role: 'user', content: textOnlyContent });
        } else if (currentFiles.length > 0) {
            // 有文件但不需要分组时，也只保存文本摘要（避免历史中残留文件URL）
            const filesSummary = currentFiles.map(f => f.name).join('、');
            const textOnlyContent = message || `请分析文件：${filesSummary}`;
            this.state.messageHistory.push({ role: 'user', content: `${textOnlyContent}\n[已上传${currentFiles.length}个文件]` });
        } else {
            // 纯文本消息，保存完整内容
            this.state.messageHistory.push({ role: 'user', content: userContent });
        }

        // 保存用户消息到数据库
        if (window.DBModule) {
            try {
                await DBModule.saveMessage(this.state.sessionId, 'user', userContent, {
                    importance: fileIds.length > 0 ? 1.0 : 0.5
                });
            } catch (error) {
                console.error('保存消息失败:', error);
            }
        }

        this.state.isWaitingResponse = true;
        this.updateSendButton(true);

        // 根据模式选择处理方式
        if (this.state.enableNetwork) {
            await this.handleNetworkSearch(userContent, analysisContainers);
        } else {
            // 如果需要分组调用，使用新的分组处理方法
            if (needGroupedCall) {
                await this.handleGroupedAIChat(message, fileGroups, analysisContainers);
            } else {
                await this.handleAIChat(userContent, analysisContainers);
            }
        }
    },

    // 解析文件（返回文件ID列表和解析结果）
    async parseFiles(files, uploadId = null) {
        if (!window.FileParserModule) {
            return { fileIds: [], results: [] };
        }

        const fileIds = [];
        const results = [];

        // 并行处理所有文件
        const parsePromises = files.map(async (file, index) => {
            try {
                // 更新文件状态为上传中
                if (uploadId && window.FenxModule && files.length > 1) {
                    FenxModule.updateFileStatus(uploadId, file.name, 'uploading');
                }

                const result = await FileParserModule.parseFile(file);

                // 更新进度
                if (uploadId && window.FenxModule && files.length > 1) {
                    FenxModule.updateFileProgress(uploadId, index + 1, files.length);
                    FenxModule.updateFileStatus(uploadId, file.name, 'success');
                }

                return { file, result, success: true };
            } catch (error) {
                console.error(`文件 ${file.name} 解析失败:`, error);

                // 更新文件状态为失败
                if (uploadId && window.FenxModule && files.length > 1) {
                    FenxModule.updateFileStatus(uploadId, file.name, 'error', error.message);
                }

                return { file, result: null, success: false, error: error.message };
            }
        });

        // 等待所有文件处理完成
        const parseResults = await Promise.all(parsePromises);
        console.log('文件解析结果:', parseResults.map(r => ({ name: r.file.name, success: r.success, type: r.result?.type, url: r.result?.url })));

        // 保存成功的文件到数据库
        for (const { file, result, success } of parseResults) {
            if (success && result && window.DBModule) {
                const fileId = await DBModule.saveFile({
                    filename: file.name,
                    type: result.type,
                    extension: result.extension || FileParserModule.getFileExtension(file.name),
                    size: file.size,
                    url: result.url || '',  // 保存URL（图片/视频/文档）
                    content: result.content || '',  // 仅文本/表格保存内容
                    metadata: {
                        totalPages: result.totalPages,
                        parsedPages: result.parsedPages,
                        totalSheets: result.totalSheets,
                        parsedSheets: result.parsedSheets,
                        totalRows: result.totalRows,
                        parsedRows: result.parsedRows
                    },
                    sessionId: this.state.sessionId
                });
                console.log('文件已保存到数据库:', file.name, 'fileId:', fileId);
                fileIds.push(fileId);
                results.push({ file, result });
            } else {
                console.log('文件保存跳过:', file.name, 'success:', success, 'result:', !!result);
            }
        }

        console.log('parseFiles 完成, fileIds:', fileIds);
        return { fileIds, results };
    },

    // 构建多模态内容数组（标准格式）
    async buildMultimodalContent(userMessage, files, fileIds) {
        console.log('buildMultimodalContent 开始:', { filesCount: files.length, fileIds });
        const contentArray = [];

        // 1. 添加用户文本消息
        if (userMessage) {
            contentArray.push({
                type: 'text',
                text: userMessage
            });
        }

        // 2. 添加文件（使用通用方法）
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileId = fileIds[i];

            if (window.DBModule) {
                const fileData = await DBModule.getFile(fileId);
                console.log('获取文件数据:', file.name, 'fileId:', fileId, 'fileData:', fileData ? { type: fileData.type, url: fileData.url } : null);
                const contentItem = await this.buildFileContentItem(fileData, file);
                console.log('构建内容项:', file.name, 'contentItem:', contentItem ? contentItem.type : null);
                if (contentItem) {
                    contentArray.push(contentItem);
                }
            }
        }

        console.log('buildMultimodalContent 完成:', contentArray.length, '个内容项');
        return contentArray;
    },

    // 为单个文件组构建 content 数组
    async buildGroupContent(userMessage, groupFiles, isFirstGroup, totalGroups = 1) {
        const contentArray = [];
        const groupType = groupFiles[0]?.fileType || 'unknown';
        const groupTypeNames = {
            'document': '文档',
            'image': '图片',
            'video': '视频',
            'text': '文本/表格'
        };
        const typeName = groupTypeNames[groupType] || '文件';

        // 第一组：添加用户消息 + 分组说明
        if (isFirstGroup && userMessage) {
            let promptText = userMessage;

            // 如果有多组，添加分组说明
            if (totalGroups > 1) {
                promptText += `\n\n【系统提示】检测到多种类型的文件，系统已自动分组处理。这是第1组（${typeName}，共${groupFiles.length}个文件），请先分析这一组。`;
            }

            contentArray.push({
                type: 'text',
                text: promptText
            });
        }
        // 后续组：添加继续分析提示
        else if (!isFirstGroup) {
            const fileNames = groupFiles.map(f => f.file.name).join('、');
            const groupIndex = isFirstGroup ? 1 : '下一';

            contentArray.push({
                type: 'text',
                text: `【系统提示】继续分析第${groupIndex}组文件（${typeName}，共${groupFiles.length}个）：${fileNames}\n请结合之前的分析结果，继续进行连贯的分析。`
            });
        }

        // 添加该组的文件
        for (const { file, fileId, fileType } of groupFiles) {
            if (window.DBModule) {
                const fileData = await DBModule.getFile(fileId);
                console.log('文件数据:', file.name, 'type:', fileData?.type, 'url:', fileData?.url);

                const contentItem = await this.buildFileContentItem(fileData, file);
                if (contentItem) {
                    if (fileData.type === 'document') {
                        console.log('添加文档URL:', fileData.url, 'media_type:', MEDIA_TYPES[fileData.extension] || 'application/octet-stream');
                    }
                    contentArray.push(contentItem);
                }
            }
        }

        return contentArray;
    },

    // 将文件按类型分组（避免混合调用导致API错误）
    groupFilesByType(files, fileIds) {
        const groups = [];
        const fileDataMap = new Map();

        // 按类型分类
        const typeGroups = {
            document: [],
            video: [],
            image: [],
            text: []
        };

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileId = fileIds[i];
            const fileType = this.getFileTypeFromName(file.name);

            fileDataMap.set(fileId, { file, fileId });

            if (fileType === 'document') {
                typeGroups.document.push({ file, fileId, fileType });
            } else if (fileType === 'video') {
                typeGroups.video.push({ file, fileId, fileType });
            } else if (fileType === 'image') {
                typeGroups.image.push({ file, fileId, fileType });
            } else {
                typeGroups.text.push({ file, fileId, fileType });
            }
        }

        // 按优先级组装分组
        // 文档：可以多个一起
        if (typeGroups.document.length > 0) {
            groups.push({ type: 'document', files: typeGroups.document, name: '文档' });
        }

        // 图片：可以多个一起（最多10个一组）
        if (typeGroups.image.length > 0) {
            for (let i = 0; i < typeGroups.image.length; i += 10) {
                const batch = typeGroups.image.slice(i, i + 10);
                groups.push({ type: 'image', files: batch, name: '图片' });
            }
        }

        // 视频：可以多个一起
        if (typeGroups.video.length > 0) {
            groups.push({ type: 'video', files: typeGroups.video, name: '视频' });
        }

        // 文本数据：可以多个一起
        if (typeGroups.text.length > 0) {
            groups.push({ type: 'text', files: typeGroups.text, name: '文本数据' });
        }

        return groups;
    },

    // 从文件名获取文件类型
    getFileTypeFromName(filename) {
        const ext = filename.split('.').pop().toLowerCase();

        // 文档类型（只包含GLM-4.6V支持URL的格式）
        if (['pdf', 'doc', 'docx'].includes(ext)) {
            return 'document';
        }
        // 视频类型
        if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'mpeg', 'mpg'].includes(ext)) {
            return 'video';
        }
        // 图片类型
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(ext)) {
            return 'image';
        }
        // 文本/表格类型
        return 'text';
    },

    // 处理联网搜索
    async handleNetworkSearch(message, existingContainers = null) {
        let textContainer = null;

        try {
            // 使用已有容器或创建新容器
            const containers = existingContainers || this.createStreamingMessage();
            textContainer = containers.textContainer;

            // 显示搜索中状态
            textContainer.innerHTML = '<p style="color: #666;"><i class="fa-solid fa-spinner fa-spin"></i> 正在联网搜索...</p>';
            this.scrollToBottom();

            // 调用智谱联网搜索
            const result = await WebSearchModule.search(message);

            if (!result.success) {
                throw new Error(result.error || '搜索失败');
            }

            // 获取搜索结果
            const searchResults = WebSearchModule.getSearchResults(result);

            if (searchResults.length === 0) {
                throw new Error('未找到相关搜索结果');
            }

            // 格式化搜索结果供AI分析
            const searchContent = WebSearchModule.formatResultsForAI(result);

            // 让AI基于搜索结果进行总结
            textContainer.innerHTML = '<p style="color: #666;"><i class="fa-solid fa-spinner fa-spin"></i> AI正在分析搜索结果...</p>';
            this.scrollToBottom();

            // 构建AI分析请求
            const analysisMessages = [
                { role: 'user', content: `请基于以下搜索结果回答问题："${message}"\n\n${searchContent}` }
            ];

            // 调用AI进行分析
            const aiRequestBody = {
                model: 'glm-4.6v',
                messages: [
                    { role: 'system', content: '你是运小助，请基于提供的搜索结果，用简洁友好的中文回答用户问题。' },
                    ...analysisMessages
                ],
                max_tokens: this.config.maxTokens,
                temperature: 0.7,
                stream: false,
                thinking: { type: 'disabled' }
            };

            const aiResponse = await fetch(this.config.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify(aiRequestBody)
            });

            if (!aiResponse.ok) {
                throw new Error('AI分析失败');
            }

            const aiResult = await aiResponse.json();
            const aiContent = aiResult.choices?.[0]?.message?.content || '';

            if (aiContent) {
                // 添加引用来源
                const refsMarkdown = WebSearchModule.formatReferencesMarkdown(searchResults);
                const fullContent = aiContent + refsMarkdown;

                textContainer.innerHTML = this.renderMarkdown(fullContent);
                textContainer.dataset.fullText = fullContent;
                this.state.messageHistory.push({ role: 'assistant', content: fullContent });
            } else {
                throw new Error('AI分析结果为空');
            }

            // 添加操作按钮
            const messageIndex = this.state.messageHistory.length - 1;
            const actionsDiv = this.createActionButtons(messageIndex);
            document.getElementById('message-container').appendChild(actionsDiv);
            this.scrollToBottom();

        } catch (error) {
            console.error('联网搜索错误:', error);
            if (textContainer) {
                textContainer.innerHTML = this.renderMarkdown(`抱歉，联网搜索出错: ${error.message}`);
            } else {
                this.addSystemMessage(`抱歉，联网搜索出错: ${error.message}`);
            }
        } finally {
            this.state.isWaitingResponse = false;
            this.updateSendButton(false);
        }
    },

    // 处理AI对话
    // 处理分组AI调用（每组使用独立容器，模拟分次输入）
    async handleGroupedAIChat(userMessage, fileGroups, existingContainers = null) {
        try {
            console.log('开始分组调用，共', fileGroups.length, '组');
            fileGroups.forEach((group, index) => {
                console.log(`第${index + 1}组 (${group.name}):`, group.files.map(f => f.file.name));
            });

            // 用于累积所有组的响应
            let fullResponse = '';
            let previousGroupResponse = ''; // 存储上一组的回复

            // 依次处理每个文件组
            for (let i = 0; i < fileGroups.length; i++) {
                const group = fileGroups[i];
                const isFirstGroup = i === 0;

                console.log(`正在处理第${i + 1}组 (${group.name})...`);

                // 每组创建独立的消息容器
                let containers;
                if (isFirstGroup && existingContainers) {
                    // 第一组使用已有容器（来自文件上传状态）
                    containers = existingContainers;
                } else {
                    // 后续组创建新容器
                    containers = this.createStreamingMessage();
                    // 显示加载提示
                    containers.textContainer.innerHTML = `<p style="color: #666;"><i class="fa-solid fa-spinner fa-spin"></i> 正在分析第${i + 1}组（${group.name}）...</p>`;
                    this.scrollToBottom();
                }

                const textContainer = containers.textContainer;
                const thinkingContainer = containers.thinkingContainer;

                // 构建该组的 content（传入总组数）
                const groupContent = await this.buildGroupContent(
                    userMessage,
                    group.files,
                    isFirstGroup,
                    fileGroups.length  // 传入总组数
                );

                console.log(`第${i + 1}组内容已构建，开始调用API...`);

                // 调用API处理该组（传递上一组的回复作为上下文）
                await this.streamGroupAPI(
                    groupContent,
                    textContainer,
                    thinkingContainer,
                    isFirstGroup,
                    previousGroupResponse
                );

                // 获取当前组的回复
                const currentText = textContainer.dataset.fullText || textContainer.innerText;
                console.log(`第${i + 1}组处理完成，回复长度:`, currentText.length);
                previousGroupResponse = currentText;
                fullResponse += (fullResponse ? '\n\n' : '') + currentText;
            }

            // 保存完整响应到历史
            this.state.messageHistory.push({ role: 'assistant', content: fullResponse });

            // 保存AI响应到数据库
            if (window.DBModule) {
                try {
                    await DBModule.saveMessage(this.state.sessionId, 'assistant', fullResponse, {
                        importance: 0.7
                    });
                } catch (error) {
                    console.error('保存AI响应失败:', error);
                }
            }

            // 限制消息历史长度
            this.trimMessageHistory();
        } catch (error) {
            console.error('AI API Error:', error);
            // 显示错误消息
            this.addSystemMessage(`抱歉，出现了错误: ${error.message}`);
        } finally {
            this.state.isWaitingResponse = false;
            this.state.currentAbortController = null;
            this.updateSendButton(false);
        }
    },

    async handleAIChat(message, existingContainers = null) {
        let textContainer = null;
        let thinkingContainer = null;

        try {
            // 使用已有容器或创建新容器
            const containers = existingContainers || this.createStreamingMessage();
            textContainer = containers.textContainer;
            thinkingContainer = containers.thinkingContainer;
            // 传递当前消息（可能包含多模态内容）
            await this.streamAPI(textContainer, thinkingContainer, message);

            const finalText = textContainer.dataset.fullText || textContainer.innerText;
            this.state.messageHistory.push({ role: 'assistant', content: finalText });

            // 保存AI响应到数据库
            if (window.DBModule) {
                try {
                    await DBModule.saveMessage(this.state.sessionId, 'assistant', finalText, {
                        importance: 0.7
                    });
                } catch (error) {
                    console.error('保存AI响应失败:', error);
                }
            }

            // 限制消息历史长度
            this.trimMessageHistory();
        } catch (error) {
            if (error.name === 'AbortError') {
                this.handleAbortedResponse(thinkingContainer, textContainer);
            } else {
                console.error('AI API Error:', error);
                // 在已有容器中显示错误，避免创建新的消息块（双头像问题）
                if (textContainer) {
                    textContainer.innerHTML = `<p style="color: #ef4444;">抱歉，出现了错误: ${error.message}</p>`;
                } else {
                    this.addSystemMessage(`抱歉，出现了错误: ${error.message}`);
                }
            }
        } finally {
            this.state.isWaitingResponse = false;
            this.state.currentAbortController = null;
            this.updateSendButton(false);
        }
    },

    // 通用API调用方法
    async callAPI(requestBody, signal = null) {
        const response = await fetch(this.config.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: signal
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
        }

        return response;
    },

    // 构建单个文件的内容项（减少重复代码）
    async buildFileContentItem(fileData, file) {
        if (!fileData) return null;

        // 对于需要URL的类型（图片、视频、文档），检查URL是否存在
        if (['image', 'video', 'document'].includes(fileData.type) && !fileData.url) {
            return null;
        }

        // 对于文本类型，检查content是否存在
        if (['text', 'spreadsheet'].includes(fileData.type) && !fileData.content) {
            return null;
        }

        if (fileData.type === 'image') {
            return {
                type: 'image_url',
                image_url: { url: fileData.url }
            };
        } else if (fileData.type === 'video') {
            return {
                type: 'video_url',
                video_url: { url: fileData.url }
            };
        } else if (fileData.type === 'document') {
            return {
                type: 'file_url',
                file_url: {
                    url: fileData.url,
                    media_type: MEDIA_TYPES[fileData.extension] || 'application/octet-stream'
                }
            };
        } else if (fileData.type === 'text' || fileData.type === 'spreadsheet') {
            // 格式化文件信息
            const fileTypeLabel = fileData.type === 'spreadsheet' ? 'Excel表格' : '文本文件';
            const fileSizeKB = (fileData.size / 1024).toFixed(1);

            let content = fileData.content;
            let rowLimitNote = '';

            // 如果是表格文件，限制为前50行
            if (fileData.type === 'spreadsheet') {
                const lines = content.split('\n');
                const totalRows = lines.length;

                if (totalRows > 50) {
                    content = lines.slice(0, 50).join('\n');
                    rowLimitNote = `\n⚠️ 注意：表格文件仅显示前50行数据（共${totalRows}行）\n`;
                }
            }

            const formattedContent = `
═══════════════════════════════════
📄 文件名：${file.name}
📋 类型：${fileTypeLabel}
📊 大小：${fileSizeKB} KB${rowLimitNote}
───────────────────────────────────
${content}
═══════════════════════════════════
`;
            return {
                type: 'text',
                text: formattedContent
            };
        }

        return null;
    },

    // 智能管理消息历史（压缩而非简单截断）
    trimMessageHistory() {
        if (!window.HistoryModule) {
            // 降级到简单截断
            const maxMessages = this.config.maxHistoryRounds * 2;

            if (this.state.messageHistory.length > maxMessages) {
                let cutIndex = this.state.messageHistory.length - maxMessages;

                // 确保不会在工具调用中间截断
                while (cutIndex > 0 && cutIndex < this.state.messageHistory.length) {
                    const msg = this.state.messageHistory[cutIndex - 1];
                    if (msg.role === 'tool' || (msg.role === 'assistant' && msg.tool_calls)) {
                        cutIndex--;
                    } else {
                        break;
                    }
                }

                this.state.messageHistory = this.state.messageHistory.slice(cutIndex);
            }
            return;
        }

        // 使用智能压缩（使用配置中的maxHistoryTokens）
        const maxTokens = this.config.maxHistoryTokens || 80000;
        const compressed = HistoryModule.compressHistory(
            this.state.messageHistory,
            maxTokens
        );

        if (compressed.length !== this.state.messageHistory.length) {
            console.log(`历史管理: ${this.state.messageHistory.length}条 → ${compressed.length}条`);
        }

        this.state.messageHistory = compressed;
    },

    // 创建流式消息容器
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

    // 流式调用 API
    // 流式调用单个文件组的API（完全独立，不包含文件历史）
    async streamGroupAPI(groupContent, textContainer, thinkingContainer, isFirstGroup, previousTextResponse) {
        // 构建临时消息历史（只包含当前组）
        const tempMessages = [
            { role: 'system', content: this.config.systemPrompt }
        ];

        // 如果不是第一组，添加上一组的纯文本回复作为上下文
        if (!isFirstGroup && previousTextResponse) {
            tempMessages.push({
                role: 'assistant',
                content: previousTextResponse
            });
        }

        // 添加当前组的消息
        tempMessages.push({ role: 'user', content: groupContent });

        console.log('API请求内容:', JSON.stringify({
            messages: tempMessages,
            contentLength: Array.isArray(groupContent) ? groupContent.length : 1
        }, null, 2));

        const requestBody = {
            model: 'glm-4.6v',
            messages: tempMessages,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            stream: true,
            thinking: {
                type: 'disabled'
            }
        };

        // 注意：分组调用时不添加工具支持，因为文件已直接传给AI
        // 避免多模态内容和工具调用混合导致API错误

        this.state.currentAbortController = new AbortController();

        const response = await this.callAPI(requestBody, this.state.currentAbortController.signal);
        await this.processStream(response, textContainer, thinkingContainer);
    },

    async streamAPI(textContainer, thinkingContainer, currentMessage = null) {
        let requestBody;

        if (this.state.enableThinking) {
            // 使用深度思考模块
            const thinkingId = thinkingContainer?.id || 'thinking-' + Date.now();
            ShendModule.startTiming(thinkingId);

            // 构建消息列表，支持多模态内容
            const messages = [...this.state.messageHistory];
            if (currentMessage && messages.length > 0) {
                const lastIndex = messages.length - 1;
                if (messages[lastIndex].role === 'user') {
                    messages[lastIndex] = { role: 'user', content: currentMessage };
                }
            }
            requestBody = ShendModule.buildRequestBody(messages, this.config.systemPrompt);
        } else {
            // 构建消息列表
            const messages = [
                { role: 'system', content: this.config.systemPrompt },
                ...this.state.messageHistory
            ];

            // 如果有当前消息（多模态内容），替换最后一条用户消息
            if (currentMessage && messages.length > 1) {
                const lastIndex = messages.length - 1;
                if (messages[lastIndex].role === 'user') {
                    messages[lastIndex] = { role: 'user', content: currentMessage };
                }
            }

            // 普通对话模式（明确禁用思考功能）
            requestBody = {
                model: 'glm-4.6v',
                messages: messages,
                max_tokens: this.config.maxTokens,
                temperature: this.config.temperature,
                stream: true,
                thinking: {
                    type: 'disabled'
                }
            };

            // 添加工具调用支持（GLM-4.6V支持多模态+工具调用）
            if (window.AIToolsModule) {
                requestBody.tools = AIToolsModule.tools;
            }
        }

        this.state.currentAbortController = new AbortController();

        const response = await this.callAPI(requestBody, this.state.currentAbortController.signal);
        await this.processStream(response, textContainer, thinkingContainer);
    },

    // 处理流式响应
    async processStream(response, textContainer, thinkingContainer) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let reasoning_content = '';
        let content = '';
        let buffer = '';
        let toolCalls = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') continue;

                    try {
                        const json = JSON.parse(data);
                        if (json.choices?.[0]?.delta) {
                            const delta = json.choices[0].delta;
                            if (delta.reasoning_content) {
                                reasoning_content += delta.reasoning_content;
                                this.updateThinkingDisplay(thinkingContainer, reasoning_content);
                            }
                            if (delta.content) {
                                content += delta.content;
                                this.updateContentDisplay(textContainer, content);
                            }
                            // 处理工具调用
                            if (delta.tool_calls) {
                                toolCalls = this.mergeToolCalls(toolCalls, delta.tool_calls);
                            }
                        }
                        // 检查finish_reason
                        if (json.choices?.[0]?.finish_reason === 'tool_calls') {
                            await this.handleToolCalls(toolCalls, textContainer, thinkingContainer);
                            return;
                        }
                    } catch (e) {}
                }
            }
        }

        this.finalizeMessage(textContainer, thinkingContainer, content, reasoning_content);
    },

    // 合并工具调用（流式响应中工具调用是分段传输的）
    mergeToolCalls(existing, newCalls) {
        const merged = [...existing];

        for (const newCall of newCalls) {
            const index = newCall.index;
            if (!merged[index]) {
                merged[index] = {
                    id: newCall.id || '',
                    type: newCall.type || 'function',
                    function: {
                        name: newCall.function?.name || '',
                        arguments: newCall.function?.arguments || ''
                    }
                };
            } else {
                if (newCall.function?.name) {
                    merged[index].function.name += newCall.function.name;
                }
                if (newCall.function?.arguments) {
                    merged[index].function.arguments += newCall.function.arguments;
                }
            }
        }

        return merged;
    },

    // 处理工具调用
    async handleToolCalls(toolCalls, textContainer, thinkingContainer) {
        if (!window.AIToolsModule) {
            textContainer.innerHTML = this.renderMarkdown('工具模块未加载');
            return;
        }

        const toolResults = [];

        for (const toolCall of toolCalls) {
            try {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);

                // 根据工具名称显示友好的提示文字
                const toolTips = {
                    'get_file_list': { icon: 'fa-folder-open', text: '正在查看文件列表...' },
                    'get_file_content': { icon: 'fa-file-lines', text: '正在查看文件内容...' },
                    'search_files': { icon: 'fa-magnifying-glass', text: '正在搜索文件...' },
                    'get_file_with_preview': { icon: 'fa-eye', text: '正在预览文件...' },
                    'compare_files_visual': { icon: 'fa-code-compare', text: '正在对比文件...' },
                    'generate_chart_from_data': { icon: 'fa-chart-bar', text: '正在生成图表...' },
                    'generate_chart_from_statistics': { icon: 'fa-chart-pie', text: '正在生成统计图表...' },
                    'search_product': { icon: 'fa-pills', text: '正在查询商品...' }
                };
                const tip = toolTips[functionName] || { icon: 'fa-spinner fa-spin', text: '正在处理...' };
                textContainer.innerHTML = `<p style="color: #666;"><i class="fa-solid ${tip.icon}"></i> ${tip.text}</p>`;
                this.scrollToBottom();

                const result = await AIToolsModule.executeTool(
                    functionName,
                    functionArgs,
                    this.state.sessionId
                );

                // 如果工具返回包含图片URL，立即在界面显示（插入到textContainer之前）
                if (result.success && result.image_url && !result.error) {
                    const chartDiv = document.createElement('div');
                    chartDiv.className = 'chart-result';
                    chartDiv.innerHTML = `
                        <div style="margin: 16px 0; padding: 12px; background: #f9fafb; border-radius: 8px;">
                            <img src="${result.image_url}" alt="图表" style="max-width: 100%; border-radius: 4px; display: block; margin: 0 auto;">
                            <p style="margin-top: 8px; font-size: 13px; color: #666; text-align: center;">${result.description || '图表已生成'}</p>
                        </div>
                    `;
                    // 插入到textContainer之前，这样不会被后续AI回复覆盖
                    textContainer.parentNode.insertBefore(chartDiv, textContainer);
                    this.scrollToBottom();
                }

                // 如果工具返回商品查询结果，使用统一的查询命令渲染逻辑
                if (result.success && result.render_cards && result.products && window.ZhiLiaoCxCommand) {
                    // 调用查询命令模块的统一渲染方法（包含展开/折叠和事件绑定）
                    const cardsContainer = ZhiLiaoCxCommand.renderProductCardsInChat(
                        result.products,
                        textContainer.parentNode,
                        textContainer
                    );
                    this.scrollToBottom();
                }

                // 处理工具返回（GLM-4.6V要求content为JSON字符串）
                let content;
                if (result.error) {
                    content = JSON.stringify({ error: result.error });
                } else {
                    content = JSON.stringify(result);
                }

                toolResults.push({
                    tool_call_id: toolCall.id,
                    role: 'tool',
                    name: functionName,
                    content: content
                });
            } catch (error) {
                toolResults.push({
                    tool_call_id: toolCall.id,
                    role: 'tool',
                    name: toolCall.function.name,
                    content: JSON.stringify({ error: error.message })
                });
            }
        }

        // 将工具调用和结果添加到消息历史
        // 注意：assistant的tool_calls消息必须紧跟在用户消息之后
        const assistantMessage = {
            role: 'assistant',
            content: null,
            tool_calls: toolCalls.map(tc => ({
                id: tc.id,
                type: tc.type,
                function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments
                }
            }))
        };

        this.state.messageHistory.push(assistantMessage);
        this.state.messageHistory.push(...toolResults);

        // 继续调用AI获取最终回复
        await this.streamAPI(textContainer, thinkingContainer);
    },

    // 完成消息处理
    finalizeMessage(textContainer, thinkingContainer, content, reasoning_content) {
        if (reasoning_content) {
            this.finalizeThinkingDisplay(thinkingContainer, reasoning_content);
        } else if (thinkingContainer) {
            thinkingContainer.innerHTML = '';
        }

        textContainer.innerHTML = this.renderMarkdown(content);
        textContainer.dataset.fullText = content;

        const messageIndex = this.state.messageHistory.length - 1;
        const actionsDiv = this.createActionButtons(messageIndex);
        document.getElementById('message-container').appendChild(actionsDiv);

        this.scrollToBottom();
    },

    // 更新思维链显示
    updateThinkingDisplay(container, content) {
        if (!container) return;

        const thinkingId = container.id;
        container.innerHTML = ShendModule.createThinkingHTML(
            thinkingId,
            content,
            (c) => this.renderMarkdownPartial(c)
        );

        const thinkingContent = document.getElementById(`${thinkingId}-content`);
        if (thinkingContent) thinkingContent.scrollTop = thinkingContent.scrollHeight;

        this.scrollToBottom();
    },

    // 完成思维链显示
    finalizeThinkingDisplay(container, content) {
        if (!container) return;

        const duration = ShendModule.getThinkingDuration();
        const thinkingId = 'final-thinking-' + Date.now();

        container.innerHTML = ShendModule.createFinishedHTML(
            thinkingId,
            content,
            duration,
            (c) => this.renderMarkdown(c)
        );
    },

    // 切换思维链显示
    toggleThinking(id) {
        const content = document.getElementById(id);
        const arrow = document.getElementById(id + '-arrow');
        if (!content) return;

        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        if (arrow) arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    },

    // 更新内容显示
    updateContentDisplay(container, content) {
        if (!container) return;
        container.innerHTML = this.renderMarkdownPartial(content);
        this.scrollToBottom();
    },

    // 添加用户消息
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
                    return `<div class="message-file"><img src="${url}" alt="${file.name}" style="max-width: 200px; border-radius: 8px; cursor: pointer;" onclick="ZhiLiaoModule.viewImage('${url}')"></div>`;
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

    // 查看图片（全屏遮罩，支持缩放和拖拽）
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

    // 添加系统消息
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

    // 滚动到底部
    scrollToBottom() {
        const container = document.getElementById('message-container');
        if (container) container.scrollTop = container.scrollHeight;
    },

    // 创建操作按钮
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

    // 复制到剪贴板
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

    // 重新回复
    async regenerateResponse(messageIndex) {
        if (this.state.isWaitingResponse) return;

        const userMessage = this.state.messageHistory[messageIndex];
        if (!userMessage || userMessage.role !== 'user') return;

        this.state.messageHistory = this.state.messageHistory.slice(0, messageIndex + 1);

        const container = document.getElementById('message-container');
        const messages = container.children;
        while (messages.length > messageIndex + 1) {
            container.removeChild(messages[messages.length - 1]);
        }

        this.state.isWaitingResponse = true;
        this.updateSendButton(true);

        try {
            const { textContainer, thinkingContainer } = this.createStreamingMessage();
            await this.streamAPI(textContainer, thinkingContainer);

            const finalText = textContainer.dataset.fullText || textContainer.innerText;
            this.state.messageHistory.push({ role: 'assistant', content: finalText });
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.addSystemMessage(`错误: ${error.message}`);
            }
        } finally {
            this.state.isWaitingResponse = false;
            this.state.currentAbortController = null;
            this.updateSendButton(false);
        }
    },

    // 显示文件处理状态（返回可复用的消息容器）
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

    // 移除文件分析状态（只移除分析文本，保留容器供AI回复使用）
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

    // HTML转义
    escapeHtml(text) {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    // 部分 Markdown 渲染
    renderMarkdownPartial(text) {
        return this.escapeHtml(text).replace(/\n/g, '<br>');
    },

    // Markdown 渲染
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

    // Toast 提示（左下角滑出）
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
    }
};

// 注册模块到主框架
AppFramework.register({
    id: 'zhiliao',
    name: '智聊',
    icon: 'fa-solid fa-comments',
    path: 'gongn/zhiliao',
    order: 1
});

// 初始化模块并注册实例
ZhiLiaoModule.init();
AppFramework.setModuleInstance('zhiliao', ZhiLiaoModule);

// 导出到全局（供指令模块访问）
window.ZhiLiaoModule = ZhiLiaoModule;