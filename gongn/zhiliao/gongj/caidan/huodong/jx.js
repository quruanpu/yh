// 智聊指令 - 活动解析模块（通用智能版）
const ZhiLiaoHdJiexiModule = {
    // 配置：定义数字范围
    config: {
        // 折扣范围：90-99
        discountRange: { min: 90, max: 99 },
        // 减免金额范围：5-500
        deductRange: { min: 5, max: 500 },
        // 档位金额范围：300-100000
        tierRange: { min: 300, max: 100000 },
        // 默认值
        defaultTier: 2000,
        defaultDiscount: 98
    },

    // 中文数字映射
    chineseMap: {
        '一百': 100, '两百': 200, '二百': 200, '三百': 300, '五百': 500,
        '一千': 1000, '两千': 2000, '二千': 2000, '三千': 3000,
        '四千': 4000, '四千五': 4500, '五千': 5000,
        '一万': 10000, '两万': 20000, '三万': 30000, '五万': 50000, '十万': 100000,
        // 混合格式：阿拉伯数字+中文单位
        '1百': 100, '2百': 200, '3百': 300, '5百': 500,
        '1千': 1000, '2千': 2000, '3千': 3000, '4千': 4000, '5千': 5000,
        '1万': 10000, '2万': 20000, '3万': 30000, '5万': 50000, '10万': 100000
    },

    // 主入口：匹配关键字
    matchKeywords(content, coupons) {
        const matched = [];
        const matchedIds = new Set();

        // 1. 解析用户输入，生成所有可能的关键字
        const parsedKeys = this.parseInput(content);
        console.log('[解析] 用户输入:', content);
        console.log('[解析] 生成关键字:', parsedKeys);
        console.log('[解析] 可用优惠券:', coupons.map(c => c.keyword));

        // 2. 遍历解析出的关键字，为每个关键字找匹配的优惠券
        for (const parsedKey of parsedKeys) {
            const normalizedParsed = this.normalizeKey(parsedKey);

            // 找到匹配这个关键字的优惠券
            for (const coupon of coupons) {
                if (matchedIds.has(coupon.id)) continue;

                const couponKey = coupon.keyword.toLowerCase();
                const normalizedCoupon = this.normalizeKey(couponKey);

                // 比较标准化后的关键字
                if (normalizedParsed === normalizedCoupon || this.isMatch(parsedKey, couponKey)) {
                    console.log(`[匹配] ${parsedKey} -> ${coupon.keyword}`);
                    matched.push(coupon);
                    matchedIds.add(coupon.id);
                    break; // 每个解析关键字只匹配一个优惠券
                }
            }
        }

        console.log('[解析] 最终匹配:', matched.map(c => c.keyword));
        return matched;
    },

    // 标准化关键字（提取数字作为唯一标识）
    normalizeKey(key) {
        const nums = key.match(/\d+/g) || [];
        return nums.join('-');
    },

    // 解析用户输入，返回所有可能的关键字
    parseInput(content) {
        const keys = new Set();
        const usedTiers = new Set(); // 记录已用于完整格式的档位

        // 第一步：移除固定格式标识符（门店ID、手机号、客户编码）
        let cleaned = this.removeIdentifiers(content);

        // 第二步：替换中文数字为阿拉伯数字
        let normalized = this.replaceChineseNumbers(cleaned);

        // 第三步：提取完整格式（档位+优惠）
        this.extractCompleteFormats(normalized, keys, usedTiers);

        // 第四步：提取纯档位（排除已用的）
        this.extractPureTiers(normalized, keys, usedTiers);

        // 第五步：提取纯折扣/减免
        this.extractPureDiscounts(normalized, keys);

        // 第六步：兜底
        if (keys.size === 0) {
            keys.add(`${this.config.defaultTier}/${this.config.defaultDiscount}折`);
        }

        return Array.from(keys);
    },

    // 移除固定格式标识符
    removeIdentifiers(content) {
        let result = content;
        // 门店ID：7位数字（前后不能是数字）- 使用兼容写法
        result = result.replace(/(^|[^\d])\d{7}([^\d]|$)/g, '$1$2');
        // 手机号：11位数字（前后不能是数字）
        result = result.replace(/(^|[^\d])\d{11}([^\d]|$)/g, '$1$2');
        // 客户编码：K开头的4-10位数字
        result = result.replace(/K\d{4,10}/gi, '');
        return result;
    },

    // 替换中文数字
    replaceChineseNumbers(content) {
        let result = content;
        // 按长度降序排列，避免"四千五"被"四千"先匹配
        const sorted = Object.entries(this.chineseMap).sort((a, b) => b[0].length - a[0].length);
        for (const [cn, num] of sorted) {
            // 替换时在数字后加空格，避免和后面的数字连在一起（如"3千98"变成"3000 98"而不是"300098"）
            result = result.replace(new RegExp(cn, 'g'), String(num) + ' ');
        }
        return result;
    },

    // 提取完整格式
    extractCompleteFormats(content, keys, usedTiers) {
        // 格式1: 1000/98折 或 1000/98
        const p1 = /(\d{3,6})\s*[\/]\s*(\d{2,3})\s*折?/g;
        let m;
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

        // 格式3: 1000-50 或 1000减50（满减）
        const p3 = /(\d{3,6})\s*[-减]\s*(\d{1,3})(?!折)/g;
        while ((m = p3.exec(content)) !== null) {
            const tier = m[1], deduct = m[2];
            if (this.isTier(tier) && this.isDeduct(deduct)) {
                // 满减格式，生成多种表达
                keys.add(`${tier}/${deduct}`);
                keys.add(`${tier}-${deduct}`);
                keys.add(`${tier}减${deduct}`);
                usedTiers.add(tier);
            }
        }

        // 格式4: 3000 98 或 3000  99（空格分隔的档位+折扣）
        // 匹配：档位(3-6位) + 空格 + 折扣(2位，90-99范围)
        const p4 = /(\d{3,6})\s+(\d{2})(?!\d)/g;
        while ((m = p4.exec(content)) !== null) {
            const tier = m[1], val = m[2];
            // 确保是有效档位且折扣在90-99范围内
            if (this.isTier(tier) && this.isDiscount(parseInt(val)) && !usedTiers.has(tier)) {
                keys.add(`${tier}/${val}折`);
                usedTiers.add(tier);
            }
        }
    },

    // 提取纯档位
    extractPureTiers(content, keys, usedTiers) {
        // 匹配独立的3-6位数字（前后不能是数字）- 使用兼容写法
        const pattern = /(^|[^\d])(\d{3,6})([^\d]|$)/g;
        let m;
        while ((m = pattern.exec(content)) !== null) {
            const num = m[2];
            if (this.isTier(num) && !usedTiers.has(num)) {
                keys.add(`${num}/${this.config.defaultDiscount}折`);
            }
            // 重置lastIndex以避免跳过匹配（因为捕获组包含边界字符）
            pattern.lastIndex = m.index + m[1].length + m[2].length;
        }
    },

    // 提取纯折扣/减免
    extractPureDiscounts(content, keys) {
        // 匹配 xx折（前面不能是数字或斜杠）
        const p1 = /(?<![\/\d])(\d{2})\s*折/g;
        let m;
        while ((m = p1.exec(content)) !== null) {
            const val = parseInt(m[1]);
            if (this.isDiscount(val)) {
                keys.add(`${this.config.defaultTier}/${val}折`);
            }
        }
    },

    // 判断是否为档位金额
    isTier(num) {
        const n = parseInt(num);
        return n >= this.config.tierRange.min && n <= this.config.tierRange.max;
    },

    // 判断是否为折扣
    isDiscount(num) {
        const n = parseInt(num);
        return n >= this.config.discountRange.min && n <= this.config.discountRange.max;
    },

    // 判断是否为减免金额
    isDeduct(num) {
        const n = parseInt(num);
        return n >= this.config.deductRange.min && n <= this.config.deductRange.max;
    },

    // 匹配两个关键字
    isMatch(parsed, couponKey) {
        // 完全匹配
        if (parsed.toLowerCase() === couponKey) return true;

        // 提取数字比较
        const pNums = parsed.match(/\d+/g) || [];
        const cNums = couponKey.match(/\d+/g) || [];

        // 两个数字都有，比较两个
        if (pNums.length >= 2 && cNums.length >= 2) {
            return pNums[0] === cNums[0] && pNums[1] === cNums[1];
        }

        // 只有一个数字，比较第一个
        if (pNums.length >= 1 && cNums.length >= 1) {
            return pNums[0] === cNums[0];
        }

        return false;
    }
};

// 导出模块
window.ZhiLiaoHdJiexiModule = ZhiLiaoHdJiexiModule;
