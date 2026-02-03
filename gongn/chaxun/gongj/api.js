// 商品查询API模块
const ChaxunAPIModule = {
    config: {
        get apiUrl() { return window.ChaxunConfig?.api?.url || ''; },
        get timeout() { return window.ChaxunConfig?.api?.timeout || 30000; },
        get pageSize() { return window.ChaxunConfig?.pagination?.pageSize || 50; },
        get fetchPages() { return window.ChaxunConfig?.pagination?.fetchPages || 1; }
    },

    state: {
        isSearching: false
    },

    /**
     * 获取SCM登录凭证（复用优惠券模块的凭证获取逻辑）
     */
    async getCredentials() {
        try {
            if (!window.FirebaseModule) {
                console.warn('Firebase模块未加载');
                return null;
            }
            await window.FirebaseModule.init();

            // 获取当前设备的SCM登录信息
            const deviceLogins = await window.FirebaseModule.getDeviceLogins();

            if (deviceLogins.scm?.length > 0) {
                // 按登录时间排序，取最新的
                const sortedLogins = deviceLogins.scm.sort((a, b) => b.login_time - a.login_time);

                for (const login of sortedLogins) {
                    const fullInfo = await window.FirebaseModule.getScmLogin(login.username);
                    if (fullInfo?.credentials) {
                        console.log('获取SCM登录凭证成功:', login.username);
                        return this.buildAuthFromCredentials(fullInfo.credentials);
                    }
                }
            }

            // 尝试获取最新的SCM登录
            const db = window.FirebaseModule.state.database;
            const scmSnapshot = await db.ref('zhanghu/scm').once('value');
            const allLogins = [];

            scmSnapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                if (data.username && data.login_time) {
                    allLogins.push({ id: data.username, login_time: data.login_time });
                }
            });

            allLogins.sort((a, b) => b.login_time - a.login_time);

            for (const login of allLogins) {
                const fullInfo = await window.FirebaseModule.getScmLogin(login.id);
                if (fullInfo?.credentials) {
                    console.log('获取SCM登录凭证成功:', login.id);
                    return this.buildAuthFromCredentials(fullInfo.credentials);
                }
            }

            return null;
        } catch (error) {
            console.error('获取登录凭证失败:', error);
            return null;
        }
    },

    /**
     * 从credentials构建auth对象
     */
    buildAuthFromCredentials(credentials) {
        return {
            token: credentials.token,
            cookies: credentials.cookies,
            providerIdM: credentials.providerIdM || credentials.providerId
        };
    },

    /**
     * 获取PMS登录凭证
     */
    async getPmsCredentials() {
        try {
            if (!window.FirebaseModule) {
                console.warn('Firebase模块未加载');
                return null;
            }
            await window.FirebaseModule.init();

            // 先尝试获取当前设备的PMS登录
            const deviceLogins = await window.FirebaseModule.getDeviceLogins();

            if (deviceLogins.pms?.length > 0) {
                // 按登录时间排序，取最新的
                const sortedLogins = deviceLogins.pms.sort((a, b) => b.login_time - a.login_time);

                for (const login of sortedLogins) {
                    const fullInfo = await window.FirebaseModule.getPmsLogin(login.account);
                    if (fullInfo?.credentials) {
                        // providerId 应该从 sub_providers 获取（当前用户所属的供应商）
                        // 而不是从 providers 获取（那是所有供应商列表）
                        const subProviders = fullInfo.permissions?.sub_providers || [];
                        const providerId = subProviders[0]?.id
                            || fullInfo.credentials.providerId
                            || fullInfo.user_info?.providerId;
                        const token = fullInfo.credentials.pms_token || fullInfo.pms_token;
                        console.log('获取PMS登录凭证成功:', login.account, 'providerId:', providerId);
                        return { token, providerId };
                    }
                }
            }

            // 如果当前设备没有登录，尝试获取最新的PMS登录
            const db = window.FirebaseModule.state.database;
            const pmsSnapshot = await db.ref('zhanghu/pms').once('value');
            const allLogins = [];

            pmsSnapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                if (data.account && data.login_time) {
                    allLogins.push({ id: data.account, ...data });
                }
            });

            if (allLogins.length === 0) {
                console.warn('没有找到任何PMS登录记录');
                return null;
            }

            allLogins.sort((a, b) => b.login_time - a.login_time);
            const latest = allLogins[0];

            if (latest.credentials) {
                // providerId 应该从 sub_providers 获取（当前用户所属的供应商）
                // 而不是从 providers 获取（那是所有供应商列表）
                const subProviders = latest.permissions?.sub_providers || [];
                const providerId = subProviders[0]?.id
                    || latest.credentials.providerId
                    || latest.user_info?.providerId;
                const token = latest.credentials.pms_token || latest.pms_token;
                console.log('使用最新PMS登录凭证:', latest.id, 'providerId:', providerId);
                return { token, providerId };
            }
            return null;
        } catch (error) {
            console.error('获取PMS登录凭证失败:', error);
            return null;
        }
    },

    /**
     * 查询PMS品种负责人
     */
    async queryPmsContactor(drugCode) {
        try {
            const auth = await this.getPmsCredentials();
            if (!auth) {
                return { success: false, error: 'NO_PMS_LOGIN', message: '请先登录PMS账户' };
            }

            const pmsUrl = window.ChaxunConfig?.api?.pmsUrl;
            if (!pmsUrl) {
                return { success: false, error: 'NO_PMS_URL', message: 'PMS接口未配置' };
            }

            const response = await fetch(pmsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    auth: auth,
                    query: { keyword: drugCode, pageSize: 1 }
                })
            });

            const result = await response.json();

            if (result.code !== 0) {
                return { success: false, error: result.message || '查询失败' };
            }

            const products = result.data?.products || [];
            if (products.length === 0) {
                return { success: false, error: '未找到商品' };
            }

            return {
                success: true,
                contactor: products[0].contactor || '-'
            };
        } catch (error) {
            console.error('查询PMS品种负责人失败:', error);
            return { success: false, error: error.message || '查询失败' };
        }
    },

    /**
     * 搜索商品
     * @param {string} keyword - 搜索关键词
     * @param {number[]} wholesaleTypes - 商品类型数组（空数组表示全部）
     * @param {number} status - 商品状态（-1表示全部）
     */
    async searchProducts(keyword = '', wholesaleTypes = [], status = -1) {
        if (this.state.isSearching) {
            return { success: false, error: 'SEARCHING', message: '搜索正在进行中' };
        }

        this.state.isSearching = true;

        try {
            const auth = await this.getCredentials();
            if (!auth) {
                return { success: false, error: 'NO_LOGIN', message: '请先登录SCM账户' };
            }

            const requestBody = {
                auth: auth,
                query: {
                    keyword: keyword.trim(),
                    wholesaleTypes: wholesaleTypes,
                    status: status,
                    pageSize: this.config.pageSize,
                    fetchPages: this.config.fetchPages
                }
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
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.code !== 0) {
                throw new Error(result.message || '查询失败');
            }

            return {
                success: true,
                data: result.data?.products || [],
                summary: result.data?.summary || {}
            };

        } catch (error) {
            console.error('商品搜索失败:', error);
            return { success: false, error: error.message || '搜索失败' };
        } finally {
            this.state.isSearching = false;
        }
    }
};

window.ChaxunAPIModule = ChaxunAPIModule;
