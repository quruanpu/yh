// 优惠券API模块 - 封装优惠券搜索接口
/**
 * 使用登录模块(LoginModule)统一接口获取凭证
 * 凭证失效时由登录模块自动弹出登录弹窗
 */
const YhquanAPIModule = {
    // 配置（从 YhquanConfig 读取）
    config: {
        get apiUrl() { return window.YhquanConfig?.api?.url || ''; },
        get pageSize() { return window.YhquanConfig?.pagination?.pageSize || 9999; }
    },

    // 状态
    state: {
        isSearching: false
    },

    /**
     * 获取登录凭证（使用登录模块统一接口）
     * @returns {Promise<Object|null>} 凭证对象或null
     */
    async getCredentials() {
        if (!window.LoginModule) {
            console.warn('登录模块未加载');
            return null;
        }
        return await window.LoginModule.getScmCredentials();
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
     * 获取单个优惠券的GMV（销售金额）
     * @param {string|number} couponId - 优惠券ID
     * @returns {Promise<string>} 销售金额或'-'
     */
    async getSalesVolume(couponId) {
        try {
            const credentials = await this.getCredentials();
            if (!credentials) {
                return '-';
            }

            const response = await fetch(this.config.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'Accept': 'application/json; charset=UTF-8'
                },
                body: JSON.stringify({
                    credentials: credentials,
                    action: 'getSalesVolume',
                    couponTypeId: String(couponId)
                })
            });

            if (!response.ok) {
                return '-';
            }

            const result = await response.json();
            if (result.success && result.data?.salesAmount) {
                return result.data.salesAmount;
            }
            return '-';
        } catch (error) {
            console.error('获取GMV失败:', error);
            return '-';
        }
    }
};

// 导出模块
window.YhquanAPIModule = YhquanAPIModule;
