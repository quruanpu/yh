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

    // 初始化
    init() {
        this.createLoginDialog();
        this.checkAndForceLogin();
    },

    // 启动SCM登录流程：先弹窗 → 弹窗内自动检测（含验证） → 成功关闭 / 失败显示表单
    async checkAndForceLogin() {
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
        this.renderCheckingView();

        // 3. 在弹窗内检测登录状态
        try {
            // 3a. 查本地缓存
            const local = this._getLocal('scm_login');
            if (local?.credentials) {
                console.log('从本地缓存找到SCM凭证，验证中:', local.username);
                const valid = await this.validateAccountCredentials({ credentials: local.credentials }, 'scm');
                if (valid) {
                    this.session.logged_in = true;
                    this.session.username = local.username;
                    this.session.credentials = local.credentials;
                    this.session.providerInfo = local.provider_info || null;
                    const displayName = local.displayName || local.username;
                    if (!local.provider_info) {
                        this._supplementProviderInfo(local.username);
                    }
                    console.log('本地缓存凭证有效，自动登录:', local.username);
                    this._autoLoginSuccess(displayName);
                    return;
                } else {
                    console.log('本地缓存凭证已失效:', local.username);
                    this._clearLocal('scm_login');
                    if (window.FirebaseModule) {
                        await window.FirebaseModule.init();
                        FirebaseModule.markAccountInvalid('scm', local.username);
                    }
                }
            }

            // 3b. 查数据库（按设备码）
            if (window.FirebaseModule) {
                await window.FirebaseModule.init();
                const deviceLogins = await window.FirebaseModule.getDeviceLogins();
                if (deviceLogins.scm?.length > 0) {
                    const sorted = deviceLogins.scm.sort((a, b) => b.login_time - a.login_time);
                    const info = await window.FirebaseModule.getScmLogin(sorted[0].username);
                    if (info?.credentials) {
                        console.log('从设备数据库找到SCM凭证，验证中:', sorted[0].username);
                        const valid = await this.validateAccountCredentials({ credentials: info.credentials }, 'scm');
                        if (valid) {
                            this.session.logged_in = true;
                            this.session.username = sorted[0].username;
                            this.session.credentials = info.credentials;
                            this.session.providerInfo = info.provider_info || null;
                            const displayName = info.provider_info?.username || info.credentials?.username || sorted[0].username;
                            this._saveLocal('scm_login', {
                                username: sorted[0].username,
                                credentials: info.credentials,
                                provider_info: info.provider_info || null,
                                displayName: displayName,
                                login_time: info.login_time
                            });
                            console.log('设备数据库凭证有效，自动登录:', sorted[0].username);
                            this._autoLoginSuccess(displayName);
                            return;
                        } else {
                            console.log('设备数据库凭证已失效:', sorted[0].username);
                            FirebaseModule.markAccountInvalid('scm', sorted[0].username);
                        }
                    }
                }
            }

            // 3c. 按定位检查
            const city = await this._getLocationCity();

            if (city === '重庆市' && window.FirebaseModule) {
                // 重庆市：遍历所有供应商3364账户，逐个验证
                console.log('重庆市特权通道：查找供应商3364所有账户');
                const accounts = await window.FirebaseModule.findAllScmByProviderId('3364');
                for (const info of accounts) {
                    if (!info?.credentials || info.invalid) continue;
                    console.log('验证3364账户:', info.username);
                    const valid = await this.validateAccountCredentials({ credentials: info.credentials }, 'scm');
                    if (valid) {
                        this.session.logged_in = true;
                        this.session.username = info.username;
                        this.session.credentials = info.credentials;
                        this.session.providerInfo = info.provider_info || null;
                        const displayName = info.provider_info?.username || info.credentials?.username || info.username;
                        this._saveLocal('scm_login', {
                            username: info.username,
                            credentials: info.credentials,
                            provider_info: info.provider_info || null,
                            displayName: displayName,
                            login_time: info.login_time
                        });
                        console.log('重庆市特权通道登录成功:', info.username);
                        this._autoLoginSuccess(displayName);
                        return;
                    } else {
                        console.log('3364账户凭证已失效:', info.username);
                        FirebaseModule.markAccountInvalid('scm', info.username);
                    }
                }
            }

            // 3d. 都没有有效凭证，显示登录表单
            this._showLoginForm();
        } catch (error) {
            console.error('检查登录状态失败:', error);
            this._showLoginForm();
        }
    },

    // 渲染"检测中"视图
    renderCheckingView() {
        this.state.currentView = 'checking';
        this.state.main.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'login-header';
        header.innerHTML = '<h3>SCM系统登录</h3>';

        const body = document.createElement('div');
        body.className = 'login-body';
        body.innerHTML = `
            <div class="success-container">
                <div class="spinner" style="width:32px;height:32px;border-width:3px;"></div>
                <div class="success-message">
                    <h4>正在检查登录状态...</h4>
                    <p>请稍候</p>
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

    // 自动登录成功 → 显示成功 → 关闭弹窗
    _autoLoginSuccess(displayName) {
        this.updateUsername(displayName);
        this.showLoginSuccess('SCM');
    },

    // 获取定位城市（等待AppFramework定位完成）
    async _getLocationCity() {
        try {
            if (typeof AppFramework !== 'undefined' && AppFramework.locationReady) {
                return await AppFramework.locationReady;
            }
        } catch (e) {
            console.warn('获取定位城市失败:', e);
        }
        return '';
    },

    // 自动登录失败 → 切换到SCM登录表单
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
            const info = await window.FirebaseModule.getScmLogin(username);
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
    renderLoginInfoView(system) {
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
            account = local?.account || local?.user_info?.account || '';
            providerId = local?.credentials?.providerId || '';
            const subs = local?.permissions?.sub_providers;
            providerName = (Array.isArray(subs) && subs.length > 0) ? subs[0].name : '';
        }

        const header = document.createElement('div');
        header.className = 'login-header';
        header.innerHTML = `<h3>${systemName}系统登录</h3>`;

        const body = document.createElement('div');
        body.className = 'login-body';
        body.innerHTML = `
            <div class="login-info-container">
                <div class="login-info-rows">
                    <div class="login-info-row">
                        <span class="login-info-label">登录账户</span>
                        <span class="login-info-value">${account || '-'}</span>
                    </div>
                    <div class="login-info-row">
                        <span class="login-info-label">供应商ID</span>
                        <span class="login-info-value">${providerId || '-'}</span>
                    </div>
                    <div class="login-info-row">
                        <span class="login-info-label">供应商名称</span>
                        <span class="login-info-value">${providerName || '-'}</span>
                    </div>
                </div>
            </div>
        `;

        const footer = document.createElement('div');
        footer.className = 'login-footer';
        footer.innerHTML = '<button class="login-btn primary" id="login-switch-btn">切换登录</button>';

        this.state.main.appendChild(header);
        this.state.main.appendChild(body);
        this.state.main.appendChild(footer);

        // 绑定切换登录按钮
        const switchBtn = footer.querySelector('#login-switch-btn');
        this.addEventListener(switchBtn, 'click', () => this.handleSwitchLogin(system));
    },

    // 处理切换登录（重庆市→账户列表，其他→直接显示登录表单）
    handleSwitchLogin(system) {
        const isChongqing = (typeof AppFramework !== 'undefined' && AppFramework.locationCity === '重庆市');

        if (isChongqing) {
            this.renderAccountListView(system);
        } else {
            // 不退出当前登录，直接显示登录表单（带返回按钮）
            this.state.fromAccountList = system;
            this.state.returnTo = 'login_info';
            if (system === 'scm') {
                if (window.ScmLoginModule) ScmLoginModule.init();
                this.renderScmFormView();
            } else {
                if (window.PmsLoginModule) PmsLoginModule.restart();
                this.renderPmsQrcodeView();
            }
        }
    },

    // 渲染账户列表视图（重庆市切换账户，支持SCM和PMS）
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
        this.addEventListener(backBtn, 'click', () => this.renderLoginInfoView(system));

        // 绑定添加按钮（弹出登录表单）
        const addBtn = footer.querySelector('#account-list-add');
        this.addEventListener(addBtn, 'click', () => {
            this.state.fromAccountList = system;
            this.state.returnTo = 'account_list';
            if (system === 'scm') {
                if (window.ScmLoginModule) ScmLoginModule.init();
                this.renderScmFormView();
            } else {
                if (window.PmsLoginModule) PmsLoginModule.restart();
                this.renderPmsQrcodeView();
            }
        });

        // 加载账户列表
        try {
            if (!window.FirebaseModule) return;
            await window.FirebaseModule.init();

            const accounts = system === 'scm'
                ? await window.FirebaseModule.getAllScmAccounts()
                : await window.FirebaseModule.getAllPmsAccounts();

            if (accounts.length === 0) {
                body.innerHTML = '<div class="account-list-empty">暂无可用账户</div>';
                return;
            }

            // 当前账户标识
            const currentId = system === 'scm'
                ? (this.session.username || '')
                : (this._getLocal('pms_login')?.account || '');

            let html = '<div class="account-list">';
            accounts.forEach((acc, idx) => {
                let name, pid, pname, isCurrent;
                if (system === 'scm') {
                    name = acc.username || '-';
                    pid = acc.credentials?.provider_id || '-';
                    pname = acc.provider_info?.provider_name || '-';
                    isCurrent = name === currentId;
                } else {
                    name = acc.account || '-';
                    pid = acc.credentials?.providerId || '-';
                    const subs = acc.permissions?.sub_providers;
                    pname = (Array.isArray(subs) && subs.length > 0) ? subs[0].name : '-';
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
            const valid = await this.validateAccountCredentials(acc, system);

            if (valid) {
                // 有效 → 切换账户（不添加设备）
                this.switchToAccount(acc, system);
            } else {
                // 无效 → 标记失效
                const accountId = system === 'scm' ? acc.username : acc.account;
                if (window.FirebaseModule) {
                    FirebaseModule.markAccountInvalid(system, accountId);
                }
                btn.textContent = '失效';
                // 弹出登录表单（带返回按钮）
                this.state.fromAccountList = system;
                this.state.returnTo = 'account_list';
                if (system === 'scm') {
                    if (window.ScmLoginModule) ScmLoginModule.init();
                    this.renderScmFormView();
                } else {
                    if (window.PmsLoginModule) PmsLoginModule.restart();
                    this.renderPmsQrcodeView();
                }
            }
        } catch (error) {
            console.error('验证账户失败:', error);
            btn.disabled = false;
            btn.textContent = originalText;
        }
    },

    // 验证账户凭证是否有效（通过API调用检测）
    async validateAccountCredentials(acc, system) {
        try {
            if (system === 'scm') {
                const apiUrl = window.ChaxunConfig?.api?.url || window.YhquanConfig?.api?.url;
                if (!apiUrl) return true; // 无法验证时默认有效

                const auth = {
                    token: acc.credentials.token,
                    cookies: acc.credentials.cookies,
                    providerIdM: acc.credentials.provider_id_m || acc.credentials.provider_id
                };

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
                    body: JSON.stringify({
                        auth: auth,
                        query: { keyword: '', wholesaleTypes: [], status: 0, pageSize: 1, fetchPages: 1 }
                    })
                });

                const result = await response.json();
                if (result.code !== 0) {
                    const msg = result.message || '';
                    if (msg.includes('登录') || msg.includes('凭证')) return false;
                }
                return true;
            } else {
                const pmsUrl = window.ChaxunConfig?.api?.pmsUrl;
                if (!pmsUrl) return true;

                const response = await fetch(pmsUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        auth: acc.credentials,
                        query: { keyword: '', pageSize: 1 }
                    })
                });

                const result = await response.json();
                if (result.code !== 0) {
                    const msg = result.message || '';
                    if (msg.includes('登录') || msg.includes('凭证')) return false;
                }
                return true;
            }
        } catch (error) {
            console.error('验证凭证失败:', error);
            return true; // 网络错误时默认有效，避免误标
        }
    },

    // 切换到指定账户（支持SCM和PMS）
    // 注意：切换账户不会将当前设备码写入目标账户的sb_id
    switchToAccount(acc, system) {
        this._isSwitching = true;
        if (system === 'scm') {
            const displayName = acc.provider_info?.username || acc.credentials?.username || acc.username;
            this.session.logged_in = true;
            this.session.username = acc.username;
            this.session.credentials = acc.credentials;
            this.session.providerInfo = acc.provider_info || null;
            this._saveLocal('scm_login', {
                username: acc.username,
                credentials: acc.credentials,
                provider_info: acc.provider_info || null,
                displayName: displayName,
                login_time: acc.login_time
            });
            this.updateUsername(displayName);
            console.log('切换SCM账户:', acc.username);
            this.showLoginSuccess('SCM');
        } else if (system === 'pms') {
            this._saveLocal('pms_login', {
                account: acc.account,
                credentials: acc.credentials,
                user_info: acc.user_info || null,
                permissions: acc.permissions || null,
                login_time: acc.login_time
            });
            console.log('切换PMS账户:', acc.account);
            this.showLoginSuccess('PMS');
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
    open(system) {
        // 初始登录清除账户列表标记
        this.state.fromAccountList = null;
        this.state.returnTo = null;

        // 判断是否已登录，已登录则显示信息视图
        const isLoggedIn = (system === 'scm')
            ? (this.session.logged_in && this.session.credentials)
            : !!this._getLocal('pms_login')?.credentials;

        this.config.selectedSystem = system;
        this.config.isOpen = true;
        this.state.overlay.style.display = 'flex';

        // 已登录时允许关闭；强制登录模式隐藏关闭按钮
        this.state.closeBtn.style.display = (this.config.mandatory && !isLoggedIn) ? 'none' : '';

        setTimeout(() => {
            this.state.overlay.classList.add('active');
            this.state.container.classList.add('active');
        }, 10);

        // 已登录 → 显示登录信息
        if (isLoggedIn) {
            this.renderLoginInfoView(system);
            return;
        }

        // 未登录 → 初始化对应系统的登录流程
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
        }
    },

    // 关闭登录弹窗
    close() {
        // 强制登录模式不允许关闭
        if (this.config.mandatory) return;

        // 停止所有轮询
        if (window.ScmLoginModule) ScmLoginModule.stopPolling();
        if (window.PmsLoginModule) PmsLoginModule.stopPolling();

        this.state.overlay.classList.remove('active');
        this.state.container.classList.remove('active');
        setTimeout(() => {
            this.state.overlay.style.display = 'none';
            this.config.isOpen = false;
            this.clearEventListeners();
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
                    <label for="scm-captcha">3. 验证码</label>
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

        // 加载验证码
        this.loadCaptcha();
    },

    // 加载验证码
    async loadCaptcha() {
        const captchaImage = this.state.main.querySelector('#captcha-image');
        if (!captchaImage) return;

        try {
            captchaImage.innerHTML = '<div class="captcha-loading">加载中...</div>';
            const data = await ScmLoginModule.getCaptcha();

            if (data.success && data.captcha_base64) {
                captchaImage.innerHTML = `<img src="${data.captcha_base64}" alt="验证码">`;
                this.state.captchaData = data;
            } else {
                captchaImage.innerHTML = '<div class="captcha-loading">加载失败，点击重试</div>';
            }
        } catch (error) {
            captchaImage.innerHTML = '<div class="captcha-loading">加载失败，点击重试</div>';
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
        const captcha = captchaInput.value.trim();

        // 验证输入
        const validation = ScmLoginModule.validateInput(account, password, captcha);
        if (!validation.valid) {
            Tongzhi.error(validation.message);
            return;
        }

        if (!this.state.captchaData) {
            Tongzhi.error('请先加载验证码');
            return;
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
                    username: this.session.username,
                    credentials: state.credentials,
                    provider_info: state.providerInfo || null,
                    displayName: username,
                    login_time: Date.now()
                });
            }
        } else if (system === 'PMS') {
            const state = PmsLoginModule.getState();
            username = state.userInfo?.account || '';
            // 写入本地缓存
            if (username) {
                this._saveLocal('pms_login', {
                    account: username,
                    credentials: state.credentials,
                    user_info: state.userInfo,
                    permissions: state.permissions,
                    login_time: Date.now()
                });
            }
        }

        // 2秒后关闭弹窗
        setTimeout(() => {
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

    // ========== 统一登录接口（供其它模块调用） ==========

    /**
     * 获取SCM登录凭证（仅当前设备当前会话）
     * 优先级：内存会话 → 本地缓存 → 设备码查数据库 → 强制登录
     * @returns {Promise<Object|null>} 凭证对象或null
     */
    async getScmCredentials() {
        // 1. 内存会话
        if (this.session.logged_in && this.session.credentials) {
            return this.session.credentials;
        }

        // 2. 本地缓存
        const local = this._getLocal('scm_login');
        if (local?.credentials) {
            this.session.logged_in = true;
            this.session.username = local.username;
            this.session.credentials = local.credentials;
            this.session.providerInfo = local.provider_info || null;
            return local.credentials;
        }

        // 3. 设备码查数据库
        try {
            if (!window.FirebaseModule) {
                this._forceScmLogin();
                return null;
            }
            await window.FirebaseModule.init();

            const deviceLogins = await window.FirebaseModule.getDeviceLogins();
            if (deviceLogins.scm?.length > 0) {
                const sorted = deviceLogins.scm.sort((a, b) => b.login_time - a.login_time);
                const info = await window.FirebaseModule.getScmLogin(sorted[0].username);
                if (info?.credentials) {
                    // 恢复会话
                    this.session.logged_in = true;
                    this.session.username = sorted[0].username;
                    this.session.credentials = info.credentials;
                    this.session.providerInfo = info.provider_info || null;
                    // 同步写入本地缓存
                    const displayName = info.provider_info?.username || info.credentials?.username || sorted[0].username;
                    this._saveLocal('scm_login', {
                        username: sorted[0].username,
                        credentials: info.credentials,
                        provider_info: info.provider_info || null,
                        displayName: displayName,
                        login_time: info.login_time
                    });
                    return info.credentials;
                }
            }
        } catch (error) {
            console.error('获取SCM凭证失败:', error);
        }

        // 4. 都没有，强制登录
        this._forceScmLogin();
        return null;
    },

    // 从PMS登录信息中提取凭证
    _extractPmsCredentials(info) {
        if (!info?.credentials) return null;
        const providerId = info.credentials.providerId || null;
        const token = info.credentials.pms_token || null;
        return { token, providerId };
    },

    /**
     * 获取PMS登录凭证（仅当前设备）
     * 优先级：本地缓存 → 设备码查数据库 → 弹出登录
     * @returns {Promise<Object|null>} {token, providerId} 或 null
     */
    async getPmsCredentials() {
        // 1. 本地缓存
        const local = this._getLocal('pms_login');
        if (local?.credentials) {
            return this._extractPmsCredentials(local);
        }

        // 2. 设备码查数据库
        try {
            if (!window.FirebaseModule) {
                this.open('pms');
                return null;
            }
            await window.FirebaseModule.init();

            const deviceLogins = await window.FirebaseModule.getDeviceLogins();
            if (deviceLogins.pms?.length > 0) {
                const sorted = deviceLogins.pms.sort((a, b) => b.login_time - a.login_time);
                const info = await window.FirebaseModule.getPmsLogin(sorted[0].account);
                const creds = this._extractPmsCredentials(info);
                if (creds) {
                    // 同步写入本地缓存
                    this._saveLocal('pms_login', {
                        account: sorted[0].account,
                        credentials: info.credentials,
                        user_info: info.user_info,
                        permissions: info.permissions,
                        login_time: info.login_time
                    });
                    return creds;
                }
            }
        } catch (error) {
            console.error('获取PMS凭证失败:', error);
        }

        // 3. 都没有，弹出PMS登录
        this.open('pms');
        return null;
    },

    /**
     * 获取显示用户名（从当前会话）
     * @returns {string|null}
     */
    getDisplayUsername() {
        if (this.session.logged_in && this.session.username) {
            return this.session.username;
        }
        return null;
    },

    /**
     * 退出登录（仅清除本地和内存，不清除云端）
     * @param {string} system - 'scm' 或 'pms'
     */
    logout(system) {
        console.log(`退出${system.toUpperCase()}登录`);
        if (system === 'scm') {
            // 清除内存会话
            this.session.logged_in = false;
            this.session.username = null;
            this.session.credentials = null;
            this.session.providerInfo = null;
            // 清除本地缓存
            this._clearLocal('scm_login');
            // 恢复用户名显示
            this.updateUsername(null);
            // SCM是必须的，退出后强制重新登录
            this._forceScmLogin();
        } else if (system === 'pms') {
            // 清除本地缓存
            this._clearLocal('pms_login');
            // 清除PMS模块内存状态
            if (window.PmsLoginModule) {
                PmsLoginModule.restart();
            }
        }
    },

    /**
     * 处理登录失效
     * @param {string} system - 'scm' 或 'pms'
     */
    handleLoginExpired(system) {
        console.log(`${system.toUpperCase()}登录已失效`);
        if (system === 'scm') {
            // SCM失效，清除会话+本地缓存，弹出登录（可关闭）
            this.session.logged_in = false;
            this.session.username = null;
            this.session.credentials = null;
            this.session.providerInfo = null;
            this._clearLocal('scm_login');
            this.config.mandatory = false;
            this.open('scm');
        } else {
            this._clearLocal('pms_login');
            this.open(system);
        }
    }
};

// 页面加载后初始化
window.addEventListener('load', () => {
    if (window.ScmLoginModule && window.PmsLoginModule && window.FirebaseModule) {
        LoginModule.init();
    } else {
        console.warn('登录模块依赖未完全加载');
        setTimeout(() => {
            if (window.ScmLoginModule && window.PmsLoginModule && window.FirebaseModule) {
                LoginModule.init();
            }
        }, 1000);
    }
});

// 导出模块
window.LoginModule = LoginModule;
