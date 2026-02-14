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
        get systemPrompt() {
            // 使用系统提示词模块
            return window.SystemPromptModule?.getSystemPrompt() || '';
        },
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

            // 自动清理24小时前的旧文件（每次刷新清理）
            try {
                const hoursToKeep = window.ZhiLiaoConfig?.cleanup.hoursToKeep || 24;
                const cleanupResult = await DBModule.cleanupOldFiles(hoursToKeep);
                if (cleanupResult.success && cleanupResult.deletedFiles > 0) {
                    console.log(`自动清理完成（保留${hoursToKeep}小时内文件）:`, cleanupResult);
                }
            } catch (error) {
                console.error('自动清理失败:', error);
            }
        }

        // 生成会话ID（简化版：不需要持久化会话）
        this.state.sessionId = 'session-' + Date.now();

        // 初始化工具注册中心
        if (window.ToolRegistry && window.ToolDefinitions) {
            ToolRegistry.init();
            // 注册所有工具
            ToolRegistry.registerBatch(ToolDefinitions.getAllTools());
            console.log('✅ 工具注册中心初始化完成');
        }

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
        // 注意：核心模块已在index.html中加载
        // 这里只加载动态CSS资源

        // 加载指令菜单CSS（已迁移到zhiling目录）
        const zhilingCssPath = 'zhiliao/gongju/zhiling/zhiling.css';
        if (!document.querySelector(`link[href="${zhilingCssPath}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = zhilingCssPath;
            document.head.appendChild(link);
        }

        // 商品查询模块CSS（复用卡片样式）
        if (!document.querySelector('link[href="gongn/chaxun/kuangjia/yangshi.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'gongn/chaxun/kuangjia/yangshi.css';
            document.head.appendChild(link);
        }
    },

    // 渲染页面结构
    render() {
        const container = document.getElementById('module-container');
        if (window.ZhiLiaoBujuModule) {
            ZhiLiaoBujuModule.render(container);
        }
        this.state.container = container;
    },

    // 绑定事件
    bindEvents() {
        if (window.ZhiLiaoJiaohuModule) {
            ZhiLiaoJiaohuModule.bindEvents(this.state, () => this.sendMessage());
        }
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
        if (window.ZhiLiaoJiaohuModule) {
            await ZhiLiaoJiaohuModule.handleFileUpload(files, this.state);
        }
    },

    // 注意：这些方法已迁移到ZhiLiaoJiaohuModule，这里保留是为了兼容性
    // 实际的事件绑定在bindEvents()中通过ZhiLiaoJiaohuModule完成

    // 更新文件标签显示
    updateFileTags() {
        if (window.ZhiLiaoBujuModule) {
            ZhiLiaoBujuModule.updateFileTags(this.state.uploadedFiles);
        }
    },

    // 移除文件
    removeFile(index) {
        if (window.ZhiLiaoJiaohuModule) {
            ZhiLiaoJiaohuModule.removeFile(index, this.state);
        }
    },

    // 自动调整textarea高度（已迁移到ZhiLiaoJiaohuModule）
    autoResizeTextarea(textarea) {
        if (window.ZhiLiaoJiaohuModule) {
            ZhiLiaoJiaohuModule.autoResizeTextarea(textarea);
        }
    },

    // 更新发送按钮状态
    updateSendButton(isLoading) {
        if (window.ZhiLiaoJiaohuModule) {
            ZhiLiaoJiaohuModule.updateSendButton(isLoading);
        }
    },

    // 停止响应
    stopResponse() {
        if (window.ZhiLiaoJiaohuModule) {
            ZhiLiaoJiaohuModule.stopResponse(this.state);
        }
    },

    // 处理中止的响应
    handleAbortedResponse(thinkingContainer, textContainer) {
        if (window.ZhiLiaoJiaohuModule) {
            ZhiLiaoJiaohuModule.handleAbortedResponse(thinkingContainer, textContainer, this.state);
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
        if (message && window.YhquanToolModule?.state?.selectedCoupons?.length > 0) {
            // 显示欢迎屏幕切换
            const welcomeScreen = document.getElementById('welcome-screen');
            const messageContainer = document.getElementById('message-container');
            if (welcomeScreen?.style.display !== 'none') {
                welcomeScreen.style.display = 'none';
                messageContainer?.classList.add('active');
            }
            textarea.value = '';
            textarea.style.height = 'auto';
            // 调用优惠券模块发送选中的优惠券
            await YhquanToolModule.sendSelectedCoupons(message);
            return;
        }

        // 检查是否为指令（以 @ 开头）
        if (message && message.startsWith('@')) {
            // 切换欢迎屏幕（不显示用户消息，让命令处理器自己处理）
            const welcomeScreen = document.getElementById('welcome-screen');
            const messageContainer = document.getElementById('message-container');
            if (welcomeScreen?.style.display !== 'none') {
                welcomeScreen.style.display = 'none';
                messageContainer?.classList.add('active');
            }
            textarea.value = '';
            textarea.style.height = 'auto';

            // 执行指令并显示结果
            await this.executeCommandAndShowResult(message);
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
            console.log('📁 文件解析完成, fileIds:', fileIds, 'currentFiles:', currentFiles.length);
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
            console.log('📤 多模态内容构建完成:', Array.isArray(userContent) ? userContent.length + '项' : '纯文本');
        } else {
            userContent = message;
            console.log('📤 纯文本消息:', userContent?.substring(0, 50));
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

        // 1. 构建文件信息提示（告诉AI文件ID，方便调用工具）
        let fileInfoText = '';
        if (files.length > 0 && fileIds.length > 0) {
            const fileInfoList = files.map((file, i) => `- ${file.name} (文件ID: ${fileIds[i]})`).join('\n');
            fileInfoText = `\n\n[已上传文件]\n${fileInfoList}\n（如需对文件进行图表生成等操作，请使用上述文件ID）`;
        }

        // 2. 添加用户文本消息（如果没有文本，添加默认提示）
        const textContent = (userMessage || '请分析这些文件的内容') + fileInfoText;
        contentArray.push({
            type: 'text',
            text: textContent
        });

        // 2. 添加文件（使用通用方法）
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileId = fileIds[i];

            if (window.DBModule) {
                const fileData = await DBModule.getFile(fileId);
                console.log('获取文件数据:', file.name, 'fileId:', fileId, 'fileData:', fileData ? { type: fileData.type, url: fileData.url?.substring(0, 50) } : null);
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
        if (window.ZhiLiaoBujuModule) {
            return ZhiLiaoBujuModule.createStreamingMessage();
        }
        return { textContainer: null, thinkingContainer: null };
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
            if (window.ToolRegistry) {
                requestBody.tools = ToolRegistry.getTools();
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
        if (!window.ToolRegistry) {
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

                // 添加 _fromAI 标记，让工具知道是AI调用（不显示重复的用户消息）
                const argsWithFlag = { ...functionArgs, _fromAI: true };

                const result = await ToolRegistry.executeTool(
                    functionName,
                    argsWithFlag,
                    this.state.sessionId
                );

                // 调试：打印工具返回结果
                console.log('🔧 工具返回结果:', functionName, result);

                // 如果工具返回包含图片URL，立即在界面显示（插入到textContainer之前）
                if (result.success && result.image_url && !result.error) {
                    console.log('📊 检测到图表，准备显示:', result.image_url?.substring(0, 50));
                    const chartDiv = document.createElement('div');
                    chartDiv.className = 'chart-result';
                    chartDiv.innerHTML = `
                        <div style="margin: 16px 0; padding: 12px; background: #f9fafb; border-radius: 8px;">
                            <img src="${result.image_url}" alt="图表" style="max-width: 100%; border-radius: 4px; display: block; margin: 0 auto; cursor: zoom-in;">
                            <p style="margin-top: 8px; font-size: 13px; color: #666; text-align: center;">${result.description || '图表已生成'}</p>
                        </div>
                    `;
                    // 添加点击预览功能
                    const chartImg = chartDiv.querySelector('img');
                    if (chartImg && window.YulanModule) {
                        chartImg.addEventListener('click', () => {
                            YulanModule.show(chartImg.src);
                        });
                    }
                    // 插入到textContainer之前，这样不会被后续AI回复覆盖
                    textContainer.parentNode.insertBefore(chartDiv, textContainer);
                    this.scrollToBottom();
                    console.log('📊 图表已插入DOM');
                } else {
                    console.log('📊 未检测到图表:', { success: result.success, hasImageUrl: !!result.image_url, error: result.error });
                }

                // 如果工具返回商品查询结果，使用统一的查询命令渲染逻辑
                if (result.success && result.render_cards && result.products && window.ChaxunYsModule) {
                    // 调用查询命令模块的统一渲染方法（包含展开/折叠和事件绑定）
                    const cardsContainer = ChaxunYsModule.renderCardsAt(
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
        if (window.ZhiLiaoBujuModule) {
            ZhiLiaoBujuModule.addUserMessage(text, files);
        }
    },

    // 添加系统消息
    addSystemMessage(text) {
        if (window.ZhiLiaoBujuModule) {
            ZhiLiaoBujuModule.addSystemMessage(text);
        }
    },

    // 执行命令并显示结果
    async executeCommandAndShowResult(message) {
        // 解析命令和参数
        const commands = window.ZhiLiaoCaidanModule?.state?.commands || [];
        let matchedCommand = null;
        let extraContent = '';

        for (const cmd of commands) {
            const prefix = `@${cmd.name}`;
            if (message.startsWith(prefix)) {
                matchedCommand = cmd;
                extraContent = message.slice(prefix.length).trim();
                break;
            }
        }

        if (!matchedCommand) {
            this.addSystemMessage('未找到匹配的命令');
            return;
        }

        try {
            // 执行命令
            const result = await matchedCommand.handler(extraContent);

            // 根据结果类型显示
            if (result && result.error) {
                this.addSystemMessage(`执行失败：${result.error}`);
            } else if (result && result.message) {
                this.addSystemMessage(result.message);
            }
            // 如果 success 为 true 且无 message，则不显示额外消息
        } catch (error) {
            console.error('命令执行失败:', error);
            this.addSystemMessage(`执行失败：${error.message}`);
        }
    },

    // 滚动到底部
    scrollToBottom() {
        if (window.ZhiLiaoBujuModule) {
            ZhiLiaoBujuModule.scrollToBottom();
        }
    },

    // 创建操作按钮
    createActionButtons(messageIndex) {
        if (window.ZhiLiaoBujuModule) {
            return ZhiLiaoBujuModule.createActionButtons(messageIndex);
        }
        return document.createElement('div');
    },

    // 复制到剪贴板
    async copyToClipboard(button) {
        if (window.ZhiLiaoJiaohuModule) {
            await ZhiLiaoJiaohuModule.copyToClipboard(button);
        }
    },

    // 重新回复
    async regenerateResponse(messageIndex) {
        if (window.ZhiLiaoJiaohuModule) {
            await ZhiLiaoJiaohuModule.regenerateResponse(
                messageIndex,
                this.state,
                (textContainer, thinkingContainer) => this.streamAPI(textContainer, thinkingContainer)
            );
        }
    },

    // 显示文件处理状态（返回可复用的消息容器）
    showAnalyzingState(stateType = 'analyzing', fileCount = 1) {
        if (window.ZhiLiaoBujuModule) {
            return ZhiLiaoBujuModule.showAnalyzingState(stateType, fileCount);
        }
        return { container: null, textContainer: null, thinkingContainer: null, uploadId: null };
    },

    // 移除文件分析状态（只移除分析文本，保留容器供AI回复使用）
    removeAnalyzingState(container) {
        if (window.ZhiLiaoBujuModule) {
            ZhiLiaoBujuModule.removeAnalyzingState(container);
        }
    },

    // HTML转义
    escapeHtml(text) {
        if (window.ZhiLiaoBujuModule) {
            return ZhiLiaoBujuModule.escapeHtml(text);
        }
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    // 部分 Markdown 渲染
    renderMarkdownPartial(text) {
        if (window.ZhiLiaoBujuModule) {
            return ZhiLiaoBujuModule.renderMarkdownPartial(text);
        }
        return this.escapeHtml(text).replace(/\n/g, '<br>');
    },

    // Markdown 渲染
    renderMarkdown(text) {
        if (window.ZhiLiaoBujuModule) {
            return ZhiLiaoBujuModule.renderMarkdown(text);
        }
        return this.escapeHtml(text).replace(/\n/g, '<br>');
    },

    // Toast 提示（左下角滑出）
    showToast(message, type = 'warning') {
        if (window.ZhiLiaoBujuModule) {
            ZhiLiaoBujuModule.showToast(message, type);
        }
    },

    // 查看图片（全屏遮罩，支持缩放和拖拽）
    viewImage(url) {
        if (window.ZhiLiaoBujuModule) {
            ZhiLiaoBujuModule.viewImage(url);
        }
    },

    // 切换思维链显示
    toggleThinking(id) {
        if (window.ZhiLiaoJiaohuModule) {
            ZhiLiaoJiaohuModule.toggleThinking(id);
        }
    },
};

// 注册模块到主框架
AppFramework.register({
    id: 'zhiliao',
    name: '智聊',
    icon: 'fa-solid fa-comments',
    path: 'zhiliao',  // 修复：使用正确的模块路径
    order: 1
});

// 初始化模块并注册实例
ZhiLiaoModule.init();
AppFramework.setModuleInstance('zhiliao', ZhiLiaoModule);

// 导出到全局（供指令模块访问）
window.ZhiLiaoModule = ZhiLiaoModule;