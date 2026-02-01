// 优惠券API模块 - 封装优惠券搜索接口
const YhquanAPIModule = {
    // 配置（从 YhquanConfig 读取）
    config: {
        get apiUrl() { return window.YhquanConfig?.api?.url || ''; },
        get timeout() { return window.YhquanConfig?.api?.timeout || 30000; },
        get pageSize() { return window.YhquanConfig?.pagination?.pageSize || 9999; }
    },

    // 状态
    state: {
        isSearching: false,
        lastSearchKeyword: '',
        credentials: null  // 缓存的完整credentials对象
    },

    /**
     * 获取登录凭证（智能策略）
     * 1. 优先使用当前设备的登录信息
     * 2. 如果当前设备登录失效，查找其他设备的有效登录
     * 3. 如果所有登录都失效，返回null
     */
    async getCredentials() {
        // 如果已缓存，直接返回
        if (this.state.credentials) {
            return this.state.credentials;
        }

        try {
            // 检查Firebase模块是否存在
            if (!window.FirebaseModule) {
                console.warn('Firebase模块未加载');
                return null;
            }

            // 初始化Firebase（确保设备ID已生成）
            await window.FirebaseModule.init();
            const currentDeviceId = window.FirebaseModule.state.deviceId;

            // 获取当前设备的登录信息
            const deviceLogins = await window.FirebaseModule.getDeviceLogins();

            // 策略1：优先使用当前设备的SCM登录信息
            if (deviceLogins.scm && deviceLogins.scm.length > 0) {
                const result = await this.tryGetValidCredentials('scm', deviceLogins.scm, currentDeviceId);
                if (result) return result;
            }

            // 策略2：如果SCM失效，尝试当前设备的PMS登录信息
            if (deviceLogins.pms && deviceLogins.pms.length > 0) {
                const result = await this.tryGetValidCredentials('pms', deviceLogins.pms, currentDeviceId);
                if (result) return result;
            }

            // 策略3：当前设备没有登录信息，尝试使用其他设备的登录信息
            console.log('当前设备没有登录信息，尝试使用其他设备的登录...');
            const allLoginsResult = await this.tryGetAllDevicesCredentials();
            if (allLoginsResult) return allLoginsResult;

            console.log('没有有效的登录信息');
            return null;
        } catch (error) {
            console.error('获取登录凭证失败:', error);
            return null;
        }
    },

    /**
     * 尝试获取有效的登录凭证
     * @param {string} system - 系统类型 'scm' 或 'pms'
     * @param {Array} logins - 登录信息列表
     * @param {string} currentDeviceId - 当前设备ID
     * @returns {Promise<Object|null>} 有效的credentials或null
     */
    async tryGetValidCredentials(system, logins, currentDeviceId) {
        // 按登录时间排序
        const sortedLogins = logins.sort((a, b) => b.login_time - a.login_time);

        // 策略1：优先尝试当前设备的登录
        for (const login of sortedLogins) {
            const accountId = system === 'scm' ? login.username : login.account;
            const fullInfo = system === 'scm'
                ? await window.FirebaseModule.getScmLogin(accountId)
                : await window.FirebaseModule.getPmsLogin(accountId);

            if (!fullInfo || !fullInfo.credentials) continue;

            // 检查是否是当前设备的登录
            if (fullInfo.device_id === currentDeviceId) {
                // 检查是否有效
                if (this.isLoginValid(fullInfo)) {
                    this.state.credentials = fullInfo.credentials;
                    console.log(`获取${system.toUpperCase()}登录凭证成功（当前设备）:`, accountId);
                    return this.state.credentials;
                }
            }
        }

        // 策略2：当前设备登录失效，尝试其他设备的有效登录
        console.log(`当前设备的${system.toUpperCase()}登录失效，尝试其他设备...`);

        for (const login of sortedLogins) {
            const accountId = system === 'scm' ? login.username : login.account;
            const fullInfo = system === 'scm'
                ? await window.FirebaseModule.getScmLogin(accountId)
                : await window.FirebaseModule.getPmsLogin(accountId);

            if (!fullInfo || !fullInfo.credentials) continue;

            // 检查是否有效（不限制设备）
            if (this.isLoginValid(fullInfo)) {
                this.state.credentials = fullInfo.credentials;
                console.log(`获取${system.toUpperCase()}登录凭证成功（其他设备）:`, accountId);
                return this.state.credentials;
            }
        }

        return null;
    },

    /**
     * 尝试从所有设备获取有效的登录凭证（当前设备没有登录时使用）
     * @returns {Promise<Object|null>} 有效的credentials或null
     */
    async tryGetAllDevicesCredentials() {
        try {
            const db = window.FirebaseModule.state.database;

            // 获取所有 SCM 账户
            const scmSnapshot = await db.ref('zhanghu/scm').once('value');
            const allScmLogins = [];

            scmSnapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                if (data.username && data.login_time) {
                    allScmLogins.push({
                        username: data.username,
                        login_time: data.login_time
                    });
                }
            });

            // 优先尝试 SCM 账户
            if (allScmLogins.length > 0) {
                // 按登录时间排序，最新的在前
                const sortedScm = allScmLogins.sort((a, b) => b.login_time - a.login_time);

                for (const login of sortedScm) {
                    const fullInfo = await window.FirebaseModule.getScmLogin(login.username);

                    if (!fullInfo || !fullInfo.credentials) continue;

                    // 通过API验证登录是否有效
                    if (await this.isLoginValid(fullInfo)) {
                        this.state.credentials = fullInfo.credentials;
                        console.log('获取SCM登录凭证成功（其他设备）:', login.username);
                        return this.state.credentials;
                    }
                }
            }

            // 如果 SCM 没有有效登录，尝试 PMS 账户
            const pmsSnapshot = await db.ref('zhanghu/pms').once('value');
            const allPmsLogins = [];

            pmsSnapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                if (data.account && data.login_time) {
                    allPmsLogins.push({
                        account: data.account,
                        login_time: data.login_time
                    });
                }
            });

            if (allPmsLogins.length > 0) {
                // 按登录时间排序，最新的在前
                const sortedPms = allPmsLogins.sort((a, b) => b.login_time - a.login_time);

                for (const login of sortedPms) {
                    const fullInfo = await window.FirebaseModule.getPmsLogin(login.account);

                    if (!fullInfo || !fullInfo.credentials) continue;

                    // 通过API验证登录是否有效
                    if (await this.isLoginValid(fullInfo)) {
                        this.state.credentials = fullInfo.credentials;
                        console.log('获取PMS登录凭证成功（其他设备）:', login.account);
                        return this.state.credentials;
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('从所有设备获取登录凭证失败:', error);
            return null;
        }
    },

    /**
     * 检查登录信息是否有效（通过实际查询优惠券验证）
     * @param {Object} loginInfo - 登录信息
     * @returns {Promise<boolean>} 是否有效
     */
    async isLoginValid(loginInfo) {
        try {
            console.log('通过查询优惠券验证登录有效性...');

            const requestBody = {
                credentials: loginInfo.credentials,
                action: 'list',
                pageNo: 1,
                pageSize: 1, // 只请求1条数据，减少开销
                name: '',
                id: '',
                type: '',
                is_valid: '',
                valid_type: '',
                ctime: '',
                chooseDay: ''
            };

            const response = await fetch(this.config.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'Accept': 'application/json; charset=UTF-8'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                console.log('查询失败（HTTP错误）:', response.status);
                return false;
            }

            const result = await response.json();

            if (result.success === false) {
                console.log('登录凭证无效:', result.message);
                return false;
            }

            console.log('登录凭证有效（查询成功）');
            return true;

        } catch (error) {
            console.error('验证失败:', error);
            return false;
        }
    },

    /**
     * 兼容旧接口 - 获取登录信息
     */
    async getLoginInfo() {
        const credentials = await this.getCredentials();
        if (!credentials) return null;
        return {
            username: credentials.username,
            token: credentials.token,
            sessionId: credentials.cms_token
        };
    },

    /**
     * 搜索优惠券
     * @param {string} keyword - 搜索关键词（空字符串表示加载所有）
     * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
     */
    async searchCoupons(keyword = '') {
        // 如果正在搜索，静默返回（UI层面已禁用按钮）
        if (this.state.isSearching) {
            console.log('搜索正在进行中，忽略重复请求');
            return { success: false, error: 'SEARCHING', message: '搜索正在进行中' };
        }

        this.state.isSearching = true;
        this.state.lastSearchKeyword = keyword.trim();

        try {
            // 获取完整的credentials对象
            const credentials = await this.getCredentials();
            if (!credentials) {
                return { success: false, error: 'NO_LOGIN', message: '你没有有效登录信息！' };
            }

            // 智能判断搜索类型：7位纯数字为ID搜索，其他为名称模糊搜索
            const trimmedKeyword = keyword.trim();
            const isIdSearch = /^\d{7}$/.test(trimmedKeyword);

            // 构建云函数请求体（符合云函数接口规范）
            const requestBody = {
                credentials: credentials,
                action: 'list',
                pageNo: 1,
                pageSize: this.config.pageSize,
                name: isIdSearch ? '' : trimmedKeyword,  // 非ID搜索时使用 name 字段模糊搜索
                id: isIdSearch ? trimmedKeyword : '',  // 7位数字时使用 ID 精确搜索
                type: '',
                is_valid: '',
                valid_type: '',
                ctime: '',
                chooseDay: ''
            };

            console.log('发送优惠券查询请求:', this.config.apiUrl);

            const response = await fetch(this.config.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'Accept': 'application/json; charset=UTF-8'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            console.log('云函数返回:', result);

            // 云函数返回格式：{success, message, data}
            if (!result || typeof result !== 'object') {
                throw new Error('返回数据格式错误');
            }

            if (result.success === false) {
                throw new Error(result.message || '搜索失败');
            }

            // 云函数返回：data.results 是优惠券数组
            const coupons = result.data?.results || [];

            return {
                success: true,
                data: coupons,
                total: result.data?.totalRecord || coupons.length
            };

        } catch (error) {
            console.error('优惠券搜索失败:', error);
            return {
                success: false,
                error: error.message || '搜索失败，请稍后重试'
            };
        } finally {
            this.state.isSearching = false;
        }
    },

    /**
     * 获取最后搜索的关键词
     */
    getLastKeyword() {
        return this.state.lastSearchKeyword;
    },

    /**
     * 检查是否正在搜索
     */
    isSearching() {
        return this.state.isSearching;
    }
};

// 导出模块
window.YhquanAPIModule = YhquanAPIModule;
