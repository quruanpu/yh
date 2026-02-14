/**
 * 优惠券模块 - 共享业务逻辑（集成抢券活动）
 */
const GxYewu = {
    currentCoupon: null,
    shareData: null,
    shareListener: null,
    activityList: null,
    activityData: null,
    activityId: null,
    areaProvinces: null,
    providerId: null,
    _operationInProgress: false,

    // 判断共享是否处于开启状态：有活动且未被禁用
    isSharingActive() {
        return this.activityData != null && this.activityData.isClose === 0;
    },

    // 客户类型映射（值与药师帮SCM后台一致）
    STORE_SUB_TYPES: [
        { value: -1, label: '不限' },
        { value: 0, label: '零售单体' },
        { value: 1, label: '第三终端' },
        { value: 2, label: '连锁总部(批零一体)' },
        { value: 3, label: '连锁加盟' },
        { value: 4, label: '连锁总部(纯连锁)' },
        { value: 5, label: '商业公司' },
        { value: 6, label: '民营医院' },
        { value: 8, label: '医疗器械经营店' }
    ],

    // ========== 生命周期 ==========

    async show(coupon) {
        this.currentCoupon = coupon;
        this.shareData = null;
        this.activityList = null;
        this.activityData = null;
        this.activityId = null;
        this.areaProvinces = null;

        // 获取当前供应商ID（路径隔离用）
        const creds = await window.LoginModule?.getScmCredentials();
        this.providerId = creds?.provider_id || null;
        if (!this.providerId) {
            console.error('无法获取供应商ID，共享功能不可用');
            return;
        }

        // 立即渲染弹窗
        this.render();
        this.bindEvents();

        // 统一加载：Firebase + 活动列表 + 选中活动详情 + 区域
        this.setFormLoading(true);
        this.loadAllData().then(() => {
            this.refreshBody();
            this.bindBodyEvents();
            this.setFormLoading(false);
            this.setupShareListener();
        }).catch(err => {
            console.error('加载数据失败:', err);
            // 即使加载失败，也要渲染表单并绑定事件，确保UI可交互
            this.refreshBody();
            this.bindBodyEvents();
            this.setFormLoading(false);
        });
    },

    hide() {
        this.cleanupShareListener();
        const modal = document.getElementById('yhquan-gx-modal');
        if (modal) modal.remove();
        this.currentCoupon = null;
        this.shareData = null;
        this.activityList = null;
        this.activityData = null;
        this.activityId = null;
        this.areaProvinces = null;
        this.providerId = null;
    },

    // ========== Firebase 监听 ==========

    setupShareListener() {
        try {
            this.cleanupShareListener();
            if (!this.currentCoupon) return;

            const db = firebase.database();
            const couponRef = db.ref(`yhq_gx/${this.providerId}/${this.currentCoupon.id}`);

            this.shareListener = couponRef.on('value', (snapshot) => {
                this.shareData = snapshot.val();
                this.updateButtonState();
                // 根据 shifenggongxiang 自动更新卡片图标
                const isSharing = !!(this.shareData?.shifenggongxiang);
                this.updateCardStatusIcon(this.currentCoupon.id, isSharing);
            });
        } catch (error) {
            console.error('设置共享状态监听失败:', error);
        }
    },

    cleanupShareListener() {
        if (this.shareListener && this.currentCoupon) {
            try {
                const db = firebase.database();
                db.ref(`yhq_gx/${this.providerId}/${this.currentCoupon.id}`).off('value', this.shareListener);
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
            if (!card) return;

            // 更新状态图标（🌎️/💡）
            if (coupon) {
                const statusIcon = card.querySelector('.yhquan-status-icon');
                if (statusIcon) {
                    statusIcon.textContent = YhquanGongju.getStatusIcon(coupon);
                }
            }

            // 更新二维码图标显示/隐藏
            const tagsRow = card.querySelector('.yhquan-card-tags');
            if (!tagsRow) return;
            const existingEwm = tagsRow.querySelector('.yhquan-tag-ewm');
            const isValid = coupon ? YhquanGongju.getCouponStatus(coupon).valid : false;

            if (isSharing && isValid) {
                if (!existingEwm) {
                    tagsRow.insertAdjacentHTML('beforeend',
                        `<span class="yhquan-tag yhquan-tag-ewm" data-id="${couponId}" title="生成二维码链接"><i class="fa-solid fa-qrcode"></i></span>`
                    );
                }
            } else {
                if (existingEwm) existingEwm.remove();
            }
        } catch (error) {
            console.error('更新卡片状态图标失败:', error);
        }
    },

    // ========== 数据加载 ==========

    async loadShareData() {
        try {
            const db = firebase.database();
            const firebasePromise = db.ref(`yhq_gx/${this.providerId}/${this.currentCoupon.id}`).once('value');
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Firebase 连接超时')), 8000)
            );
            const snapshot = await Promise.race([firebasePromise, timeoutPromise]);
            this.shareData = snapshot.val();
        } catch (error) {
            console.error('加载共享数据失败:', error);
            this.shareData = null;
        }
    },

    async loadActivityList() {
        try {
            if (!window.EwmYewu) return;
            const list = await EwmYewu.queryAllByCouponId(this.currentCoupon.id);
            this.activityList = Array.isArray(list) ? list : [];
        } catch (error) {
            console.error('加载活动列表失败:', error);
            this.activityList = [];
        }
    },

    async loadSelectedActivity(activityId) {
        try {
            if (!window.EwmYewu || !activityId) {
                this.activityId = null;
                this.activityData = null;
                return;
            }
            this.activityId = activityId;
            this.activityData = await EwmYewu.getActivityDetail(activityId);
        } catch (error) {
            console.error('加载活动详情失败:', error);
            this.activityId = null;
            this.activityData = null;
        }
    },

    async loadAreaProvinces() {
        try {
            if (!window.EwmYewu) return;
            const data = await EwmYewu.getAreaTree('#', this.activityId || undefined);
            if (Array.isArray(data)) {
                // 调试：打印第一个省份的完整数据结构，确认 state 字段格式
                if (data.length > 0) {
                    console.log('[区域调试] 第一个省份原始数据:', JSON.stringify(data[0]));
                }
                this.areaProvinces = data.map(item => {
                    const s = item.state;
                    let isSelected = false;
                    if (Array.isArray(s)) {
                        // SCM 实际格式: [{status:"selected",assured:true/false}, {status:"undetermined",assured:true/false}, ...]
                        isSelected = s.some(st =>
                            (st.status === 'selected' || st.status === 'undetermined') && st.assured === true
                        );
                    } else if (s && typeof s === 'object') {
                        // 兼容标准 jstree 对象格式
                        isSelected = !!(s.selected || s.checked || s.undetermined);
                    }
                    return {
                        id: parseInt(String(item.id).replace('node_', '')),
                        text: item.text,
                        selected: isSelected
                    };
                });
            }
        } catch (error) {
            console.error('加载区域数据失败:', error);
            this.areaProvinces = null;
        }
    },

    async loadAllData() {
        // 并行加载 Firebase（仅用于写入时的辅助字段）和活动列表（表单数据源）
        await Promise.all([
            this.loadShareData(),
            this.loadActivityList()
        ]);
        // 默认选中第一个活动，加载其详情
        const firstActivity = this.activityList?.[0];
        if (firstActivity) {
            await this.loadSelectedActivity(firstActivity.id);
        }
        // 异步加载区域数据（不阻塞UI，加载完后更新摘要）
        if (this.activityData?.isLimitArea === 1) {
            this.loadAreaProvinces().then(() => {
                this.updateAreaSummaryFromData();
            });
        }
    },

    // ========== 加载状态控制 ==========

    setFormLoading(loading) {
        const body = document.querySelector('.yhquan-gx-body');
        const toggleBtn = document.getElementById('yhquan-gx-toggle');
        const resetBtn = document.getElementById('yhquan-gx-reset');
        const updateBtn = document.getElementById('yhquan-gx-update');
        const deleteBtn = document.getElementById('yhquan-gx-delete');

        if (loading) {
            if (body) body.style.opacity = '0.4';
            if (body) body.style.pointerEvents = 'none';
            if (toggleBtn) { toggleBtn.disabled = true; toggleBtn.classList.add('loading'); }
            if (resetBtn) { resetBtn.disabled = true; }
            if (updateBtn) { updateBtn.disabled = true; }
            if (deleteBtn) { deleteBtn.disabled = true; }
        } else {
            if (body) body.style.opacity = '1';
            if (body) body.style.pointerEvents = '';
            if (toggleBtn) toggleBtn.classList.remove('loading');
            if (resetBtn) resetBtn.classList.remove('loading');
            if (updateBtn) updateBtn.classList.remove('loading');
            if (deleteBtn) deleteBtn.classList.remove('loading');
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
            this.renderActivitySelect(),
            this.renderKeywordInput(),
            this.renderLimitSettings(),
            this.renderStoreSubTypes(),
            this.renderAreaSetting(),
            this.renderDateRange()
        ].join('');
    },

    // ========== 日期工具 ==========

    formatLocalDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    getTodayStr() {
        return this.formatLocalDate(new Date());
    },

    getDefaultEndStr() {
        const d = new Date();
        d.setDate(d.getDate() + 2);
        let endStr = this.formatLocalDate(d);
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
                        <span class="yhquan-gx-info-value">${YhquanGongju.getCouponDetail(coupon)}</span>
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

    // ========== 渲染：抢券活动选择 ==========

    renderActivitySelect() {
        const list = this.activityList || [];
        const selectedId = this.activityId;

        let optionsHtml;
        if (list.length === 0) {
            optionsHtml = '<option value="">暂无抢券活动</option>';
        } else {
            optionsHtml = list.map(a => {
                const sel = String(a.id) === String(selectedId) ? ' selected' : '';
                const tag = a.isClose === 0 ? '启用' : '禁用';
                const tagClass = a.isClose === 0 ? 'yhquan-gx-tag-on' : 'yhquan-gx-tag-off';
                const name = YhquanGongju.escapeHtml(a.eventName || '未命名活动');
                return `<option value="${a.id}"${sel}>[${tag}] ${name}</option>`;
            }).join('');
        }

        return `
            <div class="yhquan-gx-section">
                <div class="yhquan-gx-section-title">2. 抢券活动</div>
                <select class="yhquan-gx-select" id="yhquan-gx-activity-select">
                    ${optionsHtml}
                </select>
            </div>
        `;
    },

    // ========== 渲染：活动名称（原触发关键字） ==========

    renderKeywordInput() {
        const escape = YhquanGongju.escapeHtml;
        const keyword = this.activityData?.eventName || '';
        return `
            <div class="yhquan-gx-section">
                <div class="yhquan-gx-section-title">3. 活动名称</div>
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
        const totalLimit = this.activityData?.couponAmount || 10000;
        const storeLimit = this.activityData?.couponNum || 5;

        return `
            <div class="yhquan-gx-section">
                <div class="yhquan-gx-section-title">4. 数量设置</div>
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

    // ========== 解析客户类型 ==========

    // 解析API返回的storeSubtypes（拼接的单字符格式，如 "0163" → [0,1,6,3]，"-1" → [-1]）
    parseApiStoreSubtypes(str) {
        const s = String(str).trim();
        if (s === '' || s === '-1') return [-1];
        return s.split('').map(Number).filter(n => !isNaN(n));
    },

    // ========== 渲染：领券对象 ==========

    renderStoreSubTypes() {
        // 解析客户类型：活动API → 默认不限
        let selected = [-1];
        const validValues = this.STORE_SUB_TYPES.map(t => t.value);
        if (this.activityData?.storeSubtypes != null && String(this.activityData.storeSubtypes).trim() !== '') {
            selected = this.parseApiStoreSubtypes(this.activityData.storeSubtypes);
        }
        if (!selected.some(v => validValues.includes(v))) selected = [-1];

        const isUnlimited = selected.includes(-1);
        const summaryText = isUnlimited ? '' : this.getChipsSummaryText(selected);
        const bodyChips = this.STORE_SUB_TYPES.filter(t => t.value !== -1).map(t => {
            const isActive = selected.includes(t.value);
            return `<span class="yhquan-gx-chip${isActive ? ' active' : ''}" data-value="${t.value}">${t.label}</span>`;
        }).join('');

        return `
            <div class="yhquan-gx-section">
                <div class="yhquan-gx-section-title">5. 领券对象</div>
                <div class="yhquan-gx-chips" id="yhquan-gx-chips">
                    <div class="yhquan-gx-collapse-header">
                        <span class="yhquan-gx-chip${isUnlimited ? ' active' : ''}" data-value="-1">不限</span>
                        <span class="yhquan-gx-collapse-summary" id="yhquan-gx-chips-summary">${summaryText}</span>
                        <span class="yhquan-gx-expand-btn" id="yhquan-gx-chips-toggle">▼</span>
                    </div>
                    <div class="yhquan-gx-collapse-body" id="yhquan-gx-chips-body" style="display:none">
                        ${bodyChips}
                    </div>
                </div>
            </div>
        `;
    },

    // 通用摘要格式：已选"A、B、C"等N个xx
    formatSummary(names, unit) {
        if (names.length === 0) return '';
        const preview = names.slice(0, 3).join('、');
        return `已选"${preview}"等${names.length}个${unit}！`;
    },

    getChipsSummaryText(selected) {
        const names = this.STORE_SUB_TYPES
            .filter(t => t.value !== -1 && selected.includes(t.value))
            .map(t => t.label);
        return this.formatSummary(names, '领券对象');
    },

    updateChipsSummary() {
        const summary = document.getElementById('yhquan-gx-chips-summary');
        if (!summary) return;
        const chips = document.querySelectorAll('#yhquan-gx-chips-body .yhquan-gx-chip.active');
        const names = Array.from(chips).map(c => c.textContent);
        summary.textContent = this.formatSummary(names, '领券对象');
    },

    // ========== 渲染：区域设置 ==========

    renderAreaSetting() {
        // 判断是否限制区域（仅从API读取）
        const isLimited = this.activityData?.isLimitArea === 1;

        const noLimitActive = !isLimited ? ' active' : '';
        let summaryText = '';
        if (isLimited && this.areaProvinces) {
            const selectedNames = this.areaProvinces.filter(p => p.selected).map(p => p.text);
            summaryText = this.formatSummary(selectedNames, '省份');
        } else if (isLimited) {
            summaryText = '加载中......';
        }

        return `
            <div class="yhquan-gx-section">
                <div class="yhquan-gx-section-title">6. 区域设置</div>
                <div class="yhquan-gx-area-wrap" id="yhquan-gx-area-wrap">
                    <div class="yhquan-gx-collapse-header">
                        <span class="yhquan-gx-chip${noLimitActive}" id="yhquan-gx-area-nolimit">不限</span>
                        <span class="yhquan-gx-collapse-summary" id="yhquan-gx-area-summary">${summaryText}</span>
                        <span class="yhquan-gx-expand-btn" id="yhquan-gx-area-toggle">▼</span>
                    </div>
                    <div class="yhquan-gx-collapse-body" id="yhquan-gx-area-body" style="display:none">
                    </div>
                </div>
            </div>
        `;
    },

    // 渲染省份 chip 到折叠区域
    renderAreaChips() {
        const body = document.getElementById('yhquan-gx-area-body');
        if (!body || !this.areaProvinces) return;

        // 判断已选区域（仅从API读取）
        const isLimited = this.activityData?.isLimitArea === 1;

        body.innerHTML = this.areaProvinces.map(p => {
            const isActive = isLimited && p.selected;
            return `<span class="yhquan-gx-chip yhquan-gx-area-chip${isActive ? ' active' : ''}" data-area-id="${p.id}">${p.text}</span>`;
        }).join('');
    },

    updateAreaSummary() {
        const summary = document.getElementById('yhquan-gx-area-summary');
        if (!summary) return;
        const chips = document.querySelectorAll('#yhquan-gx-area-body .yhquan-gx-area-chip.active');
        const names = Array.from(chips).map(c => c.textContent);
        summary.textContent = this.formatSummary(names, '省份');
    },

    // 从内存数据更新摘要（异步加载完成后调用，不依赖DOM chip）
    updateAreaSummaryFromData() {
        const summary = document.getElementById('yhquan-gx-area-summary');
        if (!summary || !this.areaProvinces) return;
        const selectedNames = this.areaProvinces.filter(p => p.selected).map(p => p.text);
        summary.textContent = this.formatSummary(selectedNames, '省份');
    },

    // ========== 渲染：抢券时间 ==========

    renderDateRange() {
        const beginDate = this.activityData?.beginTimeDate || this.getTodayStr();
        const endDate = this.activityData?.endTimeDate || this.getDefaultEndStr();
        const maxDate = this.currentCoupon?.endTime ? this.currentCoupon.endTime.split(' ')[0] : '';

        return `
            <div class="yhquan-gx-section">
                <div class="yhquan-gx-section-title">7. 抢券时间</div>
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
                            <div class="yhquan-gx-action-menu" id="yhquan-gx-action-menu">
                                <div class="yhquan-gx-action-popup" id="yhquan-gx-action-popup">
                                    <button class="yhquan-gx-btn yhquan-gx-btn-success" id="yhquan-gx-update" ${toggleBtnDisabled}>更新</button>
                                    <button class="yhquan-gx-btn yhquan-gx-btn-danger" id="yhquan-gx-reset" ${resetDisabled}>重置</button>
                                    <button class="yhquan-gx-btn yhquan-gx-btn-danger" id="yhquan-gx-delete" disabled>删除</button>
                                </div>
                                <button class="yhquan-gx-btn yhquan-gx-btn-primary" id="yhquan-gx-action-trigger">
                                    操作 <i class="fa-solid fa-chevron-up"></i>
                                </button>
                            </div>
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

        const deleteBtn = document.getElementById('yhquan-gx-delete');
        if (deleteBtn) {
            deleteBtn.disabled = !isValid || !this.activityId || this.isSharingActive();
            deleteBtn.classList.remove('loading');
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
        const unlimitedChip = document.querySelector('#yhquan-gx-chips [data-value="-1"]');
        if (unlimitedChip?.classList.contains('active')) return [-1];
        const chips = document.querySelectorAll('#yhquan-gx-chips-body .yhquan-gx-chip.active');
        if (chips.length === 0) return [-1];
        return Array.from(chips).map(c => parseInt(c.dataset.value));
    },

    getSelectedAreaInfo() {
        const noLimitChip = document.getElementById('yhquan-gx-area-nolimit');
        if (noLimitChip?.classList.contains('active')) {
            return { isLimitArea: 0, selectedAreaIds: [] };
        }
        const areaChips = document.querySelectorAll('#yhquan-gx-area-body .yhquan-gx-area-chip.active');
        const ids = Array.from(areaChips).map(c => parseInt(c.dataset.areaId));
        if (ids.length === 0) return { isLimitArea: 0, selectedAreaIds: [] };
        return { isLimitArea: 1, selectedAreaIds: ids };
    },

    // ========== 开启共享 ==========

    async openSharing() {
        this._operationInProgress = true;
        this.setFormLoading(true);
        const toggleBtn = document.getElementById('yhquan-gx-toggle');
        if (toggleBtn) { toggleBtn.classList.add('loading'); toggleBtn.disabled = true; }

        try {
            const form = this.getFormValues();

            // 1. 处理抢券活动：只启用，不编辑；无活动则创建
            if (window.EwmYewu) {
                let isNewlyCreated = false;

                if (this.activityId) {
                    // 有选中活动：仅启用（不执行编辑）
                    await EwmYewu.enableActivity(this.activityId, form.storeSubTypes);
                } else {
                    // 无活动：以表单设置创建新活动
                    const newId = await EwmYewu.createNewActivity({
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
                    this.activityId = newId;
                    isNewlyCreated = true;

                    // 加载新活动的完整详情
                    await this.loadSelectedActivity(newId);
                    this.areaProvinces = null;
                }

                // 刷新活动列表下拉
                await this.refreshActivitySelect();

                // 同步内部状态
                if (!this.activityData) this.activityData = {};
                this.activityData.isClose = 0;

                // 强制同步本地活动列表（防止API返回延迟导致状态不一致）
                this.forceActivityState(this.activityId, 0);

                // 新创建活动时刷新表单区域
                if (isNewlyCreated) {
                    this.refreshFormSections();
                    this.bindFormSectionEvents();
                }
            }

            // 2. Firebase：无条件写 shifenggongxiang + guanjianzi
            const db = firebase.database();
            await db.ref(`yhq_gx/${this.providerId}/${this.currentCoupon.id}`).update({
                shifenggongxiang: true,
                guanjianzi: form.keyword
            });

            this.showNotification('共享已开启', 'success');
        } catch (error) {
            console.error('开启共享失败:', error);
            this.showNotification('开启失败: ' + error.message, 'error');
        } finally {
            this._operationInProgress = false;
            this.setFormLoading(false);
        }
    },

    // ========== 关闭共享 ==========

    async closeSharing() {
        this._operationInProgress = true;
        this.setFormLoading(true);
        const toggleBtn = document.getElementById('yhquan-gx-toggle');
        if (toggleBtn) { toggleBtn.classList.add('loading'); toggleBtn.disabled = true; }

        try {
            // 1. 禁用当前选中的抢券活动
            if (window.EwmYewu && this.activityId) {
                const storeSubTypes = this.getSelectedStoreSubTypes();
                await EwmYewu.disableActivity(this.activityId, storeSubTypes);
            }

            // 同步内部状态
            if (this.activityData) this.activityData.isClose = 1;

            // 刷新活动列表下拉（获取最新状态）
            await this.refreshActivitySelect();

            // 强制同步本地活动列表（防止API返回延迟导致状态不一致）
            this.forceActivityState(this.activityId, 1);

            // 2. 检查是否还有其他启用的活动
            const hasEnabledActivity = (this.activityList || []).some(a => a.isClose === 0);

            // 仅当没有任何启用的活动时，才写 shifenggongxiang: false
            if (!hasEnabledActivity) {
                const db = firebase.database();
                await db.ref(`yhq_gx/${this.providerId}/${this.currentCoupon.id}`).update({
                    shifenggongxiang: false
                });
            }

            this.showNotification('已禁用选中的活动', 'success');
        } catch (error) {
            console.error('关闭共享失败:', error);
            this.showNotification('关闭失败，请重试', 'error');
        } finally {
            this._operationInProgress = false;
            this.setFormLoading(false);
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
        this.setFormLoading(true);
        const resetBtn = document.getElementById('yhquan-gx-reset');
        if (resetBtn) { resetBtn.classList.add('loading'); resetBtn.disabled = true; }

        try {
            // 1. Firebase：只同步 guanjianzi（不改变 shifenggongxiang）
            const db = firebase.database();
            await db.ref(`yhq_gx/${this.providerId}/${this.currentCoupon.id}`).update({
                guanjianzi: this.currentCoupon.name
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

            // 刷新活动列表下拉（活动名称已重置）
            await this.refreshActivitySelect();

            this.showNotification(`${this.currentCoupon.name} 重置成功！`, 'success');
        } catch (error) {
            console.error('重置失败:', error);
            this.showNotification('重置失败，请重试', 'error');
        } finally {
            this._operationInProgress = false;
            this.setFormLoading(false);
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

            // 1. Firebase：只同步 guanjianzi（不改变 shifenggongxiang）
            const db = firebase.database();
            await db.ref(`yhq_gx/${this.providerId}/${this.currentCoupon.id}`).update({
                guanjianzi: form.keyword
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

            // 刷新活动列表下拉（活动名称可能变更）
            await this.refreshActivitySelect();

            this.showNotification('更新成功', 'success');
        } catch (error) {
            console.error('更新失败:', error);
            this.showNotification('更新失败: ' + error.message, 'error');
        } finally {
            this._operationInProgress = false;
            this.updateButtonState();
        }
    },

    // ========== 删除 ==========

    async handleDelete() {
        if (!this.activityId) {
            this.showNotification('没有选中的活动可删除', 'warning');
            return;
        }

        this._operationInProgress = true;
        this.setFormLoading(true);
        const deleteBtn = document.getElementById('yhquan-gx-delete');
        if (deleteBtn) { deleteBtn.classList.add('loading'); deleteBtn.disabled = true; }

        try {
            // 1. 调用删除接口
            if (window.EwmYewu) {
                await EwmYewu.deleteActivity(this.activityId);
            }

            // 2. 清除当前选中
            const deletedId = this.activityId;
            this.activityId = null;
            this.activityData = null;
            this.areaProvinces = null;

            // 3. 刷新活动列表
            await this.loadActivityList();

            // 4. 选中下一个活动（如有）
            const nextActivity = (this.activityList || [])[0];
            if (nextActivity) {
                await this.loadSelectedActivity(nextActivity.id);
            }

            // 5. 刷新整个表单
            this.refreshBody();
            this.bindBodyEvents();

            // 6. 如果没有任何启用的活动，同步 Firebase
            const hasEnabled = (this.activityList || []).some(a => a.isClose === 0);
            if (!hasEnabled) {
                const db = firebase.database();
                await db.ref(`yhq_gx/${this.providerId}/${this.currentCoupon.id}`).update({
                    shifenggongxiang: false
                });
            }

            this.showNotification('活动已删除', 'success');
        } catch (error) {
            console.error('删除活动失败:', error);
            this.showNotification('删除失败: ' + error.message, 'error');
        } finally {
            this._operationInProgress = false;
            this.setFormLoading(false);
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
        const deleteBtn = document.getElementById('yhquan-gx-delete');
        const actionTrigger = document.getElementById('yhquan-gx-action-trigger');
        const actionPopup = document.getElementById('yhquan-gx-action-popup');

        closeBtn?.addEventListener('click', () => this.hide());
        toggleBtn?.addEventListener('click', () => this.handleToggle());
        resetBtn?.addEventListener('click', () => this.handleReset());
        updateBtn?.addEventListener('click', () => this.handleUpdate());
        deleteBtn?.addEventListener('click', () => this.handleDelete());

        // 操作菜单展开/折叠
        if (actionTrigger && actionPopup) {
            actionTrigger.addEventListener('click', () => {
                actionPopup.classList.toggle('open');
                actionTrigger.classList.toggle('open');
            });
        }
    },

    closeActionMenu() {
        const popup = document.getElementById('yhquan-gx-action-popup');
        const trigger = document.getElementById('yhquan-gx-action-trigger');
        if (popup) popup.classList.remove('open');
        if (trigger) trigger.classList.remove('open');
    },

    // ========== 刷新活动下拉 ==========

    async refreshActivitySelect() {
        try {
            await this.loadActivityList();
            const selectEl = document.getElementById('yhquan-gx-activity-select');
            if (!selectEl) return;

            const list = this.activityList || [];
            const selectedId = this.activityId;

            if (list.length === 0) {
                selectEl.innerHTML = '<option value="">暂无抢券活动</option>';
            } else {
                selectEl.innerHTML = list.map(a => {
                    const sel = String(a.id) === String(selectedId) ? ' selected' : '';
                    const tag = a.isClose === 0 ? '启用' : '禁用';
                    const name = YhquanGongju.escapeHtml(a.eventName || '未命名活动');
                    return `<option value="${a.id}"${sel}>[${tag}] ${name}</option>`;
                }).join('');
            }
        } catch (err) {
            console.error('刷新活动下拉失败:', err);
        }
    },

    // 强制同步本地活动状态并刷新下拉（防止API返回延迟）
    forceActivityState(activityId, isClose) {
        if (!activityId) return;
        const item = (this.activityList || []).find(a => String(a.id) === String(activityId));
        if (item && item.isClose !== isClose) {
            item.isClose = isClose;
            // 重新渲染下拉框
            const selectEl = document.getElementById('yhquan-gx-activity-select');
            if (selectEl) {
                selectEl.innerHTML = (this.activityList || []).map(a => {
                    const sel = String(a.id) === String(this.activityId) ? ' selected' : '';
                    const tag = a.isClose === 0 ? '启用' : '禁用';
                    const name = YhquanGongju.escapeHtml(a.eventName || '未命名活动');
                    return `<option value="${a.id}"${sel}>[${tag}] ${name}</option>`;
                }).join('');
            }
        }
    },

    // ========== 活动切换 ==========

    async onActivityChange(newActivityId) {
        if (!newActivityId || newActivityId === String(this.activityId)) return;

        this.setFormLoading(true);
        try {
            await this.loadSelectedActivity(newActivityId);
            // 重置区域数据，下次展开时重新懒加载（带新的 activityId）
            this.areaProvinces = null;
            this.refreshFormSections();
            this.bindFormSectionEvents();
        } catch (err) {
            console.error('切换活动失败:', err);
            this.showNotification('加载活动数据失败', 'error');
        } finally {
            this.setFormLoading(false);
        }
    },

    // 仅刷新表单区域（不刷新活动下拉）
    refreshFormSections() {
        const body = document.querySelector('.yhquan-gx-body');
        if (!body) return;

        // 保留前两个 section（优惠券信息 + 活动选择），替换后续表单
        const sections = body.querySelectorAll('.yhquan-gx-section');
        // 移除第3个及之后的 section
        for (let i = sections.length - 1; i >= 2; i--) {
            sections[i].remove();
        }

        // 追加新的表单区块
        const formHtml = [
            this.renderKeywordInput(),
            this.renderLimitSettings(),
            this.renderStoreSubTypes(),
            this.renderAreaSetting(),
            this.renderDateRange()
        ].join('');

        body.insertAdjacentHTML('beforeend', formHtml);
    },

    // 仅绑定表单区域事件（不含活动下拉）
    bindFormSectionEvents() {
        // 复用 bindBodyEvents 中除活动下拉外的逻辑
        this.bindStoreInput();
        this.bindChipsEvents();
        this.bindAreaEvents();
        this.bindDateEvents();
    },

    // ========== 事件绑定（内容区，每次刷新后重新绑定） ==========

    bindBodyEvents() {
        // 抢券活动下拉切换
        const activitySelect = document.getElementById('yhquan-gx-activity-select');
        if (activitySelect) {
            activitySelect.addEventListener('change', () => this.onActivityChange(activitySelect.value));
        }
        // 表单区域事件
        this.bindStoreInput();
        this.bindChipsEvents();
        this.bindAreaEvents();
        this.bindDateEvents();
    },

    bindStoreInput() {
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
    },

    bindChipsEvents() {
        // 展开/收起按钮
        const toggleBtn = document.getElementById('yhquan-gx-chips-toggle');
        const body = document.getElementById('yhquan-gx-chips-body');
        if (toggleBtn && body) {
            toggleBtn.addEventListener('click', () => {
                const isHidden = body.style.display === 'none';
                body.style.display = isHidden ? 'flex' : 'none';
                toggleBtn.textContent = isHidden ? '▲' : '▼';
            });
        }

        // "不限" chip 点击
        const unlimitedChip = document.querySelector('#yhquan-gx-chips [data-value="-1"]');
        if (unlimitedChip) {
            unlimitedChip.addEventListener('click', () => {
                // 清除所有选中
                document.querySelectorAll('#yhquan-gx-chips-body .yhquan-gx-chip').forEach(c => c.classList.remove('active'));
                unlimitedChip.classList.add('active');
                // 收起折叠区域
                if (body) { body.style.display = 'none'; }
                if (toggleBtn) { toggleBtn.textContent = '▼'; }
                this.updateChipsSummary();
            });
        }

        // 折叠区域内 chip 点击
        if (body) {
            body.addEventListener('click', (e) => {
                const chip = e.target.closest('.yhquan-gx-chip');
                if (!chip) return;
                if (unlimitedChip) unlimitedChip.classList.remove('active');
                chip.classList.toggle('active');
                // 无任何选中时回退到"不限"
                const anyActive = body.querySelector('.yhquan-gx-chip.active');
                if (!anyActive && unlimitedChip) {
                    unlimitedChip.classList.add('active');
                    body.style.display = 'none';
                    if (toggleBtn) toggleBtn.textContent = '▼';
                }
                this.updateChipsSummary();
            });
        }
    },

    bindAreaEvents() {
        const toggleBtn = document.getElementById('yhquan-gx-area-toggle');
        const body = document.getElementById('yhquan-gx-area-body');
        const noLimitChip = document.getElementById('yhquan-gx-area-nolimit');

        // 展开/收起按钮（含懒加载）
        if (toggleBtn && body) {
            toggleBtn.addEventListener('click', async () => {
                const isHidden = body.style.display === 'none';
                if (isHidden) {
                    // 首次展开：懒加载区域数据
                    if (!this.areaProvinces) {
                        body.innerHTML = '<span class="yhquan-gx-collapse-loading">加载中...</span>';
                        body.style.display = 'flex';
                        toggleBtn.textContent = '▲';
                        await this.loadAreaProvinces();
                        this.renderAreaChips();
                        this.bindAreaChipEvents();
                        // 渲染后检查：如果没有任何省份被选中，自动回退到"不限"
                        const anyActive = body.querySelector('.yhquan-gx-area-chip.active');
                        if (!anyActive && noLimitChip) {
                            noLimitChip.classList.add('active');
                        }
                        this.updateAreaSummary();
                    } else {
                        // 数据已预加载但 chip 未渲染到 DOM
                        if (!body.querySelector('.yhquan-gx-area-chip')) {
                            this.renderAreaChips();
                            this.bindAreaChipEvents();
                            const anyActive = body.querySelector('.yhquan-gx-area-chip.active');
                            if (!anyActive && noLimitChip) {
                                noLimitChip.classList.add('active');
                            }
                            this.updateAreaSummary();
                        }
                        body.style.display = 'flex';
                        toggleBtn.textContent = '▲';
                    }
                } else {
                    body.style.display = 'none';
                    toggleBtn.textContent = '▼';
                }
            });
        }

        // "不限" chip 点击
        if (noLimitChip) {
            noLimitChip.addEventListener('click', () => {
                document.querySelectorAll('#yhquan-gx-area-body .yhquan-gx-area-chip').forEach(c => c.classList.remove('active'));
                noLimitChip.classList.add('active');
                this.updateAreaSummary();
            });
        }
    },

    // 绑定省份 chip 点击事件（懒加载后调用）
    bindAreaChipEvents() {
        const body = document.getElementById('yhquan-gx-area-body');
        const noLimitChip = document.getElementById('yhquan-gx-area-nolimit');
        const toggleBtn = document.getElementById('yhquan-gx-area-toggle');
        if (!body) return;

        body.addEventListener('click', (e) => {
            const chip = e.target.closest('.yhquan-gx-area-chip');
            if (!chip) return;
            if (noLimitChip) noLimitChip.classList.remove('active');
            chip.classList.toggle('active');
            const anyActive = body.querySelector('.yhquan-gx-area-chip.active');
            if (!anyActive && noLimitChip) {
                noLimitChip.classList.add('active');
            }
            this.updateAreaSummary();
        });
    },

    bindDateEvents() {
        const beginInput = document.getElementById('yhquan-gx-begin');
        const endInput = document.getElementById('yhquan-gx-end');
        const maxDate = this.currentCoupon?.endTime ? this.currentCoupon.endTime.split(' ')[0] : '';

        if (beginInput) {
            beginInput.addEventListener('change', () => {
                if (!beginInput.value || !endInput) return;
                const d = new Date(beginInput.value);
                d.setDate(d.getDate() + 2);
                let endStr = this.formatLocalDate(d);
                if (maxDate && endStr > maxDate) endStr = maxDate;
                endInput.value = endStr;
            });
        }
        if (endInput) {
            endInput.addEventListener('change', () => {
                if (!endInput.value || !beginInput) return;
                const d = new Date(endInput.value);
                d.setDate(d.getDate() - 2);
                const today = this.formatLocalDate(new Date());
                let beginStr = this.formatLocalDate(d);
                if (beginStr < today) beginStr = today;
                beginInput.value = beginStr;
            });
        }
    }
};

window.GxYewu = GxYewu;
