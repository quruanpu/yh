const ZhiLiaoZjgLiaochengModule = (() => {
    const methods = {
        async sendMessage() {
            const textarea = document.getElementById('message-input');
            const message = textarea?.value.trim();
            const hasFiles = this.state.uploadedFiles.length > 0;

            if (this.trySelectVisibleCommandMenuItem()) return;

            if ((!message && !hasFiles) || this.state.isWaitingResponse) {
                if (!message && !hasFiles) this.resetMessageInput(textarea);
                return;
            }

            if (message && message.startsWith('@')) {
                this.activateChatView();
                this.resetMessageInput(textarea);
                window.ZhiLiaoCaidanModule?.hideMenu?.();
                await this.executeCommandAndShowResult(message);
                return;
            }

            if (message && window.YhquanToolModule?.state?.selectedCoupons?.length > 0) {
                this.activateChatView();
                this.resetMessageInput(textarea);
                await YhquanToolModule.sendSelectedCoupons(message);
                await this.persistDisplaySnapshot();
                return;
            }

            if (!(await this.ensureActiveModelReady({ pendingFiles: this.state.uploadedFiles }))) return;
            this.activateChatView();

            const currentFiles = [...this.state.uploadedFiles];

            this.addUserMessage(message || '请分析当前文件！', currentFiles);
            this.resetMessageInput(textarea);

            this.state.uploadedFiles = [];
            window.ZhiLiaoBujuModule?.updateFileTags?.(this.state.uploadedFiles);

            let fileIds = [];
            let analysisContainers = null;
            if (currentFiles.length > 0) {
                analysisContainers = window.ZhiLiaoBujuModule?.showAnalyzingState?.('uploading', currentFiles.length)
                    || { container: null, textContainer: null, thinkingContainer: null, uploadId: null };
                const parseData = await this.parseFiles(currentFiles, analysisContainers.uploadId, {
                    includeResults: false
                });
                fileIds = parseData.fileIds;
                this.logDebug('文件解析完成', {
                    fileIds,
                    filesCount: currentFiles.length
                });
                window.ZhiLiaoBujuModule?.removeAnalyzingState?.(analysisContainers.container);
            }

            let needGroupedCall = false;
            let fileGroups = [];

            if (fileIds.length > 0 && currentFiles.length > 0) {
                fileGroups = this.groupFilesByType(currentFiles, fileIds);
                needGroupedCall = fileGroups.length > 1;
            }

            let userContent = message;
            if (!needGroupedCall && fileIds.length > 0 && currentFiles.length > 0) {
                userContent = await this.buildMultimodalContent(message, currentFiles, fileIds);
                this.logDebug('多模态内容已构建', {
                    type: Array.isArray(userContent) ? 'array' : 'text',
                    itemCount: Array.isArray(userContent) ? userContent.length : 1
                });
            } else if (!needGroupedCall) {
                this.logDebug('文本消息预览', userContent?.substring(0, 50));
            }

            this.pushUserHistory(message, userContent, currentFiles, needGroupedCall);
            await this.persistDisplaySnapshot();
            this.state.toolCallDepth = 0;
            this.state.lastToolCallSignature = '';
            this.state.repeatedToolCallCount = 0;

            this.setWaitingState(true);

            if (needGroupedCall) {
                await this.handleGroupedAIChat(message, fileGroups, analysisContainers);
            } else {
                await this.handleAIChat(userContent, analysisContainers);
            }
        },

        async handleGroupedAIChat(userMessage, fileGroups, existingContainers = null) {
            const chatSessionId = this.state.sessionId;
            try {
                this.logDebug('开始分组处理', { groups: fileGroups.length });
                fileGroups.forEach((group, index) => {
                    this.logDebug(`分组 ${index + 1}`, {
                        name: group.name,
                        files: group.files.map(f => f.file.name)
                    });
                });

                let fullResponse = '';
                let previousGroupMessage = null;

                for (let i = 0; i < fileGroups.length; i++) {
                    const group = fileGroups[i];
                    const isFirstGroup = i === 0;

                    this.logDebug(`正在处理第 ${i + 1} 组`, { groupName: group.name });

                    let containers;
                    if (isFirstGroup && existingContainers) {
                        containers = existingContainers;
                    } else {
                        containers = this.createStreamingMessage();
                        containers.textContainer.innerHTML = `<p style="color: #666;"><i class="fa-solid fa-spinner fa-spin"></i> 正在分析第 ${i + 1} 组（${group.name}）...</p>`;
                        this.scrollToBottom();
                    }

                    const textContainer = containers.textContainer;
                    const thinkingContainer = containers.thinkingContainer;

                    const groupContent = await this.buildGroupContent(
                        userMessage,
                        group.files,
                        isFirstGroup,
                        i + 1,
                        fileGroups.length
                    );

                    this.logDebug(`第 ${i + 1} 组内容构建完成，开始调用 API`);

                    const groupStreamResult = await this.streamGroupAPI(
                        groupContent,
                        textContainer,
                        thinkingContainer,
                        isFirstGroup,
                        previousGroupMessage
                    );
                    if (!this.isActiveChatSession(chatSessionId, textContainer)) return;

                    const currentText = textContainer.dataset.fullText || textContainer.innerText;
                    this.logDebug(`第 ${i + 1} 组处理完成`, { responseLength: currentText.length });
                    previousGroupMessage = this.createAssistantHistoryMessage(currentText, groupStreamResult);
                    fullResponse += (fullResponse ? '\n\n' : '') + currentText;
                }

                if (this.isActiveChatSession(chatSessionId)) {
                    this.state.messageHistory.push(this.createAssistantHistoryMessage(fullResponse, {
                        reasoningContent: previousGroupMessage?.reasoning_content || ''
                    }));
                }

                this.trimMessageHistory();
                await this.persistDisplaySnapshot();
            } catch (error) {
                if (this.isActiveChatSession(chatSessionId)) {
                    this.logError('分组 AI 调用失败', error);
                    this.showAIError(error);
                }
            } finally {
                if (this.isActiveChatSession(chatSessionId)) {
                    this.setWaitingState(false);
                }
            }
        },

        async handleAIChat(message, existingContainers = null) {
            const chatSessionId = this.state.sessionId;
            let textContainer = null;
            let thinkingContainer = null;

            try {
                const containers = existingContainers || this.createStreamingMessage();
                textContainer = containers.textContainer;
                thinkingContainer = containers.thinkingContainer;
                const prefetch = await this.maybeInjectToolCenterContext(message);
                if (prefetch.prefetched) {
                    this.logDebug('工具中心预查询已注入上下文');
                }
                if (!this.isActiveChatSession(chatSessionId, textContainer)) return;
                const streamResult = await this.streamAPI(textContainer, thinkingContainer, prefetch.message);
                if (!this.isActiveChatSession(chatSessionId, textContainer)) return;

                const finalText = textContainer.dataset.fullText || textContainer.innerText;
                if (!streamResult?.historyCommitted) {
                    this.state.messageHistory.push(this.createAssistantHistoryMessage(finalText, streamResult));
                }

                this.trimMessageHistory();
                await this.persistDisplaySnapshot();
            } catch (error) {
                if (!this.isActiveChatSession(chatSessionId, textContainer)) {
                    return;
                }
                if (error.name === 'AbortError') {
                    window.ZhiLiaoJiaohuModule?.handleAbortedResponse?.(thinkingContainer, textContainer, this.state);
                } else {
                    this.logError('AI 调用失败', error);
                    this.showAIError(error, textContainer);
                }
            } finally {
                if (this.isActiveChatSession(chatSessionId)) {
                    this.setWaitingState(false);
                }
            }
        },

        createAssistantHistoryMessage(content = '', meta = {}) {
            const message = {
                role: 'assistant',
                content: content ?? ''
            };
            const reasoningContent = typeof meta?.reasoningContent === 'string'
                ? meta.reasoningContent
                : '';
            const reasoningSignature = typeof meta?.reasoningSignature === 'string'
                ? meta.reasoningSignature
                : '';
            if (reasoningContent) {
                message.reasoning_content = reasoningContent;
            }
            if (reasoningSignature) {
                message.reasoning_signature = reasoningSignature;
            }
            return message;
        },

        trimMessageHistory() {
            if (!window.HistoryModule?.compressHistory) {
                return;
            }

            const maxTokens = this.config.maxHistoryTokens || 80000;
            const compressed = HistoryModule.compressHistory(
                this.state.messageHistory,
                maxTokens
            );

            if (compressed.length !== this.state.messageHistory.length) {
                this.logDebug(`History compressed: ${this.state.messageHistory.length} -> ${compressed.length}`);
            }

            this.state.messageHistory = compressed;
        },

        createStreamingMessage() {
            return window.ZhiLiaoBujuModule?.createStreamingMessage?.()
                || { textContainer: null, thinkingContainer: null };
        },

        async prepareMediaAwareMessages(messages = [], currentContent = null) {
            const preparedMessages = Array.isArray(messages) ? [...messages] : [];
            let capability = 'text';
            let modelOption = null;

            if (!currentContent || !this.hasImageOrVideoBlocks(currentContent)) {
                return { messages: preparedMessages, capability, modelOption };
            }

            const route = await this.pickChatCapabilityForContent(currentContent);
            capability = route.capability || 'text';
            modelOption = route.modelOption || null;

            if (capability === 'text') {
                const lastIndex = preparedMessages.length - 1;
                if (preparedMessages[lastIndex]?.role === 'user') {
                    preparedMessages[lastIndex] = {
                        ...preparedMessages[lastIndex],
                        content: await this.buildTextFallbackContentForMultimodal(currentContent)
                    };
                }
            }

            return { messages: preparedMessages, capability, modelOption };
        },

        async streamGroupAPI(groupContent, textContainer, thinkingContainer, isFirstGroup, previousGroupMessage) {
            const tempMessages = [
                { role: 'system', content: this.getRuntimeSystemPrompt() }
            ];

            if (!isFirstGroup && previousGroupMessage) {
                tempMessages.push(previousGroupMessage);
            }

            tempMessages.push({ role: 'user', content: groupContent });

            this.logDebug('分组 API 请求', {
                messageCount: tempMessages.length,
                contentLength: Array.isArray(groupContent) ? groupContent.length : 1
            });

            this.state.currentAbortController = new AbortController();
            const routed = await this.prepareMediaAwareMessages(tempMessages, groupContent);
            const result = await this.callAPIWithJjgnFallback({
                messages: routed.messages,
                stream: true,
                enableThinking: this.state.enableThinking,
                enableTools: true,
                maxTokens: this.config.maxTokens,
                temperature: this.config.temperature,
                capability: routed.capability,
                modelOption: routed.modelOption,
                signal: this.state.currentAbortController.signal
            });
            return await this.processStream(
                result.response,
                textContainer,
                thinkingContainer,
                result.payload.capability,
                this.state.enableThinking
            );
        },

        async streamAPI(textContainer, thinkingContainer, currentMessage = null) {
            if (this.state.enableThinking) {
                const thinkingId = thinkingContainer?.id || ('thinking-' + Date.now());
                window.ShendModule?.startTiming?.(thinkingId);
            }

            const messages = [
                { role: 'system', content: this.getRuntimeSystemPrompt() },
                ...this.state.messageHistory
            ];

            if (currentMessage && messages.length > 1) {
                const lastIndex = messages.length - 1;
                if (messages[lastIndex].role === 'user') {
                    messages[lastIndex] = { role: 'user', content: currentMessage };
                }
            }

            this.state.currentAbortController = new AbortController();
            const routed = await this.prepareMediaAwareMessages(messages, currentMessage);
            const result = await this.callAPIWithJjgnFallback({
                messages: routed.messages,
                stream: true,
                enableThinking: this.state.enableThinking,
                enableTools: true,
                maxTokens: this.config.maxTokens,
                temperature: this.config.temperature,
                capability: routed.capability,
                modelOption: routed.modelOption,
                signal: this.state.currentAbortController.signal
            });
            return await this.processStream(
                result.response,
                textContainer,
                thinkingContainer,
                result.payload.capability,
                this.state.enableThinking
            );
        },

        parseToolCallArguments(toolCall = {}) {
            try {
                return JSON.parse(toolCall?.function?.arguments || '{}');
            } catch {
                return {};
            }
        },

        isActiveChatSession(sessionId, textContainer = null) {
            const currentSessionId = String(this.state.sessionId || '');
            const expectedSessionId = String(sessionId || '');
            if (expectedSessionId && currentSessionId && expectedSessionId !== currentSessionId) return false;
            if (textContainer && textContainer.isConnected === false) return false;
            return true;
        },

        getMediaPolicyContextText() {
            if (window.ToolSkillCenterModule?.getLatestUserText) {
                return ToolSkillCenterModule.getLatestUserText();
            }

            const history = Array.isArray(this.state.messageHistory) ? this.state.messageHistory : [];
            for (let i = history.length - 1; i >= 0; i -= 1) {
                const item = history[i];
                if (!item || item.role !== 'user') continue;
                if (typeof item.content === 'string') return item.content;
                try {
                    return JSON.stringify(item.content || '');
                } catch {
                    return '';
                }
            }
            return '';
        },

        createAssistantToolHistoryMessage(toolCalls = [], assistantMeta = null) {
            const assistantMessage = {
                role: 'assistant',
                content: null,
                tool_calls: toolCalls.map(tc => ({
                    id: tc.id,
                    type: tc.type,
                    function: {
                        name: tc.function.name,
                        arguments: this.compactToolCallArgumentsForHistory?.(tc.function.name, tc.function.arguments) || tc.function.arguments
                    }
                }))
            };
            const reasoningContent = typeof assistantMeta?.reasoningContent === 'string'
                ? assistantMeta.reasoningContent
                : '';
            const reasoningSignature = typeof assistantMeta?.reasoningSignature === 'string'
                ? assistantMeta.reasoningSignature
                : '';
            if (reasoningContent) assistantMessage.reasoning_content = reasoningContent;
            if (reasoningSignature) assistantMessage.reasoning_signature = reasoningSignature;
            return assistantMessage;
        },

        buildToolHistoryContent(functionName, result = {}) {
            if (result?.error) {
                const errorPayload = { error: result.error };
                if (result.route_blocked === true) errorPayload.route_blocked = true;
                if (result.suggested_tool) errorPayload.suggested_tool = String(result.suggested_tool);
                return JSON.stringify(errorPayload);
            }
            return JSON.stringify(this.compactToolResultForHistory(functionName, result));
        },

        async renderToolResultCards(functionName, result = {}, textContainer = null) {
            if (!result?.success || !result.render_cards) return false;

            const parentElement = textContainer?.parentNode || document.getElementById('message-container');
            if (!parentElement) return false;

            let rendered = false;
            if (functionName === 'search_product' && Array.isArray(result.products) && window.ChaxunYsModule) {
                ChaxunYsModule.renderCardsAt(result.products, parentElement, textContainer || null);
                rendered = true;
            } else if (
                functionName === 'query_coupon' &&
                result.card_type === 'coupon_activity_list' &&
                Array.isArray(result.coupons) &&
                window.YhquanYsModule
            ) {
                YhquanYsModule.renderResultsAt(result.coupons, parentElement, textContainer || null);
                rendered = true;
            }

            if (!rendered) return false;
            this.scrollToBottom();
            await this.persistDisplaySnapshot();
            return true;
        },

        async streamToolFollowup(textContainer, thinkingContainer, sessionId = '') {
            if (!this.isActiveChatSession(sessionId, textContainer)) {
                return { historyCommitted: true, stale: true };
            }
            const followupResult = await this.streamAPI(textContainer, thinkingContainer);
            if (!this.isActiveChatSession(sessionId, textContainer)) {
                return { historyCommitted: true, stale: true };
            }
            const followupText = textContainer.dataset.fullText || textContainer.innerText;
            if (!followupResult?.historyCommitted) {
                this.state.messageHistory.push(this.createAssistantHistoryMessage(followupText, followupResult));
            }
            return followupResult;
        },

        async handleToolCalls(toolCalls, textContainer, thinkingContainer, assistantMeta = null) {
            const toolSessionId = this.state.sessionId;
            if (!window.ToolRegistry) {
                textContainer.innerHTML = this.renderFinalMessage('工具模块未加载');
                return;
            }

            const maxToolRounds = 8;
            this.state.toolCallDepth = Number(this.state.toolCallDepth || 0) + 1;
            if (this.state.toolCallDepth > maxToolRounds) {
                const notice = '工具调用轮次过多，已自动停止。你可以补充更明确的需求后重试。';
                textContainer.innerHTML = this.renderFinalMessage(notice);
                textContainer.dataset.fullText = notice;
                if (thinkingContainer) {
                    thinkingContainer.innerHTML = '';
                }
                this.state.messageHistory.push({ role: 'assistant', content: notice });
                this.state.toolCallDepth = 0;
                this.state.lastToolCallSignature = '';
                this.state.repeatedToolCallCount = 0;
                return;
            }

            const toolCallSignature = (Array.isArray(toolCalls) ? toolCalls : [])
                .map((item) => {
                    const name = String(item?.function?.name || '').trim();
                    const args = String(item?.function?.arguments || '').trim();
                    return `${name}:${args}`;
                })
                .join('|');

            if (toolCallSignature && toolCallSignature === this.state.lastToolCallSignature) {
                this.state.repeatedToolCallCount = Number(this.state.repeatedToolCallCount || 0) + 1;
            } else {
                this.state.lastToolCallSignature = toolCallSignature;
                this.state.repeatedToolCallCount = 1;
            }

            if (this.state.repeatedToolCallCount > 3) {
                const notice = '检测到同一工具参数被连续重复调用，已自动停止。请补充更具体要求后重试。';
                textContainer.innerHTML = this.renderFinalMessage(notice);
                textContainer.dataset.fullText = notice;
                if (thinkingContainer) {
                    thinkingContainer.innerHTML = '';
                }
                this.state.messageHistory.push({ role: 'assistant', content: notice });
                this.state.toolCallDepth = 0;
                this.state.lastToolCallSignature = '';
                this.state.repeatedToolCallCount = 0;
                return;
            }

            const toolResults = [];
            const executedToolResults = [];
            const mediaTasks = [];
            const mediaContextText = this.getMediaPolicyContextText();
            const renderInlineToolResult = async (toolName, result) => {
                return this.renderToolResultCards(toolName, result, textContainer);
            };

            for (const toolCall of toolCalls) {
                let stopStatusTimer = null;
                try {
                    const functionName = toolCall.function.name;
                    const functionArgs = this.parseToolCallArguments(toolCall);

                    if (this.isMediaArtifactToolName?.(functionName)) {
                        let mediaParams = {
                            ...functionArgs,
                            _fromAI: true
                        };

                        if (window.ToolSkillCenterModule && typeof window.ToolSkillCenterModule.beforeExecute === 'function') {
                            const skillResult = await window.ToolSkillCenterModule.beforeExecute(functionName, mediaParams, {
                                sessionId: toolSessionId,
                                source: 'media_queue_prepare',
                                priorToolResults: executedToolResults.slice()
                            });

                            if (skillResult?.blocked) {
                                const blockedResult = {
                                    success: false,
                                    error: skillResult.error || '工具调用被 skill 策略阻止',
                                    route_blocked: true,
                                    suggested_tool: skillResult.suggestedTool || ''
                                };
                                executedToolResults.push({ functionName, result: blockedResult });
                                toolResults.push({
                                    tool_call_id: toolCall.id,
                                    role: 'tool',
                                    name: functionName,
                                    content: JSON.stringify(blockedResult)
                                });
                                continue;
                            }

                            if (skillResult && Object.prototype.hasOwnProperty.call(skillResult, 'params')) {
                                mediaParams = skillResult.params;
                            }

                            if (Array.isArray(skillResult?.artifacts)) {
                                for (const artifact of skillResult.artifacts) {
                                    if (artifact?.type === 'tool_result') {
                                        await renderInlineToolResult(artifact.tool, artifact.result);
                                    }
                                }
                            }
                        }

                        mediaParams = {
                            ...(mediaParams && typeof mediaParams === 'object' ? mediaParams : {}),
                            _fromAI: true,
                            _skipSkill: true
                        };

                        const policy = this.buildMediaTaskPolicy?.(functionName, mediaParams, mediaContextText) || {
                            toolName: functionName,
                            kind: this.getMediaTaskKind(functionName),
                            deliveryMode: 'card_only'
                        };
                        const queuedResult = this.enqueueMediaTask(
                            functionName,
                            mediaParams,
                            toolSessionId,
                            policy
                        );
                        const result = this.buildQueuedMediaToolResult(functionName, queuedResult);
                        executedToolResults.push({ functionName, result });
                        const toolResult = {
                            tool_call_id: toolCall.id,
                            role: 'tool',
                            name: functionName,
                            content: JSON.stringify(result)
                        };
                        mediaTasks.push({
                            functionName,
                            policy,
                            queuedResult,
                            completion: queuedResult.completion,
                            toolResult
                        });
                        toolResults.push(toolResult);
                        continue;
                    }

                    const tip = this.getToolTip(functionName, functionArgs);
                    stopStatusTimer = this.startStatusTimer(textContainer, tip.text, tip.icon, '#666');

                    const argsWithFlag = { ...functionArgs, _fromAI: true };

                    const result = await ToolRegistry.executeTool(
                        functionName,
                        argsWithFlag,
                        toolSessionId
                    );
                    if (!this.isActiveChatSession(toolSessionId, textContainer)) return;
                    executedToolResults.push({ functionName, result });

                    this.logDebug('工具返回结果', { functionName, result });

                    if (result.success && result.image_url && !result.error && functionName !== 'search_product') {
                        this.logDebug('检测到图片结果', { functionName, hasImageUrl: !!result.image_url });
                        const isImageTool = functionName === 'generate_or_edit_image';
                        const isProductImageTool =
                            functionName === 'search_product' || functionName === 'understand_product_image';
                        const imageTitle = (isImageTool || isProductImageTool) ? '图片' : '图表';
                        const imageDescription = result.description
                            || (isImageTool
                                ? '图片已生成'
                                : (isProductImageTool ? '商品图片（查询返回）' : '图表已生成'));
                        this.renderImageResultCard(textContainer, {
                            image_url: result.image_url,
                            description: imageDescription
                        }, imageTitle);
                        this.logDebug('图片已插入 DOM');
                        await this.persistDisplaySnapshot();
                    } else if (result.success && result.video_url && !result.error) {
                        this.logDebug('检测到视频结果', { functionName, hasVideoUrl: !!result.video_url });
                        this.renderVideoResultCard(textContainer, {
                            video_url: result.video_url
                        }, '视频');
                        this.logDebug('视频已插入 DOM');
                        await this.persistDisplaySnapshot();
                    } else {
                        this.logDebug('未检测到媒体结果', {
                            success: result.success,
                            hasImageUrl: !!result.image_url,
                            hasVideoUrl: !!result.video_url,
                            error: result.error
                        });
                    }

                    await renderInlineToolResult(functionName, result);

                    toolResults.push({
                        tool_call_id: toolCall.id,
                        role: 'tool',
                        name: functionName,
                        content: this.buildToolHistoryContent(functionName, result)
                    });
                } catch (error) {
                    this.logWarn('工具调用失败', {
                        toolName: toolCall.function.name,
                        error: this.getErrorMessage(error)
                    });
                    executedToolResults.push({
                        functionName: toolCall.function.name,
                        result: { success: false, error: this.getErrorMessage(error) }
                    });
                    toolResults.push({
                        tool_call_id: toolCall.id,
                        role: 'tool',
                        name: toolCall.function.name,
                        content: JSON.stringify({ error: this.getErrorMessage(error) })
                    });
                } finally {
                    if (typeof stopStatusTimer === 'function') {
                        stopStatusTimer();
                    }
                }
            }

            const awaitMediaTasks = mediaTasks.filter((entry) =>
                entry?.policy?.deliveryMode === 'await_then_reply' && entry?.completion
            );

            if (awaitMediaTasks.length > 0) {
                if (thinkingContainer) thinkingContainer.innerHTML = '';
                if (textContainer) {
                    textContainer.innerHTML = '';
                    textContainer.dataset.fullText = '';
                }

                const completions = await Promise.all(awaitMediaTasks.map((entry) => entry.completion));
                if (!this.isActiveChatSession(toolSessionId, textContainer)) return;
                completions.forEach((completion, index) => {
                    const entry = awaitMediaTasks[index];
                    if (!entry?.toolResult) return;

                    if (completion?.success && completion?.summary) {
                        entry.toolResult.content = JSON.stringify(completion.summary);
                        return;
                    }

                    entry.toolResult.content = JSON.stringify({
                        success: false,
                        media_kind: entry.policy?.kind || '',
                        error: completion?.error || `${this.getMediaTaskLabel(entry.policy?.kind)}生成失败`
                    });
                });
            }

            if (!this.isActiveChatSession(toolSessionId, textContainer)) return;
            const assistantMessage = this.createAssistantToolHistoryMessage(toolCalls, assistantMeta);

            this.state.messageHistory.push(assistantMessage);
            this.state.messageHistory.push(...toolResults);

            const isQueuedCardMediaResult = (item) => {
                if (!item?.result?.queued || !this.isMediaArtifactToolName?.(item.functionName)) return false;
                const mode = this.normalizeDeliveryMode?.(item.result.delivery_mode) || 'card_only';
                return mode === 'card_only' || item.result.suppress_followup === true;
            };
            const isRenderedProductResult = (item) =>
                item?.functionName === 'search_product' &&
                item?.result?.success &&
                item?.result?.render_cards;
            const shouldSkipToolFollowup = mediaTasks.length > 0 &&
                awaitMediaTasks.length === 0 &&
                mediaTasks.every((entry) => entry?.policy?.deliveryMode === 'card_only') &&
                executedToolResults.every((item) =>
                    isQueuedCardMediaResult(item) || isRenderedProductResult(item)
                );

            if (shouldSkipToolFollowup) {
                this.removeEmptyToolMessage(
                    textContainer,
                    thinkingContainer,
                    '媒体生成任务已提交，后台生成中。'
                );
                await this.persistDisplaySnapshot();
                return;
            }

            if (awaitMediaTasks.length > 0) {
                await this.streamToolFollowup(textContainer, thinkingContainer, toolSessionId);
                return;
            }

            await this.streamToolFollowup(textContainer, thinkingContainer, toolSessionId);
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

window.ZhiLiaoZjgLiaochengModule = ZhiLiaoZjgLiaochengModule;
