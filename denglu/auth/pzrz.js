// 登录凭证认证与错误分类：只判断，不写库，不改 UI。
const LoginCredentialVerifier = {
    authWords: [
        '登录过期', '登陆过期', '登录失效', '登陆失效', '请重新登录', '未登录',
        'token过期', 'token失效', 'token无效', 'session过期', 'session失效',
        'unauthorized', 'expired', 'invalid token', 'login required', 'authentication failed'
    ],

    invalidWords: [
        '账号不存在', '账户不存在', '账号被禁用', '账户被禁用', '账号停用', '账户停用',
        '账号已注销', '账户已注销', 'account disabled', 'account not found'
    ],

    normalizeSystem(system) {
        return String(system || '').trim().toLowerCase();
    },

    hasAuthMessage(message = '') {
        const text = String(message || '').toLowerCase();
        return this.authWords.some(word => text.includes(word));
    },

    hasInvalidMessage(message = '') {
        const text = String(message || '').toLowerCase();
        return this.invalidWords.some(word => text.includes(word));
    },

    pickMessage(payload = {}) {
        return String(
            payload?.message
            || payload?.msg
            || payload?.error
            || payload?.detail?.message
            || ''
        );
    },

    result(system, overrides = {}) {
        const status = overrides.status || (overrides.ok ? 'valid' : 'temporary');
        return {
            ok: !!overrides.ok,
            system: this.normalizeSystem(system),
            status,
            reason: overrides.reason || (overrides.ok ? 'VALID' : 'TEMPORARY'),
            message: overrides.message || '',
            canMarkInvalid: !!overrides.canMarkInvalid,
            canClearLocal: !!overrides.canClearLocal,
            canRetry: overrides.canRetry !== undefined ? !!overrides.canRetry : status === 'temporary',
            detail: overrides.detail || {}
        };
    },

    valid(system, detail = {}) {
        return this.result(system, {
            ok: true,
            status: 'valid',
            reason: 'VALID',
            message: '凭证有效。',
            detail
        });
    },

    missing(system, reason = 'MISSING_CREDENTIALS', message = '缺少候选凭证。', detail = {}) {
        return this.result(system, {
            status: 'missing',
            reason,
            message,
            canRetry: false,
            detail
        });
    },

    incomplete(system, reason = 'INCOMPLETE_CREDENTIALS', message = '候选凭证不完整。', detail = {}) {
        return this.result(system, {
            status: 'incomplete',
            reason,
            message,
            canClearLocal: true,
            canRetry: false,
            detail
        });
    },

    temporary(system, reason = 'TEMPORARY_ERROR', message = '暂时无法验证凭证。', detail = {}) {
        return this.result(system, {
            status: 'temporary',
            reason,
            message,
            canRetry: true,
            detail
        });
    },

    invalid(system, reason = 'AUTH_INVALID', message = '凭证已失效。', detail = {}) {
        return this.result(system, {
            status: 'invalid',
            reason,
            message,
            canMarkInvalid: true,
            canClearLocal: true,
            canRetry: false,
            detail
        });
    },

    expired(system, reason = 'AUTH_EXPIRED', message = '凭证已过期。', detail = {}) {
        return this.result(system, {
            status: 'expired',
            reason,
            message,
            canMarkInvalid: false,
            canClearLocal: true,
            canRetry: false,
            detail
        });
    },

    proxyUnavailable(system, message = '代理不可用，暂时无法验证凭证。', detail = {}) {
        return this.result(system, {
            status: 'proxy_unavailable',
            reason: 'PROXY_UNAVAILABLE',
            message,
            canRetry: true,
            detail
        });
    },

    permissionDenied(system, message = '权限不足，无法作为凭证失效判断。', detail = {}) {
        return this.result(system, {
            status: 'permission_denied',
            reason: 'PERMISSION_DENIED',
            message,
            canRetry: false,
            detail
        });
    },

    classifyPayload(system, payload = {}, status = 200) {
        const message = this.pickMessage(payload);
        const detail = { payload, status };

        if (this.hasInvalidMessage(message)) {
            return this.invalid(system, 'ACCOUNT_INVALID', message || '账号不可用。', detail);
        }

        if (status === 401 || payload?.needLogin === true) {
            return this.expired(system, 'AUTH_EXPIRED', message || '登录已过期。', detail);
        }

        if (status === 403 || /权限|未授权|permission|forbidden/i.test(message)) {
            return this.permissionDenied(system, message || '权限不足，无法作为凭证失效判断。', detail);
        }

        if (this.hasAuthMessage(message)) {
            return this.expired(system, 'AUTH_EXPIRED', message || '登录已过期。', detail);
        }

        if (status >= 500) {
            return this.temporary(system, 'SERVER_ERROR', message || `服务异常：HTTP ${status}`, detail);
        }

        if (status && status >= 400) {
            return this.temporary(system, 'HTTP_ERROR', message || `请求失败：HTTP ${status}`, detail);
        }

        return null;
    },

    async readJsonSafely(response) {
        try {
            return await response.json();
        } catch (error) {
            return { __parseError: true, message: error?.message || '响应解析失败' };
        }
    },

    async verify(system, acc = {}, options = {}) {
        const normalized = this.normalizeSystem(system);
        if (normalized === 'scm') return this.verifyScmCredentials(acc, options);
        if (normalized === 'pms') return this.verifyPmsCredentials(acc, options);
        if (normalized === 'bi') return this.verifyBiToken(acc, options);
        return this.missing(normalized, 'INVALID_SYSTEM', '系统参数无效。');
    },

    async verifyScmCredentials(acc = {}) {
        const credentials = acc.credentials || {};
        const apiUrl = window.ChaxunConfig?.api?.url || window.YhquanConfig?.api?.url || '';
        if (!apiUrl) return this.temporary('scm', 'API_UNAVAILABLE', 'SCM 校验接口未就绪。');
        if (!credentials.token) return this.incomplete('scm', 'MISSING_TOKEN', 'SCM 凭证缺少 token。');

        const auth = {
            token: credentials.token,
            cookies: credentials.cookies,
            providerIdM: credentials.provider_id_m || credentials.provider_id || credentials.providerId || ''
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=UTF-8' },
                body: JSON.stringify({
                    auth,
                    query: { keyword: '', wholesaleTypes: [], status: 0, pageSize: 1, fetchPages: 1 }
                })
            });
            const payload = await this.readJsonSafely(response);
            if (payload.__parseError) return this.temporary('scm', 'BAD_RESPONSE', payload.message, { status: response.status });

            const classified = this.classifyPayload('scm', payload, response.status);
            if (classified) return classified;
            if (payload?.success === false) {
                return this.temporary('scm', 'BUSINESS_ERROR', this.pickMessage(payload) || 'SCM 校验返回业务错误。', { payload, status: response.status });
            }
            if (Object.prototype.hasOwnProperty.call(payload || {}, 'code') && payload.code !== 0) {
                return this.temporary('scm', 'BUSINESS_ERROR', this.pickMessage(payload) || 'SCM 校验返回业务错误。', { payload, status: response.status });
            }
            return this.valid('scm', { payload, status: response.status });
        } catch (error) {
            return this.temporary('scm', 'NETWORK_ERROR', error?.message || 'SCM 校验请求失败。', { error });
        }
    },

    async verifyPmsCredentials(acc = {}) {
        const credentials = acc.credentials || {};
        const pmsUrl = window.ChaxunConfig?.api?.pmsUrl || '';
        if (!credentials || !Object.keys(credentials).length) {
            return this.incomplete('pms', 'MISSING_CREDENTIALS', 'PMS 凭证为空。');
        }
        const token = credentials.token || credentials.access_token || credentials.accessToken || '';
        if (!token) {
            return this.valid('pms', { skipped: true, reason: 'PMS_TOKENLESS_CREDENTIALS' });
        }
        if (!pmsUrl) return this.valid('pms', { skipped: true, reason: 'NO_PMS_URL' });

        try {
            const response = await fetch(pmsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    auth: credentials,
                    query: { keyword: '', pageSize: 1 }
                })
            });
            const payload = await this.readJsonSafely(response);
            if (payload.__parseError) return this.temporary('pms', 'BAD_RESPONSE', payload.message, { status: response.status });

            const classified = this.classifyPayload('pms', payload, response.status);
            if (classified) return classified;
            if (Object.prototype.hasOwnProperty.call(payload || {}, 'code') && payload.code !== 0) {
                return this.valid('pms', {
                    skipped: true,
                    reason: 'PMS_NON_AUTH_BUSINESS_RESPONSE',
                    payload,
                    status: response.status
                });
            }
            return this.valid('pms', { payload, status: response.status });
        } catch (error) {
            return this.temporary('pms', 'NETWORK_ERROR', error?.message || 'PMS 校验请求失败。', { error });
        }
    },

    getBiToken(acc = {}) {
        const credentials = acc.credentials || {};
        return {
            token: credentials.token || acc.token || '',
            tokenSig: credentials.tokenSig || acc.tokenSig || '',
            exp: credentials.exp || acc.exp || 0
        };
    },

    isJwtExpired(exp) {
        const value = Number(exp || 0);
        if (!Number.isFinite(value) || value <= 0) return false;
        return Date.now() >= value * 1000;
    },

    async verifyBiToken(acc = {}, options = {}) {
        const tokenInfo = this.getBiToken(acc);
        if (!tokenInfo.token) return this.incomplete('bi', 'MISSING_TOKEN', 'BI 凭证缺少 token。');
        if (this.isJwtExpired(tokenInfo.exp)) {
            return this.expired('bi', 'BI_TOKEN_EXPIRED', 'BI Token 已过期。', { exp: tokenInfo.exp });
        }
        if (!window.YejiGongju) return this.proxyUnavailable('bi', 'BI 代理工具未加载。');

        const previous = options.host?._getLocal?.('bi_login') || null;
        const local = options.host?._buildBiLocal
            ? options.host._buildBiLocal({ ...acc, credentials: tokenInfo })
            : { ...acc, token: tokenInfo.token, tokenSig: tokenInfo.tokenSig, exp: tokenInfo.exp, credentials: tokenInfo };

        try {
            options.host?._saveLocal?.('bi_login', local);
            let proxyUrl = window.YejiGongju.getProxyUrl?.() || '';
            if (!proxyUrl) proxyUrl = await window.YejiGongju.autoDiscoverProxy?.();
            if (!proxyUrl) return this.proxyUnavailable('bi', 'BI 代理未就绪。');

            const headers = { Accept: 'application/json' };
            headers['X-BI-Token'] = tokenInfo.tokenSig ? `${tokenInfo.token}|${tokenInfo.tokenSig}` : tokenInfo.token;
            const response = await fetch(`${proxyUrl.replace(/\/+$/, '')}/api/validate-token`, {
                method: 'GET',
                headers,
                credentials: 'include'
            });
            const payload = await this.readJsonSafely(response);
            if (response.status === 401) {
                return this.expired('bi', 'BI_TOKEN_EXPIRED', this.pickMessage(payload) || 'BI 登录已过期。', { payload, status: response.status });
            }
            const classified = this.classifyPayload('bi', payload, response.status);
            if (classified) return classified;
            if (!response.ok) {
                return this.temporary('bi', 'HTTP_ERROR', this.pickMessage(payload) || `BI Token 校验失败：HTTP ${response.status}`, { payload, status: response.status });
            }
            if (payload?.response === 'success') return this.valid('bi', { payload, status: response.status });
            return this.temporary('bi', 'TOKEN_VERIFY_UNKNOWN', this.pickMessage(payload) || 'BI Token 校验结果未知。', { payload, status: response.status });
        } catch (error) {
            return this.temporary('bi', 'NETWORK_ERROR', error?.message || 'BI Token 校验请求失败。', { error });
        } finally {
            if (previous) options.host?._saveLocal?.('bi_login', previous);
            else options.host?._clearLocal?.('bi_login');
        }
    }
};

window.LoginCredentialVerifier = LoginCredentialVerifier;
