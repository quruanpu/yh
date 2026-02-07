/**
 * 优惠券关键字解析模块
 *
 * 职责：
 * 1. 解析用户输入的关键字
 * 2. 匹配共享优惠券
 * 3. 支持多种格式（档位/折扣、满减等）
 */

const YhquanJxModule = {
    // 配置
    config: {
        discountRange: { min: 90, max: 99 },
        deductRange: { min: 5, max: 500 },
        tierRange: { min: 300, max: 100000 },
        defaultTier: 2000,
        defaultDiscount: 98
    },

    // 中文数字映射
    chineseMap: {
        '一百': 100, '两百': 200, '二百': 200, '三百': 300, '五百': 500,
        '一千': 1000, '两千': 2000, '二千': 2000, '三千': 3000,
        '四千': 4000, '四千五': 4500, '五千': 5000,
        '一万': 10000, '两万': 20000, '三万': 30000, '五万': 50000, '十万': 100000,
        '1百': 100, '2百': 200, '3百': 300, '5百': 500,
        '1千': 1000, '2千': 2000, '3千': 3000, '4千': 4000, '5千': 5000,
        '1万': 10000, '2万': 20000, '3万': 30000, '5万': 50000, '10万': 100000
    },

    /**
     * 主入口：匹配关键字
     */
    matchKeywords(content, coupons) {
        const matched = [];
        const matchedIds = new Set();

        const parsedKeys = this.parseInput(content);
        console.log('[解析] 用户输入:', content);
        console.log('[解析] 生成关键字:', parsedKeys);

        for (const parsedKey of parsedKeys) {
            const normalizedParsed = this.normalizeKey(parsedKey);

            for (const coupon of coupons) {
                if (matchedIds.has(coupon.id)) continue;

                const couponKey = coupon.keyword.toLowerCase();
                const normalizedCoupon = this.normalizeKey(couponKey);

                if (normalizedParsed === normalizedCoupon || this.isMatch(parsedKey, couponKey)) {
                    console.log(`[匹配] ${parsedKey} -> ${coupon.keyword}`);
                    matched.push(coupon);
                    matchedIds.add(coupon.id);
                    break;
                }
            }
        }

        console.log('[解析] 最终匹配:', matched.map(c => c.keyword));
        return matched;
    },

    /**
     * 标准化关键字
     */
    normalizeKey(key) {
        const nums = key.match(/\d+/g) || [];
        return nums.join('-');
    },

    /**
     * 解析用户输入
     */
    parseInput(content) {
        const keys = new Set();
        const usedTiers = new Set();

        let cleaned = this.removeIdentifiers(content);
        let normalized = this.replaceChineseNumbers(cleaned);

        this.extractCompleteFormats(normalized, keys, usedTiers);
        this.extractPureTiers(normalized, keys, usedTiers);
        this.extractPureDiscounts(normalized, keys);

        if (keys.size === 0) {
            keys.add(`${this.config.defaultTier}/${this.config.defaultDiscount}折`);
        }

        return Array.from(keys);
    },

    /**
     * 移除固定格式标识符
     */
    removeIdentifiers(content) {
        let result = content;
        result = result.replace(/(^|[^\d])\d{7}([^\d]|$)/g, '$1$2');
        result = result.replace(/(^|[^\d])\d{11}([^\d]|$)/g, '$1$2');
        result = result.replace(/K\d{4,10}/gi, '');
        return result;
    },

    /**
     * 替换中文数字
     */
    replaceChineseNumbers(content) {
        let result = content;
        const sorted = Object.entries(this.chineseMap).sort((a, b) => b[0].length - a[0].length);
        for (const [cn, num] of sorted) {
            result = result.replace(new RegExp(cn, 'g'), String(num) + ' ');
        }
        return result;
    },

    /**
     * 提取完整格式
     */
    extractCompleteFormats(content, keys, usedTiers) {
        let m;

        // 格式1: 1000/98折
        const p1 = /(\d{3,6})\s*[\/]\s*(\d{2,3})\s*折?/g;
        while ((m = p1.exec(content)) !== null) {
            const tier = m[1], val = m[2];
            if (this.isTier(tier)) {
                keys.add(`${tier}/${val}折`);
                usedTiers.add(tier);
            }
        }

        // 格式2: 1000档98折
        const p2 = /(\d{3,6})\s*档\s*(\d{2,3})\s*折/g;
        while ((m = p2.exec(content)) !== null) {
            const tier = m[1], val = m[2];
            if (this.isTier(tier)) {
                keys.add(`${tier}/${val}折`);
                usedTiers.add(tier);
            }
        }

        // 格式3: 1000-50 满减
        const p3 = /(\d{3,6})\s*[-减]\s*(\d{1,3})(?!折)/g;
        while ((m = p3.exec(content)) !== null) {
            const tier = m[1], deduct = m[2];
            if (this.isTier(tier) && this.isDeduct(deduct)) {
                keys.add(`${tier}/${deduct}`);
                keys.add(`${tier}-${deduct}`);
                keys.add(`${tier}减${deduct}`);
                usedTiers.add(tier);
            }
        }

        // 格式4: 3000 98 空格分隔
        const p4 = /(\d{3,6})\s+(\d{2})(?!\d)/g;
        while ((m = p4.exec(content)) !== null) {
            const tier = m[1], val = m[2];
            if (this.isTier(tier) && this.isDiscount(parseInt(val)) && !usedTiers.has(tier)) {
                keys.add(`${tier}/${val}折`);
                usedTiers.add(tier);
            }
        }

        // 格式5: 2000的99
        const p5 = /(\d{3,6})的(\d{2})(?!\d)/g;
        while ((m = p5.exec(content)) !== null) {
            const tier = m[1], val = m[2];
            if (this.isTier(tier) && this.isDiscount(parseInt(val)) && !usedTiers.has(tier)) {
                keys.add(`${tier}/${val}折`);
                usedTiers.add(tier);
            }
        }
    },

    /**
     * 提取纯档位
     */
    extractPureTiers(content, keys, usedTiers) {
        const pattern = /(^|[^\d])(\d{3,6})([^\d]|$)/g;
        let m;
        while ((m = pattern.exec(content)) !== null) {
            const num = m[2];
            if (this.isTier(num) && !usedTiers.has(num)) {
                keys.add(`${num}/${this.config.defaultDiscount}折`);
            }
            pattern.lastIndex = m.index + m[1].length + m[2].length;
        }
    },

    /**
     * 提取纯折扣
     */
    extractPureDiscounts(content, keys) {
        const p1 = /(?<![\/\d])(\d{2})\s*折/g;
        let m;
        while ((m = p1.exec(content)) !== null) {
            const val = parseInt(m[1]);
            if (this.isDiscount(val)) {
                keys.add(`${this.config.defaultTier}/${val}折`);
            }
        }
    },

    isTier(num) {
        const n = parseInt(num);
        return n >= this.config.tierRange.min && n <= this.config.tierRange.max;
    },

    isDiscount(num) {
        const n = parseInt(num);
        return n >= this.config.discountRange.min && n <= this.config.discountRange.max;
    },

    isDeduct(num) {
        const n = parseInt(num);
        return n >= this.config.deductRange.min && n <= this.config.deductRange.max;
    },

    isMatch(parsed, couponKey) {
        if (parsed.toLowerCase() === couponKey) return true;

        const pNums = parsed.match(/\d+/g) || [];
        const cNums = couponKey.match(/\d+/g) || [];

        if (pNums.length >= 2 && cNums.length >= 2) {
            return pNums[0] === cNums[0] && pNums[1] === cNums[1];
        }

        if (pNums.length >= 1 && cNums.length >= 1) {
            return pNums[0] === cNums[0];
        }

        return false;
    }
};

// 导出模块
window.YhquanJxModule = YhquanJxModule;
