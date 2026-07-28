// BI运营模块工具：固定代理探活、Token校验、观远接口转发。
const YejiGongju = {
    get cfg() { return window.YejiConfig || {}; },

    _401count: 0,
    _401fired: false,
    _proxyDownFired: false,
    _proxySessionId: '',

    getProxyUrl() {
        return String(this.cfg.api?.url || '').trim();
    },

    _normalizeProxyUrl(url) {
        return String(url || '').trim().replace(/\/+$/, '');
    },

    getProxySessionHeaders() {
        return this._proxySessionId
            ? { 'X-BI-Proxy-Session': this._proxySessionId }
            : {};
    },

    _rememberProxySession(sessionId) {
        const normalized = String(sessionId || '').trim();
        if (!this._proxySessionId && /^[A-Za-z0-9_-]{32,128}$/.test(normalized)) {
            this._proxySessionId = normalized;
        }
    },

    async _fetchProxy(url, path, options = {}, timeout = null) {
        const baseUrl = this._normalizeProxyUrl(url);
        if (!baseUrl) throw new Error('BI代理地址为空');

        const requestOptions = {
            ...options,
            headers: {
                ...(options.headers || {}),
                ...this.getProxySessionHeaders()
            }
        };
        let timer = null;
        if (timeout != null && Number.isFinite(Number(timeout))) {
            const ctrl = new AbortController();
            requestOptions.signal = ctrl.signal;
            timer = setTimeout(() => ctrl.abort(), Number(timeout));
        }
        try {
            const response = await fetch(`${baseUrl}${path}`, requestOptions);
            this._rememberProxySession(
                response.headers?.get?.('X-BI-Proxy-Session'));
            return response;
        } finally {
            if (timer) clearTimeout(timer);
        }
    },

    async ensureProxy(timeout = 10000) {
        const fixedUrl = this.getProxyUrl();
        if (!fixedUrl) return '';
        try {
            const status = await this.checkProxy(fixedUrl, timeout);
            if (status?.code !== 0) {
                return '';
            }
            this._proxyDownFired = false;
            return fixedUrl;
        } catch (error) {
            console.warn('[yeji] 固定BI代理连接失败:', error);
            return '';
        }
    },

    async checkProxy(url, timeout = 10000) {
        if (!url) return null;
        try {
            const resp = await this._fetchProxy(
                url,
                '/--api/status',
                { method: 'GET' },
                timeout
            );
            const status = await resp.json();
            this._rememberProxySession(status?.sessionId);
            return status;
        } catch {
            return null;
        }
    },

    async isTokenValid() {
        try {
            const bi = window.LoginModule?.getLocalLogin?.('bi') || {};
            if (!bi.token) return false;

            const proxyUrl = await this.ensureProxy();
            if (!proxyUrl) return false;

            const headers = { Accept: 'application/json' };
            headers['X-BI-Token'] = bi.tokenSig ? `${bi.token}|${bi.tokenSig}` : bi.token;

            const resp = await this._fetchProxy(proxyUrl, '/api/validate-token', {
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

        const proxyUrl = this.getProxyUrl();
        if (!proxyUrl) return null;

        for (let round = 0; round < 3; round += 1) {
            const result = await this._postOnce(path, body, headers, proxyUrl);
            if (result === '__401__') {
                this._401count += 1;
                continue;
            }
            if (result !== null) {
                this._401count = 0;
                this._401fired = false;
                this._proxyDownFired = false;
                return result;
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

        const stillReachable = await this.ensureProxy(3000);
        if (stillReachable) {
            return null;
        }

        if (!this._proxyDownFired) {
            this._proxyDownFired = true;
            this._onProxyDown?.();
        }
        return null;
    },

    async _postOnce(path, body, headers, proxyUrl) {
        if (!proxyUrl) return null;
        try {
            const resp = await this._fetchProxy(proxyUrl, path, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify(body)
            });
            if (resp.status === 401) return '__401__';
            if (!resp.ok) return null;
            return await resp.json();
        } catch {
            return null;
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
