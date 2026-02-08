// IndexedDB 数据库管理模块（文件存储专用）
const DBModule = {
    // 配置
    config: {
        dbName: 'ZhiLiaoDatabase',
        version: 3,  // 升级到版本3（移除sessions和messages）
        stores: {
            files: 'files'  // 仅保留文件内容存储
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

                // 删除旧的sessions和messages存储（如果存在）
                if (db.objectStoreNames.contains('sessions')) {
                    db.deleteObjectStore('sessions');
                    console.log('已删除sessions存储');
                }
                if (db.objectStoreNames.contains('messages')) {
                    db.deleteObjectStore('messages');
                    console.log('已删除messages存储');
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
                url: fileData.url || '',  // 保存文件URL（图片/视频/文档）
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

    // 清理过期文件（保留最近N小时）
    async cleanupOldFiles(hoursToKeep = 24) {
        if (!this.state.initialized) await this.init();

        const cutoffTime = Date.now() - (hoursToKeep * 60 * 60 * 1000);
        let deletedFiles = 0;

        try {
            const transaction = this.state.db.transaction([this.config.stores.files], 'readwrite');
            const fileStore = transaction.objectStore(this.config.stores.files);
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
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });

            console.log(`文件清理完成: 删除${deletedFiles}个文件`);
            return { success: true, deletedFiles };
        } catch (error) {
            console.error('文件清理失败:', error);
            return { success: false, error: error.message };
        }
    },

    // 获取文件存储统计
    async getFileStats() {
        if (!this.state.initialized) await this.init();

        try {
            const transaction = this.state.db.transaction([this.config.stores.files], 'readonly');
            const store = transaction.objectStore(this.config.stores.files);
            const request = store.getAll();

            const files = await new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });

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
                totalSize: totalFileSize,
                totalSizeMB: (totalFileSize / 1024 / 1024).toFixed(2)
            };
        } catch (error) {
            console.error('获取存储统计失败:', error);
            return null;
        }
    }
};

// 导出模块
window.DBModule = DBModule;
