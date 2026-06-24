/**
 * 会话持久化模块：IndexedDB 封装
 * 提供异步 key-value 风格 API，用于持久化消息历史、图片池、文件记录。
 */
const SessionDB = {
    config: {
        dbName: 'zhiliao_session',
        dbVersion: 3,
        stores: {
            meta: 'session_meta',
            messages: 'messages',
            imagePool: 'image_pool',
            files: 'files',
            apiHistory: 'api_history'
        },
        storeKeyPaths: {
            session_meta: 'key',
            messages: 'index',
            image_pool: 'key',
            files: 'id',
            api_history: 'key'
        },
        maxMessageBytes: 8 * 1024 * 1024
    },

    state: {
        db: null,
        ready: false
    },

    async init() {
        if (this.state.ready && this.state.db) return;
        try {
            this.state.db = await this.openDB();
            const currentVersion = Number(this.state.db?.version || 0);
            if (currentVersion < this.config.dbVersion) {
                this.state.db.close();
                this.state.db = await this.openDB(this.config.dbVersion);
            }
            await this.ensureSchemaReady();
            this.state.ready = true;
        } catch (error) {
            this.state.db = null;
            this.state.ready = false;
            throw error;
        }
    },

    getAllStoreNames() {
        return Object.values(this.config.stores);
    },

    getStoreOptions(storeName) {
        const keyPath = this.config.storeKeyPaths?.[storeName];
        return keyPath ? { keyPath } : undefined;
    },

    ensureStores(db) {
        if (!db) return;
        this.getAllStoreNames().forEach((storeName) => {
            if (!db.objectStoreNames.contains(storeName)) {
                const options = this.getStoreOptions(storeName);
                db.createObjectStore(storeName, options);
            }
        });
    },

    getMissingStores(db) {
        if (!db) return this.getAllStoreNames();
        return this.getAllStoreNames().filter((storeName) => !db.objectStoreNames.contains(storeName));
    },

    async ensureSchemaReady() {
        const db = this.state.db;
        const missingStores = this.getMissingStores(db);
        if (missingStores.length === 0) return;

        // Schema drift should be repaired via a deterministic version upgrade.
        const nextVersion = Number(db?.version || this.config.dbVersion || 1) + 1;
        if (db) db.close();

        this.state.db = await this.openDB(nextVersion);
        const unresolvedStores = this.getMissingStores(this.state.db);
        if (unresolvedStores.length > 0) {
            throw new Error(`SessionDB schema migration failed, missing stores: ${unresolvedStores.join(', ')}`);
        }
    },

    openDB(version = null) {
        return new Promise((resolve, reject) => {
            const hasVersion = Number.isInteger(version) && version > 0;
            const request = hasVersion
                ? indexedDB.open(this.config.dbName, version)
                : indexedDB.open(this.config.dbName);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.ensureStores(db);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error('IndexedDB upgrade blocked'));
        });
    },

    tx(storeName, mode) {
        if (!this.state.db) {
            throw new Error('IndexedDB is not initialized.');
        }
        if (!this.state.db.objectStoreNames.contains(storeName)) {
            throw new Error(`IndexedDB store not found: ${storeName}`);
        }
        const transaction = this.state.db.transaction(storeName, mode);
        return transaction.objectStore(storeName);
    },

    put(storeName, data) {
        return new Promise((resolve, reject) => {
            const store = this.tx(storeName, 'readwrite');
            const request = store.put(data);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    get(storeName, key) {
        return new Promise((resolve, reject) => {
            const store = this.tx(storeName, 'readonly');
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    },

    getAll(storeName) {
        return new Promise((resolve, reject) => {
            const store = this.tx(storeName, 'readonly');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    clearStore(storeName) {
        return new Promise((resolve, reject) => {
            const store = this.tx(storeName, 'readwrite');
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // --- Session Meta ---
    async saveSessionMeta(meta) {
        await this.put(this.config.stores.meta, { key: 'current', ...meta });
    },

    async getSessionMeta() {
        return this.get(this.config.stores.meta, 'current');
    },

    // --- Messages ---
    async saveMessage(index, msg) {
        const record = this.prepareMessageRecord(index, msg);
        await this.put(this.config.stores.messages, record);
    },

    prepareMessageRecord(index, msg) {
        const maxBytes = Number(this.config.maxMessageBytes || 8 * 1024 * 1024);
        const suffix = '\n...[snapshot truncated]';
        const record = { index, ...(msg || {}) };

        const fits = (value) => {
            try {
                return JSON.stringify(value).length <= maxBytes;
            } catch {
                return false;
            }
        };

        const truncateFieldToFit = (fieldName) => {
            if (typeof record[fieldName] !== 'string' || !record[fieldName]) return false;
            const source = record[fieldName];
            let low = 0;
            let high = source.length;
            let best = '';

            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                record[fieldName] = source.slice(0, mid) + suffix;
                if (fits(record)) {
                    best = record[fieldName];
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }

            if (best) {
                record[fieldName] = best;
                return true;
            }
            return false;
        };

        if (fits(record)) return record;
        if (truncateFieldToFit('displayContent') && fits(record)) return record;
        if (truncateFieldToFit('content') && fits(record)) return record;

        const fallback = {
            index,
            role: typeof record.role === 'string' ? record.role : 'system',
            content: '[snapshot omitted: payload too large]'
        };
        return fallback;
    },

    async getAllMessages() {
        const all = await this.getAll(this.config.stores.messages);
        return all.sort((a, b) => a.index - b.index);
    },

    async clearMessages() {
        await this.clearStore(this.config.stores.messages);
    },

    async replaceSnapshot(messages = [], apiHistory = []) {
        if (!this.state.db) {
            throw new Error('IndexedDB is not initialized.');
        }

        const messageStoreName = this.config.stores.messages;
        const apiHistoryStoreName = this.config.stores.apiHistory;
        const normalizedMessages = Array.isArray(messages) ? messages : [];
        const normalizedHistory = Array.isArray(apiHistory) ? apiHistory : [];

        await new Promise((resolve, reject) => {
            const tx = this.state.db.transaction([messageStoreName, apiHistoryStoreName], 'readwrite');
            const messageStore = tx.objectStore(messageStoreName);
            const apiHistoryStore = tx.objectStore(apiHistoryStoreName);

            messageStore.clear();
            for (let i = 0; i < normalizedMessages.length; i += 1) {
                const safeRecord = this.prepareMessageRecord(i, normalizedMessages[i]);
                messageStore.put(safeRecord);
            }
            apiHistoryStore.put({ key: 'history', items: normalizedHistory });

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('IndexedDB snapshot write failed.'));
            tx.onabort = () => reject(tx.error || new Error('IndexedDB snapshot transaction aborted.'));
        });
    },

    // --- Image Pool ---
    async saveImagePool(pool) {
        const maxItemBytes = 5 * 1024 * 1024;
        const filtered = (Array.isArray(pool) ? pool : []).filter((item) => {
            const url = String(item?.image_url || '');
            if (!url) return false;
            if (url.length > maxItemBytes) return false;
            return true;
        });
        await this.put(this.config.stores.imagePool, { key: 'pool', items: filtered });
    },

    async getImagePool() {
        const record = await this.get(this.config.stores.imagePool, 'pool');
        return Array.isArray(record?.items) ? record.items : [];
    },

    // --- Files ---
    async saveFile(fileRecord) {
        if (!fileRecord || !fileRecord.id) return;
        await this.put(this.config.stores.files, fileRecord);
    },

    async getAllFiles() {
        return this.getAll(this.config.stores.files);
    },

    // --- API History (full messageHistory for model context) ---
    async saveApiHistory(historyArray) {
        await this.put(this.config.stores.apiHistory, { key: 'history', items: historyArray });
    },

    async getApiHistory() {
        const record = await this.get(this.config.stores.apiHistory, 'history');
        return Array.isArray(record?.items) ? record.items : [];
    },

    // --- Clear All ---
    async clearAll() {
        const stores = this.config.stores;
        await this.clearStore(stores.meta);
        await this.clearStore(stores.messages);
        await this.clearStore(stores.imagePool);
        await this.clearStore(stores.files);
        await this.clearStore(stores.apiHistory);
    }
};

window.SessionDB = SessionDB;
