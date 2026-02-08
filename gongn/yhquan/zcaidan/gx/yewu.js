/**
 * 优惠券模块 - 共享业务逻辑（集成抢券活动）
 */
const GxYewu = {
    currentCoupon: null,
    shareData: null,
    shareListener: null,
    activityData: null,
    activityId: null,
    areaProvinces: null,
    _operationInProgress: false,

    // 判断共享是否处于开启状态：数据库标识 → 活动API存在性
    isSharingActive() {
        // 数据库有明确标识，直接使用
        if (this.shareData?.shifenggongxiang !== undefined && this.shareData?.shifenggongxiang !== null) {
            return this.shareData.shifenggongxiang === true;
        }
        // 数据库无标识，活动API存在则视为开启
        return this.activityData != null;
    },

    // 客户类型映射
    STORE_SUB_TYPES: [
        { value: -1, label: '不限' },
        { value: 2, label: '零售单体' },
        { value: 4, label: '第三终端' },
        { value: 5, label: '民营医院' },
        { value: 1, label: '连锁总部(批零一体)' },
        { value: 3, label: '连锁加盟' },
        { value: 6, label: '连锁总部(纯连锁)' },
        { value: 7, label: '商业公司' },
        { value: 8, label: '医疗器械经营店' }
    ],

    // ========== 生命周期 ==========

    show(coupon) {
        this.currentCoupon = coupon;
        this.shareData = null;
        this.activityData = null;
        this.activityId = null;
        this.areaProvinces = null;

        // 立即渲染弹窗
        this.render();
        this.bindEvents();

        if (coupon.isSharing) {
            // 已共享：加载数据库和活动API数据
            this.setFormLoading(true);
            this.loadAllData().then(() => {
                this.refreshBody();
                this.bindBodyEvents();
                this.setFormLoading(false);
                this.setupShareListener();
            }).catch(err => {
                console.error('加载数据失败:', err);
                this.setFormLoading(false);
            });
        } else {
            // 未共享：仅加载区域选项（供开启时选择），其余使用默认值
            this.setFormLoading(true);
            this.loadAreaProvinces().then(() => {
                this.refreshBody();
                this.bindBodyEvents();
                this.setFormLoading(false);
                this.setupShareListener();
            }).catch(err => {
                console.error('加载区域数据失败:', err);
                this.setFormLoading(false);
            });
        }
    },

    hide() {
        this.cleanupShareListener();
        const modal = document.getElementById('yhquan-gx-modal');
        if (modal) modal.remove();
        this.currentCoupon = null;
        this.shareData = null;
        this.activityData = null;
        this.activityId = null;
        this.areaProvinces = null;
    },

    // ========== Firebase 监听 ==========

    setupShareListener() {
        try {
            this.cleanupShareListener();
            if (!this.currentCoupon) return;

            const db = firebase.database();
            const couponRef = db.ref(`yhq_gx/${this.currentCoupon.id}`);

            this.shareListener = couponRef.on('value', (snapshot) => {
                this.shareData = snapshot.val();
                this.updateButtonState();
            });
        } catch (error) {
            console.error('设置共享状态监听失败:', error);
        }
    },

    cleanupShareListener() {
        if (this.shareListener && this.currentCoupon) {
            try {
                const db = firebase.database();
                db.ref(`yhq_gx/${this.currentCoupon.id}`).off('value', this.shareListener);
                this.shareListener = null;
            } catch (error) {
                console.error('清理共享状态监听失败:', error);
            }
        }
    },

    // ========== 卡片状态 ==========

    updateCardStatusIcon(couponId, isSharing) {
        try {
            let coupon = null;
            if (window.YhquanModule?.state?.allCoupons) {
                coupon = window.YhquanModule.state.allCoupons.find(c => String(c.id) === String(couponId));
                if (coupon) coupon.isSharing = isSharing;
            }

            const card = document.querySelector(`.yhquan-card[data-id="${couponId}"]`);
            if (card && coupon) {
                const statusIcon = card.querySelector('.yhquan-status-icon');
                if (statusIcon) {
                    statusIcon.textContent = YhquanGongju.getStatusIcon(coupon);
                }
            }
        } catch (error) {
            console.error('更新卡片状态图标失败:', error);
        }
    },

    // ========== 数据加载 ==========

    async loadShareData() {
        try {
            const db = firebase.database();
            const snapshot = await db.ref(`yhq_gx/${this.currentCoupon.id}`).once('value');
            this.shareData = snapshot.val();
        } catch (error) {
            console.error('加载共享数据失败:', error);
            this.shareData = null;
        }
    },

    async loadActivityData() {
        try {
            if (!window.EwmYewu) return;
            const queryResult = await EwmYewu.queryByCouponId(this.currentCoupon.id);

            if (queryResult && queryResult.activityId) {
                this.activityId = queryResult.activityId;
                this.activityData = await EwmYewu.getActivityDetail(queryResult.activityId);
            } else {
                this.activityId = null;
                this.activityData = null;
            }
        } catch (error) {
            console.error('加载抢券活动数据失败:', error);
            this.activityId = null;
            this.activityData = null;
        }
    },

    async loadAreaProvinces() {
        try {
            if (!window.EwmYewu) return;
            const data = await EwmYewu.getAreaTree('#', this.activityId || undefined);
            if (Array.isArray(data)) {
                this.areaProvinces = data.map(item => ({
                    id: parseInt(String(item.id).replace('node_', '')),
                    text: item.text,
                    selected: item.state?.selected || false
                }));
            }
        } catch (error) {
            console.error('加载区域数据失败:', error);
            this.areaProvinces = null;
        }
    },

    async loadAllData() {
        // 并行加载 Firebase 和活动数据
        await Promise.all([
            this.loadShareData(),
            this.loadActivityData()
        ]);
        // 区域加载依赖 activityId，需在活动数据之后
        await this.loadAreaProvinces();
    },

    // ========== 加载状态控制 ==========

    setFormLoading(loading) {
        const body = document.querySelector('.yhquan-gx-body');
        const toggleBtn = document.getElementById('yhquan-gx-toggle');
        const resetBtn = document.getElementById('yhquan-gx-reset');
        const updateBtn = document.getElementById('yhquan-gx-update');

        if (loading) {
            if (body) body.style.opacity = '0.4';
            if (body) body.style.pointerEvents = 'none';
            if (toggleBtn) { toggleBtn.disabled = true; toggleBtn.classList.add('loading'); }
            if (resetBtn) { resetBtn.disabled = true; }
            if (updateBtn) { updateBtn.disabled = true; }
        } else {
            if (body) body.style.opacity = '1';
            if (body) body.style.pointerEvents = '';
            if (toggleBtn) toggleBtn.classList.remove('loading');
            if (resetBtn) resetBtn.classList.remove('loading');
            if (updateBtn) updateBtn.classList.remove('loading');
            this.updateButtonState();
        }
    },

    // ========== 刷新弹窗内容 ==========

    refreshBody() {
        const body = document.querySelector('.yhquan-gx-body');
        if (!body) return;

        const coupon = this.currentCoupon;
        const status = YhquanGongju.getCouponStatus(coupon);

        body.innerHTML = [
            this.renderCouponInfo(coupon, status),
            this.renderKeywordInput(),
            this.renderLimitSettings(),
            this.renderStoreSubTypes(),
            this.renderAreaSetting(),
            this.renderDateRange()
        ].join('');
    },

    // ========== 日期工具 ==========

    getTodayStr() {
        return new Date().toISOString().slice(0, 10);
    },

    getDefaultEndStr() {
        const d = new Date();
        d.setDate(d.getDate() + 2);
        let endStr = d.toISOString().slice(0, 10);
        // 不能超过优惠券结束日期
        if (this.currentCoupon?.endTime) {
            const couponEnd = this.currentCoupon.endTime.split(' ')[0];
            if (couponEnd < endStr) endStr = couponEnd;
        }
        return endStr;
    },

    // ========== 渲染：优惠券信息 ==========

    renderCouponInfo(coupon, status) {
        const escape = YhquanGongju.escapeHtml;
        return `
            <div class="yhquan-gx-section">
                <div class="yhquan-gx-section-title">1. 优惠券信息</div>
                <div class="yhquan-gx-info-grid">
                    <div class="yhquan-gx-info-row">
                        <span class="yhquan-gx-info-label">名称：</span>
                        <span class="yhquan-gx-info-value">${escape(coupon.name)}</span>
                    </div>
                    <div class="yhquan-gx-info-row">
                        <span class="yhquan-gx-info-label">详情：</span>
                        <span class="yhquan-gx-info-value">${escape(coupon.note || '暂无使用说明')}</span>
                    </div>
                    <div class="yhquan-gx-info-row">
                        <span class="yhquan-gx-info-label">有效期：</span>
                        <span class="yhquan-gx-info-value">${escape(YhquanGongju.getValidPeriod(coupon))}</span>
                    </div>
                    <div class="yhquan-gx-info-row">
                        <span class="yhquan-gx-info-label">状态：</span>
                        <span class="yhquan-gx-info-value" style="color: ${status.color};">${status.text}</span>
                    </div>
                </div>
            </div>
        `;
    },

    // ========== 渲染：活动名称（原触发关键字） ==========

    renderKeywordInput() {
        const escape = YhquanGongju.escapeHtml;
        const keyword = this.shareData?.guanjianzi || this.activityData?.eventName || '';
        return `
            <div class="yhquan-gx-section">
                <div class="yhquan-gx-section-title">2. 活动名称</div>
                <input type="text"
                       class="yhquan-gx-input"
                       id="yhquan-gx-keyword"
                       placeholder="留空则使用默认名称: ${escape(this.currentCoupon.name)}"
                       value="${escape(keyword)}">
            </div>
        `;
    },

    // ========== 渲染：数量设置 ==========

    renderLimitSettings() {
        const totalLimit = this.shareData?.zengsongzongshu || this.activityData?.couponAmount || 10000;
        const storeLimit = this.shareData?.dandianxianzhi || this.activityData?.couponNum || 5;

        return `
            <div class="yhquan-gx-section">
                <div class="yhquan-gx-section-title">3. 数量设置</div>
                <div class="yhquan-gx-limit-row">
                    <div class="yhquan-gx-limit-item">
                        <label class="yhquan-gx-limit-label">总量上限</label>
                        <input type="number" class="yhquan-gx-input" id="yhquan-gx-total" value="${totalLimit}" min="1">
                    </div>
                    <div class="yhquan-gx-limit-item">
                        <label class="yhquan-gx-limit-label">单店限制</label>
                        <input type="number" class="yhquan-gx-input" id="yhquan-gx-store" value="${storeLimit}" min="1" max="5">
                    </div>
                </div>
            </div>
        `;
    },

    // ========== 渲染：领券对象 ==========

    renderStoreSubTypes() {
        // 解析客户类型：数据库 → 活动API → 默认不限
        let selected = [-1];
        const validValues = this.STORE_SUB_TYPES.map(t => t.value);
        if (this.shareData?.kehuTypes != null && String(this.shareData.kehuTypes).trim() !== '') {
            const parsed = String(this.shareData.kehuTypes).split(',').map(Number).filter(n => !isNaN(n));
            if (parsed.length > 0) selected = parsed;
        } else if (this.activityData?.storeSubtypes != null && String(this.activityData.storeSubtypes).trim() !== '') {
            const parsed = String(this.activityData.storeSubtypes).split(',').map(Number).filter(n => !isNaN(n));
            if (parsed.length > 0) selected = parsed;
        }
        // 解析值无法匹配任何已知类型时，回退到"不限"
        if (!selected.some(v => validValues.includes(v))) selected = [-1];

        const chips = this.STORE_SUB_TYPES.map(t => {
            const isActive = selected.includes(t.value);
            return `<span class="yhquan-gx-chip${isActive ? ' active' : ''}" data-value="${t.value}">${t.label}</span>`;
        }).join('');

        return `
            <div class="yhquan-gx-section">
                <div class="yhquan-gx-section-title">4. 领券对象</div>
                <div class="yhquan-gx-chips" id="yhquan-gx-chips">${chips}</div>
            </div>
        `;
    },

    // ========== 渲染：区域设置 ==========

    renderAreaSetting() {
        // 数据库 → 活动API → 默认不限
        const dbLimitArea = this.shareData?.isLimitArea;
        let isLimited = (dbLimitArea !== undefined && dbLimitArea !== null)
            ? dbLimitArea === 1
            : this.activityData?.isLimitArea === 1;

        // 解析数据库中存储的已选区域ID
        let dbAreaIds = null;
        if (this.shareData?.selectedAreaIds) {
            dbAreaIds = String(this.shareData.selectedAreaIds).split(',').map(Number).filter(n => !isNaN(n) && n > 0);
        }

        // 预计算：标记为限制区域但实际无任何省份选中时，回退到"不限"
        if (isLimited && this.areaProvinces && this.areaProvinces.length > 0) {
            const hasAnyActive = this.areaProvinces.some(p => dbAreaIds ? dbAreaIds.includes(p.id) : p.selected);
            if (!hasAnyActive) isLimited = false;
        }

        const noLimitActive = !isLimited ? ' active' : '';

        let provinceChips = '';
        if (this.areaProvinces && this.areaProvinces.length > 0) {
            provinceChips = this.areaProvinces.map(p => {
                const isActive = isLimited && (dbAreaIds ? dbAreaIds.includes(p.id) : p.selected);
                return `<span class="yhquan-gx-chip yhquan-gx-area-chip${isActive ? ' active' : ''}" data-area-id="${p.id}">${p.text}</span>`;
            }).join('');
        }

        return `
            <div class="yhquan-gx-section">
                <div class="yhquan-gx-section-title">5. 区域设置</div>
                <div class="yhquan-gx-area-wrap" id="yhquan-gx-area-wrap">
                    <span class="yhquan-gx-chip${noLimitActive}" id="yhquan-gx-area-nolimit">不限</span>
                    ${provinceChips}
                </div>
            </div>
        `;
    },

    // ========== 渲染：抢券时间 ==========

    renderDateRange() {
        const beginDate = this.shareData?.beginTimeDate || this.activityData?.beginTimeDate || this.getTodayStr();
        const endDate = this.shareData?.endTimeDate || this.activityData?.endTimeDate || this.getDefaultEndStr();
        const maxDate = this.currentCoupon?.endTime ? this.currentCoupon.endTime.split(' ')[0] : '';

        return `
            <div class="yhquan-gx-section">
                <div class="yhquan-gx-section-title">6. 抢券时间</div>
                <div class="yhquan-gx-date-row">
                    <input type="date" class="yhquan-gx-date-input" id="yhquan-gx-begin"
                           value="${beginDate}" ${maxDate ? `max="${maxDate}"` : ''}>
                    <span class="yhquan-gx-date-sep">至</span>
                    <input type="date" class="yhquan-gx-date-input" id="yhquan-gx-end"
                           value="${endDate}" ${maxDate ? `max="${maxDate}"` : ''}>
                </div>
            </div>
        `;
    },

    // ========== 主渲染 ==========

    render() {
        const oldModal = document.getElementById('yhquan-gx-modal');
        if (oldModal) oldModal.remove();

        if (window.GxYangshi) GxYangshi.inject();

        const coupon = this.currentCoupon;
        const status = YhquanGongju.getCouponStatus(coupon);
        const isActive = this.isSharingActive();
        const isValid = status.text === '有效';

        const toggleBtnClass = isActive ? 'yhquan-gx-btn-danger' : 'yhquan-gx-btn-primary';
        const toggleBtnText = isActive ? '关闭' : '开启';
        const toggleBtnDisabled = !isValid ? 'disabled' : '';
        const resetDisabled = !isValid ? 'disabled' : '';

        const html = `
            <div id="yhquan-gx-modal" class="yhquan-gx-modal">
                <div class="yhquan-gx-overlay"></div>
                <div class="yhquan-gx-content">
                    <div class="yhquan-gx-header">
                        <span class="yhquan-gx-title">
                            <i class="fa-solid fa-share-nodes"></i> 共享 - ${YhquanGongju.escapeHtml(coupon.name)}
                        </span>
                        <button class="yhquan-gx-close"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="yhquan-gx-body">
                        ${this.renderCouponInfo(coupon, status)}
                        ${this.renderKeywordInput()}
                        ${this.renderLimitSettings()}
                        ${this.renderStoreSubTypes()}
                        ${this.renderAreaSetting()}
                        ${this.renderDateRange()}
                    </div>
                    <div class="yhquan-gx-footer">
                        <div class="yhquan-gx-footer-left">
                            <button class="yhquan-gx-btn yhquan-gx-btn-danger" id="yhquan-gx-reset" ${resetDisabled}>重置</button>
                            <button class="yhquan-gx-btn yhquan-gx-btn-warning" id="yhquan-gx-update" ${toggleBtnDisabled}>更新</button>
                        </div>
                        <button class="yhquan-gx-btn ${toggleBtnClass}" id="yhquan-gx-toggle" ${toggleBtnDisabled}>
                            ${toggleBtnText}
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    // ========== 按钮状态更新 ==========

    updateButtonState() {
        // 操作进行中时，不允许监听器恢复按钮状态
        if (this._operationInProgress) return;

        const toggleBtn = document.getElementById('yhquan-gx-toggle');
        if (!toggleBtn) return;

        const isActive = this.isSharingActive();
        const status = YhquanGongju.getCouponStatus(this.currentCoupon);
        const isValid = status.text === '有效';

        toggleBtn.className = `yhquan-gx-btn ${isActive ? 'yhquan-gx-btn-danger' : 'yhquan-gx-btn-primary'}`;
        toggleBtn.textContent = isActive ? '关闭' : '开启';
        toggleBtn.disabled = !isValid;
        toggleBtn.classList.remove('loading');

        const resetBtn = document.getElementById('yhquan-gx-reset');
        if (resetBtn) {
            resetBtn.disabled = !isValid;
            resetBtn.classList.remove('loading');
        }

        const updateBtn = document.getElementById('yhquan-gx-update');
        if (updateBtn) {
            updateBtn.disabled = !isValid;
            updateBtn.classList.remove('loading');
        }
    },

    // ========== 表单读取 ==========

    getFormValues() {
        const keyword = document.getElementById('yhquan-gx-keyword')?.value.trim() || this.currentCoupon.name;
        const storeLimit = Math.min(parseInt(document.getElementById('yhquan-gx-store')?.value) || 5, 5);
        const totalLimit = parseInt(document.getElementById('yhquan-gx-total')?.value) || 10000;
        const beginDate = document.getElementById('yhquan-gx-begin')?.value || this.getTodayStr();
        const endDate = document.getElementById('yhquan-gx-end')?.value || this.getDefaultEndStr();
        const storeSubTypes = this.getSelectedStoreSubTypes();
        const { isLimitArea, selectedAreaIds } = this.getSelectedAreaInfo();

        return { keyword, storeLimit, totalLimit, beginDate, endDate, storeSubTypes, isLimitArea, selectedAreaIds };
    },

    getSelectedStoreSubTypes() {
        const chips = document.querySelectorAll('#yhquan-gx-chips .yhquan-gx-chip.active');
        if (chips.length === 0) return [-1];
        const values = Array.from(chips).map(c => parseInt(c.dataset.value));
        // 如果选了"不限"，只返回[-1]
        if (values.includes(-1)) return [-1];
        return values;
    },

    getSelectedAreaInfo() {
        const noLimitChip = document.getElementById('yhquan-gx-area-nolimit');
        if (noLimitChip?.classList.contains('active')) {
            return { isLimitArea: 0, selectedAreaIds: [] };
        }
        const areaChips = document.querySelectorAll('#yhquan-gx-area-wrap .yhquan-gx-area-chip.active');
        const ids = Array.from(areaChips).map(c => parseInt(c.dataset.areaId));
        if (ids.length === 0) return { isLimitArea: 0, selectedAreaIds: [] };
        return { isLimitArea: 1, selectedAreaIds: ids };
    },

    // ========== 开启共享 ==========

    async openSharing() {
        this._operationInProgress = true;
        const toggleBtn = document.getElementById('yhquan-gx-toggle');
        const resetBtn = document.getElementById('yhquan-gx-reset');
        if (toggleBtn) { toggleBtn.classList.add('loading'); toggleBtn.disabled = true; }
        if (resetBtn) { resetBtn.disabled = true; }

        try {
            const form = this.getFormValues();

            // 1. 更新 Firebase（全字段）
            const db = firebase.database();
            const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

            await db.ref(`yhq_gx/${this.currentCoupon.id}`).update({
                shifenggongxiang: true,
                guanjianzi: form.keyword,
                mingcheng: form.keyword,
                gengxinshijian: now,
                zengsongzongshu: form.totalLimit,
                dandianxianzhi: form.storeLimit,
                yifafangzongshu: this.shareData?.yifafangzongshu || 0,
                kehuTypes: form.storeSubTypes.join(','),
                isLimitArea: form.isLimitArea,
                selectedAreaIds: form.selectedAreaIds.join(','),
                beginTimeDate: form.beginDate,
                endTimeDate: form.endDate
            });

            // 2. 处理抢券活动
            if (window.EwmYewu) {
                const activityParams = {
                    eventName: form.keyword,
                    couponTypeId: this.currentCoupon.id,
                    couponNum: form.storeLimit,
                    couponAmount: form.totalLimit,
                    tagBeginTimeDate: form.beginDate,
                    tagBeginTimeHms: '00:00:00',
                    beginTimeDate: form.beginDate,
                    beginTimeHms: '00:00:00',
                    endTimeDate: form.endDate,
                    endTimeHms: '23:59:59',
                    storeSubTypes: form.storeSubTypes,
                    isLimitArea: form.isLimitArea,
                    selectedAreaIds: form.selectedAreaIds,
                    deselectedAreaIds: []
                };

                const queryResult = await EwmYewu.queryByCouponId(this.currentCoupon.id);

                if (queryResult && queryResult.activityId) {
                    const detail = await EwmYewu.getActivityDetail(queryResult.activityId);
                    if (detail && detail.isClose === 1) {
                        await EwmYewu.enableActivity(queryResult.activityId, form.storeSubTypes);
                    }
                    await EwmYewu.editActivity(queryResult.activityId, activityParams);
                    this.activityId = queryResult.activityId;
                } else {
                    const newId = await EwmYewu.createNewActivity(activityParams);
                    this.activityId = newId;
                }

                // 同步内部状态：标记活动为启用
                if (!this.activityData) this.activityData = {};
                this.activityData.isClose = 0;
            }

            this.updateCardStatusIcon(this.currentCoupon.id, true);
            this.showNotification('共享已开启', 'success');
        } catch (error) {
            console.error('开启共享失败:', error);
            this.showNotification('开启失败: ' + error.message, 'error');
        } finally {
            // 所有操作完成后才恢复按钮状态
            this._operationInProgress = false;
            this.updateButtonState();
        }
    },

    // ========== 关闭共享 ==========

    async closeSharing() {
        this._operationInProgress = true;
        const toggleBtn = document.getElementById('yhquan-gx-toggle');
        const resetBtn = document.getElementById('yhquan-gx-reset');
        if (toggleBtn) { toggleBtn.classList.add('loading'); toggleBtn.disabled = true; }
        if (resetBtn) { resetBtn.disabled = true; }

        try {
            const form = this.getFormValues();

            // 1. Firebase 更新状态和数据（保留节点）
            const db = firebase.database();
            const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
            await db.ref(`yhq_gx/${this.currentCoupon.id}`).update({
                shifenggongxiang: false,
                guanjianzi: form.keyword,
                mingcheng: form.keyword,
                gengxinshijian: now,
                zengsongzongshu: form.totalLimit,
                dandianxianzhi: form.storeLimit,
                kehuTypes: form.storeSubTypes.join(','),
                isLimitArea: form.isLimitArea,
                selectedAreaIds: form.selectedAreaIds.join(','),
                beginTimeDate: form.beginDate,
                endTimeDate: form.endDate
            });

            // 2. 处理抢券活动：先禁用再删除
            if (window.EwmYewu) {
                try {
                    const queryResult = await EwmYewu.queryByCouponId(this.currentCoupon.id);
                    if (queryResult && queryResult.activityId) {
                        const storeSubTypes = this.getSelectedStoreSubTypes();
                        await EwmYewu.disableActivity(queryResult.activityId, storeSubTypes);
                        await EwmYewu.deleteActivity(queryResult.activityId);
                    }
                } catch (apiErr) {
                    console.error('关闭抢券活动失败:', apiErr);
                }
            }

            this.activityId = null;
            this.activityData = null;
            this.updateCardStatusIcon(this.currentCoupon.id, false);
            this.showNotification('共享已关闭', 'success');
        } catch (error) {
            console.error('关闭共享失败:', error);
            this.showNotification('关闭失败，请重试', 'error');
        } finally {
            // 所有操作完成后才恢复按钮状态
            this._operationInProgress = false;
            this.updateButtonState();
        }
    },

    // ========== 切换 ==========

    async handleToggle() {
        if (this.isSharingActive()) {
            await this.closeSharing();
        } else {
            await this.openSharing();
        }
    },

    // ========== 重置 ==========

    async handleReset() {
        this._operationInProgress = true;
        const resetBtn = document.getElementById('yhquan-gx-reset');
        const toggleBtn = document.getElementById('yhquan-gx-toggle');
        if (resetBtn) { resetBtn.classList.add('loading'); resetBtn.disabled = true; }
        if (toggleBtn) { toggleBtn.disabled = true; }

        try {
            // 1. 重置 Firebase（全字段）
            const db = firebase.database();
            const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
            await db.ref(`yhq_gx/${this.currentCoupon.id}`).update({
                guanjianzi: this.currentCoupon.name,
                mingcheng: this.currentCoupon.name,
                gengxinshijian: now,
                yaodiantongji: null,
                yifafangzongshu: 0,
                dandianxianzhi: 5,
                zengsongzongshu: 10000,
                kehuTypes: '-1',
                isLimitArea: 0,
                selectedAreaIds: '',
                beginTimeDate: this.getTodayStr(),
                endTimeDate: this.getDefaultEndStr()
            });

            // 2. 同步修改抢券活动
            const resetDefaults = {
                eventName: this.currentCoupon.name,
                couponTypeId: this.currentCoupon.id,
                couponNum: 5,
                couponAmount: 10000,
                tagBeginTimeDate: this.getTodayStr(),
                tagBeginTimeHms: '00:00:00',
                beginTimeDate: this.getTodayStr(),
                beginTimeHms: '00:00:00',
                endTimeDate: this.getDefaultEndStr(),
                endTimeHms: '23:59:59',
                storeSubTypes: [-1],
                isLimitArea: 0,
                selectedAreaIds: [],
                deselectedAreaIds: []
            };

            if (window.EwmYewu && this.activityId) {
                try {
                    await EwmYewu.editActivity(this.activityId, resetDefaults);
                } catch (apiErr) {
                    console.error('同步重置抢券活动失败:', apiErr);
                }
            }

            // 3. 更新内部状态为重置后的值
            if (this.shareData) {
                this.shareData.guanjianzi = this.currentCoupon.name;
                this.shareData.mingcheng = this.currentCoupon.name;
                this.shareData.dandianxianzhi = 5;
                this.shareData.zengsongzongshu = 10000;
                this.shareData.yifafangzongshu = 0;
                this.shareData.yaodiantongji = null;
                this.shareData.kehuTypes = '-1';
                this.shareData.isLimitArea = 0;
                this.shareData.selectedAreaIds = '';
                this.shareData.beginTimeDate = this.getTodayStr();
                this.shareData.endTimeDate = this.getDefaultEndStr();
            }
            if (this.activityData) {
                this.activityData.eventName = this.currentCoupon.name;
                this.activityData.couponNum = 5;
                this.activityData.couponAmount = 10000;
                this.activityData.storeSubtypes = '-1';
                this.activityData.isLimitArea = 0;
                this.activityData.beginTimeDate = this.getTodayStr();
                this.activityData.endTimeDate = this.getDefaultEndStr();
            }

            // 4. 刷新前端 UI
            this.refreshBody();
            this.bindBodyEvents();

            this.showNotification(`${this.currentCoupon.name} 重置成功！`, 'success');
        } catch (error) {
            console.error('重置失败:', error);
            this.showNotification('重置失败，请重试', 'error');
        } finally {
            this._operationInProgress = false;
            this.updateButtonState();
        }
    },

    // ========== 更新 ==========

    async handleUpdate() {
        this._operationInProgress = true;
        const updateBtn = document.getElementById('yhquan-gx-update');
        const toggleBtn = document.getElementById('yhquan-gx-toggle');
        const resetBtn = document.getElementById('yhquan-gx-reset');
        if (updateBtn) { updateBtn.classList.add('loading'); updateBtn.disabled = true; }
        if (toggleBtn) { toggleBtn.disabled = true; }
        if (resetBtn) { resetBtn.disabled = true; }

        try {
            const form = this.getFormValues();

            // 1. 更新 Firebase（全字段）
            const db = firebase.database();
            const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
            await db.ref(`yhq_gx/${this.currentCoupon.id}`).update({
                guanjianzi: form.keyword,
                mingcheng: form.keyword,
                gengxinshijian: now,
                zengsongzongshu: form.totalLimit,
                dandianxianzhi: form.storeLimit,
                kehuTypes: form.storeSubTypes.join(','),
                isLimitArea: form.isLimitArea,
                selectedAreaIds: form.selectedAreaIds.join(','),
                beginTimeDate: form.beginDate,
                endTimeDate: form.endDate
            });

            // 2. 如果有活动，同步编辑活动信息
            if (window.EwmYewu && this.activityId) {
                await EwmYewu.editActivity(this.activityId, {
                    eventName: form.keyword,
                    couponTypeId: this.currentCoupon.id,
                    couponNum: form.storeLimit,
                    couponAmount: form.totalLimit,
                    tagBeginTimeDate: form.beginDate,
                    tagBeginTimeHms: '00:00:00',
                    beginTimeDate: form.beginDate,
                    beginTimeHms: '00:00:00',
                    endTimeDate: form.endDate,
                    endTimeHms: '23:59:59',
                    storeSubTypes: form.storeSubTypes,
                    isLimitArea: form.isLimitArea,
                    selectedAreaIds: form.selectedAreaIds,
                    deselectedAreaIds: []
                });
            }

            this.showNotification('更新成功', 'success');
        } catch (error) {
            console.error('更新失败:', error);
            this.showNotification('更新失败: ' + error.message, 'error');
        } finally {
            this._operationInProgress = false;
            this.updateButtonState();
        }
    },

    // ========== 通知 ==========

    showNotification(message, type = 'info') {
        if (window.Tongzhi) {
            Tongzhi.show(message, type);
        } else {
            alert(message);
        }
    },

    // ========== 事件绑定（头部+底部，只绑一次） ==========

    bindEvents() {
        const closeBtn = document.querySelector('.yhquan-gx-close');
        const toggleBtn = document.getElementById('yhquan-gx-toggle');
        const resetBtn = document.getElementById('yhquan-gx-reset');
        const updateBtn = document.getElementById('yhquan-gx-update');

        closeBtn?.addEventListener('click', () => this.hide());
        toggleBtn?.addEventListener('click', () => this.handleToggle());
        resetBtn?.addEventListener('click', () => this.handleReset());
        updateBtn?.addEventListener('click', () => this.handleUpdate());
    },

    // ========== 事件绑定（内容区，每次刷新后重新绑定） ==========

    bindBodyEvents() {
        // 单店限制：大于5自动修正为5
        const storeInput = document.getElementById('yhquan-gx-store');
        if (storeInput) {
            storeInput.addEventListener('input', () => {
                const val = parseInt(storeInput.value);
                if (val > 5) {
                    storeInput.value = 5;
                    this.showNotification('单店限制最大为 5', 'warning');
                }
            });
        }

        // 领券对象多选标签
        const chipsContainer = document.getElementById('yhquan-gx-chips');
        if (chipsContainer) {
            chipsContainer.addEventListener('click', (e) => {
                const chip = e.target.closest('.yhquan-gx-chip');
                if (!chip) return;
                const value = parseInt(chip.dataset.value);

                if (value === -1) {
                    chipsContainer.querySelectorAll('.yhquan-gx-chip').forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                } else {
                    const unlimitedChip = chipsContainer.querySelector('[data-value="-1"]');
                    if (unlimitedChip) unlimitedChip.classList.remove('active');
                    chip.classList.toggle('active');
                    const anyActive = chipsContainer.querySelector('.yhquan-gx-chip.active');
                    if (!anyActive && unlimitedChip) unlimitedChip.classList.add('active');
                }
            });
        }

        // 区域设置多选标签
        const areaWrap = document.getElementById('yhquan-gx-area-wrap');
        if (areaWrap) {
            areaWrap.addEventListener('click', (e) => {
                const chip = e.target.closest('.yhquan-gx-chip');
                if (!chip) return;
                const noLimitChip = document.getElementById('yhquan-gx-area-nolimit');

                if (chip === noLimitChip) {
                    areaWrap.querySelectorAll('.yhquan-gx-area-chip').forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                } else {
                    if (noLimitChip) noLimitChip.classList.remove('active');
                    chip.classList.toggle('active');
                    const anyActive = areaWrap.querySelector('.yhquan-gx-area-chip.active');
                    if (!anyActive && noLimitChip) noLimitChip.classList.add('active');
                }
            });
        }

        // 抢券时间联动
        const beginInput = document.getElementById('yhquan-gx-begin');
        const endInput = document.getElementById('yhquan-gx-end');
        const maxDate = this.currentCoupon?.endTime ? this.currentCoupon.endTime.split(' ')[0] : '';

        if (beginInput) {
            beginInput.addEventListener('change', () => {
                if (!beginInput.value || !endInput) return;
                const d = new Date(beginInput.value);
                d.setDate(d.getDate() + 2);
                let endStr = d.toISOString().slice(0, 10);
                if (maxDate && endStr > maxDate) endStr = maxDate;
                endInput.value = endStr;
            });
        }
        if (endInput) {
            endInput.addEventListener('change', () => {
                if (!endInput.value || !beginInput) return;
                const d = new Date(endInput.value);
                d.setDate(d.getDate() - 2);
                const today = new Date().toISOString().slice(0, 10);
                let beginStr = d.toISOString().slice(0, 10);
                if (beginStr < today) beginStr = today;
                beginInput.value = beginStr;
            });
        }
    }
};

window.GxYewu = GxYewu;
