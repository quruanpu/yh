/**
 * 优惠券活动共享/创建校验模块
 * 仅负责业务校验，不处理 UI 渲染
 */
const YhquanHdJiaoyanModule = {
    config: {
        minPayAreaLimitThreshold: 2000,
        aggressiveDiscountThreshold: 0.98
    },

    inferCouponType(coupon) {
        if (!coupon || typeof coupon !== 'object') return null;

        const known = new Set([11, 13, 25]);
        const directKeys = ['type', 'couponType', 'couponTypeId', 'typeId', 'coupon_type', 'coupon_type_id'];
        for (let i = 0; i < directKeys.length; i += 1) {
            const key = directKeys[i];
            const num = Number(coupon[key]);
            if (known.has(num)) return num;
        }

        // 结构化字段优先：不依赖文案识别
        if (coupon.discount != null) return 13;
        if (coupon.price != null && coupon.minPay != null) return 11;
        return null;
    },

    parseDiscountRate(raw) {
        if (raw == null || raw === '') return null;

        if (typeof raw === 'string') {
            const foldMatch = raw.match(/(\d+(?:\.\d+)?)\s*\u6298/);
            if (foldMatch) {
                const n = Number(foldMatch[1]);
                if (Number.isFinite(n) && n > 0) {
                    return n > 1 ? n / 10 : n;
                }
            }

            const pctMatch = raw.match(/(\d+(?:\.\d+)?)\s*%/);
            if (pctMatch) {
                const n = Number(pctMatch[1]);
                if (Number.isFinite(n) && n > 0) return n / 100;
            }
        }

        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) return null;
        if (n <= 1) return n;
        if (n <= 10) return n / 10;
        if (n <= 100) return n / 100;
        return null;
    },

    getDiscountCouponRate(coupon) {
        if (!coupon || typeof coupon !== 'object') return null;
        // 仅使用结构化字段，不从文本推断
        const candidates = [coupon.discount];
        for (let i = 0; i < candidates.length; i += 1) {
            const rate = this.parseDiscountRate(candidates[i]);
            if (rate != null) return rate;
        }
        return null;
    },

    getFullReductionEffectiveRate(coupon) {
        if (!coupon || typeof coupon !== 'object') return null;
        // 仅使用结构化字段：minPay + price
        const minPay = Number(coupon.minPay);
        const price = Number(coupon.price);
        if (!Number.isFinite(minPay) || minPay <= 0) return null;
        if (!Number.isFinite(price) || price <= 0 || price >= minPay) return null;
        return (minPay - price) / minPay;
    },

    normalizeAreaInfo(areaInfo = {}) {
        const isLimitArea = Number(areaInfo?.isLimitArea) === 1 ? 1 : 0;
        const selectedAreaIds = Array.isArray(areaInfo?.selectedAreaIds)
            ? areaInfo.selectedAreaIds
                .map(id => Number(id))
                .filter(id => Number.isFinite(id))
            : [];
        return { isLimitArea, selectedAreaIds };
    },

    normalizeStoreSubTypes(storeSubTypes = []) {
        if (!Array.isArray(storeSubTypes)) return [];
        const seen = new Set();
        const values = [];
        storeSubTypes.forEach((item) => {
            const n = Number(item);
            if (!Number.isInteger(n) || n < -1) return;
            if (seen.has(n)) return;
            seen.add(n);
            values.push(n);
        });
        return values;
    },

    isUnlimitedArea(areaInfo = {}) {
        const normalized = this.normalizeAreaInfo(areaInfo);
        return !(normalized.isLimitArea === 1 && normalized.selectedAreaIds.length > 0);
    },

    hasLimitedArea(areaInfo = {}) {
        const normalized = this.normalizeAreaInfo(areaInfo);
        return normalized.isLimitArea === 1 && normalized.selectedAreaIds.length > 0;
    },

    hasLimitedAudience(storeSubTypes = []) {
        const normalized = this.normalizeStoreSubTypes(storeSubTypes);
        return normalized.some(v => v !== -1);
    },

    isHighDiscountCoupon(coupon) {
        const type = this.inferCouponType(coupon);
        const minPay = Number(coupon?.minPay);
        const minPayLow = Number.isFinite(minPay) &&
            minPay > 0 &&
            minPay < this.config.minPayAreaLimitThreshold;

        const fullReductionRate = this.getFullReductionEffectiveRate(coupon);
        const discountRate = this.getDiscountCouponRate(coupon);

        if (type === 11) {
            const discountAggressive = fullReductionRate != null && fullReductionRate < this.config.aggressiveDiscountThreshold;
            return minPayLow || discountAggressive;
        }

        if (type === 13) {
            const discountAggressive = discountRate != null && discountRate < this.config.aggressiveDiscountThreshold;
            return minPayLow || discountAggressive;
        }

        return false;
    },

    validateSharePolicy(coupon, areaInfo = {}) {
        const type = this.inferCouponType(coupon);
        const isUnlimited = this.isUnlimitedArea(areaInfo);

        if (type === 25) {
            return {
                pass: false,
                reason: 'FREE_SHIPPING',
                message: '免邮券暂不支持共享！'
            };
        }

        if ((type === 11 || type === 13) && this.isHighDiscountCoupon(coupon) && isUnlimited) {
            return {
                pass: false,
                reason: 'AREA_REQUIRED',
                message: '优惠较大，请设置至少1个区域！'
            };
        }

        return { pass: true, reason: 'OK', message: '' };
    },

    validateCreateRestriction(coupon, form = {}) {
        if (!this.isHighDiscountCoupon(coupon)) {
            return { pass: true, reason: 'SKIP_NOT_HIGH_DISCOUNT', message: '' };
        }

        const hasArea = this.hasLimitedArea({
            isLimitArea: form.isLimitArea,
            selectedAreaIds: form.selectedAreaIds
        });
        const hasAudience = this.hasLimitedAudience(form.storeSubTypes);

        if (!hasArea && !hasAudience) {
            return {
                pass: false,
                reason: 'AREA_AND_AUDIENCE_REQUIRED',
                message: '优惠力度过大，请设置领券对象和区域！'
            };
        }

        if (!hasArea) {
            return {
                pass: false,
                reason: 'AREA_REQUIRED',
                message: '优惠力度过大，请设置区域！'
            };
        }

        if (!hasAudience) {
            return {
                pass: false,
                reason: 'AUDIENCE_REQUIRED',
                message: '优惠力度过大，请设置领券对象！'
            };
        }

        return { pass: true, reason: 'OK', message: '' };
    },

    validateBeforeOpen(coupon) {
        const type = this.inferCouponType(coupon);
        if (type === 25) {
            return {
                pass: false,
                reason: 'FREE_SHIPPING',
                message: '免邮券暂不支持共享！'
            };
        }
        return { pass: true, reason: 'OK', message: '' };
    },

    shouldValidateOnSave(form = {}) {
        return form.availableStatus === 'enabled' && form.shareMode === 'public';
    },

    validateBeforeSave(coupon, form = {}) {
        if (!this.shouldValidateOnSave(form)) {
            return { pass: true, reason: 'SKIP_NOT_PUBLIC', message: '' };
        }

        const createValidation = this.validateCreateRestriction(coupon, form);
        if (!createValidation.pass) return createValidation;

        return this.validateSharePolicy(coupon, {
            isLimitArea: form.isLimitArea,
            selectedAreaIds: form.selectedAreaIds
        });
    }
};

window.YhquanHdJiaoyanModule = YhquanHdJiaoyanModule;
