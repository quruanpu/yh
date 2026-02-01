// 登录功能统筹模块
const LoginModule = {
    // 配置
    config: {
        selectedSystem: null, // scm 或 pms
        isOpen: false
    },

    // 状态
    state: {
        container: null,
        overlay: null,
        main: null,
        currentView: null, // scm_form, scm_qrcode, pms_qrcode, success
        captchaData: null,
        eventListeners: []
    },

    // 初始化
    init() {
        this.createLoginDialog();
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
    },

    // 打开登录弹窗
    open(system) {
        this.config.selectedSystem = system;
        this.config.isOpen = true;
        this.state.overlay.style.display = 'flex';

        setTimeout(() => {
            this.state.overlay.classList.add('active');
            this.state.container.classList.add('active');
        }, 10);

        // 初始化对应系统的登录流程
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
        footer.innerHTML = '<button id="scm-next" class="login-btn primary">下一步</button>';

        this.state.main.appendChild(header);
        this.state.main.appendChild(body);
        this.state.main.appendChild(footer);

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
            this.showMessage(validation.message, 'error');
            return;
        }

        if (!this.state.captchaData) {
            this.showMessage('请先加载验证码', 'error');
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
            this.showMessage(error.message, 'error');
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
            this.showMessage(error.message, 'error');
            qrcodeImg.style.opacity = '1';
            loginBtn.disabled = false;
            loginBtn.textContent = '重试';
        }
    },

    // 开始SCM轮询
    async startScmPolling() {
        const qrcodeOverlay = this.state.main.querySelector('#qrcode-overlay');
        const loginBtn = this.state.main.querySelector('#scm-login');

        if (!qrcodeOverlay || !loginBtn) return;

        // 启动轮询（不等待，让它在后台运行）
        ScmLoginModule.startPolling().then(() => {
            // 轮询成功完成，显示登录成功
            this.showLoginSuccess('SCM');
        }).catch((error) => {
            // 轮询失败
            qrcodeOverlay.style.display = 'none';
            loginBtn.disabled = false;
            loginBtn.textContent = '重试';
            console.error('SCM轮询失败:', error);
        });

        // UI状态检查循环
        const checkStatus = () => {
            const state = ScmLoginModule.getState();
            console.log('SCM状态检查:', state.currentStep, state.lastStatus);

            if (state.currentStep === 'polling') {
                if (state.lastStatus === 'QRCODE_SCAN_ING') {
                    // 扫码成功，显示遮罩和绿勾
                    console.log('SCM: 显示扫码成功遮罩');
                    qrcodeOverlay.style.display = 'flex';
                    loginBtn.disabled = true;
                    loginBtn.textContent = '扫码成功，请确认...';
                } else if (state.lastStatus === 'QRCODE_SCAN_SUCC') {
                    // 确认成功，正在登录
                    console.log('SCM: 确认成功，正在登录');
                    qrcodeOverlay.style.display = 'flex';
                    loginBtn.disabled = true;
                    loginBtn.textContent = '登录中...';
                } else {
                    // 等待扫码
                    qrcodeOverlay.style.display = 'none';
                    loginBtn.disabled = true;
                    loginBtn.textContent = '等待扫码...';
                }
                setTimeout(checkStatus, 300);
            } else if (state.currentStep === 'success') {
                // 登录成功，保持登录中状态
                console.log('SCM: 登录流程完成');
                qrcodeOverlay.style.display = 'flex';
                loginBtn.disabled = true;
                loginBtn.textContent = '登录中...';
            }
        };

        checkStatus();
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
        footer.innerHTML = '<button id="pms-login" class="login-btn primary">登录</button>';

        this.state.main.appendChild(header);
        this.state.main.appendChild(body);
        this.state.main.appendChild(footer);

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
    async startPmsPolling() {
        const qrcodeOverlay = this.state.main.querySelector('#pms-qrcode-overlay');
        const loginBtn = this.state.main.querySelector('#pms-login');

        if (!qrcodeOverlay || !loginBtn) return;

        // 启动轮询（不等待，让它在后台运行）
        PmsLoginModule.startPolling().then(() => {
            // 轮询成功完成，显示登录成功
            this.showLoginSuccess('PMS');
        }).catch((error) => {
            // 轮询失败
            qrcodeOverlay.style.display = 'none';
            loginBtn.disabled = false;
            loginBtn.textContent = '重试';
            console.error('PMS轮询失败:', error);
        });

        // UI状态检查循环
        const checkStatus = () => {
            const state = PmsLoginModule.getState();
            console.log('PMS状态检查:', state.currentStep, state.lastStatus);

            if (state.currentStep === 'polling') {
                if (state.lastStatus === 'QRCODE_SCAN_ING') {
                    // 扫码成功，显示遮罩和绿勾
                    console.log('PMS: 显示扫码成功遮罩');
                    qrcodeOverlay.style.display = 'flex';
                    loginBtn.disabled = true;
                    loginBtn.textContent = '扫码成功，请确认...';
                } else if (state.lastStatus === 'QRCODE_SCAN_SUCC') {
                    // 确认成功，正在登录
                    console.log('PMS: 确认成功，正在登录');
                    qrcodeOverlay.style.display = 'flex';
                    loginBtn.disabled = true;
                    loginBtn.textContent = '登录中...';
                } else {
                    // 等待扫码
                    qrcodeOverlay.style.display = 'none';
                    loginBtn.disabled = true;
                    loginBtn.textContent = '等待扫码...';
                }
                setTimeout(checkStatus, 300);
            } else if (state.currentStep === 'success') {
                // 登录成功，保持登录中状态
                console.log('PMS: 登录流程完成');
                qrcodeOverlay.style.display = 'flex';
                loginBtn.disabled = true;
                loginBtn.textContent = '登录中...';
            }
        };

        checkStatus();
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

        // 获取用户名
        let username = '';
        if (system === 'PMS') {
            const state = PmsLoginModule.getState();
            username = state.userInfo?.account || '';
        } else if (system === 'SCM') {
            const state = ScmLoginModule.getState();
            console.log('SCM登录状态:', state);
            console.log('providerInfo:', state.providerInfo);
            console.log('credentials:', state.credentials);
            username = state.providerInfo?.username || state.credentials?.username || state.account || '';
            console.log('提取的用户名:', username);
        }

        // 2秒后关闭弹窗
        setTimeout(() => {
            this.close();

            // 更新导航栏用户名
            if (username) {
                this.updateUsername(username);
            }

            // 触发登录成功事件
            const event = new CustomEvent('loginSuccess', {
                detail: { system, username }
            });
            document.dispatchEvent(event);

        }, 2000);
    },

    // 显示消息
    showMessage(message, type = 'info') {
        const existingMsg = this.state.main.querySelector('.login-message');
        if (existingMsg) existingMsg.remove();

        const msgDiv = document.createElement('div');
        msgDiv.className = `login-message ${type}`;
        msgDiv.textContent = message;

        const body = this.state.main.querySelector('.login-body');
        if (body) {
            this.state.main.insertBefore(msgDiv, body);
        } else {
            this.state.main.appendChild(msgDiv);
        }

        setTimeout(() => {
            if (msgDiv.parentNode) {
                msgDiv.remove();
            }
        }, 3000);
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
