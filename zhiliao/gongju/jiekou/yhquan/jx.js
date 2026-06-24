/**
 * 优惠券关键词解析模块（按原版规则）
 * 目标：
 * 1. 用户原始文本中自动解析优惠规格
 * 2. 匹配共享优惠券 keyword
 * 3. 对无效标识（如门店编码/手机号/K编码）做清理
 */
const YhquanJxModule = {
    config: {
        discountRange: { min: 90, max: 99 },
        deductRange: { min: 5, max: 500 },
        tierRange: { min: 300, max: 100000 },
        defaultTier: 2000,
        defaultDiscount: 98
    },

    chineseMap: {
        '一百': 100, '两百': 200, '二百': 200, '三百': 300, '五百': 500,
        '一千': 1000, '两千': 2000, '二千': 2000, '三千': 3000,
        '四千': 4000, '四千五': 4500, '五千': 5000,
        '一万': 10000, '两万': 20000, '三万': 30000, '五万': 50000, '十万': 100000,
        '1百': 100, '2百': 200, '3百': 300, '5百': 500,
        '1千': 1000, '2千': 2000, '3千': 3000, '4千': 4000, '5千': 5000,
        '1万': 10000, '2万': 20000, '3万': 30000, '5万': 50000, '10万': 100000
    },

    matchKeywords(content, coupons = []) {
        if (!Array.isArray(coupons) || coupons.length === 0) return [];

        const matched = [];
        const matchedIds = new Set();
        const parsedKeys = this.parseInput(content);

        for (let i = 0; i < parsedKeys.length; i += 1) {
            const parsedKey = parsedKeys[i];
            const normalizedParsed = this.normalizeKey(parsedKey);

            for (let j = 0; j < coupons.length; j += 1) {
                const coupon = coupons[j];
                if (matchedIds.has(coupon.id)) continue;

                const couponKey = String(coupon?.keyword || '').toLowerCase();
                if (!couponKey) continue;
                const normalizedCoupon = this.normalizeKey(couponKey);

                if (normalizedParsed === normalizedCoupon || this.isMatch(parsedKey, couponKey)) {
                    matched.push(coupon);
                    matchedIds.add(coupon.id);
                    break;
                }
            }
        }

        return matched;
    },

    normalizeKey(key) {
        const nums = String(key || '').match(/\d+/g) || [];
        return nums.join('-');
    },

    parseInput(content) {
        const keys = new Set();
        const usedTiers = new Set();

        const cleaned = this.removeIdentifiers(content);
        const normalized = this.replaceChineseNumbers(cleaned);

        this.extractCompleteFormats(normalized, keys, usedTiers);
        this.extractPureTiers(normalized, keys, usedTiers);
        this.extractPureDiscounts(normalized, keys);

        if (keys.size === 0) {
            keys.add(`${this.config.defaultTier}/${this.config.defaultDiscount}折`);
        }

        return Array.from(keys);
    },

    removeIdentifiers(content) {
        let result = String(content || '');
        result = result.replace(/(^|[^\d])\d{7}([^\d]|$)/g, '$1$2');
        result = result.replace(/(^|[^\d])\d{11}([^\d]|$)/g, '$1$2');
        result = result.replace(/K\d{4,10}/gi, '');
        return result;
    },

    replaceChineseNumbers(content) {
        let result = String(content || '');
        const sorted = Object.entries(this.chineseMap).sort((a, b) => b[0].length - a[0].length);
        for (let i = 0; i < sorted.length; i += 1) {
            const [cn, num] = sorted[i];
            result = result.replace(new RegExp(cn, 'g'), `${num} `);
        }
        return result;
    },

    extractCompleteFormats(content, keys, usedTiers) {
        let m = null;

        // 1000/98折
        const p1 = /(\d{3,6})\s*[\/]\s*(\d{2,3})\s*折?/g;
        while ((m = p1.exec(content)) !== null) {
            const tier = m[1];
            const val = m[2];
            if (this.isTier(tier)) {
                keys.add(`${tier}/${val}折`);
                usedTiers.add(tier);
            }
        }

        // 1000档98折
        const p2 = /(\d{3,6})\s*档\s*(\d{2,3})\s*折/g;
        while ((m = p2.exec(content)) !== null) {
            const tier = m[1];
            const val = m[2];
            if (this.isTier(tier)) {
                keys.add(`${tier}/${val}折`);
                usedTiers.add(tier);
            }
        }

        // 1000-50 / 1000减50
        const p3 = /(\d{3,6})\s*[-减]\s*(\d{1,3})(?!折)/g;
        while ((m = p3.exec(content)) !== null) {
            const tier = m[1];
            const deduct = m[2];
            if (this.isTier(tier) && this.isDeduct(deduct)) {
                keys.add(`${tier}/${deduct}`);
                keys.add(`${tier}-${deduct}`);
                keys.add(`${tier}减${deduct}`);
                usedTiers.add(tier);
            }
        }

        // 3000 98
        const p4 = /(\d{3,6})\s+(\d{2})(?!\d)/g;
        while ((m = p4.exec(content)) !== null) {
            const tier = m[1];
            const val = m[2];
            if (this.isTier(tier) && this.isDiscount(parseInt(val, 10)) && !usedTiers.has(tier)) {
                keys.add(`${tier}/${val}折`);
                usedTiers.add(tier);
            }
        }

        // 2000的99
        const p5 = /(\d{3,6})的(\d{2})(?!\d)/g;
        while ((m = p5.exec(content)) !== null) {
            const tier = m[1];
            const val = m[2];
            if (this.isTier(tier) && this.isDiscount(parseInt(val, 10)) && !usedTiers.has(tier)) {
                keys.add(`${tier}/${val}折`);
                usedTiers.add(tier);
            }
        }
    },

    extractPureTiers(content, keys, usedTiers) {
        const pattern = /(^|[^\d])(\d{3,6})([^\d]|$)/g;
        let m = null;
        while ((m = pattern.exec(content)) !== null) {
            const num = m[2];
            if (this.isTier(num) && !usedTiers.has(num)) {
                keys.add(`${num}/${this.config.defaultDiscount}折`);
            }
            pattern.lastIndex = m.index + m[1].length + m[2].length;
        }
    },

    extractPureDiscounts(content, keys) {
        const p1 = /(?<![\/\d])(\d{2})\s*折/g;
        let m = null;
        while ((m = p1.exec(content)) !== null) {
            const val = parseInt(m[1], 10);
            if (this.isDiscount(val)) {
                keys.add(`${this.config.defaultTier}/${val}折`);
            }
        }
    },

    isTier(num) {
        const n = parseInt(num, 10);
        return n >= this.config.tierRange.min && n <= this.config.tierRange.max;
    },

    isDiscount(num) {
        const n = parseInt(num, 10);
        return n >= this.config.discountRange.min && n <= this.config.discountRange.max;
    },

    isDeduct(num) {
        const n = parseInt(num, 10);
        return n >= this.config.deductRange.min && n <= this.config.deductRange.max;
    },

    isMatch(parsed, couponKey) {
        const parsedText = String(parsed || '').toLowerCase();
        const couponText = String(couponKey || '').toLowerCase();
        if (parsedText === couponText) return true;

        const pNums = parsedText.match(/\d+/g) || [];
        const cNums = couponText.match(/\d+/g) || [];

        if (pNums.length >= 2 && cNums.length >= 2) {
            return pNums[0] === cNums[0] && pNums[1] === cNums[1];
        }

        if (pNums.length >= 1 && cNums.length >= 1) {
            return pNums[0] === cNums[0];
        }

        return false;
    }
};

window.YhquanJxModule = YhquanJxModule;
