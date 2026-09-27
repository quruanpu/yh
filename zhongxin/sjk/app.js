// =====================================================================
// sjk/app.js - SjkModule: unified data layer (CF Worker + D1 via gateway)
// Realtime: WebSocket push (notify-then-fetch) + 60s fallback poll + degraded mode
// All business modules use ONLY this API. Changing the DB touches only sjk/ + worker.
// =====================================================================
const SjkModule = {
    config: {
        gatewayUrl: (typeof localStorage !== 'undefined' && localStorage.getItem('sjk_gateway')) || 'https://yhsjk.cfdaili.top',
        token: 'f21ac6eb173ffc820403a50ce468bb1153ac2452',
        requestTimeoutMs: 10000,
        pollMs: 60000,          // fallback poll while WebSocket healthy
        degradedPollMs: 10000,  // poll interval while WebSocket unavailable
        reconnectMs: 30000,     // WebSocket retry while degraded
        initialized: false,
        degraded: false
    },

    state: {
        initPromise: null,
        degraded: false,        // true = polling at degradedPollMs
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

    async init() {
        if (this.state.initPromise) return this.state.initPromise;
        this.state.initPromise = (async () => {
            try {
                await this._withTimeout(fetch(this.config.gatewayUrl), 'gateway health check');
                this.config.initialized = true;
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
        return this._call('add', { collection, data: data || {} });
    },

    async set(collection, docId, data) {
        await this.init();
        return this._call('set', { collection, docId: String(docId), data: data || {} });
    },

    async update(collection, docId, patch) {
        await this.init();
        return this._call('update', { collection, docId: String(docId), patch: patch || {} });
    },

    async upsert(collection, docId, patch) {
        await this.init();
        return this._call('upsert', { collection, docId: String(docId), patch: patch || {} });
    },

    async remove(collection, docId) {
        await this.init();
        return this._call('remove', { collection, docId: String(docId) });
    },

    async updateWhere(collection, docId, patch, wherePath, whereValue) {
        await this.init();
        return this._call('updateWhere', {
            collection, docId: String(docId), patch: patch || {},
            wherePath: String(wherePath || ''), whereValue
        });
    },

    // ---------- realtime subscriptions (delegated to zhongxin/dy) ----------
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
