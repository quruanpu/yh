// =====================================================================
// zhongxin/dingyue/realtime.js - SjkRealtime : realtime subscription engine
// Owns: WS connection lifecycle, subscription registry, notify->fetch->callback,
//       failure self-healing (exponential backoff), fallback/degraded polling.
// Consumers register via SjkModule.watchWhere/watchCollection (delegated here).
// =====================================================================
const SjkRealtime = {
    config: {
        wsUrl: (typeof localStorage !== 'undefined' && localStorage.getItem('sjk_ws')) || 'wss://yhsjk.cfdaili.top/connect',
        token: 'f21ac6eb173ffc820403a50ce468bb1153ac2452',
        tickMs: 1000,
        pollMs: 600000,          // 保险丝：WS 健康时的周期性兜底拉取（推送为主，10 分钟一次）
        degradedPollMs: 60000,   // WS 不可用时的降级轮询
        pingMs: 30000,           // 心跳间隔（保持 NAT/代理存活 + 探测假连接）
        freshMs: 45000,          // 已见过 pong 后，超过该时长无任何入站消息即判定假连接
        retryBaseMs: 5000,
        retryMaxMs: 60000,
        reconnectMs: 30000
    },

    state: {
        ws: null,
        wsState: 'idle',
        attempts: 0,
        degraded: false,
        subs: new Map(),
        tickTimer: null,
        reconnectTimer: null,
        pingTimer: null,
        lastMessageAt: 0,
        pongSeen: false
    },

    _logWarn(label, error) {
        console.warn('[dy] ' + label + ':', error && error.message ? error.message : error);
    },

    _pollInterval() {
        return this.state.degraded ? this.config.degradedPollMs : this.config.pollMs;
    },

    subscribe(key, collection, fetcher, callback) {
        if (typeof fetcher !== 'function') throw new Error('SjkRealtime.subscribe: fetcher must be a function');
        if (typeof callback !== 'function') throw new Error('SjkRealtime.subscribe: callback must be a function');
        this.state.subs.set(key, {
            key: key, collection: String(collection || ''), fetcher: fetcher, callback: callback,
            lastJson: '', failCount: 0, nextRetryAt: 0, pulling: false
        });
        this._ensureTick();
        this._ensureConnected();
        this._syncCollections();
        this._wakeCollection(String(collection || ''));
        return () => this.unsubscribe(key);
    },

    unsubscribe(key) {
        this.state.subs.delete(key);
        if (this.state.subs.size === 0) { this._teardown(); return; }
        this._syncCollections();
    },

    _ensureConnected() {
        if (this.state.wsState === 'open' || this.state.wsState === 'connecting') return;
        if (typeof WebSocket === 'undefined') { this._setDegraded(true); return; }
        this.state.wsState = 'connecting';
        const url = this.config.wsUrl + '?token=' + encodeURIComponent(this.config.token);
        let ws;
        try { ws = new WebSocket(url); } catch (e) {
            this.state.wsState = 'idle';
            this._onWsFailure();
            return;
        }
        this.state.ws = ws;
        ws.onopen = () => this._onOpen();
        ws.onmessage = (ev) => this._onMessage(ev);
        ws.onclose = () => this._onClose();
        ws.onerror = () => { try { ws.close(); } catch (e) { } };
    },

    _onOpen() {
        this.state.wsState = 'open';
        this.state.attempts = 0;
        this.state.lastMessageAt = this._now();
        this.state.pongSeen = false;   // 每次新连接重新协商：收到首个 pong 才启用超时判定
        if (this.state.degraded) { this.state.degraded = false; }
        this._syncCollections();
        this._wakeAll();
        this._startPing();
    },

    _onMessage(ev) {
        this.state.lastMessageAt = this._now();
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg && msg.type === 'pong') { this.state.pongSeen = true; return; }
        if (msg && msg.collection) this._wakeCollection(String(msg.collection));
    },

    _onClose() {
        this.state.ws = null;
        this.state.wsState = 'idle';
        this._stopPing();
        this.state.attempts++;
        if (this.state.subs.size > 0) {
            this._setDegraded(true);
            this._scheduleReconnect();
        }
    },

    _scheduleReconnect() {
        if (this.state.reconnectTimer) return;
        this.state.reconnectTimer = setTimeout(() => {
            this.state.reconnectTimer = null;
            if (this.state.subs.size > 0) this._ensureConnected();
        }, this.config.reconnectMs);
    },

    // ---------- heartbeat（客户端 ping 保活 + 假连接探测；DO 收到 ping 回 pong） ----------
    _startPing() {
        if (this.state.pingTimer) return;
        this.state.pingTimer = setInterval(() => {
            const ws = this.state.ws;
            if (!ws || this.state.wsState !== 'open') return;
            try { ws.send(JSON.stringify({ ping: 1 })); } catch (e) { try { ws.close(); } catch (e2) { } return; }
            // 仅在服务端证明会应答 pong（新 Worker）后才启用超时判定，旧 Worker 静默兼容
            if (this.state.pongSeen && (this._now() - this.state.lastMessageAt) > this.config.freshMs) {
                console.warn('[dy] heartbeat timeout (no inbound ' + this.config.freshMs + 'ms), reconnecting');
                try { ws.close(); } catch (e) { }
            }
        }, this.config.pingMs);
    },

    _stopPing() {
        if (this.state.pingTimer) { clearInterval(this.state.pingTimer); this.state.pingTimer = null; }
    },

    // Public: 本地立即唤醒（写成功后由 SjkModule 调用；写入者 ~1 RTT 内见到自己的变更）
    wakeCollection(collection) {
        this._wakeCollection(String(collection || ''));
    },

    _setDegraded(flag) {
        if (this.state.degraded === flag) return;
        this.state.degraded = flag;
        console.warn('[dy] realtime ' + (flag ? 'DEGRADED (poll mode)' : 'RESTORED (push mode)'));
        this._wakeAll();
    }    ,

    _syncCollections() {
        const ws = this.state.ws;
        if (!ws || ws.readyState !== 1) return;
        const cols = [...new Set([...this.state.subs.values()].map((s) => s.collection).filter(Boolean))];
        try { ws.send(JSON.stringify({ subscribe: cols })); } catch (e) { /* ignore */ }
    },

    _wakeCollection(collection) {
        for (const sub of this.state.subs.values()) {
            if (sub.collection !== collection) continue;
            sub.nextRetryAt = 0;
            this._pull(sub);
        }
    },

    _wakeAll() {
        for (const sub of this.state.subs.values()) {
            sub.nextRetryAt = 0;
            this._pull(sub);
        }
    },

    _onWsFailure() {
        this._setDegraded(true);
        this._scheduleReconnect();
    },

    _now() {
        return Date.now();
    },

    // ---------- unified scheduler ----------
    _ensureTick() {
        if (this.state.tickTimer) return;
        this.state.tickTimer = setInterval(() => this._tick(), this.config.tickMs);
    },

    _tick() {
        const now = this._now();
        const interval = this._pollInterval();
        for (const sub of this.state.subs.values()) {
            if (sub.pulling) continue;
            if (now < sub.nextRetryAt) continue;
            sub.nextRetryAt = now + interval;   // regular cadence; failures/wakes reschedule
            this._pull(sub);
        }
    },

    _pull(sub) {
        if (sub.pulling) return;
        sub.pulling = true;
        (async () => {
            try {
                const docs = (await sub.fetcher()) || [];
                sub.failCount = 0;
                this._deliver(sub, docs, this.state.degraded ? 'poll' : 'push');
            } catch (error) {
                sub.failCount = (sub.failCount || 0) + 1;
                const backoff = Math.min(
                    this.config.retryBaseMs * Math.pow(2, Math.min(sub.failCount, 10)),
                    this.config.retryMaxMs
                );
                sub.nextRetryAt = this._now() + backoff;
                this._logWarn('pull failed (retry in ' + Math.round(backoff / 1000) + 's) [' + sub.key + ']', error);
            } finally {
                sub.pulling = false;
            }
        })();
    },

    _deliver(sub, docs, type) {
        try {
            const json = JSON.stringify(docs);
            if (json === sub.lastJson) return;
            sub.lastJson = json;
            sub.callback({ docs: docs || [], type: type });
        } catch (error) {
            this._logWarn('deliver [' + sub.key + ']', error);
        }
    },

    _teardown() {
        this._stopPing();
        if (this.state.ws) { try { this.state.ws.close(); } catch (e) { } }
        this.state.ws = null;
        this.state.wsState = 'idle';
        if (this.state.tickTimer) { clearInterval(this.state.tickTimer); this.state.tickTimer = null; }
        if (this.state.reconnectTimer) { clearTimeout(this.state.reconnectTimer); this.state.reconnectTimer = null; }
        this.state.degraded = false;
        this.state.attempts = 0;
    }
};

window.SjkRealtime = SjkRealtime;

// 回前台/网络恢复 resync：微信 webview 挂起等场景错过推送时，可见性恢复即全量重拉（~9 行，一次拉取/事件）
function _sjkResyncOnRevive() {
    try {
        if (SjkRealtime.state.subs.size > 0) { SjkRealtime._ensureConnected(); SjkRealtime._wakeAll(); }
    } catch (e) { /* ignore */ }
}
if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') _sjkResyncOnRevive();
    });
}
if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('online', _sjkResyncOnRevive);
}