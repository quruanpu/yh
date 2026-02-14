/**
 * 商品查询模块 - API与工具函数
 */
const GongjuApi = {
    // ========== 配置 ==========
    config: {
        get apiUrl() { return window.ChaxunConfig?.api?.url || ''; },
        get pageSize() { return window.ChaxunConfig?.pagination?.pageSize || 50; },
        get fetchPages() { return window.ChaxunConfig?.pagination?.fetchPages || 1; }
    },

    state: {
        isSearching: false
    },

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
            providerIdM: credentials.provider_id_m || credentials.provider_id
        };
    },

    async getPmsCredentials() {
        if (!window.LoginModule) {
            console.warn('登录模块未加载');
            return null;
        }
        return await window.LoginModule.getPmsCredentials();
    },

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
                const msg = result.message || '';
                if (msg.includes('登录') || msg.includes('凭证')) {
                    return { success: false, error: 'NO_PMS_LOGIN', message: msg };
                }
                return { success: false, error: msg || '查询失败' };
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
                const msg = result.message || '';
                if (msg.includes('登录') || msg.includes('凭证')) {
                    return { success: false, error: 'NO_LOGIN', message: msg };
                }
                throw new Error(msg || '查询失败');
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

    // ========== 工具函数 ==========
    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    formatPrice(price) {
        if (price === null || price === undefined || price === '') return '-';
        const num = parseFloat(price);
        if (isNaN(num)) return '-';
        return num.toFixed(2);
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) return dateStr;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}/${m}/${d}`;
    },

    getTypeStyle(typeName) {
        const styles = {
            '一口价': { bg: '#dbeafe', color: '#2563eb' },
            '特价': { bg: '#fef3c7', color: '#d97706' },
            '限时特价': { bg: '#fee2e2', color: '#dc2626' },
            '赠品': { bg: '#f3e8ff', color: '#9333ea' },
            '普通拼团': { bg: '#cffafe', color: '#0891b2' },
            '批购包邮': { bg: '#d1fae5', color: '#059669' }
        };
        return styles[typeName] || { bg: '#e5e7eb', color: '#374151' };
    }
};

window.GongjuApi = GongjuApi;
