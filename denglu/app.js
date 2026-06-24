// 登录功能统筹模块
const LoginModule = {
    // 配置
    config: {
        selectedSystem: null, // scm 或 pms
        isOpen: false,
        mandatory: false // 强制登录模式（不可关闭）
    },

    // 当前会话（SCM登录后设置）
    session: {
        logged_in: false,
        username: null,
        credentials: null,
        providerInfo: null
    },

    // 状态
    state: {
        container: null,
        overlay: null,
        main: null,
        closeBtn: null,
        currentView: null, // scm_form, scm_qrcode, pms_qrcode, success
        captchaData: null,
        eventListeners: [],
        devicePromise: null,
        dependencyPromise: null,
        authModulePromise: null,
        successTimer: null,
        loginReady: false,
        loginReadyDispatched: false,
        scmAuthenticated: false,
        scmAuthenticatedDispatched: false,
        scmAuthenticatedKey: '',
        fromAccountList: null, // 从账户列表/登录信息进入登录时记录system，用于显示返回按钮
        returnTo: null // 返回目标：'account_list' 或 'login_info'
    },

    // ========== 本地缓存（localStorage） ==========

    _saveLocal(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.warn('本地缓存写入失败:', e);
        }
    },

    _getLocal(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.warn('本地缓存读取失败:', e);
            return null;
        }
    },

    _clearLocal(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {}
    },

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`${src}加载失败`));
            document.head.appendChild(script);
        });
    },

    async ensureDeviceModule() {
        if (window.DeviceModule?.ready) {
            return window.DeviceModule.ready();
        }
        if (this.state.devicePromise) return this.state.devicePromise;

        const scripts = [
            'denglu/shebei/zhiwen.js',
            'denglu/shebei/xinxi.js',
            'denglu/shebei/huancun.js',
            'denglu/shebei/app.js'
        ];

        this.state.devicePromise = scripts.reduce(
            (chain, src) => chain.then(() => this._loadScript(src)),
            Promise.resolve()
        ).then(() => {
            if (!window.DeviceModule?.ready) {
                throw new Error('设备模块加载后未初始化');
            }
            return window.DeviceModule.ready();
        }).catch(error => {
            this.state.devicePromise = null;
            throw error;
        });

        return this.state.devicePromise;
    },

    async getDeviceSnapshot() {
        return this.ensureDeviceModule();
    },

    async getDeviceId() {
        const device = await this.getDeviceSnapshot();
        return device.deviceId || '';
    },

    async getDeviceCode() {
        const device = await this.getDeviceSnapshot();
        return device.shortCode || '';
    },

    async ensureDependencies() {
        if (this.state.dependencyPromise) return this.state.dependencyPromise;

        const scripts = [
            'denglu/fir.js',
            'denglu/yw/scm.js',
            'denglu/yw/pms.js',
            'denglu/yw/bi.js',
            'denglu/auth/pzrz.js',
            'denglu/auth/app.js'
        ];

        this.state.dependencyPromise = scripts.reduce(
            (chain, src) => chain.then(() => this._loadScript(src)),
            this.ensureDeviceModule()
        ).then(() => {
            const missing = [
                ['DeviceModule', window.DeviceModule],
                ['FirebaseModule', window.FirebaseModule],
                ['ScmLoginModule', window.ScmLoginModule],
                ['PmsLoginModule', window.PmsLoginModule],
                ['BiLoginModule', window.BiLoginModule],
                ['LoginCredentialVerifier', window.LoginCredentialVerifier],
                ['LoginAuthModule', window.LoginAuthModule]
            ].filter(([, value]) => !value).map(([name]) => name);
            if (missing.length) {
                throw new Error(`登录依赖未完成初始化: ${missing.join(', ')}`);
            }
        }).catch(error => {
            this.state.dependencyPromise = null;
            throw error;
        });

        return this.state.dependencyPromise;
    },

    async ensureAuthModule() {
        if (window.LoginAuthModule) return window.LoginAuthModule;
        if (this.state.authModulePromise) return this.state.authModulePromise;

        this.state.authModulePromise = this.ensureDependencies()
            .then(() => {
                if (!window.LoginAuthModule) {
                    throw new Error('LoginAuthModule加载后未初始化');
                }
                return window.LoginAuthModule;
            })
            .catch(error => {
                this.state.authModulePromise = null;
                throw error;
            });

        return this.state.authModulePromise;
    },

    _clearSuccessTimer(options = {}) {
        if (this.state.successTimer) {
            clearTimeout(this.state.successTimer);
            this.state.successTimer = null;
        }
        if (options.releaseMandatory) {
            this.config.mandatory = false;
        }
    },

    dispatchLoginReady(recovery = null) {
        if (this.state.loginReadyDispatched) return;
        this.state.loginReady = true;
        this.state.loginReadyDispatched = true;
        document.dispatchEvent(new CustomEvent('loginReady', {
            detail: {
                recoveredSystems: Object.keys(recovery?.results || {}),
                checkedAt: Date.now()
            }
        }));
    },

    dispatchScmAuthenticated(detail = {}) {
        const local = this._getLocal('scm_login') || {};
        const credentials = this.session.credentials || local.credentials || {};
        const username = String(
            detail.username
            || this.session.username
            || local.displayName
            || local.username
            || credentials.username
            || ''
        ).trim();
        const providerId = String(
            detail.providerId
            || credentials.provider_id
            || credentials.providerId
            || local.provider_id
            || ''
        ).trim();
        const providerName = String(
            detail.providerName
            || this.session.providerInfo?.provider_name
            || local.provider_name
            || local.provider_info?.provider_name
            || credentials.provider_name
            || credentials.providerName
            || ''
        ).trim();
        const authKey = `${providerId}::${username}`;

        this.state.scmAuthenticated = true;
        if (this.state.scmAuthenticatedDispatched && this.state.scmAuthenticatedKey === authKey) return;
        this.state.scmAuthenticatedDispatched = true;
        this.state.scmAuthenticatedKey = authKey;

        document.dispatchEvent(new CustomEvent('scmAuthenticated', {
            detail: {
                system: 'SCM',
                username,
                providerId,
                providerName,
                source: detail.source || local.credential_source || '',
                switched: !!detail.switched,
                checkedAt: Date.now()
            }
        }));
    },

    // 初始化
    init() {
        if (this.state.initialized) return;
        this.state.initialized = true;
        this.createLoginDialog();
        this.ensureDeviceModule()
            .then(() => window.AppFramework?.initDeviceCode?.())
            .catch(error => console.warn('设备码初始化失败:', error));
        this.ensureDependencies()
            .catch(error => console.warn('统一登录模块加载失败:', error))
            .finally(() => this.checkAndForceLogin());
    },

    // 启动SCM登录流程：先弹窗，再在弹窗内自动检测（含验证），成功关闭或失败显示表单
    async checkAndForceLogin() {
        let recovered = null;
        // 1. 先弹出弹窗（不可关闭）
        this.config.mandatory = true;
        this.config.selectedSystem = 'scm';
        this.config.isOpen = true;
        this.state.overlay.style.display = 'flex';
        this.state.closeBtn.style.display = 'none';
        setTimeout(() => {
            this.state.overlay.classList.add('active');
            this.state.container.classList.add('active');
        }, 10);

        // 2. 显示检测中视图
        this.renderCheckingView('scm');

        // 2.5 提前发现BI代理（不阻塞SCM/PMS登录流程）
        this._ensureBiProxy();

        // 3. 在弹窗内检测登录状态
        try {
            const auth = await this.ensureAuthModule();
            recovered = await Promise.race([
                auth.recoverSystems(this, ['scm', 'pms']),
                new Promise(resolve => setTimeout(() => resolve(null), 10000))
            ]);
            const scmResult = recovered?.results?.scm;
            if (scmResult) {
                this._autoLoginSuccess(scmResult.displayName, recovered);
                return;
            }

            // 都没有有效凭证，显示登录表单
            this._showLoginForm();
        } catch (error) {
            console.error('检查登录状态失败:', error);
            this._showLoginForm();
        } finally {
            this.dispatchLoginReady(recovered);
        }
    },

    // 渲染"检测中"视图
    renderCheckingView(system = 'scm') {
        this.state.currentView = 'checking';
        this.state.main.innerHTML = '';

        const systemName = String(system || 'scm').toUpperCase();
        const header = document.createElement('div');
        header.className = 'login-header';
        header.innerHTML = `<h3>${systemName}系统登录</h3>`;

        const body = document.createElement('div');
        body.className = 'login-body';
        body.innerHTML = `
            <div class="success-container">
                <div class="spinner" style="width:32px;height:32px;border-width:3px;"></div>
                <div class="success-message">
                    <h4>正在检查登录状态...</h4>
                    <p>请稍后...</p>
                </div>
            </div>
        `;

        const footer = document.createElement('div');
        footer.className = 'login-footer';
        footer.innerHTML = '<button class="login-btn primary" disabled>检测中...</button>';

        this.state.main.appendChild(header);
        this.state.main.appendChild(body);
        this.state.main.appendChild(footer);
    },

    // 自动登录成功后显示成功状态，并行触发PMS和BI自动登录
    _autoLoginSuccess(displayName, recovery = null) {
        this.updateUsername(displayName);
        this.showLoginSuccess('SCM');
        if (!recovery?.results?.pms) this._autoLoginPms();
        if (!recovery?.results?.bi) this._autoLoginBi();
    },

    // PMS自动登录：本地缓存、当前设备索引、同供应商共享凭证
    async _autoLoginPms() {
        try {
            const auth = await this.ensureAuthModule();
            const recovered = await auth.recoverSystems(this, ['pms']);
            if (!recovered?.results?.pms) console.log('PMS无有效自动登录账户');
        } catch (e) {
            console.warn('PMS自动登录失败:', e);
        }
    },

    _pickText(...values) {
        for (const value of values) {
            const text = String(value ?? '').trim();
            if (text) return text;
        }
        return '';
    },

    _normalizePmsProvider(info = {}) {
        const credentials = info.credentials || {};
        const permissions = info.permissions || {};
        const userInfo = info.user_info || info.userInfo || {};
        const providers = [
            ...(Array.isArray(permissions.sub_providers) ? permissions.sub_providers : []),
            ...(Array.isArray(permissions.providers) ? permissions.providers : [])
        ];

        const providerId = this._pickText(
            info.provider_id,
            info.providerId,
            credentials.providerId,
            credentials.provider_id,
            userInfo.providerId,
            userInfo.provider_id,
            userInfo.supplierId,
            userInfo.supplier_id,
            providers[0]?.id,
            providers[0]?.provider_id,
            providers[0]?.providerId
        );

        const matched = providerId
            ? providers.find(item => this._pickText(item?.id, item?.provider_id, item?.providerId, item?.supplierId, item?.supplier_id) === providerId)
            : null;
        const provider = matched || providers[0] || {};

        return {
            provider_id: providerId,
            provider_name: this._pickText(
                info.provider_name,
                info.providerName,
                credentials.providerName,
                credentials.provider_name,
                userInfo.providerName,
                userInfo.provider_name,
                userInfo.supplierName,
                userInfo.supplier_name,
                userInfo.companyName,
                userInfo.company_name,
                userInfo.orgName,
                userInfo.org_name,
                provider.name,
                provider.provider_name,
                provider.providerName,
                provider.supplierName,
                provider.supplier_name,
                provider.companyName,
                provider.company_name
            )
        };
    },

    _buildPmsLocal(acc) {
        const provider = this._normalizePmsProvider(acc);
        return {
            system: 'pms',
            account: acc.account || acc.user_info?.account || acc.userInfo?.account || '',
            provider_id: provider.provider_id,
            provider_name: provider.provider_name,
            credentials: acc.credentials,
            user_info: acc.user_info || null,
            permissions: acc.permissions || null,
            login_time: acc.login_time
        };
    },

    _buildBiLocal(acc) {
        const credentials = acc.credentials || {};
        return {
            system: 'bi',
            account: acc.account || acc.user_info?.account || '',
            provider_id: acc.provider_id || acc.credentials?.providerId || acc.credentials?.provider_id || '',
            provider_name: acc.provider_name || acc.credentials?.providerName || acc.credentials?.provider_name || '',
            token: credentials.token,
            tokenSig: credentials.tokenSig || '',
            exp: credentials.exp || 0,
            credentials,
            userInfo: acc.user_info || acc.userInfo || null,
            login_time: acc.login_time,
            time: Date.now()
        };
    },

    // BI自动登录：本地缓存、当前设备索引、同供应商共享凭证，代理连接独立处理
    async _autoLoginBi() {
        console.log('[BI自动登录] ========== 开始 ==========');
        try {
            console.log('[BI自动登录] 步骤0: 初始化BI代理');
            const proxyReady = await this._ensureBiProxy();
            console.log(proxyReady
                ? '[BI自动登录] BI代理已连通'
                : '[BI自动登录] 未发现可用BI代理，跳过登录恢复');
            if (window.YejiModule?.setConnectionState) {
                window.YejiModule.setConnectionState({ proxyReady, tokenValid: false });
            }
            if (!proxyReady) return;

            const auth = await this.ensureAuthModule();
            const recovered = await auth.recoverSystems(this, ['bi']);
            if (!recovered?.results?.bi) console.log('[BI自动登录] 无有效BI账户');
        } catch (e) {
            console.warn('[BI自动登录] 错误详情:', e);
        } finally {
            console.log('[BI自动登录] ========== 结束 ==========');
        }
    },

    async syncSharedCredentialAfterLogin(system) {
        const local = this.getLocalLogin(system);
        if (!local || !this.canShareCurrentLogin(system) || !window.FirebaseModule) return false;

        await FirebaseModule.init();
        const account = this.getLocalAccountId(system, local);
        const providerId = local.provider_id || local.credentials?.providerId || local.credentials?.provider_id || '';
        if (!account || !providerId) return false;

        const sharedState = await this.getCurrentSharedState(system);
        if (!sharedState.hasAny) return false;

        const mode = system === 'scm' && sharedState.hasSecret && !sharedState.hasCredentials
            ? 'secret'
            : 'credentials';
        return this.shareCurrentCredential(system, mode);
    },

    // BI登录后：查询BI子公司selector独立确定供应商归属
    async resolveBiProvider() {
        try {
            if (!window.YejiGongju || !window.YejiConfig) return;
            const sid = YejiConfig.page2?.selectors?.company;
            if (!sid) return;

            const resp = await YejiGongju.querySelector(sid);
            const items = resp?.response?.result;
            console.log('[BI供应商] 公司筛选项查询结果:', items);
            if (!Array.isArray(items) || items.length === 0) return;

            let pid, pname;
            if (items.length === 1) {
                pid = String(items[0].value ?? '');
                pname = String(items[0].displayValue ?? items[0].dvt ?? pid);
                console.log('[BI供应商] 单公司模式 - value:', pid, 'name:', pname);
            } else {
                pid = 'jituan';
                pname = '多子公司';
                console.log('[BI供应商] 集团模式 - 公司数量:', items.length);
            }
            if (!pid) return;

            const local = this._getLocal('bi_login');
            if (local) {
                local.provider_id = pid;
                local.provider_name = pname;
                local.system = 'bi';
                this._saveLocal('bi_login', local);
            }

            console.log('BI供应商解析完成:', pid, pname);
            return { provider_id: pid, provider_name: pname };
        } catch (e) {
            console.warn('解析BI供应商失败:', e);
        }
        return null;
    },

    // BI代理发现（失败可重试）
    _ensureBiProxy() {
        if (this._proxyPromise) return this._proxyPromise;
        this._proxyPromise = (async () => {
            if (!window.YejiGongju) return false;
            const url = await YejiGongju.autoDiscoverProxy();
            if (url) return true;
            YejiGongju.startWatching();
            return await this._waitForBiProxy(8000);
        })().then(ok => {
            if (!ok) this._proxyPromise = null;
            if (window.YejiGongju) YejiGongju.startWatching();
            return ok;
        });
        return this._proxyPromise;
    },

    async _waitForBiProxy(timeout = 8000) {
        const started = Date.now();
        while (Date.now() - started < timeout) {
            const proxyUrl = window.YejiGongju?.getProxyUrl?.() || localStorage.getItem('bi_proxy_url') || '';
            if (proxyUrl) {
                const status = await YejiGongju.checkProxy(proxyUrl, 3000);
                if (status?.code === 0) return true;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        return false;
    },

    // 自动登录失败后切换到SCM登录表单
    _showLoginForm() {
        if (window.ScmLoginModule) {
            ScmLoginModule.init();
        }
        this.renderScmFormView();
    },

    // 后台补充缺失的provider_info（从Firebase获取并回写localStorage）
    async _supplementProviderInfo(username) {
        try {
            if (!window.FirebaseModule) return;
            await window.FirebaseModule.init();
            const providerId = this.session.credentials?.provider_id || this._getLocal('scm_login')?.provider_id || '';
            const info = await window.FirebaseModule.getScmLogin(username, providerId);
            if (info?.provider_info) {
                this.session.providerInfo = info.provider_info;
                // 回写localStorage
                const local = this._getLocal('scm_login');
                if (local) {
                    local.provider_info = info.provider_info;
                    this._saveLocal('scm_login', local);
                }
                console.log('已从数据库补充provider_info:', info.provider_info.provider_name);
            }
        } catch (e) {
            console.warn('补充provider_info失败:', e);
        }
    },

    // 渲染登录信息视图（已登录时展示）
    async renderLoginInfoView(system) {
        this.state.currentView = 'login_info';
        this.state.main.innerHTML = '';

        const systemName = system.toUpperCase();

        // 收集登录信息
        let account = '';
        let providerId = '';
        let providerName = '';

        if (system === 'scm') {
            account = this.session.username || '';
            providerId = this.session.credentials?.provider_id || '';
            providerName = this.session.providerInfo?.provider_name || '';
        } else if (system === 'pms') {
            const local = this._getLocal('pms_login');
            const provider = this._normalizePmsProvider(local || {});
            account = local?.account || local?.user_info?.account || '';
            providerId = provider.provider_id;
            providerName = provider.provider_name;
        } else if (system === 'bi') {
            const local = this._getLocal('bi_login');
            account = local?.userInfo?.account || local?.account || '-';
            providerId = local?.provider_id || '';
            providerName = local?.provider_name || '';
        }

        const header = document.createElement('div');
        header.className = 'login-header';
        header.innerHTML = `<h3>${systemName}系统登录</h3>`;

        const labels = { l1: '登录账户', l2: '供应商ID', l3: '供应商名称' };

        const body = document.createElement('div');
        body.className = 'login-body';
        body.innerHTML = `
            <div class="login-info-container">
                <div class="login-info-rows">
                    <div class="login-info-row">
                        <span class="login-info-label">${labels.l1}</span>
                        <span class="login-info-value">${account || '-'}</span>
                    </div>
                    <div class="login-info-row">
                        <span class="login-info-label">${labels.l2}</span>
                        <span class="login-info-value">${providerId || '-'}</span>
                    </div>
                    <div class="login-info-row">
                        <span class="login-info-label">${labels.l3}</span>
                        <span class="login-info-value">${providerName || '-'}</span>
                    </div>
                </div>
            </div>
        `;

        const footer = document.createElement('div');
        footer.className = 'login-footer';
        const canShare = this.canShareCurrentLogin(system);
        footer.innerHTML = `
            <button class="login-btn primary" id="login-share-btn"${canShare ? '' : ' disabled'} title="${canShare ? '凭证管理' : '当前账号无共享权限'}">凭证管理</button>
            <button class="login-btn primary" id="login-switch-btn">切换登录</button>
        `;

        this.state.main.appendChild(header);
        this.state.main.appendChild(body);
        this.state.main.appendChild(footer);

        // 绑定切换登录按钮
        const shareBtn = footer.querySelector('#login-share-btn');
        this.addEventListener(shareBtn, 'click', () => this.showShareCredentialDialog(system));
        const switchBtn = footer.querySelector('#login-switch-btn');
        this.addEventListener(switchBtn, 'click', () => this.handleSwitchLogin(system));
    },

    getLocalLogin(system) {
        if (system === 'scm') return this._getLocal('scm_login');
        if (system === 'pms') return this._getLocal('pms_login');
        if (system === 'bi') return this._getLocal('bi_login');
        return null;
    },

    getLocalAccountId(system, local = null) {
        const info = local || this.getLocalLogin(system);
        if (system === 'scm') return info?.username || info?.account || '';
        if (system === 'pms') return info?.account || info?.user_info?.account || '';
        if (system === 'bi') return info?.account || info?.userInfo?.account || '';
        return '';
    },

    canShareCurrentLogin(system) {
        const local = this.getLocalLogin(system);
        const account = this.getLocalAccountId(system, local);
        const providerId = local?.provider_id || local?.credentials?.providerId || local?.credentials?.provider_id || '';
        if (!local || !account || !providerId) return false;
        const source = local.credential_source || (local.share_allowed === false ? 'shared' : 'local');
        return local.share_allowed !== false && source !== 'shared';
    },

    async getCurrentSharedState(system) {
        const local = this.getLocalLogin(system);
        const account = this.getLocalAccountId(system, local);
        const providerId = local?.provider_id || local?.credentials?.providerId || local?.credentials?.provider_id || '';
        if (!window.FirebaseModule || !providerId || !account) return { hasAny: false };
        await FirebaseModule.init();
        let shared = null;
        if (system === 'scm') shared = await FirebaseModule.getScmLogin(account, providerId);
        else if (system === 'pms') shared = await FirebaseModule.getPmsLogin(account, providerId);
        else if (system === 'bi') shared = await FirebaseModule.findBiByAccount(account, providerId);
        const hasSecret = !!shared?.account_secret;
        const hasCredentials = !!shared?.credentials;
        return { shared, hasSecret, hasCredentials, hasAny: hasSecret || hasCredentials };
    },

    getCredentialManageOptions(system) {
        const local = this.getLocalLogin(system) || {};
        const options = [];
        if (system === 'scm' && local.account_secret) {
            options.push({ value: 'secret', label: '账号/密码' });
        }
        if (system === 'scm' && local.credentials) {
            options.push({ value: 'credentials', label: '完整凭证' });
        }
        if (system === 'pms' || system === 'bi') {
            options.push({ value: 'credentials', label: '完整凭证' });
        }
        return options;
    },

    getCredentialSharedByMode(sharedState = {}, mode = 'credentials') {
        return mode === 'secret' ? !!sharedState.hasSecret : !!sharedState.hasCredentials;
    },

    updateCredentialManageAction(mask, sharedState = {}) {
        const select = mask.querySelector('#login-share-mode');
        const okBtn = mask.querySelector('#login-share-ok');
        if (!select || !okBtn) return;
        const isShared = this.getCredentialSharedByMode(sharedState, select.value || 'credentials');
        okBtn.disabled = false;
        okBtn.textContent = isShared ? '私有' : '共享';
        okBtn.style.background = isShared ? '#dc2626' : '#2563eb';
        okBtn.style.color = '#fff';
        okBtn.title = isShared ? '关闭该凭证共享' : '共享该凭证';
    },

    updateCredentialManageBusy(mask, text) {
        const okBtn = mask.querySelector('#login-share-ok');
        if (!okBtn) return;
        okBtn.disabled = true;
        okBtn.textContent = text;
        okBtn.style.background = '#9ca3af';
        okBtn.style.color = '#fff';
        okBtn.title = text;
    },

    async showShareCredentialDialog(system) {
        if (!this.canShareCurrentLogin(system)) return;
        if (document.getElementById('login-share-dialog')) return;

        const options = this.getCredentialManageOptions(system);
        if (!options.length) return;
        let sharedState = await this.getCurrentSharedState(system);
        const selectOptions = options
            .map(item => `<option value="${item.value}">${item.label}</option>`)
            .join('');
        const mask = document.createElement('div');
        mask.id = 'login-share-dialog';
        mask.className = 'login-overlay active';
        mask.style.zIndex = '10001';
        mask.innerHTML = `
            <div class="login-container active" style="min-height:auto;">
                <div class="login-header"><h3>凭证管理</h3></div>
                <div class="login-body" style="padding-top:10px;padding-bottom:10px;">
                    <select id="login-share-mode" style="width:100%;height:34px;border:1px solid #d1d5db;border-radius:6px;padding:0 10px;background:#fff;" ${options.length === 1 ? 'disabled' : ''}>
                        ${selectOptions}
                    </select>
                </div>
                <div class="login-footer">
                    <button class="login-btn primary" id="login-share-cancel">返回</button>
                    <button class="login-btn primary" id="login-share-ok">共享</button>
                </div>
            </div>
        `;
        document.body.appendChild(mask);

        const close = () => mask.remove();
        mask.querySelector('#login-share-cancel')?.addEventListener('click', close);
        mask.querySelector('#login-share-mode')?.addEventListener('change', () => {
            this.updateCredentialManageAction(mask, sharedState);
        });
        this.updateCredentialManageAction(mask, sharedState);
        mask.querySelector('#login-share-ok')?.addEventListener('click', async () => {
            const mode = mask.querySelector('#login-share-mode')?.value || 'credentials';
            const isShared = this.getCredentialSharedByMode(sharedState, mode);
            this.updateCredentialManageBusy(mask, isShared ? '关闭中...' : '共享中...');
            const ok = isShared
                ? await this.unshareCurrentCredential(system, mode)
                : await this.shareCurrentCredential(system, mode);
            const modeText = mode === 'secret' ? '账号/密码' : '完整凭证';
            const message = isShared
                ? (ok ? `${modeText}已设为私有` : `${modeText}设为私有失败`)
                : `${modeText}共享${ok ? '成功' : '失败'}`;
            if (window.Tongzhi?.success) Tongzhi.success(message);
            else alert(message);
            if (ok) sharedState = await this.getCurrentSharedState(system);
            this.updateCredentialManageAction(mask, sharedState);
        });
    },

    async shareCurrentCredential(system, mode = 'credentials') {
        const local = this.getLocalLogin(system);
        if (!local || !this.canShareCurrentLogin(system) || !window.FirebaseModule) return false;
        await FirebaseModule.init();
        if (system === 'scm') {
            const account = local.username || local.account;
            const secret = local.account_secret || null;
            const credentials = local.credentials || null;
            if (mode === 'secret' && !secret) return false;
            if (mode === 'credentials' && !credentials) return false;
            const providerId = local.provider_id || local.providerId || local.credentials?.provider_id || local.credentials?.providerId || '';
            const providerInfo = {
                ...(local.provider_info || {}),
                provider_id: providerId,
                provider_name: local.provider_name || local.provider_info?.provider_name || local.credentials?.provider_name || local.credentials?.providerName || ''
            };
            const shared = await FirebaseModule.getScmLogin(account, providerInfo.provider_id);
            return FirebaseModule.saveScmLogin(
                account,
                mode === 'credentials' ? credentials : (shared?.credentials || null),
                providerInfo,
                mode === 'secret' ? secret : (shared?.account_secret || null)
            );
        }
        if (system === 'pms') {
            return FirebaseModule.savePmsLogin(local.account, local.credentials, local.user_info || null, local.permissions || null);
        }
        if (system === 'bi') {
            return FirebaseModule.saveBiLogin(
                local.account || local.userInfo?.account,
                local.credentials || { token: local.token, tokenSig: local.tokenSig, exp: local.exp || 0 },
                local.userInfo || null,
                local.provider_id,
                local.provider_name
            );
        }
        return false;
    },

    async unshareCurrentCredential(system, mode = 'credentials') {
        const local = this.getLocalLogin(system);
        if (!local || !this.canShareCurrentLogin(system) || !window.FirebaseModule) return false;
        const account = this.getLocalAccountId(system, local);
        const providerId = local.provider_id || local.credentials?.providerId || local.credentials?.provider_id || '';
        return FirebaseModule.unshareLogin(system, providerId, account, mode);
    },

    // 处理切换登录（所有用户统一进入账户列表）
    handleSwitchLogin(system) {
        this.renderAccountListView(system);
    },

    _getSystemProviderId(system) {
        if (system === 'scm') {
            return this.session.credentials?.provider_id || this._getLocal('scm_login')?.provider_id || '';
        }
        if (system === 'pms') {
            const local = this._getLocal('pms_login');
            return this._normalizePmsProvider(local || {}).provider_id;
        }
        if (system === 'bi') {
            return this._getLocal('bi_login')?.provider_id || '';
        }
        return '';
    },

    buildAccountKey(system, acc) {
        const providerId = system === 'pms'
            ? this._normalizePmsProvider(acc || {}).provider_id
            : (acc?.provider_id || acc?.credentials?.providerId || acc?.credentials?.provider_id || '');
        const account = system === 'scm' ? (acc?.username || acc?.account) : acc?.account;
        return `${providerId}::${account}`;
    },

    async getVerifiedLocalAccount(system) {
        const local = this.getLocalLogin(system);
        if (!local) return null;
        const account = this.getLocalAccountId(system, local);
        const providerId = system === 'pms'
            ? this._normalizePmsProvider(local).provider_id
            : (local.provider_id || local.credentials?.providerId || local.credentials?.provider_id || '');
        if (!account || !providerId) return null;

        if (system === 'scm') {
            const acc = {
                ...local,
                username: account,
                account,
                provider_id: providerId,
                provider_name: local.provider_name || local.provider_info?.provider_name || '',
                _source: 'local'
            };
            if (local.credentials) {
                const verification = await this.validateAccountCredentials({ ...acc, credentials: local.credentials }, 'scm');
                return verification.ok ? acc : null;
            }
            return local.account_secret ? acc : null;
        }
        if (system === 'pms' && local.credentials) {
            const provider = this._normalizePmsProvider(local);
            const acc = { ...local, account, provider_id: provider.provider_id || providerId, provider_name: provider.provider_name || local.provider_name || '', _source: 'local' };
            const verification = await this.validateAccountCredentials(acc, 'pms');
            return verification.ok ? acc : null;
        }
        if (system === 'bi' && local.token) {
            const acc = {
                ...local,
                account,
                credentials: local.credentials || { token: local.token, tokenSig: local.tokenSig, exp: local.exp || 0 },
                provider_id: providerId,
                _source: 'local'
            };
            const verification = await this.validateAccountCredentials(acc, 'bi');
            return verification.ok ? acc : null;
        }
        return null;
    },

    // 渲染账户列表视图
    async renderAccountListView(system) {
        this.state.currentView = 'account_list';
        this.state.main.innerHTML = '';

        const systemName = system.toUpperCase();

        const header = document.createElement('div');
        header.className = 'login-header';
        header.innerHTML = '<h3>切换账户</h3>';

        const body = document.createElement('div');
        body.className = 'login-body';
        body.innerHTML = `
            <div class="account-list-loading">
                <div class="spinner" style="width:24px;height:24px;border-width:2px;"></div>
                <span>加载账户列表...</span>
            </div>
        `;

        const footer = document.createElement('div');
        footer.className = 'login-footer';
        footer.innerHTML = `
            <button class="login-btn primary" id="account-list-back">返回</button>
            <button class="login-btn primary" id="account-list-add">添加</button>
        `;

        this.state.main.appendChild(header);
        this.state.main.appendChild(body);
        this.state.main.appendChild(footer);

        // 绑定返回按钮
        const backBtn = footer.querySelector('#account-list-back');
        this.addEventListener(backBtn, 'click', () => { this.renderLoginInfoView(system); });

        // 绑定添加按钮（弹出登录表单）
        const addBtn = footer.querySelector('#account-list-add');
        this.addEventListener(addBtn, 'click', () => {
            this.openAccountLoginView(system);
        });

        // 加载账户列表：本地账号优先，其余来自数据库共享
        try {
            const providerId = this._getSystemProviderId(system);
            const localAccount = await this.getVerifiedLocalAccount(system);
            const accounts = [];
            const used = new Set();
            if (localAccount) {
                accounts.push(localAccount);
                used.add(this.buildAccountKey(system, localAccount));
            }

            if (window.FirebaseModule) {
                await window.FirebaseModule.init();
                let shared = [];
                if (system === 'scm') shared = await window.FirebaseModule.findAllScmByProviderId(providerId);
                else if (system === 'bi') shared = await window.FirebaseModule.findAllBiByProviderId(providerId);
                else shared = await window.FirebaseModule.findAllPmsByProviderId(providerId);
                shared.forEach(acc => {
                    const item = { ...acc, _source: 'shared' };
                    const key = this.buildAccountKey(system, item);
                    if (!used.has(key)) {
                        used.add(key);
                        accounts.push(item);
                    }
                });
            }

            if (accounts.length === 0) {
                body.innerHTML = '<div class="account-list-empty">暂无可用账户</div>';
                return;
            }

            // 当前账户标识
            let currentId;
            if (system === 'scm') currentId = this.session.username || '';
            else if (system === 'bi') currentId = this._getLocal('bi_login')?.token ? '已登录' : '';
            else currentId = this._getLocal('pms_login')?.account || '';

            let html = '<div class="account-list">';
            accounts.forEach((acc, idx) => {
                let name, pid, pname, isCurrent;
                if (system === 'scm') {
                    name = acc.username || '-';
                    pid = acc.credentials?.provider_id || '-';
                    pname = acc.provider_info?.provider_name || '-';
                    isCurrent = name === currentId;
                } else if (system === 'bi') {
                    name = acc.account || '-';
                    pid = acc.provider_id || '-';
                    pname = acc.provider_name || '观远BI';
                    isCurrent = name === (this._getLocal('bi_login')?.account || this._getLocal('bi_login')?.userInfo?.account || '');
                } else {
                    const provider = this._normalizePmsProvider(acc);
                    name = acc.account || '-';
                    pid = provider.provider_id || '-';
                    pname = provider.provider_name || '-';
                    isCurrent = name === currentId;
                }

                let btnHtml;
                if (isCurrent) {
                    btnHtml = '<button class="account-list-btn" disabled>当前</button>';
                } else if (acc.invalid) {
                    btnHtml = '<button class="account-list-btn" disabled>失效</button>';
                } else {
                    btnHtml = `<button class="account-list-btn" data-idx="${idx}">登录</button>`;
                }

                html += `
                    <div class="account-list-item${isCurrent ? ' current' : ''}">
                        <div class="account-list-info">
                            <div class="account-list-name">${name}</div>
                            <div class="account-list-detail">${pid} · ${pname}</div>
                        </div>
                        ${btnHtml}
                    </div>
                `;
            });
            html += '</div>';
            body.innerHTML = html;

            // 绑定登录按钮（验证后切换）
            body.querySelectorAll('.account-list-btn:not(:disabled)').forEach(btn => {
                this.addEventListener(btn, 'click', () => {
                    const acc = accounts[parseInt(btn.dataset.idx)];
                    this.validateAndSwitch(acc, system, btn);
                });
            });
        } catch (error) {
            console.error('加载账户列表失败:', error);
            body.innerHTML = '<div class="account-list-empty">加载失败</div>';
        }
    },

    // 验证凭证有效性并切换账户
    async validateAndSwitch(acc, system, btn) {
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '验证中...';

        try {
            if (system === 'scm' && !acc.credentials && acc.account_secret) {
                this.openAccountLoginView(system, { prefillScmSecret: acc.account_secret });
                return;
            }

            const verification = await this.validateAccountCredentials(acc, system);

            if (verification.ok) {
        // 有效则切换账户（不添加设备）
                await this.switchToAccount(acc, system);
            } else if (verification.canMarkInvalid) {
        // 明确失效则标记失效
                await window.LoginAuthModule?.handleVerificationFailure?.(this, system, acc, verification, { source: 'manual', clearLocal: acc?._source === 'local' });
                btn.textContent = '失效';
                // 弹出登录表单（带返回按钮）
                this.openAccountLoginView(system);
            } else if (verification.canClearLocal || verification.status === 'missing' || verification.status === 'incomplete') {
                await window.LoginAuthModule?.handleVerificationFailure?.(this, system, acc, verification, { source: 'manual', clearLocal: acc?._source === 'local' });
                this.openAccountLoginView(system);
            } else {
                console.warn('账户凭证暂未通过验证:', verification.reason || verification.status, verification.message || '');
                btn.disabled = false;
                btn.textContent = originalText;
            }
        } catch (error) {
            console.error('验证账户失败:', error);
            btn.disabled = false;
            btn.textContent = originalText;
        }
    },

    openAccountLoginView(system, options = {}) {
        this.state.fromAccountList = system;
        this.state.returnTo = 'account_list';
        if (options.prefillScmSecret) this.state.prefillScmSecret = options.prefillScmSecret;
        else delete this.state.prefillScmSecret;

        if (system === 'scm') {
            if (window.ScmLoginModule) ScmLoginModule.init();
            this.renderScmFormView();
        } else if (system === 'bi') {
            if (window.BiLoginModule) BiLoginModule.restart();
            this.renderBiQrcodeView();
        } else {
            if (window.PmsLoginModule) PmsLoginModule.restart();
            this.renderPmsQrcodeView();
        }
    },

    // 验证账户凭证是否有效：统一交给 LoginCredentialVerifier 判断。
    async validateAccountCredentials(acc, system) {
        const verifier = window.LoginCredentialVerifier;
        if (!verifier?.verify) {
            return {
                ok: false,
                system,
                status: 'temporary',
                reason: 'VERIFIER_UNAVAILABLE',
                message: '凭证认证模块未加载。',
                canMarkInvalid: false,
                canClearLocal: false,
                canRetry: true,
                detail: {}
            };
        }
        return verifier.verify(system, acc, { host: this, source: acc?._source || 'manual' });
    },

    // 切换到指定账户
    // 注意：切换账户只切换本地登录态，不写入新的设备索引
    async switchToAccount(acc, system) {
        this._isSwitching = true;
        try {
            const currentDeviceId = window.FirebaseModule?.state?.deviceId || '';
            const canShare = acc._source !== 'shared' || !!(currentDeviceId && acc.devices?.[currentDeviceId]);
            const source = canShare ? (acc._source === 'local' ? 'local' : 'device') : 'shared';
            let username = '';
            if (system === 'scm') {
                const displayName = acc.provider_info?.username || acc.credentials?.username || acc.username;
                username = displayName || acc.username || '';
                this.session.logged_in = true;
                this.session.username = acc.username;
                this.session.credentials = acc.credentials;
                this.session.providerInfo = acc.provider_info || null;
                this._saveLocal('scm_login', {
                    system: 'scm',
                    username: acc.username,
                    credentials: acc.credentials,
                    provider_info: acc.provider_info || null,
                    provider_id: acc.provider_id || acc.credentials?.provider_id || '',
                    provider_name: acc.provider_name || acc.provider_info?.provider_name || '',
                    account_secret: acc.account_secret || null,
                    share_allowed: canShare,
                    credential_source: source,
                    displayName: displayName,
                    login_time: acc.login_time
                });
                this.updateUsername(displayName);
                this.dispatchScmAuthenticated({
                    username,
                    providerId: acc.provider_id || acc.credentials?.provider_id || acc.credentials?.providerId || '',
                    providerName: acc.provider_name || acc.provider_info?.provider_name || '',
                    source,
                    switched: true
                });
                console.log('切换SCM账户:', acc.username);
            } else if (system === 'pms') {
                const local = { ...this._buildPmsLocal(acc), share_allowed: canShare, credential_source: source };
                username = local.account || '';
                this._saveLocal('pms_login', local);
                console.log('切换PMS账户:', acc.account);
            } else if (system === 'bi') {
                const local = { ...this._buildBiLocal(acc), share_allowed: canShare, credential_source: source };
                username = local.account || local.userInfo?.account || '';
                this._saveLocal('bi_login', local);
                console.log('切换BI账户:', acc.account);
            }
            if (username) this.updateUsername(username);
            this.state.fromAccountList = null;
            this.state.returnTo = null;
            await this.renderLoginInfoView(system);
            document.dispatchEvent(new CustomEvent('loginSuccess', {
                detail: { system: system.toUpperCase(), username, switched: true }
            }));
        } finally {
            this._isSwitching = false;
        }
    },

    // 强制弹出SCM登录（不可关闭）
    _forceScmLogin() {
        this.config.mandatory = true;
        this.open('scm');
    },

    // 创建登录弹窗
    createLoginDialog() {
        // 创建遮罩层
        const overlay = document.createElement('div');
        overlay.id = 'login-overlay';
        overlay.className = 'login-overlay';
        overlay.style.display = 'none';

        // 创建弹窗容器
        const container = document.createElement('div');
        container.id = 'login-container';
        container.className = 'login-container';

        // 创建关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.id = 'login-close';
        closeBtn.className = 'login-close';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', () => this.close());

        // 创建主内容区域
        const main = document.createElement('div');
        main.id = 'login-main';
        main.className = 'login-main';

        // 组装
        container.appendChild(closeBtn);
        container.appendChild(main);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        this.state.container = container;
        this.state.overlay = overlay;
        this.state.main = main;
        this.state.closeBtn = closeBtn;
    },

    // 打开登录弹窗
    async open(system) {
        this._clearSuccessTimer({ releaseMandatory: this.state.currentView === 'success' });
        // 初始登录清除账户列表标记
        this.state.fromAccountList = null;
        this.state.returnTo = null;

        this.config.selectedSystem = system;
        this.config.isOpen = true;
        this.state.overlay.style.display = 'flex';

        // 强制登录模式隐藏关闭按钮
        this.state.closeBtn.style.display = this.config.mandatory ? 'none' : '';

        setTimeout(() => {
            this.state.overlay.classList.add('active');
            this.state.container.classList.add('active');
        }, 10);

        if (await this.tryOpenRecoveredLogin(system)) return;

                // 未登录则初始化对应系统的登录流程
        if (system === 'scm') {
            if (window.ScmLoginModule) {
                ScmLoginModule.init();
            }
            this.renderScmFormView();
        } else if (system === 'pms') {
            if (window.PmsLoginModule) {
                PmsLoginModule.init();
            }
            this.renderPmsQrcodeView();
        } else if (system === 'bi') {
            if (window.BiLoginModule) {
                BiLoginModule.init();
            }
            this.renderBiQrcodeView();
        }
    },

    async tryOpenRecoveredLogin(system) {
        this.renderCheckingView(system);
        try {
            if (system === 'bi') {
                const proxyReady = await this._ensureBiProxy();
                if (!proxyReady) return false;
            }
            const auth = await this.ensureAuthModule();
            const recovered = await Promise.race([
                auth.recoverSystems(this, [system]),
                new Promise(resolve => setTimeout(() => resolve(null), 10000))
            ]);
            if (!recovered?.results?.[system]) return false;
            await this.renderLoginInfoView(system);
            return true;
        } catch (error) {
            console.warn(`${String(system).toUpperCase()}自动恢复失败:`, error);
            return false;
        }
    },

    // 关闭登录弹窗
    close() {
        // 强制登录模式不允许关闭
        if (this.config.mandatory) return;
        this._clearSuccessTimer();

        // 停止所有轮询
        if (window.ScmLoginModule) ScmLoginModule.stopPolling();
        if (window.PmsLoginModule) PmsLoginModule.stopPolling();
        if (window.BiLoginModule) BiLoginModule.stopPolling();

        // 停止Firebase监听
        if (this.state.accountListListener) {
            this.state.accountListListener.ref.off('value', this.state.accountListListener.listener);
            this.state.accountListListener = null;
        }

        this.state.overlay.classList.remove('active');
        this.state.container.classList.remove('active');
        setTimeout(() => {
            this.state.overlay.style.display = 'none';
            this.config.isOpen = false;
            this.clearEventListeners();

            // 触发登录窗口关闭事件
            const event = new CustomEvent('loginClosed', {
                detail: { system: this.config.selectedSystem }
            });
            document.dispatchEvent(event);
        }, 300);
    },

    // 清理事件监听器
    clearEventListeners() {
        this.state.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.state.eventListeners = [];
    },

    // 添加事件监听器（便于清理）
    addEventListener(element, event, handler) {
        element.addEventListener(event, handler);
        this.state.eventListeners.push({ element, event, handler });
    },

    // 渲染SCM表单视图
    renderScmFormView() {
        this.state.currentView = 'scm_form';
        this.state.main.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'login-header';
        header.innerHTML = '<h3>SCM系统登录</h3>';

        const body = document.createElement('div');
        body.className = 'login-body';
        body.innerHTML = `
            <div class="login-form">
                <div class="form-group">
                    <label for="scm-account">1. 账号</label>
                    <input type="text" id="scm-account" placeholder="请输入账号" autocomplete="off">
                </div>
                <div class="form-group">
                    <label for="scm-password">2. 密码</label>
                    <input type="password" id="scm-password" placeholder="请输入密码" autocomplete="off">
                </div>
                <div class="form-group">
                    <label for="scm-captcha">3. 验证码 <span style="font-size: 12px; color: #999;">（默认自动识别）</span></label>
                    <div class="captcha-row">
                        <input type="text" id="scm-captcha" placeholder="请输入验证码" autocomplete="off">
                        <div id="captcha-image" class="captcha-image">
                            <div class="captcha-loading">点击加载验证码</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const footer = document.createElement('div');
        footer.className = 'login-footer';
        const backBtnHtml = this.state.fromAccountList
            ? '<button id="scm-back" class="login-btn primary">返回</button>'
            : '';
        footer.innerHTML = `${backBtnHtml}<button id="scm-next" class="login-btn primary">下一步</button>`;

        this.state.main.appendChild(header);
        this.state.main.appendChild(body);
        this.state.main.appendChild(footer);

        // 绑定返回按钮
        const backBtn = footer.querySelector('#scm-back');
        if (backBtn) {
            const sys = this.state.fromAccountList;
            const returnTo = this.state.returnTo;
            this.addEventListener(backBtn, 'click', () => {
                this.state.fromAccountList = null;
                this.state.returnTo = null;
                if (returnTo === 'login_info') {
                    this.renderLoginInfoView(sys);
                } else {
                    this.renderAccountListView(sys);
                }
            });
        }

        // 绑定验证码点击事件
        const captchaImage = body.querySelector('#captcha-image');
        this.addEventListener(captchaImage, 'click', () => this.loadCaptcha());

        // 绑定下一步按钮事件
        const nextBtn = footer.querySelector('#scm-next');
        this.addEventListener(nextBtn, 'click', () => this.verifyScmAccount());

        // 自动填充账号密码（仅当前设备码在用户账户下）
        this.autoFillScmAccount();

        // 加载验证码
        this.loadCaptcha();
    },

    // 自动填充SCM账号密码
    async autoFillScmAccount() {
        const accountInput = document.getElementById('scm-account');
        const passwordInput = document.getElementById('scm-password');
        const captchaInput = document.getElementById('scm-captcha');

        if (!accountInput || !passwordInput) return;

        try {
            if (this.state.prefillScmSecret) {
                const savedSecret = this.state.prefillScmSecret;
                accountInput.value = savedSecret.account || '';
                passwordInput.value = savedSecret.password || '';
                delete this.state.prefillScmSecret;
                console.log('已填充共享SCM账号密码');
                return;
            }

            // 禁用输入框并显示加载状态
            accountInput.disabled = true;
            passwordInput.disabled = true;
            if (captchaInput) captchaInput.disabled = true;
            accountInput.placeholder = '自动加载中......';
            passwordInput.placeholder = '自动加载中......';

            if (!window.FirebaseModule) return;
            await FirebaseModule.init();

            // 获取当前设备登录过的SCM账户
            const deviceLogins = await FirebaseModule.getDeviceLogins('scm');
            if (!deviceLogins.scm || deviceLogins.scm.length === 0) return;

            // 获取最近登录的账户信息
            const sorted = deviceLogins.scm.sort((a, b) => b.login_time - a.login_time);
            const info = sorted[0];

            // 检查是否有保存的账号密码，且当前设备登录过
            const savedSecret = info?.account_secret;
            if (savedSecret && info.devices?.[FirebaseModule.state.deviceId]) {
                accountInput.value = savedSecret.account || '';
                passwordInput.value = savedSecret.password || '';
                console.log('已自动填充SCM账号密码');
            }
        } catch (error) {
            console.warn('自动填充账号密码失败:', error);
        } finally {
            // 恢复输入框
            accountInput.disabled = false;
            passwordInput.disabled = false;
            if (captchaInput) captchaInput.disabled = false;
            accountInput.placeholder = '请输入账号';
            passwordInput.placeholder = '请输入密码';
        }
    },

    // 加载验证码
    async loadCaptcha() {
        const captchaImage = this.state.main.querySelector('#captcha-image');
        const captchaInput = this.state.main.querySelector('#scm-captcha');
        if (!captchaImage) return;

        try {
            // 同步显示加载状态
            captchaImage.innerHTML = '<div class="captcha-loading">加载中...</div>';
            if (captchaInput) {
                captchaInput.value = '';
                captchaInput.placeholder = '自动加载中......';
                captchaInput.disabled = true;
            }

            const data = await ScmLoginModule.getCaptcha();

            if (data.success && data.captcha_base64) {
                captchaImage.innerHTML = `<img src="${data.captcha_base64}" alt="验证码">`;
                this.state.captchaData = data;

                // 加载完成后立即填充占位符
                if (captchaInput) {
                    captchaInput.value = '******';
                    captchaInput.placeholder = '点击下一步自动识别';
                    captchaInput.disabled = false;
                }
            } else {
                captchaImage.innerHTML = '<div class="captcha-loading">加载失败，点击重试</div>';
                if (captchaInput) {
                    captchaInput.value = '';
                    captchaInput.placeholder = '请输入验证码';
                    captchaInput.disabled = false;
                }
            }
        } catch (error) {
            captchaImage.innerHTML = '<div class="captcha-loading">加载失败，点击重试</div>';
            if (captchaInput) {
                captchaInput.value = '';
                captchaInput.placeholder = '请输入验证码';
                captchaInput.disabled = false;
            }
            console.error('加载验证码失败:', error);
        }
    },

    // 验证SCM账号
    async verifyScmAccount() {
        const accountInput = this.state.main.querySelector('#scm-account');
        const passwordInput = this.state.main.querySelector('#scm-password');
        const captchaInput = this.state.main.querySelector('#scm-captcha');
        const nextBtn = this.state.main.querySelector('#scm-next');

        const account = accountInput.value.trim();
        const password = passwordInput.value.trim();
        let captcha = captchaInput.value.trim();

        // 验证账号密码
        if (!account || !password) {
            Tongzhi.error('请输入账号和密码');
            return;
        }

        if (!this.state.captchaData) {
            Tongzhi.error('请先加载验证码');
            return;
        }

        // 如果验证码是占位符，先识别
        if (captcha === '******' || captcha === '') {
            captchaInput.value = '';
            captchaInput.placeholder = '自动识别中......';
            captchaInput.disabled = true;
            nextBtn.disabled = true;
            nextBtn.textContent = '识别中...';

            try {
                const result = await ScmLoginModule.recognizeCaptcha(this.state.captchaData.captcha_base64);
                if (result) {
                    captcha = result;
                    captchaInput.value = result;
                    captchaInput.disabled = false;
                    console.log('验证码自动识别:', result);
                } else {
                    throw new Error('验证码识别失败');
                }
            } catch (error) {
                captchaInput.value = '';
                captchaInput.placeholder = '请输入验证码';
                captchaInput.disabled = false;
                Tongzhi.error('验证码识别失败，请手动输入');
                nextBtn.disabled = false;
                nextBtn.textContent = '下一步';
                return;
            }
        }

        // 禁用按钮
        nextBtn.disabled = true;
        nextBtn.textContent = '验证中...';

        try {
            const result = await ScmLoginModule.startLogin(account, password, {
                captcha: captcha,
                cookies: this.state.captchaData.cookies
            });

            // 切换到二维码视图
            this.renderScmQrcodeView(result.qrcodeUrl);

        } catch (error) {
            Tongzhi.error(error.message);
            this.loadCaptcha();
        } finally {
            nextBtn.disabled = false;
            nextBtn.textContent = '下一步';
        }
    },

    // 渲染SCM二维码视图
    renderScmQrcodeView(qrcodeUrl) {
        this.state.currentView = 'scm_qrcode';
        this.state.main.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'login-header';
        header.innerHTML = '<h3>SCM系统登录</h3>';

        const body = document.createElement('div');
        body.className = 'login-body';
        body.innerHTML = `
            <div class="qrcode-container">
                <div class="qrcode-image" style="position: relative;">
                    <img src="${qrcodeUrl}" alt="企业微信二维码" id="qrcode-img">
                    <div class="qrcode-overlay" id="qrcode-overlay" style="display: none;">
                        <i class="fas fa-check-circle"></i>
                    </div>
                </div>
            </div>
        `;

        const footer = document.createElement('div');
        footer.className = 'login-footer';
        footer.innerHTML = '<button id="scm-login" class="login-btn primary">登录</button>';

        this.state.main.appendChild(header);
        this.state.main.appendChild(body);
        this.state.main.appendChild(footer);

        // 绑定二维码点击事件（刷新）
        const qrcodeImage = body.querySelector('.qrcode-image');
        this.addEventListener(qrcodeImage, 'click', () => this.refreshScmQrcode());

        // 登录按钮初始禁用
        const loginBtn = footer.querySelector('#scm-login');
        loginBtn.disabled = true;
        loginBtn.textContent = '等待扫码...';

        // 开始轮询
        this.startScmPolling();
    },

    // 刷新SCM二维码
    async refreshScmQrcode() {
        const qrcodeImg = this.state.main.querySelector('#qrcode-img');
        const qrcodeOverlay = this.state.main.querySelector('#qrcode-overlay');
        const loginBtn = this.state.main.querySelector('#scm-login');

        if (!qrcodeImg || !loginBtn) return;

        try {
            qrcodeImg.style.opacity = '0.5';
            if (qrcodeOverlay) qrcodeOverlay.style.display = 'none';
            loginBtn.disabled = true;
            loginBtn.textContent = '刷新中...';

            ScmLoginModule.stopPolling();
            ScmLoginModule.restart();

            const state = ScmLoginModule.getState();
            const result = await ScmLoginModule.startLogin(
                state.account,
                state.password,
                { captcha: '', cookies: state.cookies }
            );

            qrcodeImg.src = result.qrcodeUrl;
            qrcodeImg.style.opacity = '1';
            loginBtn.textContent = '等待扫码...';

            this.startScmPolling();

        } catch (error) {
            Tongzhi.error(error.message);
            qrcodeImg.style.opacity = '1';
            loginBtn.disabled = false;
            loginBtn.textContent = '重试';
        }
    },

    // 统一轮询方法
    _startPolling(system, overlayId, btnId, module) {
        const qrcodeOverlay = this.state.main.querySelector(overlayId);
        const loginBtn = this.state.main.querySelector(btnId);
        if (!qrcodeOverlay || !loginBtn) return;

        module.startPolling().then(() => {
            this.showLoginSuccess(system);
        }).catch((error) => {
            qrcodeOverlay.style.display = 'none';
            loginBtn.disabled = false;
            loginBtn.textContent = '重试';
            console.error(`${system}轮询失败:`, error);
        });

        const checkStatus = () => {
            const state = module.getState();
            if (state.currentStep === 'polling') {
                if (state.lastStatus === 'QRCODE_SCAN_ING') {
                    qrcodeOverlay.style.display = 'flex';
                    loginBtn.disabled = true;
                    loginBtn.textContent = '扫码成功，请确认...';
                } else if (state.lastStatus === 'QRCODE_SCAN_SUCC') {
                    qrcodeOverlay.style.display = 'flex';
                    loginBtn.disabled = true;
                    loginBtn.textContent = '登录中...';
                } else {
                    qrcodeOverlay.style.display = 'none';
                    loginBtn.disabled = true;
                    loginBtn.textContent = '等待扫码...';
                }
                setTimeout(checkStatus, 300);
            } else if (state.currentStep === 'success') {
                qrcodeOverlay.style.display = 'flex';
                loginBtn.disabled = true;
                loginBtn.textContent = '登录中...';
            }
        };
        checkStatus();
    },

    // 开始SCM轮询
    startScmPolling() {
        this._startPolling('SCM', '#qrcode-overlay', '#scm-login', ScmLoginModule);
    },

    // 渲染PMS二维码视图
    renderPmsQrcodeView() {
        this.state.currentView = 'pms_qrcode';
        this.state.main.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'login-header';
        header.innerHTML = '<h3>PMS系统登录</h3>';

        const body = document.createElement('div');
        body.className = 'login-body';
        body.innerHTML = `
            <div class="qrcode-container">
                <div class="qrcode-image" id="pms-qrcode-image" style="position: relative;">
                    <div class="qrcode-loading">
                        <div class="spinner"></div>
                        <span>正在生成二维码...</span>
                    </div>
                </div>
            </div>
        `;

        const footer = document.createElement('div');
        footer.className = 'login-footer';
        const pmsBackHtml = this.state.fromAccountList
            ? '<button id="pms-back" class="login-btn primary">返回</button>'
            : '';
        footer.innerHTML = `${pmsBackHtml}<button id="pms-login" class="login-btn primary">登录</button>`;

        this.state.main.appendChild(header);
        this.state.main.appendChild(body);
        this.state.main.appendChild(footer);

        // 绑定返回按钮
        const pmsBackBtn = footer.querySelector('#pms-back');
        if (pmsBackBtn) {
            const sys = this.state.fromAccountList;
            const returnTo = this.state.returnTo;
            this.addEventListener(pmsBackBtn, 'click', () => {
                if (window.PmsLoginModule) PmsLoginModule.stopPolling();
                this.state.fromAccountList = null;
                this.state.returnTo = null;
                if (returnTo === 'login_info') {
                    this.renderLoginInfoView(sys);
                } else {
                    this.renderAccountListView(sys);
                }
            });
        }

        // 绑定二维码点击事件（刷新）
        const qrcodeImage = body.querySelector('#pms-qrcode-image');
        this.addEventListener(qrcodeImage, 'click', () => this.refreshPmsQrcode());

        // 登录按钮初始禁用
        const loginBtn = footer.querySelector('#pms-login');
        loginBtn.disabled = true;
        loginBtn.textContent = '等待二维码...';

        // 开始PMS登录流程
        this.loadPmsQrcode();
    },

    // 加载PMS二维码
    async loadPmsQrcode() {
        const qrcodeImage = this.state.main.querySelector('#pms-qrcode-image');
        const loginBtn = this.state.main.querySelector('#pms-login');

        if (!qrcodeImage || !loginBtn) return;

        try {
            const result = await PmsLoginModule.startLogin();

            qrcodeImage.innerHTML = `
                <img src="${result.qrcodeUrl}" alt="企业微信二维码" id="pms-qrcode-img">
                <div class="qrcode-overlay" id="pms-qrcode-overlay" style="display: none;">
                    <i class="fas fa-check-circle"></i>
                </div>
            `;
            loginBtn.disabled = true;
            loginBtn.textContent = '等待扫码...';

            this.startPmsPolling();

        } catch (error) {
            qrcodeImage.innerHTML = `
                <div class="qrcode-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${error.message}</p>
                </div>
            `;
            loginBtn.disabled = false;
            loginBtn.textContent = '重试';

            this.addEventListener(loginBtn, 'click', () => {
                this.refreshPmsQrcode();
            });
        }
    },

    // 刷新PMS二维码
    async refreshPmsQrcode() {
        const qrcodeImage = this.state.main.querySelector('#pms-qrcode-image');
        const loginBtn = this.state.main.querySelector('#pms-login');

        if (!qrcodeImage || !loginBtn) return;

        try {
            qrcodeImage.innerHTML = `
                <div class="qrcode-loading">
                    <div class="spinner"></div>
                    <span>刷新中...</span>
                </div>
            `;
            loginBtn.disabled = true;
            loginBtn.textContent = '刷新中...';

            PmsLoginModule.stopPolling();
            PmsLoginModule.restart();

            const result = await PmsLoginModule.startLogin();

            qrcodeImage.innerHTML = `
                <img src="${result.qrcodeUrl}" alt="企业微信二维码" id="pms-qrcode-img">
                <div class="qrcode-overlay" id="pms-qrcode-overlay" style="display: none;">
                    <i class="fas fa-check-circle"></i>
                </div>
            `;
            loginBtn.disabled = true;
            loginBtn.textContent = '等待扫码...';

            this.startPmsPolling();

        } catch (error) {
            qrcodeImage.innerHTML = `
                <div class="qrcode-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${error.message}</p>
                </div>
            `;
            loginBtn.disabled = false;
            loginBtn.textContent = '重试';
        }
    },

    // 开始PMS轮询
    startPmsPolling() {
        this._startPolling('PMS', '#pms-qrcode-overlay', '#pms-login', PmsLoginModule);
    },

    // 渲染BI二维码视图（与PMS同模式）
    renderBiQrcodeView() {
        this.state.currentView = 'bi_qrcode';
        this.state.main.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'login-header';
        header.innerHTML = '<h3>BI系统登录</h3>';

        const body = document.createElement('div');
        body.className = 'login-body';
        body.innerHTML = `
            <div class="qrcode-container">
                <div class="qrcode-image" id="bi-qrcode-image" style="position: relative;">
                    <div class="qrcode-loading">
                        <div class="spinner"></div>
                        <span>正在生成二维码...</span>
                    </div>
                </div>
            </div>
        `;

        const footer = document.createElement('div');
        footer.className = 'login-footer';
        const biBackHtml = this.state.fromAccountList
            ? '<button id="bi-back" class="login-btn primary">返回</button>'
            : '';
        footer.innerHTML = `${biBackHtml}<button id="bi-login" class="login-btn primary">登录</button>`;

        this.state.main.appendChild(header);
        this.state.main.appendChild(body);
        this.state.main.appendChild(footer);

        // 绑定返回按钮
        const biBackBtn = footer.querySelector('#bi-back');
        if (biBackBtn) {
            const sys = this.state.fromAccountList;
            const returnTo = this.state.returnTo;
            this.addEventListener(biBackBtn, 'click', () => {
                if (window.BiLoginModule) BiLoginModule.stopPolling();
                this.state.fromAccountList = null;
                this.state.returnTo = null;
                if (returnTo === 'login_info') this.renderLoginInfoView(sys);
            });
        }

        // 绑定二维码点击事件（刷新）
        const qrcodeImage = body.querySelector('#bi-qrcode-image');
        this.addEventListener(qrcodeImage, 'click', () => this.refreshBiQrcode());

        const loginBtn = footer.querySelector('#bi-login');
        loginBtn.disabled = true;
        loginBtn.textContent = '等待二维码...';

        this.loadBiQrcode();
    },

    // 加载BI二维码
    async loadBiQrcode() {
        const qrcodeImage = this.state.main.querySelector('#bi-qrcode-image');
        const loginBtn = this.state.main.querySelector('#bi-login');
        if (!qrcodeImage || !loginBtn) return;

        try {
            const result = await BiLoginModule.startLogin();
            qrcodeImage.innerHTML = `
                <img src="${result.qrcodeUrl}" alt="企业微信二维码" id="bi-qrcode-img">
                <div class="qrcode-overlay" id="bi-qrcode-overlay" style="display: none;">
                    <i class="fas fa-check-circle"></i>
                </div>
            `;
            loginBtn.disabled = true;
            loginBtn.textContent = '等待扫码...';
            this.startBiPolling();
        } catch (error) {
            qrcodeImage.innerHTML = `
                <div class="qrcode-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${error.message}</p>
                </div>
            `;
            loginBtn.disabled = false;
            loginBtn.textContent = '重试';
            this.addEventListener(loginBtn, 'click', () => this.refreshBiQrcode());
        }
    },

    // 刷新BI二维码
    async refreshBiQrcode() {
        const qrcodeImage = this.state.main.querySelector('#bi-qrcode-image');
        const loginBtn = this.state.main.querySelector('#bi-login');
        if (!qrcodeImage || !loginBtn) return;

        try {
            qrcodeImage.innerHTML = '<div class="qrcode-loading"><div class="spinner"></div><span>刷新中...</span></div>';
            loginBtn.disabled = true;
            loginBtn.textContent = '刷新中...';
            BiLoginModule.stopPolling();
            BiLoginModule.restart();
            const result = await BiLoginModule.startLogin();
            qrcodeImage.innerHTML = `
                <img src="${result.qrcodeUrl}" alt="企业微信二维码" id="bi-qrcode-img">
                <div class="qrcode-overlay" id="bi-qrcode-overlay" style="display: none;">
                    <i class="fas fa-check-circle"></i>
                </div>
            `;
            loginBtn.disabled = true;
            loginBtn.textContent = '等待扫码...';
            this.startBiPolling();
        } catch (error) {
            qrcodeImage.innerHTML = `
                <div class="qrcode-error"><i class="fas fa-exclamation-triangle"></i><p>${error.message}</p></div>
            `;
            loginBtn.disabled = false;
            loginBtn.textContent = '重试';
        }
    },

    // 开始BI轮询
    startBiPolling() {
        this._startPolling('BI', '#bi-qrcode-overlay', '#bi-login', BiLoginModule);
    },

    // 显示登录成功
    showLoginSuccess(system) {
        this.state.currentView = 'success';
        this.state.main.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'login-header';
        header.innerHTML = `<h3>${system}系统登录</h3>`;

        const body = document.createElement('div');
        body.className = 'login-body';
        body.innerHTML = `
            <div class="success-container">
                <div class="success-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="success-message">
                    <h4>登录成功！</h4>
                    <p>正在跳转...</p>
                </div>
            </div>
        `;

        const footer = document.createElement('div');
        footer.className = 'login-footer';
        footer.innerHTML = '<button class="login-btn primary" disabled>登录</button>';

        this.state.main.appendChild(header);
        this.state.main.appendChild(body);
        this.state.main.appendChild(footer);

        // 获取用户名并设置会话
        let username = '';
        if (this._isSwitching) {
            // 切换账户场景：数据已由switchToAccount设置，不再重复写入
            if (system === 'SCM') {
                username = this.session.username || '';
            } else if (system === 'PMS') {
                username = this._getLocal('pms_login')?.account || '';
            }
        } else if (system === 'SCM') {
            if (this.session.logged_in && this.session.credentials && !this.state.fromAccountList) {
                // 自动登录场景：会话已由checkAndForceLogin设置，直接使用
                username = this.session.username || '';
            } else {
                // 手动登录场景（含切换登录）：从ScmLoginModule获取状态
                const state = ScmLoginModule.getState();
                username = state.providerInfo?.username || state.credentials?.username || state.account || '';
                this.session.logged_in = true;
                this.session.username = state.account || username;
                this.session.credentials = state.credentials;
                this.session.providerInfo = state.providerInfo || null;
                // 写入本地缓存
                this._saveLocal('scm_login', {
                    system: 'scm',
                    username: this.session.username,
                    credentials: state.credentials,
                    provider_info: state.providerInfo || null,
                    provider_id: state.credentials?.provider_id || state.providerInfo?.provider_id || '',
                    provider_name: state.providerInfo?.provider_name || '',
                    account_secret: { account: state.account, password: state.password },
                    share_allowed: true,
                    credential_source: 'local',
                    displayName: username,
                    login_time: Date.now()
                });
            }
            this.syncSharedCredentialAfterLogin('scm').catch(error => console.warn('SCM共享凭证回写失败:', error));
            this.dispatchScmAuthenticated({
                username,
                switched: !!this._isSwitching
            });
        } else if (system === 'PMS') {
            const state = PmsLoginModule.getState();
            username = state.userInfo?.account || '';
            // 写入本地缓存
            if (username) {
                const provider = this._normalizePmsProvider({
                    account: username,
                    credentials: state.credentials || {},
                    permissions: state.permissions || {},
                    user_info: state.userInfo || {}
                });
                this._saveLocal('pms_login', {
                    system: 'pms',
                    account: username,
                    provider_id: provider.provider_id || state.credentials?.providerId || '',
                    provider_name: provider.provider_name || state.credentials?.providerName || '',
                    credentials: state.credentials,
                    user_info: state.userInfo,
                    permissions: state.permissions,
                    share_allowed: true,
                    credential_source: 'local',
                    login_time: Date.now()
                });
            }
            this.syncSharedCredentialAfterLogin('pms').catch(error => console.warn('PMS共享凭证回写失败:', error));
        } else if (system === 'BI') {
            const state = BiLoginModule.getState();
            const local = this._getLocal('bi_login');
            username = local?.account || state.userInfo?.account || 'BI已登录';
            this.syncSharedCredentialAfterLogin('bi').catch(error => console.warn('BI共享凭证回写失败:', error));
        }

        // 2秒后关闭弹窗
        this.state.successTimer = setTimeout(() => {
            this.state.successTimer = null;
            // SCM登录成功后解除强制模式
            if (system === 'SCM') {
                this.config.mandatory = false;
            }
            this.close();

            // 更新导航栏用户名
            if (username) {
                this.updateUsername(username);
            }

            // 触发登录成功事件（切换账户时标记switched，外部模块据此跳过设备码写入）
            const event = new CustomEvent('loginSuccess', {
                detail: { system, username, switched: !!this._isSwitching }
            });
            document.dispatchEvent(event);

            this._isSwitching = false;
            this.state.fromAccountList = null;
            this.state.returnTo = null;
        }, 2000);
    },

    // 更新导航栏用户名
    updateUsername(username) {
        // 直接使用 AppFramework（不带 window.）
        if (typeof AppFramework !== 'undefined' && AppFramework.setLoginUsername) {
            AppFramework.setLoginUsername(username);
        } else {
            // 降级处理：直接更新DOM
            const userText = document.getElementById('user-text');
            if (userText && username) {
                userText.textContent = username;
                userText.title = username;
            }
        }
    },

    // ========== 统一凭证接口 ==========

    async requireCredentials(system, options = {}) {
        const normalized = String(system || '').trim().toLowerCase();
        if (!['scm', 'pms', 'bi'].includes(normalized)) {
            return { ok: false, system: normalized, code: 'INVALID_SYSTEM', message: '系统参数无效。', detail: {} };
        }

        try {
            if (normalized === 'bi') {
                const proxyReady = await this._ensureBiProxy();
                if (!proxyReady) {
                    if (!options.silent) this.open('bi');
                    return { ok: false, system: 'bi', code: 'PROXY_UNAVAILABLE', message: 'BI代理未就绪。', detail: {} };
                }
            }

            const auth = await this.ensureAuthModule();
            const timeout = Number.isFinite(Number(options.timeout)) ? Number(options.timeout) : 10000;
            const recovered = await Promise.race([
                auth.recoverSystems(this, [normalized], { allowShared: true }),
                new Promise(resolve => setTimeout(() => resolve(null), timeout))
            ]);
            const result = recovered?.results?.[normalized];
            const local = result?.local || null;
            const credentials = normalized === 'bi'
                ? (local?.credentials || (local?.token ? { token: local.token, tokenSig: local.tokenSig || '', exp: local.exp || 0 } : null))
                : (local?.credentials || null);

            if (result?.source && credentials) {
                return {
                    ok: true,
                    system: normalized,
                    source: result.source,
                    credentials,
                    local,
                    provider: recovered?.context?.provider || {
                        provider_id: local?.provider_id || '',
                        provider_name: local?.provider_name || ''
                    },
                    meta: { checkedAt: Date.now(), verifiedAt: Date.now() }
                };
            }

            if (!options.silent) this.open(normalized);
            return {
                ok: false,
                system: normalized,
                code: 'NO_LOGIN',
                message: normalized === 'scm'
                    ? '请先登录SCM账户。'
                    : normalized === 'pms'
                        ? '请先登录PMS账户。'
                        : '请先完成BI登录。',
                detail: { provider: recovered?.context?.provider || null }
            };
        } catch (error) {
            if (!options.silent) this.open(normalized);
            return {
                ok: false,
                system: normalized,
                code: normalized === 'bi' && /token/i.test(String(error?.message || '')) ? 'TOKEN_EXPIRED' : 'NETWORK_ERROR',
                message: error?.message || '凭证获取失败。',
                detail: { error: String(error?.message || error || '') }
            };
        }
    },

    getDisplayUsername() {
        if (this.session.logged_in && this.session.username) {
            return this.session.username;
        }
        return null;
    }
};

// 导出模块
window.LoginModule = LoginModule;

// DOM 就绪后初始化，避免等待非登录业务和外部资源加载完成。
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        LoginModule.init();
    }, { once: true });
} else {
    LoginModule.init();
}
