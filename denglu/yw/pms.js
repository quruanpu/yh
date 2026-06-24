// PMS系统登录业务逻辑
const PmsLoginModule = {
    // 配置
    config: {
        apiBase: 'https://1317825751-g3ghjxcbeh.ap-guangzhou.tencentscf.com',
        pollInterval: 1000, // 轮询间隔1秒
        qrcodeTimeout: 300000 // 二维码超时5分钟
    },

    // 状态
    state: {
        currentStep: 'init', // init -> qrcode -> polling -> success
        webKey: null,
        lastStatus: 'QRCODE_SCAN_NEVER',
        openDataSid: null,
        pollingTimer: null,
        qrcodeTimer: null,
        authCode: null,
        credentials: null,
        userInfo: null,
        permissions: null
    },

    // 初始化
    init() {
        this.resetState();
    },

    // 重置状态
    resetState() {
        this.state = {
            currentStep: 'init',
            webKey: null,
            lastStatus: 'QRCODE_SCAN_NEVER',
            openDataSid: null,
            pollingTimer: null,
            qrcodeTimer: null,
            authCode: null,
            credentials: null,
            userInfo: null,
            permissions: null
        };
    },

    // API请求封装
    async apiRequest(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = `${this.config.apiBase}?${queryString}`;

        try {
            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error('API请求失败:', error);
            throw error;
        }
    },

    // 获取二维码
    async getQrcode() {
        try {
            const data = await this.apiRequest({ action: 'get_qrcode' });
            if (data.code !== '40001') {
                throw new Error(data.message || '获取二维码失败');
            }
            return data;
        } catch (error) {
            throw new Error(`获取二维码失败: ${error.message}`);
        }
    },

    // 查询扫码状态
    async checkStatus(webKey, lastStatus, openDataSid) {
        const params = {
            action: 'check_status',
            web_key: webKey
        };

        if (lastStatus) params.last_status = lastStatus;
        if (openDataSid) params.open_data_sid = openDataSid;

        try {
            const data = await this.apiRequest(params);
            if (data.code !== '40001') {
                throw new Error(data.message || '查询状态失败');
            }
            return data;
        } catch (error) {
            throw new Error(`查询状态失败: ${error.message}`);
        }
    },

    // 完成登录
    async login(authCode) {
        try {
            const data = await this.apiRequest({ action: 'login', auth_code: authCode });
            if (data.code !== '40001') {
                throw new Error(data.message || '登录失败');
            }
            return data;
        } catch (error) {
            throw new Error(`登录失败: ${error.message}`);
        }
    },

    // 开始登录流程
    async startLogin() {
        try {
            // 1. 获取二维码
            this.state.currentStep = 'qrcode';
            const qrcodeResult = await this.getQrcode();
            this.state.webKey = qrcodeResult.data.web_key;

            // 设置二维码超时定时器
            this.state.qrcodeTimer = setTimeout(() => {
                if (this.state.currentStep === 'qrcode' || this.state.currentStep === 'polling') {
                    this.stopPolling();
                    throw new Error('二维码已过期，请重新获取');
                }
            }, this.config.qrcodeTimeout);

            return {
                step: 'qrcode',
                qrcodeUrl: qrcodeResult.data.qrcode_url,
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
                    const statusResult = await this.checkStatus(
                        this.state.webKey,
                        this.state.lastStatus,
                        this.state.openDataSid
                    );

                    const statusData = statusResult.data;
                    this.state.lastStatus = statusData.status;
                    if (statusData.open_data_sid) {
                        this.state.openDataSid = statusData.open_data_sid;
                    }

                    switch (statusData.status) {
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
                            this.state.authCode = statusData.auth_code;
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

    // 从PMS登录返回中解析供应商信息
    resolveProviderInfo(loginData = {}) {
        const credentials = loginData.credentials || {};
        const permissions = loginData.permissions || {};
        const userInfo = loginData.user || loginData.user_info || loginData.userInfo || {};
        const pickText = (...values) => {
            for (const value of values) {
                const text = String(value ?? '').trim();
                if (text) return text;
            }
            return '';
        };
        const lists = [
            ...(Array.isArray(permissions.sub_providers) ? permissions.sub_providers : []),
            ...(Array.isArray(permissions.providers) ? permissions.providers : [])
        ];
        const providerId = pickText(
            loginData.provider_id,
            loginData.providerId,
            credentials.providerId,
            credentials.provider_id,
            userInfo.providerId,
            userInfo.provider_id,
            userInfo.supplierId,
            userInfo.supplier_id,
            lists[0]?.id,
            lists[0]?.provider_id,
            lists[0]?.providerId
        );
        const matched = providerId
            ? lists.find(item => pickText(item?.id, item?.provider_id, item?.providerId, item?.supplierId, item?.supplier_id) === providerId)
            : null;
        const first = matched || lists[0] || {};
        const providerName = pickText(
            loginData.provider_name,
            loginData.providerName,
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
            first.name,
            first.provider_name,
            first.providerName,
            first.supplierName,
            first.supplier_name,
            first.companyName,
            first.company_name
        );
        return { providerId, providerName };
    },

    // 完成登录流程
    async finalizeLogin() {
        try {
            // 1. 完成登录
            const loginResult = await this.login(this.state.authCode);
            const loginData = loginResult.data;
            const providerInfo = this.resolveProviderInfo(loginData);

            // 2. 保存状态
            this.state.credentials = loginData.credentials || {};
            if (providerInfo.providerId) this.state.credentials.providerId = providerInfo.providerId;
            if (providerInfo.providerName) this.state.credentials.providerName = providerInfo.providerName;
            this.state.userInfo = loginData.user;
            this.state.permissions = loginData.permissions;
            this.state.currentStep = 'success';

            return {
                success: true,
                credentials: this.state.credentials,
                userInfo: this.state.userInfo,
                permissions: this.state.permissions,
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
    }
};

// 导出模块
window.PmsLoginModule = PmsLoginModule;
