/**
 * 优惠券模块 - 共享业务逻辑（集成抢券活动）
 */
const HdYewu = {
    currentCoupon: null,
    shareData: null,
    activityList: null,
    activityData: null,
    activityId: null,
    areaProvinces: null,
    providerId: null,
    isCreateMode: false,
    _outsideClickHandler: null,
    _operationInProgress: false,
    _beforeCreateSnapshot: null,
    _createModeSwitchToken: 0,
    _timeRefreshDrafts: null,

    cloneActivityData(data) {
        if (!data || typeof data !== 'object') return null;
        try {
            return JSON.parse(JSON.stringify(data));
        } catch (error) {
            return { ...data };
        }
    },

    cloneAreaProvinces(list) {
        if (!Array.isArray(list)) return null;
        return list.map(item => ({ ...item }));
    },

    captureCreateModeSnapshot() {
        this._beforeCreateSnapshot = {
            activityId: this.activityId,
            activityData: this.cloneActivityData(this.activityData),
            areaProvinces: this.cloneAreaProvinces(this.areaProvinces)
        };
    },

    restoreCreateModeSnapshot() {
        const snapshot = this._beforeCreateSnapshot;
        this._beforeCreateSnapshot = null;
        if (!snapshot || typeof snapshot !== 'object') return;

        this.activityId = snapshot.activityId ?? this.activityId;
        this.activityData = snapshot.activityData ?? this.activityData;
        this.areaProvinces = snapshot.areaProvinces ?? this.areaProvinces;
    },

    isSelectedActivityShared(activityId = this.activityId) {
        if (!activityId) return false;
        const activities = this.shareData?.activities;
        if (!activities || typeof activities !== 'object') return false;
        const activity = activities[String(activityId)];
        return !!(activity && typeof activity === 'object');
    },

    normalizeTimeRefreshBehavior(value) {
        return window.YhquanHdTimeRefreshModule?.normalizeBehavior?.(value) || (String(value || '').trim() === 'auto' ? 'auto' : 'manual');
    },

    getTimeRefreshDraftKey(activityId = this.activityId) {
        if (this.isCreateMode) return '__create__';
        if (!activityId) return '';
        return String(activityId);
    },

    getTimeRefreshDraft(activityId = this.activityId) {
        const key = this.getTimeRefreshDraftKey(activityId);
        if (!key || !this._timeRefreshDrafts) return null;
        if (!Object.prototype.hasOwnProperty.call(this._timeRefreshDrafts, key)) return null;
        return this.normalizeTimeRefreshBehavior(this._timeRefreshDrafts[key]);
    },

    setSelectedTimeRefreshBehavior(behavior, activityId = this.activityId) {
        const key = this.getTimeRefreshDraftKey(activityId);
        if (!key) return;
        if (!this._timeRefreshDrafts) this._timeRefreshDrafts = {};
        this._timeRefreshDrafts[key] = this.normalizeTimeRefreshBehavior(behavior);
    },

    transferCreateTimeRefreshDraft(activityId) {
        if (!activityId || !this._timeRefreshDrafts) return;
        if (!Object.prototype.hasOwnProperty.call(this._timeRefreshDrafts, '__create__')) return;

        const behavior = this.normalizeTimeRefreshBehavior(this._timeRefreshDrafts.__create__);
        delete this._timeRefreshDrafts.__create__;
        this._timeRefreshDrafts[String(activityId)] = behavior;
    },

    getSelectedTimeRefreshBehavior(activityId = this.activityId) {
        const draft = this.getTimeRefreshDraft(activityId);
        if (draft) return draft;
        return window.YhquanHdTimeRefreshModule?.getActivityBehavior?.(this.shareData, activityId) || 'manual';
    },

    isTimeRefreshShareSelected() {
        const availabilityEl = document.getElementById('yhquan-hd-availability');
        const shareModeEl = document.getElementById('yhquan-hd-share-mode');
        const availability = availabilityEl
            ? (availabilityEl.value === 'enabled' ? 'enabled' : 'disabled')
            : this.getAvailabilityValue();
        const shareMode = shareModeEl
            ? (shareModeEl.value === 'public' ? 'public' : 'private')
            : this.getShareModeValue(availability);

        return availability === 'enabled' && shareMode === 'public';
    },

    canSetSelectedTimeRefresh(activityId = this.activityId) {
        if (!this.isTimeRefreshShareSelected()) return false;
        return this.isCreateMode || !!activityId;
    },

    syncTimeRefreshSettingButtonState() {
        const button = document.getElementById('yhquan-hd-time-setting');
        if (!button) return;

        if (!this.isTimeRefreshShareSelected()) {
            this.setSelectedTimeRefreshBehavior('manual');
        }

        const canSetRefresh = this.canSetSelectedTimeRefresh();
        const refreshBehavior = this.getSelectedTimeRefreshBehavior();
        button.disabled = !canSetRefresh;
        button.title = canSetRefresh
            ? (refreshBehavior === 'auto' ? '刷新设置：自动刷新' : '刷新设置：不自动刷新')
            : '选择公共共享后可设置';
    },

    getCouponRef(couponId = this.currentCoupon?.id) {
        if (!this.providerId || !couponId) return null;
        return firebase.database().ref(`yhq_gx/${this.providerId}/${couponId}`);
    },

    getActivityUrl(activityId = this.activityId) {
        const base = window.EwmYewu?.config?.couponPageBase || 'https://dian.ysbang.cn/#/grabCoupon?id=';
        return base + activityId;
    },

    buildAreaForShare(form) {
        if (!form || Number(form.isLimitArea) !== 1) {
            return { is_limit: 0, ids: [], names: [] };
        }
        const ids = Array.isArray(form.selectedAreaIds) ? form.selectedAreaIds : [];
        const names = (this.areaProvinces || [])
            .filter(p => ids.includes(p.id))
            .map(p => p.text);
        return { is_limit: 1, ids, names };
    },

    buildActivityShareNode(form, activityId = this.activityId) {
        const beginDate = form?.beginDate || this.activityData?.beginTimeDate || this.getTodayStr();
        const endDate = form?.endDate || this.activityData?.endTimeDate || this.getDefaultEndStr();
        const existingActivity = this.shareData?.activities?.[String(activityId)];
        const existingBehavior = window.YhquanHdTimeRefreshModule?.getBehaviorFromNode?.(existingActivity) || 'manual';
        const refreshBehavior = this.shouldSharePublic(form)
            ? this.normalizeTimeRefreshBehavior(form?.timeRefreshBehavior || this.getSelectedTimeRefreshBehavior(activityId) || existingBehavior)
            : 'manual';
        return {
            activity_name: form?.keyword || this.activityData?.eventName || this.currentCoupon?.name || '',
            total_limit: form?.totalLimit || this.activityData?.couponAmount || 10000,
            store_limit: form?.storeLimit || this.activityData?.couponNum || 5,
            area: this.buildAreaForShare(form),
            grab_time: {
                begin: beginDate + ' 00:00:00',
                end: endDate + ' 23:59:59'
            },
            activity_url: this.getActivityUrl(activityId),
            time_refresh_behavior: refreshBehavior,
            updated_at: Date.now()
        };
    },

    async syncProviderIndex() {
        const providerName = window.LoginModule?.session?.providerInfo?.provider_name || '';
        if (!providerName || !this.providerId) return;
        await firebase.database().ref(`yhq_gx_index/${this.providerId}`).update({
            provider_name: providerName,
            last_update: Date.now()
        });
    },

    async cleanupProviderIndexIfEmpty() {
        if (!this.providerId) return;
        const db = firebase.database();
        const providerSnap = await db.ref(`yhq_gx/${this.providerId}`).once('value');
        if (!providerSnap.exists()) {
            await db.ref(`yhq_gx_index/${this.providerId}`).remove();
        }
    },

    async upsertSelectedSharedActivity(form) {
        if (!this.currentCoupon?.id || !this.activityId) return;
        const couponRef = this.getCouponRef();
        if (!couponRef) return;

        const activitiesSnap = await couponRef.child('activities').once('value');
        const tasksSnap = await couponRef.child('tasks').once('value');
        const existingActivities = activitiesSnap.val();
        const existingTasks = tasksSnap.val();
        const activities = {};
        if (existingActivities && typeof existingActivities === 'object') {
            Object.entries(existingActivities).forEach(([id, node]) => {
                if (node && typeof node === 'object') activities[id] = node;
            });
        }
        activities[String(this.activityId)] = this.buildActivityShareNode(form, this.activityId);

        await couponRef.set({
            coupon_name: this.currentCoupon.name || '',
            coupon_expire_at: this.currentCoupon.endTime || '',
            updated_at: Date.now(),
            tasks: existingTasks || null,
            activities
        });
        await this.syncProviderIndex();
    },

    async removeSharedActivity(activityId = this.activityId) {
        if (!activityId) return;
        const couponRef = this.getCouponRef();
        if (!couponRef) return;

        const activitiesSnap = await couponRef.child('activities').once('value');
        const tasksSnap = await couponRef.child('tasks').once('value');
        const existingActivities = activitiesSnap.val();
        const existingTasks = tasksSnap.val();
        const activities = {};
        if (existingActivities && typeof existingActivities === 'object') {
            Object.entries(existingActivities).forEach(([id, node]) => {
                if (node && typeof node === 'object') activities[id] = node;
            });
        }
        delete activities[String(activityId)];

        if (!activities || Object.keys(activities).length === 0) {
            await couponRef.remove();
            await this.cleanupProviderIndexIfEmpty();
            return;
        }

        await couponRef.set({
            coupon_name: this.currentCoupon?.name || '',
            coupon_expire_at: this.currentCoupon?.endTime || '',
            updated_at: Date.now(),
            tasks: existingTasks || null,
            activities
        });
    },

    // 客户类型映射（值与药师帮SCM后台一致）
    STORE_SUB_TYPES: [
        { value: -1, label: '不限' },
        { value: 0, label: '零售单体' },
        { value: 1, label: '第三终端' },
        { value: 6, label: '民营医院' },
        { value: 2, label: '连锁总部(批零一体)' },
        { value: 3, label: '连锁加盟' },
        { value: 4, label: '连锁总部(纯连锁)' },
        { value: 5, label: '商业公司' },
        { value: 8, label: '医疗器械经营店' }
    ],

    normalizeStoreSubtypeValues(values) {
        if (!Array.isArray(values)) return [];
        const out = [];
        const seen = new Set();
        values.forEach((item) => {
            const n = Number(item);
            if (!Number.isInteger(n) || n < -1) return;
            if (seen.has(n)) return;
            seen.add(n);
            out.push(n);
        });
        return out;
    },

    // ========== 生命周期 ==========

    async show(coupon) {
        const openValidation = window.YhquanHdJiaoyanModule?.validateBeforeOpen?.(coupon);
        if (openValidation?.pass === false) {
            this.showNotification(openValidation.message || '当前优惠券不支持共享！', 'warning');
            return;
        }

        this.currentCoupon = coupon;
        this.shareData = null;
        this.activityList = null;
        this.activityData = null;
        this.activityId = null;
        this.areaProvinces = null;
        this.isCreateMode = false;
        this._beforeCreateSnapshot = null;
        this._createModeSwitchToken = 0;
        this._timeRefreshDrafts = {};

        // 获取当前供应商ID（路径隔离用）
        const loginResult = await window.LoginModule?.requireCredentials?.('scm', { silent: true });
        const creds = loginResult?.ok ? loginResult.credentials : null;
        this.providerId = creds?.provider_id || null;
        if (!this.providerId) {
            console.error('无法获取供应商 ID，共享功能不可用。');
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
        }).catch(err => {
            console.error('加载数据失败：', err);
            // 即使加载失败，也要渲染表单并绑定事件，确保UI可交互
            this.refreshBody();
            this.bindBodyEvents();
            this.setFormLoading(false);
        });
    },

    hide() {
        this.cleanupOutsideClickHandler();
        const modal = document.getElementById('yhquan-hd-modal');
        if (modal) modal.remove();
        this.currentCoupon = null;
        this.shareData = null;
        this.activityList = null;
        this.activityData = null;
        this.activityId = null;
        this.areaProvinces = null;
        this.providerId = null;
        this.isCreateMode = false;
        this._beforeCreateSnapshot = null;
        this._createModeSwitchToken = 0;
        this._timeRefreshDrafts = null;
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
            console.error('加载共享数据失败：', error);
            this.shareData = null;
        }
    },

    async loadActivityList() {
        try {
            if (!window.EwmYewu) return;
            const list = await EwmYewu.queryAllByCouponId(this.currentCoupon.id);
            this.activityList = Array.isArray(list) ? list : [];
        } catch (error) {
            console.error('加载活动列表失败：', error);
            this.activityList = [];
        }
    },

    async loadSelectedActivity(activityId) {
        try {
            if (!window.EwmYewu || !activityId) {
                this.activityId = null;
                this.activityData = null;
                this.areaProvinces = null;
                return;
            }
            this.activityId = activityId;
            const detail = await EwmYewu.getActivityDetail(activityId);
            const selectedAreaIds = this.normalizeAreaIds(
                detail?.selectedAreaIds ?? detail?.includeAreaIds ?? detail?.areaIds
            );
            this.activityData = {
                ...(detail || {}),
                isLimitArea: Number(detail?.isLimitArea) === 1 ? 1 : 0,
                selectedAreaIds
            };

            if (this.isAreaLimited(this.activityData?.isLimitArea)) {
                await this.loadAreaProvinces();
            } else {
                this.areaProvinces = null;
            }
        } catch (error) {
            console.error('加载活动详情失败：', error);
            this.activityId = null;
            this.activityData = null;
            this.areaProvinces = null;
        }
    },

    async loadAreaProvinces() {
        try {
            if (!window.EwmYewu) return;
            const data = await EwmYewu.getAreaTree('#', this.activityId || undefined);
            if (!Array.isArray(data)) {
                this.areaProvinces = null;
                return;
            }

            const fallbackSelectedIds = this.isAreaLimited()
                ? this.normalizeAreaIds(this.activityData?.selectedAreaIds)
                : [];

            let provinces = data.map(item => {
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
                    id: parseInt(String(item.id).replace('node_', ''), 10),
                    text: item.text,
                    selected: isSelected
                };
            });

            if (fallbackSelectedIds.length > 0 && !provinces.some(p => p.selected)) {
                const selectedSet = new Set(fallbackSelectedIds);
                provinces = provinces.map(p => ({ ...p, selected: selectedSet.has(p.id) }));
            }

            this.areaProvinces = provinces;
        } catch (error) {
            console.error('加载区域数据失败：', error);
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
    },

    // ========== 加载状态控制 ==========

    setFormLoading(loading) {
        const body = document.querySelector('.yhquan-hd-body');
        const saveBtn = document.getElementById('yhquan-hd-save');
        const createBackBtn = document.getElementById('yhquan-hd-create-back');

        if (loading) {
            if (body) body.style.opacity = '0.4';
            if (body) body.style.pointerEvents = 'none';
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.classList.add('loading');
            }
            if (createBackBtn) { createBackBtn.disabled = true; }
        } else {
            if (body) body.style.opacity = '1';
            if (body) body.style.pointerEvents = '';
            if (saveBtn) saveBtn.classList.remove('loading');
            if (createBackBtn) createBackBtn.classList.remove('loading');
            this.updateButtonState();
        }
    },

    // ========== 刷新弹窗内容 ==========

    refreshBody() {
        const body = document.querySelector('.yhquan-hd-body');
        if (!body) return;

        const coupon = this.currentCoupon;
        const status = YhquanGongju.getCouponStatus(coupon);

        body.innerHTML = [
            this.renderCouponInfo(coupon, status),
            this.renderActivitySection(),
            this.renderLimitSettings(),
            this.renderStoreSubTypes(),
            this.renderAreaSetting(),
            this.renderDateRange(),
            this.renderAvailabilitySection(),
            this.renderShareModeSection()
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
            <div class="yhquan-hd-section">
                <div class="yhquan-hd-section-title">1. 优惠券信息</div>
                <div class="yhquan-hd-info-grid">
                    <div class="yhquan-hd-info-row">
                        <span class="yhquan-hd-info-label">名称：</span>
                        <span class="yhquan-hd-info-value">${escape(coupon.name)}</span>
                    </div>
                    <div class="yhquan-hd-info-row">
                        <span class="yhquan-hd-info-label">详情：</span>
                        <span class="yhquan-hd-info-value">${YhquanGongju.getCouponDetail(coupon)}</span>
                    </div>
                    <div class="yhquan-hd-info-row">
                        <span class="yhquan-hd-info-label">有效期：</span>
                        <span class="yhquan-hd-info-value">${escape(YhquanGongju.getValidPeriod(coupon))}</span>
                    </div>
                    <div class="yhquan-hd-info-row">
                        <span class="yhquan-hd-info-label">状态：</span>
                        <span class="yhquan-hd-info-value" style="color: ${status.color};">${status.text}</span>
                    </div>
                </div>
            </div>
        `;
    },

    renderActivitySection() {
        const escape = YhquanGongju.escapeHtml;
        const list = this.activityList || [];
        const selected = this.getActivityListItem(this.activityId) || list[0] || null;
        const titleText = this.isCreateMode ? '2. 活动名称' : '2. 抢券活动';
        const createTitle = '新增活动';
        const hasActivities = list.length > 0;
        const triggerText = hasActivities
            ? (selected?.eventName || '暂无抢券活动')
            : '无抢券活动！';
        const triggerDisabled = hasActivities ? '' : 'disabled';

        const optionsHtml = list.length === 0
            ? '<div class="yhquan-hd-activity-empty">无抢券活动！</div>'
            : list.map(a => {
                const active = String(a.id) === String(this.activityId) ? ' active' : '';
                const name = escape(a.eventName || '未命名活动');
                return `
                    <div class="yhquan-hd-activity-item${active}" data-id="${a.id}">
                        <span class="yhquan-hd-activity-item-text">${name}</span>
                        <button type="button" class="yhquan-hd-activity-delete" data-delete-id="${a.id}" title="删除">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                `;
            }).join('');

        const controlHtml = this.isCreateMode
            ? `<input type="text" class="yhquan-hd-input yhquan-hd-activity-name-input" id="yhquan-hd-activity-name" placeholder="请输入活动名称" value="${escape(this.activityData?.eventName || this.currentCoupon?.name || '')}">`
            : `
                <button type="button" class="yhquan-hd-activity-trigger" id="yhquan-hd-activity-trigger" ${triggerDisabled}>
                    <span class="yhquan-hd-activity-trigger-text">${escape(triggerText)}</span>
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
                <div class="yhquan-hd-activity-menu" id="yhquan-hd-activity-menu">
                    ${optionsHtml}
                </div>
            `;

        const createBtnHtml = this.isCreateMode ? '' : `
            <button type="button" class="yhquan-hd-plus-btn" id="yhquan-hd-create-toggle" title="${createTitle}">
                <i class="fa-solid fa-plus"></i>
            </button>
        `;

        return `
            <div class="yhquan-hd-section yhquan-hd-activity-section">
                <div class="yhquan-hd-section-title">
                    <span>${titleText}</span>
                    <button type="button" class="yhquan-hd-icon-btn" id="yhquan-hd-activity-refresh" title="刷新">
                        <i class="fa-solid fa-rotate"></i>
                    </button>
                </div>
                <div class="yhquan-hd-activity-row">
                    ${controlHtml}
                    ${createBtnHtml}
                </div>
            </div>
        `;
    },

    getActivityListItem(activityId = this.activityId) {
        if (!activityId) return null;
        return (this.activityList || []).find(a => String(a.id) === String(activityId)) || null;
    },

    isActivityEnabled(activityId = this.activityId) {
        if (!activityId) return false;

        if (
            this.activityData
            && String(this.activityId) === String(activityId)
            && this.activityData.isClose != null
        ) {
            return Number(this.activityData.isClose) === 0;
        }

        const item = this.getActivityListItem(activityId);
        if (item && item.isClose != null) {
            return Number(item.isClose) === 0;
        }

        return false;
    },

    updateCreateBackButtonState() {
        const btn = document.getElementById('yhquan-hd-create-back');
        if (!btn) return;

        btn.style.display = this.isCreateMode ? '' : 'none';
        btn.disabled = !this.isCreateMode;
        btn.classList.remove('loading');
    },

    isCouponInvalidForActivityOps() {
        const status = YhquanGongju.getCouponStatus(this.currentCoupon);
        return !status.valid;
    },

    applyInvalidCouponReadOnlyState() {
        const body = document.querySelector('.yhquan-hd-body');
        if (body) {
            body.querySelectorAll('input, select, textarea, button').forEach((el) => {
                el.disabled = true;
            });
        }

        const backBtn = document.getElementById('yhquan-hd-create-back');
        if (backBtn) backBtn.disabled = true;

        const saveBtn = document.getElementById('yhquan-hd-save');
        if (saveBtn) saveBtn.disabled = false;
    },

    getAvailabilityValue() {
        if (this.isCreateMode) {
            return Number(this.activityData?.isClose) === 1 ? 'disabled' : 'enabled';
        }
        return this.isActivityEnabled(this.activityId) ? 'enabled' : 'disabled';
    },

    getShareModeValue(availability = this.getAvailabilityValue()) {
        if (this.isCreateMode) return 'private';
        if (availability !== 'enabled') return 'private';
        return this.isSelectedActivityShared(this.activityId) ? 'public' : 'private';
    },

    shouldSharePublic(form) {
        return form.availableStatus === 'enabled' && form.shareMode === 'public';
    },

    // ========== 渲染：数量设置 ==========

    renderLimitSettings() {
        const totalLimit = this.activityData?.couponAmount || 10000;
        const storeLimit = this.activityData?.couponNum || 5;

        return `
            <div class="yhquan-hd-section">
                <div class="yhquan-hd-section-title">
                    <span>3. 数量设置</span>
                    <button type="button" class="yhquan-hd-icon-btn" id="yhquan-hd-limit-refresh" title="刷新">
                        <i class="fa-solid fa-rotate"></i>
                    </button>
                </div>
                <div class="yhquan-hd-limit-row">
                    <div class="yhquan-hd-limit-item">
                        <label class="yhquan-hd-limit-label">总量上限</label>
                        <input type="number" class="yhquan-hd-input" id="yhquan-hd-total" value="${totalLimit}" min="1">
                    </div>
                    <div class="yhquan-hd-limit-item">
                        <label class="yhquan-hd-limit-label">单店限制</label>
                        <input type="number" class="yhquan-hd-input" id="yhquan-hd-store" value="${storeLimit}" min="1" max="5">
                    </div>
                </div>
            </div>
        `;
    },

    // ========== 解析客户类型 ==========

    // 解析API返回的storeSubtypes（拼接的单字符格式，如 "0163" → [0,1,6,3]，"-1" → [-1]）
    parseApiStoreSubtypes(raw) {
        if (Array.isArray(raw)) {
            const values = raw.map(v => Number(v));
            return this.normalizeStoreSubtypeValues(values);
        }

        const s = String(raw ?? '').trim();
        if (s === '' || s === '-1') return [-1];

        if (s.includes(',')) {
            return this.normalizeStoreSubtypeValues(
                s.split(',').map(v => Number(v.trim()))
            );
        }

        if (/^-?\d+$/.test(s)) {
            if (s.startsWith('-')) return this.normalizeStoreSubtypeValues([Number(s)]);
            return this.normalizeStoreSubtypeValues(s.split('').map(Number));
        }

        return [-1];
    },

    // ========== 渲染：领券对象 ==========

    renderStoreSubTypes() {
        // 解析客户类型：活动API → 默认不限
        let selected = [-1];
        const validValues = this.STORE_SUB_TYPES.map(item => item.value);
        const rawSubtype = this.activityData?.storeSubtypes ?? this.activityData?.storeSubTypes;
        if (rawSubtype != null && String(rawSubtype).trim() !== '') {
            selected = this.parseApiStoreSubtypes(rawSubtype);
        }
        selected = this.normalizeStoreSubtypeValues(selected).filter(v => validValues.includes(v));
        if (selected.length === 0) selected = [-1];
        if (selected.includes(-1)) selected = [-1];

        const isUnlimited = selected.includes(-1);
        const summaryText = isUnlimited ? '' : this.getChipsSummaryText(selected);
        const bodyChips = this.STORE_SUB_TYPES
            .filter(item => item.value !== -1)
            .map(item => {
                const isActive = selected.includes(item.value);
                return `<span class="yhquan-hd-chip${isActive ? ' active' : ''}" data-value="${item.value}">${item.label}</span>`;
            }).join('');

        return `
            <div class="yhquan-hd-section">
                <div class="yhquan-hd-section-title">
                    <span>4. 领券对象</span>
                    <button type="button" class="yhquan-hd-icon-btn" id="yhquan-hd-audience-refresh" title="刷新">
                        <i class="fa-solid fa-rotate"></i>
                    </button>
                </div>
                <div class="yhquan-hd-chips" id="yhquan-hd-chips">
                    <div class="yhquan-hd-collapse-header">
                        <span class="yhquan-hd-chip${isUnlimited ? ' active' : ''}" data-value="-1">不限</span>
                        <span class="yhquan-hd-collapse-summary" id="yhquan-hd-chips-summary">${summaryText}</span>
                        <span class="yhquan-hd-expand-btn" id="yhquan-hd-chips-toggle">▼</span>
                    </div>
                    <div class="yhquan-hd-collapse-body" id="yhquan-hd-chips-body" style="display:none">
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

    isAreaLimited(value = this.activityData?.isLimitArea) {
        return Number(value) === 1;
    },

    normalizeAreaIds(ids) {
        if (!Array.isArray(ids)) return [];
        return ids
            .map(id => Number(id))
            .filter(id => Number.isInteger(id) && id > 0);
    },

    getChipsSummaryText(selected) {
        const names = this.STORE_SUB_TYPES
            .filter(item => item.value !== -1 && selected.includes(item.value))
            .map(item => item.label);
        return this.formatSummary(names, '领券对象');
    },

    updateChipsSummary() {
        const summary = document.getElementById('yhquan-hd-chips-summary');
        if (!summary) return;
        const chips = document.querySelectorAll('#yhquan-hd-chips-body .yhquan-hd-chip.active');
        const names = Array.from(chips).map(c => c.textContent);
        summary.textContent = this.formatSummary(names, '领券对象');
    },

    // ========== 渲染：区域设置 ==========

    renderAreaSetting() {
        // 判断是否限制区域（仅从API读取）
        const isLimited = this.isAreaLimited();

        const noLimitActive = !isLimited ? ' active' : '';
        let summaryText = '';
        if (isLimited && this.areaProvinces) {
            const selectedNames = this.areaProvinces.filter(p => p.selected).map(p => p.text);
            summaryText = this.formatSummary(selectedNames, '省份');
        } else if (isLimited) {
            summaryText = '加载中......';
        }

        return `
            <div class="yhquan-hd-section">
                <div class="yhquan-hd-section-title">
                    <span>5. 区域设置</span>
                    <button type="button" class="yhquan-hd-icon-btn" id="yhquan-hd-area-refresh" title="刷新">
                        <i class="fa-solid fa-rotate"></i>
                    </button>
                </div>
                <div class="yhquan-hd-area-wrap" id="yhquan-hd-area-wrap">
                    <div class="yhquan-hd-collapse-header">
                        <span class="yhquan-hd-chip${noLimitActive}" id="yhquan-hd-area-nolimit">不限</span>
                        <span class="yhquan-hd-collapse-summary" id="yhquan-hd-area-summary">${summaryText}</span>
                        <span class="yhquan-hd-expand-btn" id="yhquan-hd-area-toggle">▼</span>
                    </div>
                    <div class="yhquan-hd-collapse-body" id="yhquan-hd-area-body" style="display:none">
                    </div>
                </div>
            </div>
        `;
    },

    // 渲染省份 chip 到折叠区域
    renderAreaChips() {
        const body = document.getElementById('yhquan-hd-area-body');
        if (!body || !this.areaProvinces) return;

        // 判断已选区域（仅从API读取）
        const isLimited = this.isAreaLimited();

        body.innerHTML = this.areaProvinces.map(p => {
            const isActive = isLimited && p.selected;
            return `<span class="yhquan-hd-chip yhquan-hd-area-chip${isActive ? ' active' : ''}" data-area-id="${p.id}">${p.text}</span>`;
        }).join('');
    },

    updateAreaSummary() {
        const summary = document.getElementById('yhquan-hd-area-summary');
        if (!summary) return;
        const chips = document.querySelectorAll('#yhquan-hd-area-body .yhquan-hd-area-chip.active');
        const names = Array.from(chips).map(c => c.textContent);
        summary.textContent = this.formatSummary(names, '省份');
    },

    // ========== 渲染：抢券时间 ==========

    renderDateRange() {
        const beginDate = this.activityData?.beginTimeDate || this.getTodayStr();
        const endDate = this.activityData?.endTimeDate || this.getDefaultEndStr();
        const maxDate = this.currentCoupon?.endTime ? this.currentCoupon.endTime.split(' ')[0] : '';
        const canSetRefresh = this.canSetSelectedTimeRefresh();
        const refreshBehavior = this.getSelectedTimeRefreshBehavior();
        const refreshTitle = canSetRefresh
            ? (refreshBehavior === 'auto' ? '刷新设置：自动刷新' : '刷新设置：不自动刷新')
            : '选择公共共享后可设置';

        return `
            <div class="yhquan-hd-section">
                <div class="yhquan-hd-section-title">
                    <span>6. 抢券时间</span>
                    <button type="button" class="yhquan-hd-icon-btn" id="yhquan-hd-time-refresh" title="刷新">
                        <i class="fa-solid fa-rotate"></i>
                    </button>
                </div>
                <div class="yhquan-hd-date-row">
                    <input type="date" class="yhquan-hd-date-input" id="yhquan-hd-begin"
                           value="${beginDate}" ${maxDate ? `max="${maxDate}"` : ''}>
                    <span class="yhquan-hd-date-sep">至</span>
                    <input type="date" class="yhquan-hd-date-input" id="yhquan-hd-end"
                           value="${endDate}" ${maxDate ? `max="${maxDate}"` : ''}>
                    <button type="button" class="yhquan-hd-time-setting-btn" id="yhquan-hd-time-setting"
                            title="${refreshTitle}" ${canSetRefresh ? '' : 'disabled'}>
                        <i class="fa-solid fa-gear"></i>
                    </button>
                </div>
            </div>
        `;
    },

    renderAvailabilitySection() {
        const value = this.getAvailabilityValue();
        return `
            <div class="yhquan-hd-section">
                <div class="yhquan-hd-section-title">
                    <span>7. 可用状态</span>
                </div>
                <div class="yhquan-hd-select-wrap">
                    <select class="yhquan-hd-select" id="yhquan-hd-availability">
                        <option value="enabled"${value === 'enabled' ? ' selected' : ''}>启用</option>
                        <option value="disabled"${value === 'disabled' ? ' selected' : ''}>禁用</option>
                    </select>
                    <i class="fa-solid fa-chevron-down yhquan-hd-select-icon"></i>
                </div>
            </div>
        `;
    },

    renderShareModeSection() {
        const availability = this.getAvailabilityValue();
        const value = this.getShareModeValue(availability);
        const disabled = availability !== 'enabled' ? 'disabled' : '';
        return `
            <div class="yhquan-hd-section">
                <div class="yhquan-hd-section-title">
                    <span>8. 共享情况</span>
                </div>
                <div class="yhquan-hd-select-wrap">
                    <select class="yhquan-hd-select" id="yhquan-hd-share-mode" ${disabled}>
                        <option value="public"${value === 'public' ? ' selected' : ''}>公共</option>
                        <option value="private"${value === 'private' ? ' selected' : ''}>私有</option>
                    </select>
                    <i class="fa-solid fa-chevron-down yhquan-hd-select-icon"></i>
                </div>
            </div>
        `;
    },

    // ========== 主渲染 ==========

    render() {
        const oldModal = document.getElementById('yhquan-hd-modal');
        if (oldModal) oldModal.remove();

        if (window.HdYangshi) HdYangshi.inject();

        const coupon = this.currentCoupon;
        const status = YhquanGongju.getCouponStatus(coupon);
        const saveBtnText = this.isCreateMode ? '创建' : '保存';
        const saveBtnClass = this.isCreateMode ? 'yhquan-hd-btn-primary' : 'yhquan-hd-btn-success';
        const saveBtnDisabled = '';
        const backBtnStyle = this.isCreateMode ? '' : 'style="display:none;"';

        const html = `
            <div id="yhquan-hd-modal" class="yhquan-hd-modal">
                <div class="yhquan-hd-overlay"></div>
                <div class="yhquan-hd-content">
                    <div class="yhquan-hd-header">
                        <span class="yhquan-hd-title">
                            <i class="fa-solid fa-gear"></i> 活动 - ${YhquanGongju.escapeHtml(coupon.name)}
                        </span>
                        <button class="yhquan-hd-close"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="yhquan-hd-body">
                        ${this.renderCouponInfo(coupon, status)}
                        ${this.renderActivitySection()}
                        ${this.renderLimitSettings()}
                        ${this.renderStoreSubTypes()}
                        ${this.renderAreaSetting()}
                        ${this.renderDateRange()}
                        ${this.renderAvailabilitySection()}
                        ${this.renderShareModeSection()}
                    </div>
                    <div class="yhquan-hd-footer">
                        <div class="yhquan-hd-footer-left">
                            <button class="yhquan-hd-btn yhquan-hd-btn-secondary yhquan-hd-create-back" id="yhquan-hd-create-back" ${backBtnStyle}>返回</button>
                        </div>
                        <div class="yhquan-hd-footer-right">
                            <button class="yhquan-hd-btn ${saveBtnClass}" id="yhquan-hd-save" ${saveBtnDisabled}>
                                ${saveBtnText}
                            </button>
                        </div>
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

        const saveBtn = document.getElementById('yhquan-hd-save');
        if (saveBtn) {
            const btnClass = this.isCreateMode ? 'yhquan-hd-btn-primary' : 'yhquan-hd-btn-success';
            const btnText = this.isCreateMode ? '创建' : '保存';
            saveBtn.className = `yhquan-hd-btn ${btnClass}`;
            saveBtn.textContent = btnText;
            saveBtn.disabled = false;
            saveBtn.classList.remove('loading');
        }

        this.updateCreateBackButtonState();
        this.syncShareModeState();
        if (this.isCouponInvalidForActivityOps()) {
            this.applyInvalidCouponReadOnlyState();
        }
    },

    // ========== 表单读取 ==========

    getFormValues() {
        const keyword = this.isCreateMode
            ? (document.getElementById('yhquan-hd-activity-name')?.value.trim() || this.currentCoupon.name)
            : (this.activityData?.eventName || this.currentCoupon.name);
        const storeLimit = Math.min(parseInt(document.getElementById('yhquan-hd-store')?.value) || 5, 5);
        const totalLimit = parseInt(document.getElementById('yhquan-hd-total')?.value) || 10000;
        const beginDate = document.getElementById('yhquan-hd-begin')?.value || this.getTodayStr();
        const endDate = document.getElementById('yhquan-hd-end')?.value || this.getDefaultEndStr();
        const storeSubTypes = this.getSelectedStoreSubTypes();
        const { isLimitArea, selectedAreaIds } = this.getSelectedAreaInfo();
        const availableStatus = document.getElementById('yhquan-hd-availability')?.value === 'enabled'
            ? 'enabled'
            : 'disabled';
        let shareMode = document.getElementById('yhquan-hd-share-mode')?.value === 'public'
            ? 'public'
            : 'private';
        if (availableStatus !== 'enabled') {
            shareMode = 'private';
        }

        return {
            keyword,
            storeLimit,
            totalLimit,
            beginDate,
            endDate,
            storeSubTypes,
            isLimitArea,
            selectedAreaIds,
            availableStatus,
            shareMode,
            timeRefreshBehavior: availableStatus === 'enabled' && shareMode === 'public'
                ? this.getSelectedTimeRefreshBehavior()
                : 'manual'
        };
    },

    getSelectedStoreSubTypes() {
        const unlimitedChip = document.querySelector('#yhquan-hd-chips [data-value="-1"]');
        if (unlimitedChip?.classList.contains('active')) return [-1];
        const chips = document.querySelectorAll('#yhquan-hd-chips-body .yhquan-hd-chip.active');
        if (chips.length === 0) return [-1];
        let selected = Array.from(chips).map(c => parseInt(c.dataset.value, 10));
        selected = this.normalizeStoreSubtypeValues(selected);
        if (selected.length === 0) return [-1];
        if (selected.includes(-1)) return [-1];
        return selected;
    },

    getSelectedAreaInfo() {
        const noLimitChip = document.getElementById('yhquan-hd-area-nolimit');
        if (noLimitChip?.classList.contains('active')) {
            return { isLimitArea: 0, selectedAreaIds: [] };
        }
        const areaChips = document.querySelectorAll('#yhquan-hd-area-body .yhquan-hd-area-chip.active');
        const ids = Array.from(areaChips).map(c => parseInt(c.dataset.areaId, 10));
        if (ids.length > 0) return { isLimitArea: 1, selectedAreaIds: ids };

        if (this.isAreaLimited() && this.areaProvinces) {
            const selectedIds = this.areaProvinces
                .filter(p => p.selected)
                .map(p => p.id);
            if (selectedIds.length > 0) {
                return { isLimitArea: 1, selectedAreaIds: selectedIds };
            }
        }

        const detailSelectedIds = this.normalizeAreaIds(this.activityData?.selectedAreaIds);
        if (this.isAreaLimited() && detailSelectedIds.length > 0) {
            return { isLimitArea: 1, selectedAreaIds: detailSelectedIds };
        }

        return { isLimitArea: 0, selectedAreaIds: [] };
    },

    async applyAvailabilityAndSharePolicy(form) {
        if (!window.EwmYewu) {
            throw new Error('二维码模块未加载');
        }
        if (!this.activityId) {
            throw new Error('没有选中的活动可保存');
        }

        const shouldEnable = form?.availableStatus === 'enabled';
        const shouldPublic = this.shouldSharePublic(form);
        const storeSubTypes = Array.isArray(form.storeSubTypes) && form.storeSubTypes.length > 0
            ? form.storeSubTypes
            : [-1];

        // 规则：
        // 1) “可用状态”决定活动启用/禁用
        // 2) “共享情况”仅决定是否写入共享快照（仅在启用时可公共）
        if (shouldEnable) {
            await EwmYewu.enableActivity(this.activityId, storeSubTypes);
            if (this.activityData) this.activityData.isClose = 0;
            if (shouldPublic) {
                await this.upsertSelectedSharedActivity(form);
            } else {
                await this.removeSharedActivity(this.activityId);
            }
            return;
        }

        await EwmYewu.disableActivity(this.activityId, storeSubTypes);
        if (this.activityData) this.activityData.isClose = 1;
        await this.removeSharedActivity(this.activityId);
    },

    // ========== 保存 ==========

    async handleInvalidCouponSaveOnly() {
        const couponId = this.currentCoupon?.id;
        if (!couponId) {
            this.showNotification('优惠券信息无效，无法清理共享节点！', 'error');
            return;
        }

        const cleanupResult = await window.YhquanModule?.removeSharedCouponSnapshot?.(couponId)
            || { removed: false, reason: 'SKIPPED' };

        if (cleanupResult.reason === 'ERROR') {
            throw new Error('共享节点清理失败');
        }

        const coupon = window.YhquanModule?.state?.allCoupons?.find(c => String(c.id) === String(couponId));
        if (coupon) coupon.isSharing = false;
        window.YhquanModule?.syncCouponCardState?.(couponId);

        this.showNotification('优惠券已失效，仅执行共享节点清理成功！', 'success');
        this.hide();
    },

    async handleSave() {
        this._operationInProgress = true;
        this.setFormLoading(true);

        try {
            if (this.isCouponInvalidForActivityOps()) {
                await this.handleInvalidCouponSaveOnly();
                return;
            }

            let form = this.getFormValues();
            form = this.refreshExpiredGrabTimeBeforePublicSave(form);
            const saveValidation = window.YhquanHdJiaoyanModule?.validateBeforeSave?.(this.currentCoupon, {
                ...form,
                isCreateMode: this.isCreateMode
            });
            if (saveValidation?.pass === false) {
                this.showNotification(saveValidation.message || '共享校验未通过！', 'warning');
                return;
            }
            if (!window.EwmYewu) {
                throw new Error('二维码模块未加载');
            }

            if (this.isCreateMode) {
                const created = await EwmYewu.createNewActivity({
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

                const createdId = (typeof created === 'object' && created !== null)
                    ? (created.id || created.activityId || created.data?.id)
                    : created;
                if (!createdId) {
                    throw new Error('创建成功但未返回活动ID');
                }

                this.isCreateMode = false;
                this._beforeCreateSnapshot = null;
                await this.loadActivityList();
                const target = (this.activityList || []).find(a => String(a.id) === String(createdId));
                this.activityId = target ? target.id : createdId;
                this.transferCreateTimeRefreshDraft(this.activityId);
                await this.loadSelectedActivity(this.activityId);
                await this.applyAvailabilityAndSharePolicy(form);
                await this.refreshActivitySelect();
                this.showNotification('活动创建成功！', 'success');
                return;
            }

            if (!this.activityId) {
                this.showNotification('请先选择一个抢券活动！', 'warning');
                return;
            }

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

            await this.applyAvailabilityAndSharePolicy(form);
            await this.refreshActivitySelect();

            this.showNotification('保存成功！', 'success');
        } catch (error) {
            console.error('保存失败：', error);
            this.showNotification('保存失败：' + (error.message || '未知错误。'), 'error');
        } finally {
            this._operationInProgress = false;
            this.setFormLoading(false);
        }
    },

    // ========== 删除 ==========

    confirmDeleteActivity() {
        return new Promise((resolve) => {
            const old = document.getElementById('yhquan-hd-delete-confirm');
            if (old) old.remove();

            const html = `
                <div class="yhquan-hd-confirm-mask" id="yhquan-hd-delete-confirm">
                    <div class="yhquan-hd-confirm-box">
                        <div class="yhquan-hd-confirm-title">提示</div>
                        <div class="yhquan-hd-confirm-text">确认要删除当前抢券活动？</div>
                        <div class="yhquan-hd-confirm-actions">
                            <button type="button" class="yhquan-hd-btn yhquan-hd-btn-secondary" id="yhquan-hd-confirm-cancel">取消</button>
                            <button type="button" class="yhquan-hd-btn yhquan-hd-btn-danger" id="yhquan-hd-confirm-ok">确认</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);

            const finish = (result) => {
                document.getElementById('yhquan-hd-delete-confirm')?.remove();
                resolve(result);
            };

            document.getElementById('yhquan-hd-confirm-cancel')?.addEventListener('click', () => finish(false), { once: true });
            document.getElementById('yhquan-hd-confirm-ok')?.addEventListener('click', () => finish(true), { once: true });
        });
    },

    async handleDelete(activityId = this.activityId) {
        const targetId = activityId || this.activityId;
        if (!targetId) {
            this.showNotification('没有选中的活动可删除！', 'warning');
            return;
        }

        const confirmed = await this.confirmDeleteActivity();
        if (!confirmed) return;

        this._operationInProgress = true;
        this.setFormLoading(true);

        try {
            const storeSubTypes = String(targetId) === String(this.activityId)
                ? this.getSelectedStoreSubTypes()
                : [-1];

            if (window.EwmYewu) {
                try {
                    await EwmYewu.disableActivity(targetId, storeSubTypes);
                } catch (disableErr) {
                    console.warn('删除前禁用活动失败，继续执行删除：', disableErr);
                }
                await EwmYewu.deleteActivity(targetId);
            }

            const deletedId = targetId;
            await this.loadActivityList();
            this.activityList = (this.activityList || []).filter(
                a => String(a.id) !== String(deletedId)
            );

            const deletedCurrent = String(this.activityId) === String(deletedId);
            if (deletedCurrent) {
                this.activityId = null;
                this.activityData = null;
                this.areaProvinces = null;
                const nextActivity = (this.activityList || [])[0];
                if (nextActivity) {
                    await this.loadSelectedActivity(nextActivity.id);
                }
            }

            await this.removeSharedActivity(deletedId);
            await this.refreshActivitySelect();

            this.showNotification('活动已删除！', 'success');
        } catch (error) {
            console.error('删除活动失败：', error);
            this.showNotification('删除失败：' + (error.message || '未知错误。'), 'error');
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
        const closeBtn = document.querySelector('.yhquan-hd-close');
        const saveBtn = document.getElementById('yhquan-hd-save');
        const createBackBtn = document.getElementById('yhquan-hd-create-back');

        closeBtn?.addEventListener('click', () => this.hide());
        saveBtn?.addEventListener('click', () => this.handleSave());
        createBackBtn?.addEventListener('click', () => this.toggleCreateMode());
    },

    // ========== 刷新活动下拉 ==========

    async refreshActivitySelect() {
        try {
            await Promise.all([
                this.loadActivityList(),
                this.loadShareData()
            ]);
            const list = this.activityList || [];
            const stillExists = list.some(a => String(a.id) === String(this.activityId));
            if (!stillExists) {
                const first = list[0];
                this.activityId = first ? first.id : null;
                if (this.activityId) {
                    await this.loadSelectedActivity(this.activityId);
                } else {
                    this.activityData = null;
                    this.areaProvinces = null;
                }
            } else if (this.activityId) {
                await this.loadSelectedActivity(this.activityId);
            }
            this.refreshBody();
            this.bindBodyEvents();
            this.updateButtonState();
        } catch (err) {
            console.error('刷新活动下拉失败：', err);
        }
    },

    // ========== 活动切换 ==========

    async onActivityChange(newActivityId) {
        if (!newActivityId || newActivityId === String(this.activityId)) return;

        this.isCreateMode = false;
        this.setFormLoading(true);
        try {
            await Promise.all([
                this.loadSelectedActivity(newActivityId),
                this.loadShareData()
            ]);
            this.refreshBody();
            this.bindFormSectionEvents();
        } catch (err) {
            console.error('切换活动失败：', err);
            this.showNotification('加载活动数据失败！', 'error');
        } finally {
            this.setFormLoading(false);
        }
    },

    // 仅绑定表单区域事件（不含活动下拉）
    bindFormSectionEvents() {
        this.bindActivitySectionEvents();
        this.bindRefreshButtons();
        this.bindStoreInput();
        this.bindChipsEvents();
        this.bindAreaEvents();
        this.bindDateEvents();
        this.bindStatusEvents();
    },

    // ========== 事件绑定（内容区，每次刷新后重新绑定） ==========

    bindBodyEvents() {
        if (this.isCouponInvalidForActivityOps()) {
            this.applyInvalidCouponReadOnlyState();
            return;
        }
        this.bindFormSectionEvents();
    },

    bindActivitySectionEvents() {
        const trigger = document.getElementById('yhquan-hd-activity-trigger');
        const menu = document.getElementById('yhquan-hd-activity-menu');
        const createToggleBtn = document.getElementById('yhquan-hd-create-toggle');

        if (trigger && menu) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.toggle('open');
                trigger.classList.toggle('open');
            });

            menu.addEventListener('click', (e) => {
                const deleteBtn = e.target.closest('.yhquan-hd-activity-delete');
                if (deleteBtn) {
                    e.stopPropagation();
                    this.handleDelete(deleteBtn.getAttribute('data-delete-id'));
                    return;
                }

                const item = e.target.closest('.yhquan-hd-activity-item');
                if (!item) return;
                e.stopPropagation();
                const newId = item.getAttribute('data-id');
                menu.classList.remove('open');
                trigger.classList.remove('open');
                this.onActivityChange(newId);
            });
        }

        createToggleBtn?.addEventListener('click', () => this.toggleCreateMode());
        this.setupOutsideClickHandler();
    },

    setupOutsideClickHandler() {
        this.cleanupOutsideClickHandler();
        this._outsideClickHandler = (e) => {
            const row = document.querySelector('.yhquan-hd-activity-row');
            const menu = document.getElementById('yhquan-hd-activity-menu');
            const trigger = document.getElementById('yhquan-hd-activity-trigger');
            if (!row || !menu || !menu.classList.contains('open')) return;
            if (row.contains(e.target)) return;
            menu.classList.remove('open');
            trigger?.classList.remove('open');
        };
        document.addEventListener('click', this._outsideClickHandler);
    },

    cleanupOutsideClickHandler() {
        if (!this._outsideClickHandler) return;
        document.removeEventListener('click', this._outsideClickHandler);
        this._outsideClickHandler = null;
    },

    bindRefreshButtons() {
        const activityRefresh = document.getElementById('yhquan-hd-activity-refresh');
        const limitRefresh = document.getElementById('yhquan-hd-limit-refresh');
        const audienceRefresh = document.getElementById('yhquan-hd-audience-refresh');
        const areaRefresh = document.getElementById('yhquan-hd-area-refresh');
        const timeRefresh = document.getElementById('yhquan-hd-time-refresh');
        const timeSetting = document.getElementById('yhquan-hd-time-setting');

        activityRefresh?.addEventListener('click', () => this.applyAllDefaultsUI());
        limitRefresh?.addEventListener('click', () => this.applyLimitDefaultsUI());
        audienceRefresh?.addEventListener('click', () => this.applyAudienceDefaultsUI());
        areaRefresh?.addEventListener('click', () => this.applyAreaDefaultsUI());
        timeRefresh?.addEventListener('click', () => this.applyTimeDefaultsUI());
        timeSetting?.addEventListener('click', () => this.openTimeRefreshSetting());
    },

    openTimeRefreshSetting() {
        if (!this.canSetSelectedTimeRefresh()) {
            this.showNotification('选择公共共享后可设置！', 'warning');
            return;
        }

        const module = window.YhquanHdTimeRefreshModule;
        if (!module?.openDialog) {
            this.showNotification('时间刷新模块未加载！', 'error');
            return;
        }

        module.openDialog({
            providerId: this.providerId,
            couponId: this.currentCoupon?.id,
            activityId: this.activityId,
            currentBehavior: this.getSelectedTimeRefreshBehavior(),
            notify: (message, type) => this.showNotification(message, type),
            onSaveBehavior: async (behavior) => {
                this.setSelectedTimeRefreshBehavior(behavior);
            },
            onSaved: async (behavior) => {
                this.setSelectedTimeRefreshBehavior(behavior);
                this.syncTimeRefreshSettingButtonState();
            }
        });
    },

    getDefaultFormValues(keyword = this.currentCoupon?.name || '') {
        return {
            keyword,
            storeLimit: 5,
            totalLimit: 10000,
            beginDate: this.getTodayStr(),
            endDate: this.getDefaultEndStr(),
            storeSubTypes: [-1],
            isLimitArea: 0,
            selectedAreaIds: [],
            availableStatus: 'enabled',
            shareMode: 'private'
        };
    },

    applyLimitDefaultsUI() {
        const defaults = this.getDefaultFormValues();
        const totalEl = document.getElementById('yhquan-hd-total');
        const storeEl = document.getElementById('yhquan-hd-store');
        if (totalEl) totalEl.value = String(defaults.totalLimit);
        if (storeEl) storeEl.value = String(defaults.storeLimit);
    },

    applyAudienceDefaultsUI() {
        const unlimitedChip = document.querySelector('#yhquan-hd-chips [data-value="-1"]');
        const chipsBody = document.getElementById('yhquan-hd-chips-body');
        if (chipsBody) {
            chipsBody.querySelectorAll('.yhquan-hd-chip').forEach(chip => chip.classList.remove('active'));
        }
        if (unlimitedChip) unlimitedChip.classList.add('active');
        this.updateChipsSummary();
    },

    applyAreaDefaultsUI() {
        const noLimitChip = document.getElementById('yhquan-hd-area-nolimit');
        const areaBody = document.getElementById('yhquan-hd-area-body');
        if (areaBody) {
            areaBody.querySelectorAll('.yhquan-hd-area-chip').forEach(chip => chip.classList.remove('active'));
        }
        if (noLimitChip) noLimitChip.classList.add('active');
        if (Array.isArray(this.areaProvinces)) {
            this.areaProvinces = this.areaProvinces.map(p => ({ ...p, selected: false }));
        }
        this.updateAreaSummary();
    },

    applyTimeDefaultsUI() {
        const defaults = this.getDefaultFormValues();
        const beginEl = document.getElementById('yhquan-hd-begin');
        const endEl = document.getElementById('yhquan-hd-end');
        if (beginEl) beginEl.value = defaults.beginDate;
        if (endEl) endEl.value = defaults.endDate;
    },

    isGrabEndExpiredForShare() {
        const endDate = document.getElementById('yhquan-hd-end')?.value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(endDate || ''))) return false;

        const endAt = new Date(`${endDate}T23:59:59`).getTime();
        return Number.isFinite(endAt) && endAt < Date.now();
    },

    handleShareModeChange() {
        const shareModeEl = document.getElementById('yhquan-hd-share-mode');
        if (shareModeEl?.value === 'public' && this.isGrabEndExpiredForShare()) {
            this.applyTimeDefaultsUI();
        }
        this.syncTimeRefreshSettingButtonState();
    },

    refreshExpiredGrabTimeBeforePublicSave(form) {
        if (!this.shouldSharePublic(form) || !this.isGrabEndExpiredForShare()) {
            return form;
        }

        this.applyTimeDefaultsUI();
        return this.getFormValues();
    },

    applyStatusDefaultsUI() {
        const defaults = this.getDefaultFormValues();
        const availabilityEl = document.getElementById('yhquan-hd-availability');
        const shareModeEl = document.getElementById('yhquan-hd-share-mode');
        if (availabilityEl) availabilityEl.value = defaults.availableStatus;
        if (shareModeEl) shareModeEl.value = defaults.shareMode;
        this.syncShareModeState();
    },

    applyAllDefaultsUI() {
        this.applyLimitDefaultsUI();
        this.applyAudienceDefaultsUI();
        this.applyAreaDefaultsUI();
        this.applyTimeDefaultsUI();
        this.applyStatusDefaultsUI();
        if (this.isCreateMode) {
            const nameEl = document.getElementById('yhquan-hd-activity-name');
            if (nameEl) nameEl.value = this.currentCoupon?.name || '';
        }
    },

    async toggleCreateMode() {
        if (this.isCreateMode) {
            this.isCreateMode = false;
            this.restoreCreateModeSnapshot();

            if (!this.activityId) {
                const first = (this.activityList || [])[0];
                this.activityId = first ? first.id : null;
            }

            // 先立即切回活动视图，再后台刷新最新数据，避免返回被网络请求阻塞。
            this.refreshBody();
            this.bindBodyEvents();
            this.updateButtonState();

            const targetActivityId = this.activityId;
            const switchToken = Date.now();
            this._createModeSwitchToken = switchToken;

            Promise.all([
                this.loadShareData(),
                targetActivityId ? this.loadSelectedActivity(targetActivityId) : Promise.resolve()
            ]).then(() => {
                if (this._createModeSwitchToken !== switchToken || this.isCreateMode) return;
                this.refreshBody();
                this.bindBodyEvents();
                this.updateButtonState();
            }).catch((err) => {
                console.error('返回活动界面后刷新数据失败：', err);
            });
            return;
        } else {
            this.isCreateMode = true;
            this.captureCreateModeSnapshot();
            this._createModeSwitchToken = Date.now();
            const defaults = this.getDefaultFormValues(this.currentCoupon?.name || '');
            this.activityData = {
                ...(this.activityData || {}),
                eventName: defaults.keyword,
                couponNum: defaults.storeLimit,
                couponAmount: defaults.totalLimit,
                storeSubtypes: '-1',
                isLimitArea: 0,
                selectedAreaIds: [],
                beginTimeDate: defaults.beginDate,
                endTimeDate: defaults.endDate,
                isClose: 0
            };
            if (Array.isArray(this.areaProvinces)) {
                this.areaProvinces = this.areaProvinces.map(p => ({ ...p, selected: false }));
            }
        }

        this.refreshBody();
        this.bindBodyEvents();
        this.updateButtonState();
    },

    bindStoreInput() {
        const storeInput = document.getElementById('yhquan-hd-store');
        if (storeInput) {
            storeInput.addEventListener('input', () => {
                const val = parseInt(storeInput.value);
                if (val > 5) {
                    storeInput.value = 5;
                    this.showNotification('单店限制最大为 5！', 'warning');
                }
            });
        }
    },

    bindChipsEvents() {
        const toggleBtn = document.getElementById('yhquan-hd-chips-toggle');
        const body = document.getElementById('yhquan-hd-chips-body');
        const unlimitedChip = document.querySelector('#yhquan-hd-chips [data-value="-1"]');

        if (toggleBtn && body) {
            toggleBtn.addEventListener('click', () => {
                const isHidden = body.style.display === 'none';
                body.style.display = isHidden ? 'flex' : 'none';
                toggleBtn.textContent = isHidden ? '▲' : '▼';
            });
        }

        if (unlimitedChip) {
            unlimitedChip.addEventListener('click', () => {
                document.querySelectorAll('#yhquan-hd-chips-body .yhquan-hd-chip').forEach(c => c.classList.remove('active'));
                unlimitedChip.classList.add('active');
                if (body) body.style.display = 'none';
                if (toggleBtn) toggleBtn.textContent = '▼';
                this.updateChipsSummary();
            });
        }

        if (body) {
            body.addEventListener('click', (e) => {
                const chip = e.target.closest('.yhquan-hd-chip');
                if (!chip || !chip.dataset.value) return;
                if (unlimitedChip) unlimitedChip.classList.remove('active');
                chip.classList.toggle('active');
                const anyActive = body.querySelector('.yhquan-hd-chip.active');
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
        const toggleBtn = document.getElementById('yhquan-hd-area-toggle');
        const body = document.getElementById('yhquan-hd-area-body');
        const noLimitChip = document.getElementById('yhquan-hd-area-nolimit');

        // 展开/收起按钮（含懒加载）
        if (toggleBtn && body) {
            toggleBtn.addEventListener('click', async () => {
                const isHidden = body.style.display === 'none';
                if (isHidden) {
                    // 首次展开：懒加载区域数据
                    if (!this.areaProvinces) {
                        body.innerHTML = '<span class="yhquan-hd-collapse-loading">加载中...</span>';
                        body.style.display = 'flex';
                        toggleBtn.textContent = '▲';
                        await this.loadAreaProvinces();
                        this.renderAreaChips();
                        this.bindAreaChipEvents();
                        // 渲染后检查：如果没有任何省份被选中，自动回退到"不限"
                        const anyActive = body.querySelector('.yhquan-hd-area-chip.active');
                        if (noLimitChip) {
                            noLimitChip.classList.toggle('active', !anyActive);
                        }
                        this.updateAreaSummary();
                    } else {
                        // 数据已预加载但 chip 未渲染到 DOM
                        if (!body.querySelector('.yhquan-hd-area-chip')) {
                            this.renderAreaChips();
                            this.bindAreaChipEvents();
                            const anyActive = body.querySelector('.yhquan-hd-area-chip.active');
                            if (noLimitChip) {
                                noLimitChip.classList.toggle('active', !anyActive);
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
                document.querySelectorAll('#yhquan-hd-area-body .yhquan-hd-area-chip').forEach(c => c.classList.remove('active'));
                noLimitChip.classList.add('active');
                if (Array.isArray(this.areaProvinces)) {
                    this.areaProvinces = this.areaProvinces.map(p => ({ ...p, selected: false }));
                }
                this.updateAreaSummary();
            });
        }
    },

    // 绑定省份 chip 点击事件（懒加载后调用）
    bindAreaChipEvents() {
        const body = document.getElementById('yhquan-hd-area-body');
        const noLimitChip = document.getElementById('yhquan-hd-area-nolimit');
        if (!body) return;

        body.addEventListener('click', (e) => {
            const chip = e.target.closest('.yhquan-hd-area-chip');
            if (!chip) return;
            if (noLimitChip) noLimitChip.classList.remove('active');
            chip.classList.toggle('active');
            const areaId = parseInt(chip.dataset.areaId, 10);
            if (Array.isArray(this.areaProvinces) && Number.isInteger(areaId)) {
                this.areaProvinces = this.areaProvinces.map(p =>
                    p.id === areaId ? { ...p, selected: chip.classList.contains('active') } : p
                );
            }
            const anyActive = body.querySelector('.yhquan-hd-area-chip.active');
            if (!anyActive && noLimitChip) {
                noLimitChip.classList.add('active');
                if (Array.isArray(this.areaProvinces)) {
                    this.areaProvinces = this.areaProvinces.map(p => ({ ...p, selected: false }));
                }
            }
            this.updateAreaSummary();
        });
    },

    syncShareModeState() {
        const availabilityEl = document.getElementById('yhquan-hd-availability');
        const shareModeEl = document.getElementById('yhquan-hd-share-mode');
        if (!availabilityEl || !shareModeEl) return;

        const isEnabled = availabilityEl.value === 'enabled';
        shareModeEl.disabled = !isEnabled;
        if (!isEnabled) {
            shareModeEl.value = 'private';
        }
        this.syncTimeRefreshSettingButtonState();
    },

    bindStatusEvents() {
        const availabilityEl = document.getElementById('yhquan-hd-availability');
        const shareModeEl = document.getElementById('yhquan-hd-share-mode');
        availabilityEl?.addEventListener('change', () => this.syncShareModeState());
        shareModeEl?.addEventListener('change', () => this.handleShareModeChange());
        this.syncShareModeState();
    },

    bindDateEvents() {
        const beginInput = document.getElementById('yhquan-hd-begin');
        const endInput = document.getElementById('yhquan-hd-end');
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

window.HdYewu = HdYewu;
