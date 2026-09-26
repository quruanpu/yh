// In-memory file store for lightweight chat sessions.
const DBModule = {
    config: {
        maxFilesPerSession: window.ZhiLiaoConfig?.fileStore?.maxFilesPerSession || 20,
        maxTotalBytesPerSession: window.ZhiLiaoConfig?.fileStore?.maxTotalBytesPerSession || (32 * 1024 * 1024),
        maxContentChars: window.ZhiLiaoConfig?.fileStore?.maxContentChars || 1000000,
        maxAgeHours: window.ZhiLiaoConfig?.fileStore?.maxAgeHours || 2
    },

    state: {
        initialized: false,
        nextId: 1,
        files: []
    },

    now() {
        return Date.now();
    },

    normalizeSessionId(sessionId) {
        return String(sessionId || '').trim();
    },

    clone(value) {
        return JSON.parse(JSON.stringify(value));
    },

    toPositiveInteger(value, fallback) {
        const num = Number(value);
        if (!Number.isFinite(num) || num <= 0) return fallback;
        return Math.floor(num);
    },

    maxAgeMs() {
        const hours = this.toPositiveInteger(this.config.maxAgeHours, 2);
        return hours * 60 * 60 * 1000;
    },

    normalizeContent(content) {
        const text = typeof content === 'string' ? content : '';
        const maxChars = this.toPositiveInteger(this.config.maxContentChars, 200000);
        if (text.length <= maxChars) return text;
        return `${text.slice(0, maxChars)}\n...[内容已截断]`;
    },

    estimateFileBytes(file) {
        const base = Number(file.size) || 0;
        const textBytes = (file.content || '').length * 2;
        const urlBytes = (file.url || '').length;
        const nameBytes = (file.filename || '').length;
        return base + textBytes + urlBytes + nameBytes;
    },

    pruneExpired(maxAgeMs = this.maxAgeMs()) {
        const now = this.now();
        const before = this.state.files.length;
        this.state.files = this.state.files.filter((file) => (now - (file.timestamp || 0)) <= maxAgeMs);
        return before - this.state.files.length;
    },

    enforceSessionLimits(sessionId) {
        const sid = this.normalizeSessionId(sessionId);
        if (!sid) return;

        const maxFiles = this.toPositiveInteger(this.config.maxFilesPerSession, 20);
        const maxBytes = this.toPositiveInteger(this.config.maxTotalBytesPerSession, 32 * 1024 * 1024);
        const sessionFiles = this.state.files
            .filter((file) => file.sessionId === sid)
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        let totalBytes = sessionFiles.reduce((sum, file) => sum + this.estimateFileBytes(file), 0);
        let totalCount = sessionFiles.length;
        const removeIds = new Set();

        for (let i = 0; i < sessionFiles.length - 1 && (totalCount > maxFiles || totalBytes > maxBytes); i += 1) {
            const file = sessionFiles[i];
            removeIds.add(file.id);
            totalBytes -= this.estimateFileBytes(file);
            totalCount -= 1;
        }

        if (removeIds.size > 0) {
            this.state.files = this.state.files.filter((file) => !removeIds.has(file.id));
        }
    },

    async init() {
        if (this.state.initialized) return this.state;
        this.state.initialized = true;
        this.pruneExpired();
        return this.state;
    },

    async saveFile(fileData) {
        if (!this.state.initialized) await this.init();

        const sessionId = this.normalizeSessionId(fileData?.sessionId);
        const record = {
            id: this.state.nextId++,
            filename: String(fileData?.filename || ''),
            type: String(fileData?.type || ''),
            extension: String(fileData?.extension || ''),
            size: Number(fileData?.size) || 0,
            url: String(fileData?.url || ''),
            content: this.normalizeContent(fileData?.content),
            metadata: fileData?.metadata && typeof fileData.metadata === 'object'
                ? this.clone(fileData.metadata)
                : {},
            sessionId,
            timestamp: this.now()
        };

        this.state.files.push(record);
        this.pruneExpired();
        this.enforceSessionLimits(sessionId);
        window.SessionDB?.saveFile?.(record);
        return record.id;
    },

    async getFile(fileId) {
        if (!this.state.initialized) await this.init();
        const id = Number(fileId);
        const hit = this.state.files.find((file) => file.id === id);
        return hit ? this.clone(hit) : null;
    },

    async getSessionFiles(sessionId) {
        if (!this.state.initialized) await this.init();
        const sid = this.normalizeSessionId(sessionId);
        if (!sid) return [];
        return this.state.files
            .filter((file) => file.sessionId === sid)
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
            .map((file) => this.clone(file));
    }
};

window.DBModule = DBModule;
