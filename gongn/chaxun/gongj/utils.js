// 商品查询模块 - 工具函数
const ChaxunUtils = {
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
     * 格式化价格（保留2位小数）
     */
    formatPrice(price) {
        if (price === null || price === undefined || price === '') return '-';
        const num = parseFloat(price);
        if (isNaN(num)) return '-';
        return num.toFixed(2);
    },

    /**
     * 格式化日期
     */
    formatDate(dateStr) {
        if (!dateStr) return '-';
        // 如果已经是 yyyy/mm/dd 格式，直接返回
        if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) return dateStr;
        // 尝试解析日期
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}/${m}/${d}`;
    },

    /**
     * 获取活动状态样式
     */
    getStatusStyle(statusName) {
        const styles = {
            '进行中': { bg: '#dcfce7', color: '#16a34a' },
            '已结束': { bg: '#fee2e2', color: '#dc2626' },
            '未开始': { bg: '#fef3c7', color: '#d97706' },
            '资质不通过': { bg: '#fecaca', color: '#b91c1c' }
        };
        return styles[statusName] || { bg: '#f3f4f6', color: '#6b7280' };
    },

    /**
     * 获取活动类型样式
     */
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

window.ChaxunUtils = ChaxunUtils;
