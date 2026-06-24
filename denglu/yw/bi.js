// BI系统登录业务逻辑（全部走代理：企微二维码 + 轮询 + token交换）
const BiLoginModule = {
    config: {
        corpId: 'wx8c9fab123dec4357',
        agentId: '1000305',
        redirectUri: 'https://bi.leyopharm.com/?provider=wechatwork&agentId=1000305&corpId=wx8c9fab123dec4357&domain=guanbi',
        pollInterval: 1500,
        qrcodeTimeout: 300000
    },

    state: {
        currentStep: 'init',
        qrKey: null,
        lastStatus: null,
        pollingTimer: null,
        qrcodeTimer: null,
        token: null,
        tokenSig: null,
        userInfo: null
    },

    init() { this.resetState(); },

    resetState() {
        this.state = {
            currentStep: 'init', qrKey: null, lastStatus: null,
            pollingTimer: null, qrcodeTimer: null, token: null, tokenSig: null,
            userInfo: null
        };
    },

    // 代理地址
    _proxyBase() {
        const url = localStorage.getItem('bi_proxy_url');
        if (!url) throw new Error('代理地址未配置');
        return url.replace(/\/+$/, '');
    },

    // 1. 获取二维码 key（通过代理访问企微）
    async startLogin() {
        console.log('[BI手动登录] ========== 开始 ==========');
        try {
            this.state.currentStep = 'qrcode';

            // 确保代理已连通
            console.log('[BI手动登录] 步骤0: 确保代理连通');
            if (!localStorage.getItem('bi_proxy_url')) {
                console.log('[BI手动登录] 代理未配置，尝试发现代理...');
                if (window.YejiGongju) {
                    const proxyUrl = await YejiGongju.autoDiscoverProxy();
                    if (!proxyUrl) {
                        console.log('[BI手动登录] 代理发现失败');
                        throw new Error('代理地址未配置，请先启动代理');
                    }
                    console.log('[BI手动登录] 代理发现成功:', proxyUrl);
                } else {
                    throw new Error('YejiGongju未加载');
                }
            }

            const base = this._proxyBase();
            console.log('[BI手动登录] 步骤1: 获取二维码');
            console.log('[BI手动登录] 代理地址:', base);
            console.log('[BI手动登录] 企微配置:', {
                corpId: this.config.corpId,
                agentId: this.config.agentId
            });

            const params = new URLSearchParams({
                appid: this.config.corpId,
                agentid: this.config.agentId,
                redirect_uri: this.config.redirectUri,
                state: 'SCAN',
                lang: 'zh'
            });
            const resp = await fetch(`${base}/wx/wwopen/sso/qrConnect?${params}`);
            const html = await resp.text();

            // 从 HTML 中提取 QR key（与原版 Python 一致）
            const key = this._extractQrKey(html);
            if (!key) {
                console.log('[BI手动登录] 获取二维码失败');
                throw new Error('获取二维码失败');
            }

            this.state.qrKey = key;
            const qrcodeUrl = `${base}/wx/wwopen/sso/qrImg?key=${key}`;
            console.log('[BI手动登录] 二维码获取成功');

            this.state.qrcodeTimer = setTimeout(() => {
                if (this.state.currentStep === 'qrcode' || this.state.currentStep === 'polling') {
                    console.log('[BI手动登录] 二维码超时');
                    this.stopPolling();
                    if (this.state._pollingReject) {
                        this.state._pollingReject(new Error('二维码已超时，请重新获取'));
                    }
                }
            }, this.config.qrcodeTimeout);

            return { step: 'qrcode', qrcodeUrl, message: '请使用企业微信扫描二维码' };
        } catch (error) {
            console.log('[BI手动登录] 登录异常');
            console.error('[BI手动登录] 错误详情:', error);
            this.resetState();
            throw error;
        }
    },

    _extractQrKey(html) {
        const patterns = [/qrImg\?key=([a-zA-Z0-9_-]+)/, /"key"\s*:\s*"([^"]+)"/, /'key'\s*:\s*'([^']+)'/];
        for (const p of patterns) {
            const m = html.match(p);
            if (m) return m[1];
        }
        return null;
    },

    // 2. 轮询扫码状态（通过代理访问企微 JSONP 接口）
    async startPolling() {
        if (!this.state.qrKey) throw new Error('未初始化二维码');
        console.log('[BI手动登录] 步骤2: 开始轮询扫码状态');
        this.state.currentStep = 'polling';
        const base = this._proxyBase();

        return new Promise((resolve, reject) => {
            this.state._pollingReject = reject;
            const poll = async () => {
                try {
                    const params = new URLSearchParams({
                        callback: 'cb',
                        key: this.state.qrKey,
                        redirect_uri: this.config.redirectUri,
                        appid: this.config.corpId,
                        _: String(Date.now())
                    });
                    if (this.state.lastStatus) params.set('lastStatus', this.state.lastStatus);

                    const resp = await fetch(`${base}/wx/wwopen/sso/l/qrConnect?${params}`);
                    const text = await resp.text();

                    // 解析 JSONP: cb({...})
                    const m = text.match(/\w+\((\{.*\})\)/s);
                    if (!m) {
                        this.state.pollingTimer = setTimeout(poll, this.config.pollInterval);
                        return;
                    }
                    const data = JSON.parse(m[1]);
                    const newStatus = data.status || '';

                    if (newStatus !== this.state.lastStatus) {
                        console.log('[BI手动登录] 状态变化:', this.state.lastStatus, '到', newStatus);
                    }
                    this.state.lastStatus = newStatus;

                    switch (data.status) {
                        case 'QRCODE_SCAN_SUCC':
                            console.log('[BI手动登录] 扫码成功');
                            this.stopPolling();
                            await this.finalizeLogin(data.auth_code);
                            resolve({ step: 'success' });
                            break;
                        case 'QRCODE_SCAN_ERR':
                        case 'QRCODE_SCAN_TIMEOUT':
                        case 'QRCODE_SCAN_CANCEL':
                            console.log('[BI手动登录] 扫码失败:', data.status);
                            this.stopPolling();
                            reject(new Error('二维码已失效，请重新获取'));
                            break;
                        default:
                            this.state.pollingTimer = setTimeout(poll, this.config.pollInterval);
                    }
                } catch (error) {
                    console.log('[BI手动登录] 轮询异常（继续重试）:', error.message);
                    this.state.pollingTimer = setTimeout(poll, this.config.pollInterval);
                }
            };
            poll();
        });
    },

    stopPolling() {
        if (this.state.pollingTimer) { clearTimeout(this.state.pollingTimer); this.state.pollingTimer = null; }
        if (this.state.qrcodeTimer) { clearTimeout(this.state.qrcodeTimer); this.state.qrcodeTimer = null; }
    },

    // 3. 扫码成功后换取 Token（通过代理调用 BI OAuth 回调）
    async finalizeLogin(authCode) {
        console.log('[BI手动登录] 步骤3: 换取Token');
        const base = this._proxyBase();

        // 3a. 通过代理调 BI OAuth 回调（代理自动捕获 Set-Cookie 中的 token）
        console.log('[BI手动登录] 步骤3a: 调用OAuth回调');
        const oauthParams = new URLSearchParams({
            provider: 'wechatwork',
            agentId: this.config.agentId,
            corpId: this.config.corpId,
            domain: 'guanbi',
            code: authCode,
            state: 'SCAN',
            appid: this.config.corpId
        });
        try {
            await fetch(`${base}/?${oauthParams}`, { method: 'GET', redirect: 'manual' });
            console.log('[BI手动登录] OAuth回调已发送');
        } catch (e) {
            console.log('[BI手动登录] OAuth回调异常（正常，代理会捕获token）:', e.message);
        }

        // 3b. 从代理获取捕获的 token
        console.log('[BI手动登录] 步骤3b: 从代理获取Token');
        let tokenData;
        const tokenResp = await fetch(`${base}/--api/get-token`);
        tokenData = await tokenResp.json();
        console.log('[BI手动登录] 第一次get-token结果:', { ok: tokenData.ok, hasToken: !!tokenData.token });

        // 3b2. 回退：通过代理转发 POST /api/user/token 显式换取（原版两步逻辑）
        if (!tokenData.ok || !tokenData.token) {
            console.log('[BI手动登录] 第一次未获取到Token，尝试POST /api/user/token');
            try {
                await fetch(`${base}/api/user/token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-dom-id': 'Z3VhbmJp'
                    },
                    body: JSON.stringify({
                        code: authCode, provider: 'wechatwork',
                        corpId: this.config.corpId, agentId: this.config.agentId,
                        domain: 'guanbi'
                    })
                });
                console.log('[BI手动登录] POST /api/user/token 已发送');
            } catch (e) {
                console.log('[BI手动登录] POST异常（正常）:', e.message);
            }
            // 再次获取代理捕获的 token
            const tokenResp2 = await fetch(`${base}/--api/get-token`);
            tokenData = await tokenResp2.json();
            console.log('[BI手动登录] 第二次get-token结果:', { ok: tokenData.ok, hasToken: !!tokenData.token });
        }

        if (!tokenData.ok || !tokenData.token) {
            console.log('[BI手动登录] 代理未捕获到Token');
            throw new Error('代理未捕获到 BI Token，登录可能失败');
        }

        this.state.token = tokenData.token;
        this.state.tokenSig = tokenData.tokenSig || '';
        this.state.currentStep = 'success';
        console.log('[BI手动登录] Token获取成功');

        // 3c. 用户信息（从 config 解析 user-id）
        console.log('[BI手动登录] 步骤3c: 解析用户信息');
        const userIdB64 = window.YejiConfig?.headers?.['user-id'] || '';
        const userId = userIdB64 ? atob(userIdB64) : 'unknown';
        this.state.userInfo = { userId, userName: userId, account: userId };
        console.log('[BI手动登录] 用户信息:', this.state.userInfo);

        // 3d. 解码JWT获取过期时间
        console.log('[BI手动登录] 步骤3d: 解码JWT获取过期时间');
        let tokenExp = 0;
        try {
            const parts = this.state.token.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                tokenExp = payload.exp || 0;
                console.log('[BI手动登录] JWT过期时间:', tokenExp, '(', new Date(tokenExp * 1000).toLocaleString(), ')');
            }
        } catch (e) {
            console.warn('[BI手动登录] JWT解码失败:', e);
        }

        // 3e. 先保存临时登录态，用于调用BI自身接口解析供应商
        console.log('[BI手动登录] 步骤3e: 保存临时localStorage并解析BI供应商');
        const localData = {
            system: 'bi',
            account: this.state.userInfo.account,
            token: this.state.token,
            tokenSig: this.state.tokenSig,
            credentials: { token: this.state.token, tokenSig: this.state.tokenSig, exp: tokenExp },
            userInfo: this.state.userInfo,
            provider_id: '',
            provider_name: '',
            share_allowed: true,
            credential_source: 'local',
            time: Date.now(),
            exp: tokenExp
        };
        try {
            localStorage.setItem('bi_login', JSON.stringify(localData));
            console.log('[BI手动登录] localStorage保存成功');
        } catch (e) {
            console.warn('[BI手动登录] localStorage保存失败:', e);
        }

        let providerInfo = null;
        if (window.LoginModule?.resolveBiProvider) {
            providerInfo = await window.LoginModule.resolveBiProvider();
        }
        const providerId = providerInfo?.provider_id || '';
        const providerName = providerInfo?.provider_name || '';
        localData.provider_id = providerId;
        localData.provider_name = providerName;
        try {
            localStorage.setItem('bi_login', JSON.stringify(localData));
        } catch (e) {
            console.warn('[BI手动登录] BI供应商信息回写localStorage失败:', e);
        }

        console.log('[BI手动登录] 手动登录完成');
        console.log('[BI手动登录] ========== 结束（成功） ==========');
    },

    getState() { return { ...this.state }; },
    restart() { this.stopPolling(); this.resetState(); }
};

window.BiLoginModule = BiLoginModule;
