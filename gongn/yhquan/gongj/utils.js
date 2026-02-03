// 优惠券模块 - 共享工具函数
const YhquanUtils = {
    /**
     * 转义HTML特殊字符
     */
    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    /**
     * 获取优惠券状态
     * @returns {{text: string, color: string, valid: boolean}}
     */
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

    /**
     * 获取优惠券详情描述
     */
    getCouponDetail(coupon) {
        const parts = [];
        if (coupon.minPay) parts.push(`满${coupon.minPay}可用`);
        if (coupon.typeDesc) parts.push(coupon.typeDesc);
        if (coupon.price) parts.push(coupon.price);
        return parts.join(' | ') || '无详情';
    },

    /**
     * 获取有效期描述
     */
    getValidPeriod(coupon) {
        if (coupon.validDayNote) return coupon.validDayNote;
        if (coupon.validDays > 0) return `领取后${coupon.validDays}天有效`;
        if (coupon.beginTime && coupon.endTime) {
            return `${coupon.beginTime.split(' ')[0]} 至 ${coupon.endTime.split(' ')[0]}`;
        }
        return '永久有效';
    },

    /**
     * 获取状态图标
     * 优先级：已作废 > 过期 > 共享 > 有效
     */
    getStatusIcon(coupon) {
        const status = this.getCouponStatus(coupon);
        if (status.text === '已作废') return '🔴';
        if (status.text === '已过期') return '🕚';
        if (coupon.isSharing) return '🌎️';
        return '💡';
    }
};

window.YhquanUtils = YhquanUtils;
