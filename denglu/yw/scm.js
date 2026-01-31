// SCM系统登录业务逻辑
const ScmLoginModule = {
    // 配置
    config: {
        apiBase: 'https://1317825751-7n6chwizun.ap-guangzhou.tencentscf.com',
        pollInterval: 1000, // 轮询间隔1秒
        qrcodeTimeout: 300000 // 二维码超时5分钟
    },

    // 状态
    state: {
        currentStep: 'init', // init -> captcha -> verify -> qrcode -> polling -> success
        account: '',
        password: '',
        captcha: '',
        cookies: null,
        webKey: null,
        lastStatus: 'QRCODE_SCAN_NEVER',
        openDataSid: null,
        pollingTimer: null,
        qrcodeTimer: null,
        authCode: null,
        credentials: null,
        providerInfo: null
    },

    // 初始化
    init() {
        this.resetState();
    },

    // 重置状态
    resetState() {
        this.state = {
            currentStep: 'init',
            account: '',
            password: '',
            captcha: '',
            cookies: null,
            webKey: null,
            lastStatus: 'QRCODE_SCAN_NEVER',
            openDataSid: null,
            pollingTimer: null,
            qrcodeTimer: null,
            authCode: null,
            credentials: null,
            providerInfo: null
        };
    },

    // API请求封装
    async apiRequest(path, body = null) {
        const options = {
            method: body ? 'POST' : 'GET',
            headers: { 'Content-Type': 'application/json' }
        };
        if (body) options.body = JSON.stringify(body);

        try {
            const response = await fetch(`${this.config.apiBase}${path}`, options);
            return await response.json();
        } catch (error) {
            console.error(`API请求失败 ${path}:`, error);
            throw error;
        }
    },

    // 获取验证码
    async getCaptcha() {
        try {
            const data = await this.apiRequest('/captcha');
            if (!data.success) {
                throw new Error(data.message || '获取验证码失败');
            }
            return data;
        } catch (error) {
            throw new Error(`获取验证码失败: ${error.message}`);
        }
    },

    // 第一步：账号密码验证
    async verifyAccountPassword(account, password, captcha, cookies) {
        try {
            const data = await this.apiRequest('/login/step1', {
                account,
                password,
                captcha,
                cookies
            });

            if (!data.success) {
                throw new Error(data.info || '账号密码验证失败');
            }

            return data;
        } catch (error) {
            throw new Error(`账号密码验证失败: ${error.message}`);
        }
    },

    // 初始化二维码
    async initQrcode(account) {
        try {
            const data = await this.apiRequest('/qrcode/init', { account });
            if (!data.success) {
                throw new Error(data.message || '初始化二维码失败');
            }
            return data;
        } catch (error) {
            throw new Error(`初始化二维码失败: ${error.message}`);
        }
    },

    // 查询扫码状态
    async pollQrcodeStatus(webKey, lastStatus, openDataSid) {
        try {
            const data = await this.apiRequest('/qrcode/status', {
                web_key: webKey,
                last_status: lastStatus,
                open_data_sid: openDataSid
            });

            if (!data.success) {
                throw new Error(data.message || '查询扫码状态失败');
            }

            return data;
        } catch (error) {
            throw new Error(`查询扫码状态失败: ${error.message}`);
        }
    },

    // 第二步：完成登录
    async completeLogin(authCode, account, cookies) {
        try {
            const data = await this.apiRequest('/login/step2', {
                auth_code: authCode,
                account,
                cookies
            });

            if (!data.success) {
                throw new Error(data.info || '完成登录失败');
            }

            return data;
        } catch (error) {
            throw new Error(`完成登录失败: ${error.message}`);
        }
    },

    // 获取完整凭证
    async getFullCredentials(cookies) {
        try {
            const data = await this.apiRequest('/credentials/full', { cookies });
            if (!data.success) {
                throw new Error('获取完整凭证失败');
            }
            return data;
        } catch (error) {
            throw new Error(`获取完整凭证失败: ${error.message}`);
        }
    },

    // 开始登录流程
    async startLogin(account, password, captchaData) {
        try {
            // 1. 获取验证码
            this.state.currentStep = 'captcha';
            const captchaResult = captchaData || await this.getCaptcha();
            this.state.cookies = captchaResult.cookies;

            // 2. 账号密码验证
            this.state.currentStep = 'verify';
            const verifyResult = await this.verifyAccountPassword(
                account,
                password,
                captchaData ? captchaData.captcha : '',
                this.state.cookies
            );

            this.state.account = account;
            this.state.password = password;
            this.state.cookies = verifyResult.cookies;

            // 3. 初始化二维码
            this.state.currentStep = 'qrcode';
            const qrcodeResult = await this.initQrcode(account);
            this.state.webKey = qrcodeResult.web_key;

            // 设置二维码超时定时器
            this.state.qrcodeTimer = setTimeout(() => {
                if (this.state.currentStep === 'qrcode' || this.state.currentStep === 'polling') {
                    this.stopPolling();
                    throw new Error('二维码已过期，请重新获取');
                }
            }, this.config.qrcodeTimeout);

            return {
                step: 'qrcode',
                qrcodeUrl: qrcodeResult.qrcode_url,
                message: '请使用企业微信扫描二维码'
            };

        } catch (error) {
            this.resetState();
            throw error;
        }
    },

    // 开始轮询扫码状态
    async startPolling() {
        if (!this.state.webKey) {
            throw new Error('未初始化二维码');
        }

        this.state.currentStep = 'polling';

        return new Promise((resolve, reject) => {
            const poll = async () => {
                try {
                    const statusResult = await this.pollQrcodeStatus(
                        this.state.webKey,
                        this.state.lastStatus,
                        this.state.openDataSid
                    );

                    this.state.lastStatus = statusResult.status;
                    if (statusResult.open_data_sid) {
                        this.state.openDataSid = statusResult.open_data_sid;
                    }

                    switch (statusResult.status) {
                        case 'QRCODE_SCAN_NEVER':
                            // 继续轮询
                            this.state.pollingTimer = setTimeout(poll, this.config.pollInterval);
                            break;

                        case 'QRCODE_SCAN_ING':
                            // 已扫码，继续轮询
                            this.state.pollingTimer = setTimeout(poll, this.config.pollInterval);
                            break;

                        case 'QRCODE_SCAN_SUCC':
                            // 扫码成功，获取auth_code
                            this.state.authCode = statusResult.auth_code;
                            this.stopPolling();
                            await this.finalizeLogin();
                            resolve({
                                step: 'success',
                                message: '扫码成功，正在完成登录...'
                            });
                            break;

                        case 'QRCODE_SCAN_ERR':
                        case 'QRCODE_SCAN_TIMEOUT':
                        case 'QRCODE_SCAN_CANCEL':
                            // 扫码失败或取消
                            this.stopPolling();
                            reject(new Error('二维码已失效，请重新获取'));
                            break;

                        default:
                            // 未知状态，继续轮询
                            this.state.pollingTimer = setTimeout(poll, this.config.pollInterval);
                            break;
                    }
                } catch (error) {
                    this.stopPolling();
                    reject(error);
                }
            };

            // 开始第一次轮询
            poll();
        });
    },

    // 停止轮询
    stopPolling() {
        if (this.state.pollingTimer) {
            clearTimeout(this.state.pollingTimer);
            this.state.pollingTimer = null;
        }
        if (this.state.qrcodeTimer) {
            clearTimeout(this.state.qrcodeTimer);
            this.state.qrcodeTimer = null;
        }
    },

    // 完成登录流程
    async finalizeLogin() {
        try {
            // 1. 完成登录
            const loginResult = await this.completeLogin(
                this.state.authCode,
                this.state.account,
                this.state.cookies
            );

            // 2. 获取完整凭证
            const fullCreds = await this.getFullCredentials(loginResult.cookies);

            // 3. 保存状态
            this.state.credentials = fullCreds.credentials;
            this.state.providerInfo = fullCreds.provider_info;
            this.state.currentStep = 'success';

            // 4. 异步存储到数据库（不等待，后台执行）
            if (window.FirebaseModule) {
                FirebaseModule.saveScmLogin(
                    this.state.account,
                    this.state.credentials,
                    this.state.providerInfo
                ).catch(error => {
                    console.error('保存SCM登录信息失败:', error);
                });
            }

            return {
                success: true,
                credentials: this.state.credentials,
                providerInfo: this.state.providerInfo,
                message: '登录成功'
            };

        } catch (error) {
            this.resetState();
            throw error;
        }
    },

    // 获取当前状态
    getState() {
        return {
            ...this.state,
            currentStep: this.state.currentStep
        };
    },

    // 取消登录
    cancelLogin() {
        this.stopPolling();
        this.resetState();
    },

    // 重新开始
    restart() {
        this.stopPolling();
        this.resetState();
        this.state.currentStep = 'init';
    },

    // 验证输入
    validateInput(account, password, captcha) {
        if (!account || account.trim() === '') {
            return { valid: false, message: '请输入账号' };
        }
        if (!password || password.trim() === '') {
            return { valid: false, message: '请输入密码' };
        }
        if (!captcha || captcha.trim() === '') {
            return { valid: false, message: '请输入验证码' };
        }
        return { valid: true, message: '' };
    }
};

// 导出模块
window.ScmLoginModule = ScmLoginModule;