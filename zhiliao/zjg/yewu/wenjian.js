const ZhiLiaoZjgWenjianModule = (() => {
    const VIDEO_EXTS = new Set(['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'mpeg', 'mpg']);
    const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico']);
    const DOCUMENT_EXTS = new Set(['pdf', 'doc', 'docx']);

    function getFileExtension(filename = '') {
        return String(filename || '').split('.').pop().toLowerCase();
    }

    const methods = {
        hasImageOrVideoBlocks(content) {
            return this.hasMediaBlocks?.(content) === true;
        },

        async pickChatCapabilityForContent(content) {
            if (!this.hasImageOrVideoBlocks(content)) return { capability: 'text', modelOption: null };

            const capability = Array.isArray(content) && content.some(item => item?.type === 'video_url')
                ? 'video_understanding'
                : 'image_understanding';

            try {
                const constants = window.ZhiLiaoMoxingChangliangModule;
                const activeOption = await this.getActiveModelOption();
                if (constants?.hasCapability?.(activeOption?.capabilities || [], capability) === true) {
                    return { capability, modelOption: activeOption };
                }
            } catch (_error) {
                // The active text model cannot accept media blocks; fall back to resource references.
            }

            return { capability: 'text', modelOption: null };
        },

        async buildTextFallbackContentForMultimodal(content) {
            return this.buildToolReferenceContent?.(content) || '';
        },

        async ensureActiveModelReady(_options = {}) {
            try {
                await this.getActiveModelOption();
                return true;
            } catch (error) {
                this.showToast(error.message || 'No available model. Please add and enable a model first.', 'warning');
                return false;
            }
        },

        async parseFiles(files, uploadId = null, options = {}) {
            if (!window.FileParserModule) return { fileIds: [], results: [] };

            const fileIds = [];
            const includeResults = options.includeResults === true;
            const results = includeResults ? [] : null;
            const fenx = window.FenxModule;
            const showBatchProgress = Boolean(uploadId && fenx && files.length > 1);

            const parsePromises = files.map(async (file, index) => {
                try {
                    if (showBatchProgress) fenx.updateFileStatus(uploadId, file.name, 'uploading');
                    const result = await FileParserModule.parseFile(file);
                    if (showBatchProgress) {
                        fenx.updateFileProgress(uploadId, index + 1, files.length);
                        fenx.updateFileStatus(uploadId, file.name, 'success');
                    }
                    return { file, result, success: true };
                } catch (error) {
                    this.logError(`File parse failed: ${file.name}`, error);
                    if (showBatchProgress) {
                        fenx.updateFileStatus(uploadId, file.name, 'error', error.message);
                    }
                    return { file, result: null, success: false, error: error.message };
                }
            });

            const parseResults = await Promise.all(parsePromises);
            const db = window.DBModule;
            for (const { file, result, success } of parseResults) {
                if (!success || !result || !db) {
                    this.logDebug('File save skipped', { fileName: file.name, success, hasResult: !!result });
                    continue;
                }

                const fileId = await db.saveFile({
                    filename: file.name,
                    type: result.type,
                    extension: result.extension || FileParserModule.getFileExtension(file.name),
                    size: file.size,
                    url: result.url || '',
                    content: result.content || '',
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

                this.logDebug('File saved to session store', { fileName: file.name, fileId });
                fileIds.push(fileId);
                if (includeResults) results.push({ file, result });
            }

            this.logDebug('parseFiles completed', { fileIds, count: fileIds.length });
            return { fileIds, results: includeResults ? results : [] };
        },

        buildUploadedFileInfo(files = [], fileIds = []) {
            if (!files.length || !fileIds.length) return '';
            const fileInfoList = files
                .map((file, index) => `- ${file.name} (file_id: ${fileIds[index]})`)
                .join('\n');
            return `\n\n[Uploaded files]\n${fileInfoList}\n${this.getDocumentToolStrategyHint({
                compact: false,
                includePrefix: true
            })}`;
        },

        async buildMultimodalContent(userMessage, files, fileIds) {
            this.logDebug('buildMultimodalContent started', { filesCount: files.length, fileIds });
            const contentArray = [];
            const textContent = (userMessage || 'Please analyze these files.') + this.buildUploadedFileInfo(files, fileIds);
            contentArray.push({ type: 'text', text: textContent });

            const db = window.DBModule;
            if (!db) return contentArray;

            for (let i = 0; i < files.length; i += 1) {
                const file = files[i];
                const fileId = fileIds[i];
                const fileData = await db.getFile(fileId);
                const contentItem = await this.buildFileContentItem(fileData, file, fileId);
                if (contentItem) {
                    contentArray.push(contentItem);
                    this.registerMediaContentItem?.(contentItem, {
                        fileId,
                        name: file.name,
                        source: 'upload'
                    });
                }
            }

            this.logDebug('buildMultimodalContent completed', { itemCount: contentArray.length });
            return contentArray;
        },

        async buildGroupContent(userMessage, groupFiles, isFirstGroup, groupIndex = 1, totalGroups = 1) {
            const contentArray = [];
            const groupType = groupFiles[0]?.fileType || 'unknown';
            const groupTypeNames = {
                document: 'document',
                image: 'image',
                video: 'video',
                text: 'text/table'
            };
            const typeName = groupTypeNames[groupType] || 'file';

            if (isFirstGroup && userMessage) {
                let promptText = userMessage;
                if (totalGroups > 1) {
                    promptText += `\n\n[System] Multiple file types detected. This is group 1 (${typeName}), ${groupFiles.length} files. Analyze this group first.`;
                }
                if (groupType === 'document' || groupType === 'text') {
                    promptText += `\n\n[System] ${this.getDocumentToolStrategyHint({
                        compact: false,
                        includePrefix: false
                    })}`;
                }
                contentArray.push({ type: 'text', text: promptText });
            } else if (!isFirstGroup) {
                const fileNames = groupFiles.map(item => item.file.name).join(', ');
                const documentHint = (groupType === 'document' || groupType === 'text')
                    ? `\n${this.getDocumentToolStrategyHint({ compact: true, includePrefix: false })}`
                    : '';
                contentArray.push({
                    type: 'text',
                    text: `[System] Continue analyzing file group ${groupIndex} (${typeName}), ${groupFiles.length} files: ${fileNames}\nContinue coherently based on previous analysis.${documentHint}`
                });
            }

            const db = window.DBModule;
            if (!db) return contentArray;

            for (const { file, fileId } of groupFiles) {
                const fileData = await db.getFile(fileId);
                const contentItem = await this.buildFileContentItem(fileData, file, fileId);
                if (contentItem) {
                    contentArray.push(contentItem);
                    this.registerMediaContentItem?.(contentItem, {
                        fileId,
                        name: file.name,
                        source: 'upload'
                    });
                }
            }

            return contentArray;
        },

        groupFilesByType(files, fileIds) {
            const groups = [];
            const typeGroups = {
                document: [],
                video: [],
                image: [],
                text: []
            };

            for (let i = 0; i < files.length; i += 1) {
                const file = files[i];
                const fileId = fileIds[i];
                const fileType = this.getFileTypeFromName(file.name);
                if (fileType === 'document') typeGroups.document.push({ file, fileId, fileType });
                else if (fileType === 'video') typeGroups.video.push({ file, fileId, fileType });
                else if (fileType === 'image') typeGroups.image.push({ file, fileId, fileType });
                else typeGroups.text.push({ file, fileId, fileType });
            }

            if (typeGroups.document.length > 0) groups.push({ type: 'document', files: typeGroups.document, name: 'document' });
            if (typeGroups.image.length > 0) {
                for (let i = 0; i < typeGroups.image.length; i += 10) {
                    groups.push({ type: 'image', files: typeGroups.image.slice(i, i + 10), name: 'image' });
                }
            }
            if (typeGroups.video.length > 0) groups.push({ type: 'video', files: typeGroups.video, name: 'video' });
            if (typeGroups.text.length > 0) groups.push({ type: 'text', files: typeGroups.text, name: 'text data' });
            return groups;
        },

        getDocumentToolStrategyHint(options = {}) {
            const compact = options.compact === true;
            const includePrefix = options.includePrefix !== false;
            const prefix = includePrefix ? '(Document reading strategy)\n' : '';
            const autoFullThreshold = Number(window.FileReadService?.config?.autoFullReadCharsThreshold || 20000);

            if (compact) {
                return `${prefix}Use describe_file_structure first. Small files (<=${autoFullThreshold} chars) can be read with get_file_content(read_mode=auto). For large files, search_file_content(include_snippet=false), then read_file_chunk with returned next parameters.`;
            }

            return [
                `${prefix}1. Call describe_file_structure(file_id) first to inspect structure.`,
                `2. For small files (<=${autoFullThreshold} chars), call get_file_content(file_id, read_mode=auto).`,
                '3. For large files, call search_file_content(file_id, keyword, max_hits<=8, include_snippet=false).',
                '4. Use read_file_chunk(file_id, start_line, max_lines<=120, max_chars<=6000), and continue with returned next parameters when available.',
                '5. Use get_file_content(file_id, read_mode=window, start_char, max_chars<=12000) only when windowed paging is needed.'
            ].join('\n');
        },

        getFileTypeFromName(filename) {
            const ext = getFileExtension(filename);
            if (DOCUMENT_EXTS.has(ext)) return 'document';
            if (VIDEO_EXTS.has(ext)) return 'video';
            if (IMAGE_EXTS.has(ext)) return 'image';
            return 'text';
        },

        async buildFileContentItem(fileData, file, fileId = null) {
            if (!fileData) return null;
            if (['image', 'video'].includes(fileData.type) && !fileData.url) return null;

            if (fileData.type === 'image') {
                return {
                    type: 'image_url',
                    image_url: { url: fileData.url }
                };
            }

            if (fileData.type === 'video') {
                return {
                    type: 'video_url',
                    video_url: { url: fileData.url }
                };
            }

            const readableTypes = ['text', 'spreadsheet', 'document'];
            if (!readableTypes.includes(fileData.type)) return null;

            const fileSizeKB = (Number(fileData.size || 0) / 1024).toFixed(1);
            const contentLength = String(fileData.content || '').length;
            const safeFileId = Number(fileId || fileData.id || 0) || 0;
            const header = [
                '[Readable file resource]',
                `file_id: ${safeFileId}`,
                `file_name: ${fileData.filename || file?.name || ''}`,
                `file_type: ${fileData.type}`,
                `file_ext: ${fileData.extension || ''}`,
                `file_size_kb: ${fileSizeKB}`,
                `content_chars: ${contentLength}`
            ].join('\n');

            return {
                type: 'text',
                text: header
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

window.ZhiLiaoZjgWenjianModule = ZhiLiaoZjgWenjianModule;
