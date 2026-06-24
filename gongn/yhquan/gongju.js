/**
 * 优惠券模块 - API与工具函数
 */
const YhquanGongju = {
    // ========== 配置 ==========
    config: {
        get apiUrl() { return window.YhquanConfig?.api?.url || ''; },
        get pageSize() { return window.YhquanConfig?.pagination?.pageSize || 9999; }
    },

    state: {
        isSearching: false
    },

    // ========== API方法 ==========
    async getCredentials() {
        if (!window.LoginModule) {
            console.warn('登录模块未加载');
            return null;
        }
        const result = await window.LoginModule.requireCredentials('scm');
        return result.ok ? result.credentials : null;
    },

    async searchCoupons(keyword = '') {
        if (this.state.isSearching) {
            console.log('搜索正在进行中，忽略重复请求');
            return { success: false, error: 'SEARCHING', message: '搜索正在进行中' };
        }

        this.state.isSearching = true;

        try {
            const credentials = await this.getCredentials();
            if (!credentials) {
                return { success: false, error: 'NO_LOGIN', message: '你没有有效登录信息！' };
            }

            const trimmedKeyword = keyword.trim();
            const isIdSearch = /^\d{7}$/.test(trimmedKeyword);

            const requestBody = {
                credentials: credentials,
                action: 'list',
                pageNo: 1,
                pageSize: this.config.pageSize,
                name: isIdSearch ? '' : trimmedKeyword,
                id: isIdSearch ? trimmedKeyword : '',
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

            if (!result || typeof result !== 'object') {
                throw new Error('返回数据格式错误');
            }

            if (result.success === false) {
                const msg = result.message || '';
                if (msg.includes('登录') || msg.includes('凭证')) {
                    return { success: false, error: 'NO_LOGIN', message: msg };
                }
                throw new Error(msg || '搜索失败');
            }

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
                error: error.message || '搜索失败，请稀后重试'
            };
        } finally {
            this.state.isSearching = false;
        }
    },

    async getSalesVolume(couponId) {
        try {
            const credentials = await this.getCredentials();
            if (!credentials) return '-';

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

            if (!response.ok) return '-';

            const result = await response.json();
            if (result.success && result.data?.salesAmount) {
                return result.data.salesAmount;
            }
            return '-';
        } catch (error) {
            console.error('获取GMV失败:', error);
            return '-';
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

    getCouponStatus(coupon) {
        if (String(coupon.couponStatus) !== '1') {
            return { text: '已作废', color: '#ef4444', valid: false };
        }
        if (coupon.endTime) {
            const endTime = new Date(coupon.endTime);
            if (!isNaN(endTime.getTime()) && new Date() > endTime) {
                return { text: '已过期', color: '#f59e0b', valid: false };
            }
        }
        return { text: '有效', color: '#10b981', valid: true };
    },

    getCouponDetail(coupon) {
        const parts = [];
        if (coupon.minPay) parts.push(`满${coupon.minPay}可用`);
        if (coupon.typeDesc) parts.push(coupon.typeDesc);
        if (coupon.price) parts.push(coupon.price);
        return parts.join(' | ') || '无详情';
    },

    getValidPeriod(coupon) {
        if (coupon.validDayNote) return coupon.validDayNote;
        if (coupon.validDays > 0) return `领取后${coupon.validDays}天有效`;
        if (coupon.beginTime && coupon.endTime) {
            return `${coupon.beginTime.split(' ')[0]} 至 ${coupon.endTime.split(' ')[0]}`;
        }
        return '永久有效';
    },

    getStatusIcon(coupon) {
        const status = this.getCouponStatus(coupon);
        if (status.text === '已作废') return '🔴';
        if (status.text === '已过期') return '🕚';
        if (coupon.isSharing) return '🌎️';
        return '💡';
    }
};

window.YhquanGongju = YhquanGongju;
