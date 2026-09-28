// =====================================================================
// sjk/app.js - SjkModule: unified data layer (CF Worker + D1 via gateway)
// Realtime: WebSocket push (notify-then-fetch) + fallback/degraded polling in realtime.js
// All business modules use ONLY this API. Changing the DB touches only sjk/ + worker.
// =====================================================================
const SjkModule = {
    config: {
        gatewayUrl: (typeof localStorage !== 'undefined' && localStorage.getItem('sjk_gateway')) || 'https://yhsjk.cfdaili.top',
        token: 'f21ac6eb173ffc820403a50ce468bb1153ac2452',
        requestTimeoutMs: 10000,
        degraded: false
    },

    state: {
        initPromise: null
    },

    // ---------- internal utils ----------
    _withTimeout(promise, label) {
        let timer = null;
        const timeout = new Promise((_, reject) => {
            timer = setTimeout(
                () => reject(new Error(`DB timeout: ${label} (${this.config.requestTimeoutMs}ms)`)),
                this.config.requestTimeoutMs
            );
        });
        return Promise.race([promise, timeout]).finally(() => { if (timer) clearTimeout(timer); });
    },

    _logError(label, error) {
        console.warn(`[sjk] ${label} failed:`, error && error.message ? error.message : error);
    },

    // 本地立即唤醒：写成功后调用，写入者 ~1 RTT 内见到自己的变更（不依赖推送回路）
    _notifyLocal(collection) {
        try {
            if (window.SjkRealtime && typeof window.SjkRealtime.wakeCollection === 'function') {
                window.SjkRealtime.wakeCollection(collection);
            }
        } catch (e) { /* ignore */ }
    },

    async init() {
        if (this.state.initPromise) return this.state.initPromise;
        this.state.initPromise = (async () => {
            try {
                await this._withTimeout(fetch(this.config.gatewayUrl), 'gateway health check');
                this.config.degraded = false;
            } catch (error) {
                this.config.degraded = true;
                this.state.initPromise = null;
                this._logError('init (health check)', error);
            }
            return !this.config.degraded;
        })();
        return this.state.initPromise;
    },

    async _call(op, params = {}) {
        let res;
        try {
            res = await this._withTimeout(
                fetch(this.config.gatewayUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-yh-token': this.config.token },
                    body: JSON.stringify({ op, ...params })
                }).then((r) => r.json()),
                op
            );
        } catch (error) {
            this._logError(op, error);
            throw error;
        }
        if (!res || res.ok !== true) {
            const msg = (res && res.error) || 'gateway error';
            this._logError(op, msg);
            throw new Error(msg);
        }
        return res.data;
    }
    ,

    // ---------- data API (signatures unchanged from previous version) ----------

    async get(collection, docId) {
        await this.init();
        return this._call('get', { collection, docId: String(docId) });
    },

    async getWhere(collection, field, op, value, limit) {
        await this.init();
        return this._call('getWhere', { collection, field: String(field), value, limit: Number(limit) || undefined });
    },

    async getAll(collection, limit) {
        await this.init();
        return this._call('getAll', { collection, limit: Number(limit) || undefined });
    },

    async add(collection, data) {
        await this.init();
        const result = await this._call('add', { collection, data: data || {} });
        this._notifyLocal(collection);
        return result;
    },

    async set(collection, docId, data) {
        await this.init();
        const result = await this._call('set', { collection, docId: String(docId), data: data || {} });
        this._notifyLocal(collection);
        return result;
    },

    async update(collection, docId, patch) {
        await this.init();
        const result = await this._call('update', { collection, docId: String(docId), patch: patch || {} });
        this._notifyLocal(collection);
        return result;
    },

    async upsert(collection, docId, patch) {
        await this.init();
        const result = await this._call('upsert', { collection, docId: String(docId), patch: patch || {} });
        this._notifyLocal(collection);
        return result;
    },

    async remove(collection, docId) {
        await this.init();
        const result = await this._call('remove', { collection, docId: String(docId) });
        this._notifyLocal(collection);
        return result;
    },

    async updateWhere(collection, docId, patch, wherePath, whereValue) {
        await this.init();
        const result = await this._call('updateWhere', {
            collection, docId: String(docId), patch: patch || {},
            wherePath: String(wherePath || ''), whereValue
        });
        this._notifyLocal(collection);
        return result;
    },

    // ---------- realtime subscriptions (delegated to zhongxin/dingyue) ----------
    watchWhere(collection, field, value, callback) {
        return window.SjkRealtime.subscribe(
            `${collection}|${field}|${JSON.stringify(value)}`, collection,
            () => this.getWhere(collection, field, '==', value), callback);
    },

    watchCollection(collection, callback) {
        return window.SjkRealtime.subscribe(
            `${collection}|*`, collection,
            () => this.getAll(collection), callback);
    }
};

window.SjkModule = SjkModule;
