// 商品查询API模块
/**
 * 使用登录模块(LoginModule)统一接口获取凭证
 * SCM登录 - 用于：商品查询
 * PMS登录 - 用于：品种负责人查询
 * 凭证失效时由登录模块自动弹出登录弹窗
 */
const ChaxunAPIModule = {
    config: {
        get apiUrl() { return window.ChaxunConfig?.api?.url || ''; },
        get pageSize() { return window.ChaxunConfig?.pagination?.pageSize || 50; },
        get fetchPages() { return window.ChaxunConfig?.pagination?.fetchPages || 1; }
    },

    state: {
        isSearching: false
    },

    /**
     * 获取SCM登录凭证（使用登录模块统一接口）
     */
    async getCredentials() {
        if (!window.LoginModule) {
            console.warn('登录模块未加载');
            return null;
        }
        const credentials = await window.LoginModule.getScmCredentials();
        if (!credentials) return null;
        return {
            token: credentials.token,
            cookies: credentials.cookies,
            providerIdM: credentials.providerIdM || credentials.providerId
        };
    },

    /**
     * 获取PMS登录凭证（使用登录模块统一接口）
     */
    async getPmsCredentials() {
        if (!window.LoginModule) {
            console.warn('登录模块未加载');
            return null;
        }
        return await window.LoginModule.getPmsCredentials();
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
