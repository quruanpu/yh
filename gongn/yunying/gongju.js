// BI运营模块工具：代理发现、Token校验、观远接口转发。
const YejiGongju = {
    get cfg() { return window.YejiConfig || {}; },

    _nodes: [],
    _activeUrl: '',
    _nodeFailures: {},
    _401count: 0,
    _401fired: false,
    _proxyDownFired: false,
    _watching: false,
    _retrying: false,

    getProxyUrl() {
        return this._activeUrl || localStorage.getItem('bi_proxy_url') || this.cfg.api?.url || '';
    },

    getConfiguredProxyUrls() {
        const urls = [
            this.cfg.api?.url,
            ...(Array.isArray(this.cfg.api?.fallbackUrls) ? this.cfg.api.fallbackUrls : [])
        ];
        return [...new Set(urls.map(url => String(url || '').trim()).filter(Boolean))];
    },

    _activateNode(url) {
        this._activeUrl = url || '';
        if (url) {
            localStorage.setItem('bi_proxy_url', url);
            this._proxyDownFired = false;
        }
    },

    async autoDiscoverProxy() {
        if (!window.FirebaseModule) return '';
        try {
            const cachedUrl = localStorage.getItem('bi_proxy_url') || this._activeUrl || '';
            if (cachedUrl) {
                const status = await this.checkProxy(cachedUrl, 5000);
                if (status?.code === 0) {
                    this._activateNode(cachedUrl);
                    return cachedUrl;
                }
                if (this._activeUrl === cachedUrl) this._activeUrl = '';
            }

            const nodes = await FirebaseModule.getVpnNodes();
            this._nodes = Array.isArray(nodes) ? nodes : [];
            const firebaseUrl = await this._tryNodeList(this._nodes);
            if (firebaseUrl) return firebaseUrl;

            return await this._tryNodeList(this.getConfiguredProxyUrls().map(url => ({ url })));
        } catch (error) {
            console.warn('[yeji] BI代理发现失败:', error);
            return '';
        }
    },

    async _tryNodeList(nodes) {
        for (const node of nodes || []) {
            if (!node?.url || node.invalid) continue;

            const status = await this.checkProxy(node.url, 10000);
            if (status?.code === 0) {
                this._activateNode(node.url);
                if (window.FirebaseModule && node.id) {
                    FirebaseModule.clearVpnNodeFailCount(node.id);
                }
                return node.url;
            }

            if (window.FirebaseModule && node.id) {
                await FirebaseModule.incrementVpnNodeFailCount(node.id);
            }
        }
        return '';
    },

    startWatching() {
        if (this._watching || !window.FirebaseModule?.watchVpnNodes) return;
        this._watching = true;
        let isFirst = true;
        FirebaseModule.watchVpnNodes(nodes => {
            if (isFirst) {
                isFirst = false;
                this._nodes = Array.isArray(nodes) ? nodes : [];
                const hasActiveProxy = !!(this._activeUrl || localStorage.getItem('bi_proxy_url'));
                if (!hasActiveProxy && !this._retrying) this._retryNodes();
                return;
            }
            this._nodes = Array.isArray(nodes) ? nodes : [];
            if (!this._retrying) this._retryNodes();
        });
    },

    async _retryNodes() {
        this._retrying = true;
        const previousUrl = this._activeUrl || localStorage.getItem('bi_proxy_url') || '';
        const nextUrl = await this._tryNodeList(this._nodes);
        if (nextUrl && nextUrl !== previousUrl && this._onProxyChanged) {
            this._onProxyChanged(nextUrl);
        }
        this._retrying = false;
    },

    async checkProxy(url, timeout = 10000) {
        if (!url) return null;
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), timeout);
            const resp = await fetch(`${url.replace(/\/+$/, '')}/--api/status`, {
                method: 'GET',
                signal: ctrl.signal
            });
            clearTimeout(timer);
            return await resp.json();
        } catch {
            return null;
        }
    },

    async isTokenValid() {
        try {
            const bi = window.LoginModule?.getLocalLogin?.('bi') || {};
            if (!bi.token) return false;

            let proxyUrl = this.getProxyUrl();
            if (!proxyUrl) proxyUrl = await this.autoDiscoverProxy();
            if (!proxyUrl) return false;

            const headers = { Accept: 'application/json' };
            headers['X-BI-Token'] = bi.tokenSig ? `${bi.token}|${bi.tokenSig}` : bi.token;

            const resp = await fetch(`${proxyUrl.replace(/\/+$/, '')}/api/validate-token`, {
                method: 'GET',
                headers,
                credentials: 'include'
            });
            if (!resp.ok) return false;
            const data = await resp.json();
            return data?.response === 'success';
        } catch {
            return false;
        }
    },

    async querySelector(selectorId, cascadeFilters) {
        const body = {
            fieldQuery: { offset: 0, limit: 1000 },
            filters: cascadeFilters || [],
            treeFilters: [],
            dynamicParams: [],
            layerTreeFilters: []
        };
        return this._post(`/api/selector/${selectorId}/data`, body);
    },

    async _post(path, body) {
        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(this.cfg.headers || {})
        };
        try {
            const bi = window.LoginModule?.getLocalLogin?.('bi') || {};
            if (bi.token) {
                headers['X-BI-Token'] = bi.tokenSig ? `${bi.token}|${bi.tokenSig}` : bi.token;
            }
        } catch {
            // 没有登录信息时让接口自然失败，由上层处理。
        }

        const activeUrl = this._activeUrl || localStorage.getItem('bi_proxy_url') || '';
        const otherNodes = this._nodes.filter(node => node.url && node.url !== activeUrl && !node.invalid);
        const candidates = activeUrl
            ? [{ url: activeUrl, id: this._nodes.find(node => node.url === activeUrl)?.id }, ...otherNodes]
            : otherNodes;

        const configuredUrls = this.getConfiguredProxyUrls();
        for (const url of configuredUrls) {
            if (!candidates.some(node => node.url === url)) candidates.push({ url, id: null });
        }
        if (!candidates.length) return null;

        for (let round = 0; round < 3; round += 1) {
            for (const node of candidates) {
                const result = await this._postOnce(path, body, headers, node.url);
                if (result === '__401__') {
                    this._401count += 1;
                    continue;
                }
                if (result !== null) {
                    this._401count = 0;
                    this._401fired = false;
                    this._proxyDownFired = false;
                    this._activateNode(node.url);
                    if (node.id) this._nodeFailures[node.id] = 0;
                    return result;
                }
                if (node.id) this._nodeFailures[node.id] = (this._nodeFailures[node.id] || 0) + 1;
            }
        }

        if (this._401count >= 3) {
            this._401count = 0;
            if (!this._401fired) {
                this._401fired = true;
                this._on401?.();
            }
            return null;
        }

        for (const node of candidates) {
            if (node.id && this._nodeFailures[node.id] >= 3) {
                await this._markNodeInvalid(node.id);
                delete this._nodeFailures[node.id];
            }
        }

        const stillReachable = await this.confirmAnyProxyReachable(candidates);
        if (stillReachable) {
            this._activateNode(stillReachable);
            return null;
        }

        if (!this._proxyDownFired) {
            this._proxyDownFired = true;
            this._onProxyDown?.();
        }
        return null;
    },

    async confirmAnyProxyReachable(candidates = []) {
        const activeUrl = this._activeUrl || localStorage.getItem('bi_proxy_url') || '';
        const urls = [
            activeUrl,
            ...candidates.map(node => node.url),
            ...this.getConfiguredProxyUrls()
        ].map(url => String(url || '').trim()).filter(Boolean);
        for (const url of [...new Set(urls)]) {
            const status = await this.checkProxy(url, 3000);
            if (status?.code === 0) return url;
        }
        return '';
    },

    async _postOnce(path, body, headers, proxyUrl) {
        if (!proxyUrl) return null;
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), Number(this.cfg.api?.timeout || 30000));
            const resp = await fetch(`${proxyUrl.replace(/\/+$/, '')}${path}`, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify(body),
                signal: ctrl.signal
            });
            clearTimeout(timer);
            if (resp.status === 401) return '__401__';
            if (!resp.ok) return null;
            return await resp.json();
        } catch {
            return null;
        }
    },

    async _markNodeInvalid(nodeId) {
        if (!window.FirebaseModule?.markVpnNodeInvalid) return false;
        try {
            const ok = await FirebaseModule.markVpnNodeInvalid(nodeId);
            const node = this._nodes.find(item => item.id === nodeId);
            if (ok && node) node.invalid = true;
            return ok;
        } catch {
            return false;
        }
    },

    escapeHtml(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};

window.YejiGongju = YejiGongju;
