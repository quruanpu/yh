// IndexedDB 数据库管理模块
const DBModule = {
    // 配置
    config: {
        dbName: 'ZhiLiaoDatabase',
        version: 2,  // 升级到版本2
        stores: {
            files: 'files',           // 文件内容存储
            sessions: 'sessions',     // 会话管理
            messages: 'messages'      // 消息历史
        }
    },

    // 状态
    state: {
        db: null,
        initialized: false
    },

    // 初始化数据库
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.config.dbName, this.config.version);

            request.onerror = () => {
                console.error('数据库打开失败:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.state.db = request.result;
                this.state.initialized = true;
                console.log('数据库初始化成功');
                resolve(this.state.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 创建文件存储（存储解析后的文件内容）
                if (!db.objectStoreNames.contains(this.config.stores.files)) {
                    const fileStore = db.createObjectStore(this.config.stores.files, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    fileStore.createIndex('filename', 'filename', { unique: false });
                    fileStore.createIndex('timestamp', 'timestamp', { unique: false });
                    fileStore.createIndex('sessionId', 'sessionId', { unique: false });
                }

                // 创建会话存储
                if (!db.objectStoreNames.contains(this.config.stores.sessions)) {
                    const sessionStore = db.createObjectStore(this.config.stores.sessions, {
                        keyPath: 'sessionId'
                    });
                    sessionStore.createIndex('createdAt', 'createdAt', { unique: false });
                    sessionStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                    sessionStore.createIndex('isActive', 'isActive', { unique: false });
                }

                // 创建消息历史存储
                if (!db.objectStoreNames.contains(this.config.stores.messages)) {
                    const messageStore = db.createObjectStore(this.config.stores.messages, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    messageStore.createIndex('sessionId', 'sessionId', { unique: false });
                    messageStore.createIndex('timestamp', 'timestamp', { unique: false });
                    messageStore.createIndex('importance', 'importance', { unique: false });
                }

                console.log('数据库结构创建完成');
            };
        });
    },

    // 保存文件到数据库
    async saveFile(fileData) {
        if (!this.state.initialized) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.state.db.transaction([this.config.stores.files], 'readwrite');
            const store = transaction.objectStore(this.config.stores.files);

            const data = {
                filename: fileData.filename,
                type: fileData.type,
                extension: fileData.extension,
                size: fileData.size,
                url: fileData.url || '',  // 新增：保存文件URL（图片/视频/文档）
                content: fileData.content || '',  // 文本内容（文本/表格）
                metadata: fileData.metadata || {},
                sessionId: fileData.sessionId,
                timestamp: Date.now()
            };

            const request = store.add(data);

            request.onsuccess = () => {
                resolve(request.result); // 返回文件ID
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    // 获取文件
    async getFile(fileId) {
        if (!this.state.initialized) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.state.db.transaction([this.config.stores.files], 'readonly');
            const store = transaction.objectStore(this.config.stores.files);
            const request = store.get(fileId);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    // 获取会话的所有文件
    async getSessionFiles(sessionId) {
        if (!this.state.initialized) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.state.db.transaction([this.config.stores.files], 'readonly');
            const store = transaction.objectStore(this.config.stores.files);
            const index = store.index('sessionId');
            const request = index.getAll(sessionId);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    },

    // 清除会话文件
    async clearSessionFiles(sessionId) {
        if (!this.state.initialized) await this.init();

        const files = await this.getSessionFiles(sessionId);
        const transaction = this.state.db.transaction([this.config.stores.files], 'readwrite');
        const store = transaction.objectStore(this.config.stores.files);

        for (const file of files) {
            store.delete(file.id);
        }

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    },

    // 搜索文件（按文件名）
    async searchFiles(sessionId, keyword) {
        if (!this.state.initialized) await this.init();

        const files = await this.getSessionFiles(sessionId);
        return files.filter(file =>
            file.filename.toLowerCase().includes(keyword.toLowerCase())
        );
    },

    // 获取文件列表（简要信息）
    async getFileList(sessionId) {
        if (!this.state.initialized) await this.init();

        const files = await this.getSessionFiles(sessionId);
        return files.map(file => ({
            id: file.id,
            filename: file.filename,
            type: file.type,
            extension: file.extension,
            size: file.size,
            timestamp: file.timestamp
        }));
    },

    // ========== 数据清理方法 ==========

    // 清理过期数据（保留最近N小时）
    async cleanupOldData(hoursToKeep = 1) {
        if (!this.state.initialized) await this.init();

        const cutoffTime = Date.now() - (hoursToKeep * 60 * 60 * 1000);
        let deletedFiles = 0;
        let deletedMessages = 0;

        try {
            // 清理旧文件
            const transaction1 = this.state.db.transaction([this.config.stores.files], 'readwrite');
            const fileStore = transaction1.objectStore(this.config.stores.files);
            const fileIndex = fileStore.index('timestamp');
            const fileRequest = fileIndex.openCursor(IDBKeyRange.upperBound(cutoffTime));

            fileRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    deletedFiles++;
                    cursor.continue();
                }
            };

            await new Promise((resolve, reject) => {
                transaction1.oncomplete = () => resolve();
                transaction1.onerror = () => reject(transaction1.error);
            });

            // 清理旧消息
            const transaction2 = this.state.db.transaction([this.config.stores.messages], 'readwrite');
            const messageStore = transaction2.objectStore(this.config.stores.messages);
            const messageIndex = messageStore.index('timestamp');
            const messageRequest = messageIndex.openCursor(IDBKeyRange.upperBound(cutoffTime));

            messageRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    deletedMessages++;
                    cursor.continue();
                }
            };

            await new Promise((resolve, reject) => {
                transaction2.oncomplete = () => resolve();
                transaction2.onerror = () => reject(transaction2.error);
            });

            console.log(`数据清理完成: 删除${deletedFiles}个文件, ${deletedMessages}条消息`);
            return { success: true, deletedFiles, deletedMessages };
        } catch (error) {
            console.error('数据清理失败:', error);
            return { success: false, error: error.message };
        }
    },

    // 获取数据库存储统计
    async getStorageStats() {
        if (!this.state.initialized) await this.init();

        try {
            const files = await this.getAllFiles();
            const messages = await this.getAllMessages();

            // 计算文件总大小
            let totalFileSize = 0;
            files.forEach(file => {
                totalFileSize += file.size || 0;
                if (file.content) {
                    totalFileSize += file.content.length;
                }
            });

            return {
                fileCount: files.length,
                messageCount: messages.length,
                totalSize: totalFileSize,
                totalSizeMB: (totalFileSize / 1024 / 1024).toFixed(2)
            };
        } catch (error) {
            console.error('获取存储统计失败:', error);
            return null;
        }
    },

    // 获取所有文件（用于统计）
    async getAllFiles() {
        if (!this.state.initialized) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.state.db.transaction([this.config.stores.files], 'readonly');
            const store = transaction.objectStore(this.config.stores.files);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // 获取所有消息（用于统计）
    async getAllMessages() {
        if (!this.state.initialized) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.state.db.transaction([this.config.stores.messages], 'readonly');
            const store = transaction.objectStore(this.config.stores.messages);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // ========== 消息历史管理方法 ==========

    // 保存消息到数据库
    async saveMessage(sessionId, role, content, metadata = {}) {
        if (!this.state.initialized) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.state.db.transaction([this.config.stores.messages], 'readwrite');
            const store = transaction.objectStore(this.config.stores.messages);

            const messageData = {
                sessionId: sessionId,
                role: role,
                content: content,
                timestamp: Date.now(),
                tokenCount: metadata.tokenCount || 0,
                importance: metadata.importance || 0.5,
                cached: metadata.cached || false
            };

            const request = store.add(messageData);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // 获取会话消息
    async getSessionMessages(sessionId, limit = 50) {
        if (!this.state.initialized) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.state.db.transaction([this.config.stores.messages], 'readonly');
            const store = transaction.objectStore(this.config.stores.messages);
            const index = store.index('sessionId');
            const request = index.getAll(sessionId);

            request.onsuccess = () => {
                const messages = request.result;
                const sorted = messages.sort((a, b) => a.timestamp - b.timestamp);
                resolve(sorted.slice(-limit));
            };
            request.onerror = () => reject(request.error);
        });
    }
};

// 导出模块
window.DBModule = DBModule;

