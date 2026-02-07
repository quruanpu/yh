/**
 * 优惠券模块统一接口
 *
 * 职责：
 * 1. 封装优惠券模块的所有功能
 * 2. 提供统一的接口供外部模块（如智聊模块）调用
 * 3. 隔离内部实现细节，便于维护和扩展
 *
 * 接口列表：
 * - queryCoupons: 查询优惠券
 * - getCouponDetail: 获取优惠券详情
 * - renderCouponCard: 渲染优惠券卡片HTML
 * - showCouponList: 显示优惠券列表（UI操作）
 */
const CouponQueryInterface = {
    /**
     * 1. 查询优惠券
     * @param {Object} params - 查询参数
     * @param {string} [params.keyword=''] - 搜索关键词（空字符串表示加载所有）
     * @param {string} [params.category] - 优惠券类别（预留参数）
     * @param {string} [params.platform] - 平台（预留参数）
     * @returns {Promise<Object>} 查询结果
     * @returns {boolean} result.success - 是否成功
     * @returns {Array} result.data - 优惠券列表
     * @returns {string} result.error - 错误信息（失败时）
     * @returns {string} result.message - 提示信息
     */
    async queryCoupons(params = {}) {
        if (!window.YhquanGongju) {
            return { success: false, error: '优惠券工具模块未加载' };
        }

        const { keyword = '' } = params;

        return await YhquanGongju.searchCoupons(keyword);
    },

    /**
     * 2. 获取优惠券详情
     * @param {string|number} couponId - 优惠券ID
     * @returns {Promise<Object>} 查询结果
     * @returns {boolean} result.success - 是否成功
     * @returns {Object} result.data - 优惠券详情数据
     * @returns {string} result.error - 错误信息（失败时）
     */
    async getCouponDetail(couponId) {
        // 注意：当前优惠券模块没有单独的详情接口
        // 详情数据已包含在列表查询结果中
        // 如果需要单独的详情接口，可以在此扩展

        if (!couponId) {
            return { success: false, error: '请提供优惠券ID' };
        }

        // 简化实现：通过ID查询优惠券列表
        const result = await this.queryCoupons({ keyword: String(couponId) });

        if (!result.success) {
            return result;
        }

        const coupons = result.data || [];
        const coupon = coupons.find(c => String(c.id) === String(couponId));

        if (!coupon) {
            return { success: false, error: '未找到该优惠券' };
        }

        return {
            success: true,
            data: coupon
        };
    },

    /**
     * 3. 渲染优惠券卡片HTML
     * @param {Object} couponData - 优惠券数据
     * @param {number} [index=1] - 卡片序号
     * @returns {string} 优惠券卡片HTML字符串
     */
    renderCouponCard(couponData, index = 1) {
        if (!window.KapianYewu) {
            console.error('优惠券卡片渲染模块未加载');
            return '<div class="yhquan-error">卡片渲染模块未加载</div>';
        }

        if (!couponData) {
            console.error('优惠券数据为空');
            return '<div class="yhquan-error">优惠券数据为空</div>';
        }

        return KapianYewu.renderCard(couponData, index);
    },

    /**
     * 批量渲染优惠券卡片HTML
     * @param {Array} coupons - 优惠券数据数组
     * @param {number} [startIndex=1] - 起始序号
     * @returns {string} 优惠券卡片HTML字符串
     */
    renderCouponCards(coupons, startIndex = 1) {
        if (!window.KapianYewu) {
            console.error('优惠券卡片渲染模块未加载');
            return '<div class="yhquan-error">卡片渲染模块未加载</div>';
        }

        if (!Array.isArray(coupons) || coupons.length === 0) {
            return '<div class="yhquan-empty">暂无优惠券数据</div>';
        }

        return coupons.map((coupon, idx) =>
            KapianYewu.renderCard(coupon, startIndex + idx)
        ).join('');
    },

    /**
     * 4. 显示优惠券列表（UI操作）
     * @param {Array} coupons - 优惠券数据数组
     * @param {Object} [options] - 显示选项
     * @param {string} [options.containerId] - 容器ID（默认：智聊消息容器）
     * @returns {void}
     */
    showCouponList(coupons, options = {}) {
        if (!Array.isArray(coupons) || coupons.length === 0) {
            console.warn('优惠券列表为空');
            return;
        }

        // 生成卡片HTML
        const cardsHtml = this.renderCouponCards(coupons);

        // 获取容器
        const containerId = options.containerId || 'zhiliao-messages';
        const container = document.getElementById(containerId);

        if (!container) {
            console.error(`容器不存在: ${containerId}`);
            return;
        }

        // 创建优惠券列表容器
        const listContainer = document.createElement('div');
        listContainer.className = 'yhquan-list-container';
        listContainer.innerHTML = `
            <div class="yhquan-list-header">
                <span>🎫 优惠券列表（共${coupons.length}张）</span>
            </div>
            <div class="yhquan-list-content">
                ${cardsHtml}
            </div>
        `;

        // 添加到容器
        container.appendChild(listContainer);

        // 滚动到底部
        container.scrollTop = container.scrollHeight;
    }
};

// 导出模块
window.CouponQueryInterface = CouponQueryInterface;
