// =====================================================================
// sjk/app.js - SjkModule: unified data layer (CF Worker + D1 via gateway)
// Realtime: WebSocket push (notify-then-fetch) + 60s fallback poll + degraded mode
// All business modules use ONLY this API. Changing the DB touches only sjk/ + worker.
// =====================================================================
const SjkModule = {
    config: {
        gatewayUrl: (typeof localStorage !== 'undefined' && localStorage.getItem('sjk_gateway')) || 'https://yhsjk.cfdaili.top',
        wsUrl: (typeof localStorage !== 'undefined' && localStorage.getItem('sjk_ws')) || 'wss://yhsjk.cfdaili.top/connect',
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
        ws: null,               // WebSocket instance
        wsState: 'idle',        // idle | connecting | open
        wsAttempts: 0,
        degraded: false,        // true = polling at degradedPollMs
        subs: new Map(),        // key -> { collection, fetcher, callback, lastJson }
        pollTimer: null,
        reconnectTimer: null
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

    // ---------- realtime subscriptions (push + fallback poll) ----------

    // docs where field == value; callback receives { docs, type: 'push'|'poll'|'resync' }
    watchWhere(collection, field, value, callback) {
        const key = `${collection}|${field}|${JSON.stringify(value)}`;
        return this._register(key, collection, () => this.getWhere(collection, field, '==', value), callback);
    },

    // whole collection; callback receives { docs, type: 'push'|'poll'|'resync' }
    watchCollection(collection, callback) {
        const key = `${collection}|*`;
        return this._register(key, collection, () => this.getAll(collection), callback);
    },

    _register(key, collection, fetcher, callback) {
        if (typeof callback !== 'function') {
            throw new Error('SjkModule.watch: callback must be a function');
        }
        this.state.subs.set(key, { collection, fetcher, callback, lastJson: '' });
        this._ensureRealtime();
        const unwatch = () => {
            this.state.subs.delete(key);
            if (this.state.subs.size === 0) this._closeRealtime();
        };
        return unwatch;
    },

    _deliver(sub, docs, type) {
        try {
            const json = JSON.stringify(docs);
            if (json === sub.lastJson) return; // no change -> no UI churn
            sub.lastJson = json;
            sub.callback({ docs: docs || [], type });
        } catch (error) {
            this._logError('deliver', error);
        }
    },

    _pullAll(type) {
        for (const sub of this.state.subs.values()) {
            (async () => {
                try {
                    const docs = (await sub.fetcher()) || [];
                    this._deliver(sub, docs, type);
                } catch (error) {
                    this._logError('pull', error);
                }
            })();
        }
    },

    // ---------- WebSocket realtime (Hibernation broadcast on the server) ----------

    _ensureRealtime() {
        if (this.state.wsState === 'open' || this.state.wsState === 'connecting') return;
        if (typeof WebSocket === 'undefined') { this._startFallbackPoll(); return; }

        this.state.wsState = 'connecting';
        const url = `${this.config.wsUrl}?token=${encodeURIComponent(this.config.token)}`;
        let ws;
        try {
            ws = new WebSocket(url);
        } catch (error) {
            this.state.wsState = 'idle';
            this._handleWsFailure();
            return;
        }
        this.state.ws = ws;

        ws.onopen = () => {
            this.state.wsState = 'open';
            this.state.wsAttempts = 0;
            if (this.state.degraded) {
                this.state.degraded = false;
                this._setPollInterval(this.config.pollMs); // restore slow fallback poll
            }
            // (re)subscribe all registered collections; then resync immediately
            const cols = [...new Set([...this.state.subs.values()].map(s => s.collection))];
            try { ws.send(JSON.stringify({ subscribe: cols })); } catch (e) { }
            this._pullAll('resync');
        };

        ws.onmessage = (event) => {
            let msg;
            try { msg = JSON.parse(event.data); } catch (e) { return; }
            if (!msg || !msg.collection) return;
            for (const sub of this.state.subs.values()) {
                if (sub.collection !== msg.collection) continue;
                (async () => {
                    try {
                        const docs = (await sub.fetcher()) || [];
                        this._deliver(sub, docs, 'push');
                    } catch (error) {
                        this._logError('push pull', error);
                    }
                })();
            }
        };

        ws.onclose = () => {
            this.state.ws = null;
            this.state.wsState = 'idle';
            this._handleWsFailure();
        };
        ws.onerror = () => { try { ws.close(); } catch (e) { } };
    },

    _handleWsFailure() {
        this.state.wsAttempts++;
        if (this.state.subs.size === 0) return;
        if (!this.state.degraded) {
            this.state.degraded = true;
            this._setPollInterval(this.config.degradedPollMs); // fast poll while realtime is down
            this._pullAll('resync');                           // immediate consistency on failure
        }
        if (this.state.reconnectTimer) return;
        this.state.reconnectTimer = setTimeout(() => {
            this.state.reconnectTimer = null;
            if (this.state.subs.size > 0) this._ensureRealtime();
        }, this.config.reconnectMs);
    },

    _closeRealtime() {
        if (this.state.ws) {
            try { this.state.ws.close(); } catch (e) { }
        }
        this.state.ws = null;
        this.state.wsState = 'idle';
        if (this.state.reconnectTimer) { clearTimeout(this.state.reconnectTimer); this.state.reconnectTimer = null; }
        if (this.state.pollTimer) { clearInterval(this.state.pollTimer); this.state.pollTimer = null; }
        this.state.degraded = false;
    },

    _setPollInterval(ms) {
        if (this.state.pollTimer) clearInterval(this.state.pollTimer);
        this.state.pollTimer = setInterval(() => {
            if (typeof document !== 'undefined' && document.hidden) return;
            this._pullAll('poll');
        }, ms);
    },

    _startFallbackPoll() {
        this._setPollInterval(this.state.degraded ? this.config.degradedPollMs : this.config.pollMs);
    }
};

window.SjkModule = SjkModule;
