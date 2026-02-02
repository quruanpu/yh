// 商品查询API模块
const ChaxunAPIModule = {
    config: {
        get apiUrl() { return window.ChaxunConfig?.api?.url || ''; },
        get timeout() { return window.ChaxunConfig?.api?.timeout || 30000; },
        get pageSize() { return window.ChaxunConfig?.pagination?.pageSize || 50; },
        get fetchPages() { return window.ChaxunConfig?.pagination?.fetchPages || 1; }
    },

    state: {
        isSearching: false,
        lastSearchKeyword: ''
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
        this.state.lastSearchKeyword = keyword.trim();

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
    },

    isSearching() {
        return this.state.isSearching;
    }
};

window.ChaxunAPIModule = ChaxunAPIModule;
