/**
 * 优惠券模块 - 作废业务逻辑
 */
const ZfYewu = {
    currentCoupon: null,
    storeList: [],
    filteredList: [],
    selectedIds: new Set(),
    datePickerOutsideHandler: null,

    config: {
        apiUrl: 'https://1317825751-lc0ftian1b.ap-guangzhou.tencentscf.com'
    },

    async show(coupon) {
        this.currentCoupon = coupon;
        this.storeList = [];
        this.filteredList = [];
        this.selectedIds.clear();
        this.render();
        this.bindEvents();
        await this.loadStoreList();
    },

    hide() {
        const modal = document.getElementById('yhquan-zf-modal');
        if (modal) modal.remove();
        this.closeDatePicker();
        this.currentCoupon = null;
        this.storeList = [];
        this.filteredList = [];
        this.selectedIds.clear();
    },

    render() {
        const oldModal = document.getElementById('yhquan-zf-modal');
        if (oldModal) oldModal.remove();

        const coupon = this.currentCoupon;
        const status = YhquanGongju.getCouponStatus(coupon);

        const html = `
            <div id="yhquan-zf-modal" class="yhquan-zf-modal">
                <div class="yhquan-zf-overlay"></div>
                <div class="yhquan-zf-content">
                    <div class="yhquan-zf-header">
                        <span class="yhquan-zf-title">
                            <i class="fa-solid fa-ban"></i> 作废 - ${YhquanGongju.escapeHtml(coupon.name)}
                        </span>
                        <button class="yhquan-zf-close"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="yhquan-zf-body">
                        ${this.renderCouponInfo(coupon, status)}
                        ${this.renderModeSelect()}
                        ${this.renderCreateTimeFilter()}
                        ${this.renderStoreList()}
                    </div>
                    <div class="yhquan-zf-footer">
                        <button class="yhquan-zf-btn yhquan-zf-btn-danger" id="yhquan-zf-submit" ${!status.valid ? 'disabled' : ''}>作废</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    renderCouponInfo(coupon, status) {
        const escape = YhquanGongju.escapeHtml;
        return `
            <div class="yhquan-zf-section">
                <div class="yhquan-zf-section-title">1.优惠券信息</div>
                <div class="yhquan-zf-info-grid">
                    <div class="yhquan-zf-info-row">
                        <span class="yhquan-zf-info-label">名称：</span>
                        <span class="yhquan-zf-info-value">${escape(coupon.name)}</span>
                    </div>
                    <div class="yhquan-zf-info-row">
                        <span class="yhquan-zf-info-label">详情：</span>
                        <span class="yhquan-zf-info-value">${escape(YhquanGongju.getCouponDetail(coupon))}</span>
                    </div>
                    <div class="yhquan-zf-info-row">
                        <span class="yhquan-zf-info-label">有效期：</span>
                        <span class="yhquan-zf-info-value">${escape(YhquanGongju.getValidPeriod(coupon))}</span>
                    </div>
                    <div class="yhquan-zf-info-row">
                        <span class="yhquan-zf-info-label">状态：</span>
                        <span class="yhquan-zf-info-value" style="color: ${status.color};">${status.text}</span>
                    </div>
                </div>
            </div>
        `;
    },

    renderModeSelect() {
        return `
            <div class="yhquan-zf-section">
                <div class="yhquan-zf-section-title">2.作废方式</div>
                <select id="yhquan-zf-mode" class="yhquan-zf-select">
                    <option value="coupon">按优惠券</option>
                    <option value="store">按药店ID</option>
                </select>
            </div>
        `;
    },

    renderCreateTimeFilter() {
        return `
            <div class="yhquan-zf-section">
                <div class="yhquan-zf-section-title">3.创建时间</div>
                <div class="yhquan-zf-time-range">
                    <div class="yhquan-zf-date-field" data-type="start">
                        <input type="text" readonly class="yhquan-zf-time-input" id="yhquan-zf-create-start" placeholder="开始日期">
                        <i class="fa-solid fa-calendar-days yhquan-zf-date-icon"></i>
                    </div>
                    <div class="yhquan-zf-date-field" data-type="end">
                        <input type="text" readonly class="yhquan-zf-time-input" id="yhquan-zf-create-end" placeholder="结束日期">
                        <i class="fa-solid fa-calendar-days yhquan-zf-date-icon"></i>
                    </div>
                </div>
            </div>
        `;
    },

    renderStoreList() {
        return `
            <div class="yhquan-zf-section" id="yhquan-zf-store-section">
                <div class="yhquan-zf-section-title">4.药店列表</div>
                <div class="yhquan-zf-store-container">
                    <input type="text" class="yhquan-zf-search" id="yhquan-zf-search"
                           placeholder="请输入药店ID/名称/编码/状态搜索...">
                    <div class="yhquan-zf-store-list" id="yhquan-zf-store-list">
                        <div class="yhquan-zf-loading"><i class="fa-solid fa-spinner fa-spin"></i>加载中...</div>
                    </div>
                </div>
            </div>
        `;
    },

    bindEvents() {
        document.querySelector('.yhquan-zf-close')?.addEventListener('click', () => this.hide());
        document.getElementById('yhquan-zf-submit')?.addEventListener('click', () => this.handleSubmit());
        document.getElementById('yhquan-zf-mode')?.addEventListener('change', (e) => this.handleModeChange(e));
        document.getElementById('yhquan-zf-search')?.addEventListener('input', (e) => this.handleSearch(e));
        document.querySelectorAll('.yhquan-zf-date-field').forEach(field => {
            field.addEventListener('click', () => this.handleDateFieldClick(field));
        });
        this.updateCreateTimeFilterState();
    },

    handleModeChange() {
        this.selectedIds.clear();
        this.updateCreateTimeFilterState();
        this.applyFilters();
    },

    updateCreateTimeFilterState() {
        const isCouponMode = (document.getElementById('yhquan-zf-mode')?.value || 'coupon') === 'coupon';
        ['yhquan-zf-create-start', 'yhquan-zf-create-end'].forEach(id => {
            const input = document.getElementById(id);
            if (!input) return;
            input.dataset.disabled = isCouponMode ? '1' : '';
            if (isCouponMode) input.value = '';
        });
        if (isCouponMode) this.closeDatePicker();
    },

    handleDateFieldClick(field) {
        const input = field.querySelector('.yhquan-zf-time-input');
        if (input?.dataset.disabled === '1') return;
        this.openDatePicker(field.dataset.type);
    },

    getSelectedFilteredStoreIds() {
        return this.filteredList
            .filter(store => store.canCancel && this.selectedIds.has(store.id))
            .map(store => store.id);
    },

    pruneSelectedIdsToFilteredList() {
        const visibleIds = new Set(this.filteredList.map(store => store.id));
        Array.from(this.selectedIds).forEach(id => {
            if (!visibleIds.has(id)) this.selectedIds.delete(id);
        });
    },

    resetVisibleSelection(checked) {
        this.filteredList.forEach(store => {
            if (!store.canCancel) return;
            if (checked) {
                this.selectedIds.add(store.id);
            } else {
                this.selectedIds.delete(store.id);
            }
        });
        this.renderStoreTable();
    },

    async loadStoreList() {
        const listContainer = document.getElementById('yhquan-zf-store-list');
        listContainer.innerHTML = '<div class="yhquan-zf-loading"><i class="fa-solid fa-spinner fa-spin"></i>加载中...</div>';

        try {
            const credentials = await YhquanGongju.getCredentials();
            if (!credentials) {
                listContainer.innerHTML = '<div class="yhquan-zf-empty">请先登录</div>';
                return;
            }

            const response = await fetch(this.config.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'getStoreList',
                    credentials: credentials,
                    couponId: this.currentCoupon.id,
                    status: 99
                })
            });

            const result = await response.json();

            if (result.success && result.data) {
                this.storeList = result.data;
                this.applyFilters();
            } else {
                listContainer.innerHTML = `<div class="yhquan-zf-empty">${result.message || '加载失败。'}</div>`;
            }
        } catch (error) {
            console.error('加载药店列表失败：', error);
            listContainer.innerHTML = '<div class="yhquan-zf-empty">加载失败。</div>';
        }
    },

    renderStoreTable() {
        const listContainer = document.getElementById('yhquan-zf-store-list');
        const stores = this.filteredList;
        const mode = document.getElementById('yhquan-zf-mode')?.value || 'coupon';

        if (stores.length === 0) {
            listContainer.innerHTML = '<div class="yhquan-zf-empty">暂无数据</div>';
            return;
        }

        const isCouponMode = mode === 'coupon';
        const cancelableStores = stores.filter(s => s.canCancel);
        const allChecked = !isCouponMode && cancelableStores.length > 0 && cancelableStores.every(s => this.selectedIds.has(s.id));

        let html = `
            <table class="yhquan-zf-table">
                <thead>
                    <tr>
                        <th><input type="checkbox" class="yhquan-zf-checkbox" id="yhquan-zf-check-all" ${allChecked ? 'checked' : ''} ${isCouponMode ? 'disabled' : ''}></th>
                        <th>药店ID</th>
                        <th>药店名称</th>
                        <th>状态</th>
                    </tr>
                </thead>
                <tbody>
        `;

        stores.forEach(store => {
            const checked = this.selectedIds.has(store.id) ? 'checked' : '';
            const disabled = isCouponMode || !store.canCancel ? 'disabled' : '';
            html += `
                <tr>
                    <td><input type="checkbox" class="yhquan-zf-checkbox yhquan-zf-store-check"
                               data-id="${store.id}" ${checked} ${disabled}></td>
                    <td>${store.storeId}</td>
                    <td>${YhquanGongju.escapeHtml(store.storeName)}</td>
                    <td>${YhquanGongju.escapeHtml(store.statusDesc)}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        listContainer.innerHTML = html;

        this.bindTableEvents();
    },

    bindTableEvents() {
        document.getElementById('yhquan-zf-check-all')?.addEventListener('change', (e) => {
            this.resetVisibleSelection(e.target.checked);
        });

        document.querySelectorAll('.yhquan-zf-store-check').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const id = parseInt(e.target.dataset.id);
                if (e.target.checked) {
                    this.selectedIds.add(id);
                } else {
                    this.selectedIds.delete(id);
                }
                this.renderStoreTable();
            });
        });
    },

    handleSearch(e) {
        this.applyFilters();
    },

    applyFilters() {
        this.normalizeCreateDateRange();
        const keyword = (document.getElementById('yhquan-zf-search')?.value || '').trim().toLowerCase();
        const startTime = this.getInputDateTime('yhquan-zf-create-start', false);
        const endTime = this.getInputDateTime('yhquan-zf-create-end', true);

        this.filteredList = this.storeList.filter(store => {
            const createTime = this.getStoreCreateTime(store);
            const matchesStart = !startTime || (createTime && createTime >= startTime);
            const matchesEnd = !endTime || (createTime && createTime <= endTime);
            if (!matchesStart || !matchesEnd) return false;

            if (!keyword) return true;

            return (
                String(store.storeId).includes(keyword) ||
                (store.storeName || '').toLowerCase().includes(keyword) ||
                (store.storeCode || '').toLowerCase().includes(keyword) ||
                (store.providerCode || '').toLowerCase().includes(keyword) ||
                (store.ctimeStr || store.createTime || '').toLowerCase().includes(keyword) ||
                (store.usertimeStr || store.useTime || '').toLowerCase().includes(keyword) ||
                (store.orderSn || '').toLowerCase().includes(keyword) ||
                String(store.couponPay || '').toLowerCase().includes(keyword) ||
                (store.statusDesc || '').toLowerCase().includes(keyword)
            );
        });

        this.pruneSelectedIdsToFilteredList();
        this.renderStoreTable();
    },

    normalizeCreateDateRange() {
        const startInput = document.getElementById('yhquan-zf-create-start');
        const endInput = document.getElementById('yhquan-zf-create-end');
        if (!startInput?.value || !endInput?.value) return;
        if (startInput.value > endInput.value) {
            endInput.value = startInput.value;
        }
    },

    getInputDateTime(id, isEnd) {
        const value = document.getElementById(id)?.value;
        if (!value) return null;
        const suffix = isEnd ? 'T23:59:59' : 'T00:00:00';
        const timestamp = new Date(`${value}${suffix}`).getTime();
        return Number.isNaN(timestamp) ? null : timestamp;
    },

    getStoreCreateTime(store) {
        const value = store.ctimeStr || store.createTime || '';
        if (!value) return null;
        const timestamp = new Date(String(value).replace(' ', 'T')).getTime();
        return Number.isNaN(timestamp) ? null : timestamp;
    },

    openDatePicker(type) {
        this.closeDatePicker();

        const inputId = type === 'end' ? 'yhquan-zf-create-end' : 'yhquan-zf-create-start';
        const input = document.getElementById(inputId);
        if (!input) return;

        const baseDate = this.parseDateValue(input.value) || new Date();
        const year = baseDate.getFullYear();
        const month = baseDate.getMonth();
        const picker = document.createElement('div');
        picker.id = 'yhquan-zf-date-picker';
        picker.className = 'yhquan-zf-date-picker';
        picker.dataset.type = type;
        picker.dataset.year = String(year);
        picker.dataset.month = String(month);
        picker.innerHTML = this.renderDatePickerHtml(year, month, input.value);
        document.body.appendChild(picker);
        this.positionDatePicker(picker, input);
        this.bindDatePickerEvents(picker, input);
        this.bindDatePickerOutsideClose(picker, input);
    },

    closeDatePicker() {
        document.getElementById('yhquan-zf-date-picker')?.remove();
        if (this.datePickerOutsideHandler) {
            document.removeEventListener('pointerdown', this.datePickerOutsideHandler, true);
            this.datePickerOutsideHandler = null;
        }
    },

    renderDatePickerHtml(year, month, selectedValue) {
        const monthStart = new Date(year, month, 1);
        const firstDay = monthStart.getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();
        const prevDays = new Date(year, month, 0).getDate();
        const cells = [];

        for (let i = firstDay - 1; i >= 0; i--) {
            cells.push({ day: prevDays - i, muted: true, date: this.formatDateValue(new Date(year, month - 1, prevDays - i)) });
        }
        for (let day = 1; day <= totalDays; day++) {
            cells.push({ day, muted: false, date: this.formatDateValue(new Date(year, month, day)) });
        }
        while (cells.length < 42) {
            const day = cells.length - firstDay - totalDays + 1;
            cells.push({ day, muted: true, date: this.formatDateValue(new Date(year, month + 1, day)) });
        }

        return `
            <div class="yhquan-zf-date-picker-header">
                <button type="button" class="yhquan-zf-date-nav" data-action="prev"><i class="fa-solid fa-chevron-left"></i></button>
                <div class="yhquan-zf-date-title">${year}年${month + 1}月</div>
                <button type="button" class="yhquan-zf-date-nav" data-action="next"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
            <div class="yhquan-zf-date-weekdays">
                <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
            </div>
            <div class="yhquan-zf-date-grid">
                ${cells.map(cell => `
                    <button type="button" class="yhquan-zf-date-cell ${cell.muted ? 'is-muted' : ''} ${cell.date === selectedValue ? 'is-selected' : ''}" data-date="${cell.date}">
                        ${cell.day}
                    </button>
                `).join('')}
            </div>
            <div class="yhquan-zf-date-actions">
                <button type="button" class="yhquan-zf-date-link" data-action="clear">清除</button>
                <button type="button" class="yhquan-zf-date-link" data-action="today">今天</button>
            </div>
        `;
    },

    positionDatePicker(picker, input) {
        const inputRect = input.getBoundingClientRect();
        const modalRect = document.querySelector('.yhquan-zf-content')?.getBoundingClientRect();
        const width = picker.offsetWidth;
        const height = picker.offsetHeight;
        const margin = 8;
        const minLeft = Math.max(margin, modalRect ? modalRect.left + margin : margin);
        const maxLeft = Math.min(window.innerWidth - width - margin, modalRect ? modalRect.right - width - margin : window.innerWidth - width - margin);
        const minTop = Math.max(margin, modalRect ? modalRect.top + margin : margin);
        const maxTop = Math.min(window.innerHeight - height - margin, modalRect ? modalRect.bottom - height - margin : window.innerHeight - height - margin);
        const preferredTop = inputRect.bottom + 6;
        const fallbackTop = inputRect.top - height - 6;

        picker.style.left = `${Math.max(minLeft, Math.min(inputRect.left, maxLeft))}px`;
        picker.style.top = `${Math.max(minTop, Math.min(preferredTop > maxTop ? fallbackTop : preferredTop, maxTop))}px`;
    },

    bindDatePickerEvents(picker, input) {
        picker.querySelectorAll('.yhquan-zf-date-nav').forEach(btn => {
            btn.addEventListener('click', () => {
                const direction = btn.dataset.action === 'next' ? 1 : -1;
                const year = Number(picker.dataset.year);
                const month = Number(picker.dataset.month) + direction;
                const nextDate = new Date(year, month, 1);
                picker.dataset.year = String(nextDate.getFullYear());
                picker.dataset.month = String(nextDate.getMonth());
                picker.innerHTML = this.renderDatePickerHtml(nextDate.getFullYear(), nextDate.getMonth(), input.value);
                this.bindDatePickerEvents(picker, input);
            });
        });

        picker.querySelectorAll('.yhquan-zf-date-cell').forEach(btn => {
            btn.addEventListener('click', () => {
                input.value = btn.dataset.date || '';
                this.closeDatePicker();
                this.applyFilters();
            });
        });

        picker.querySelector('[data-action="clear"]')?.addEventListener('click', () => {
            input.value = '';
            this.closeDatePicker();
            this.applyFilters();
        });

        picker.querySelector('[data-action="today"]')?.addEventListener('click', () => {
            input.value = this.formatDateValue(new Date());
            this.closeDatePicker();
            this.applyFilters();
        });
    },

    bindDatePickerOutsideClose(picker, input) {
        this.datePickerOutsideHandler = (event) => {
            const target = event.target;
            if (picker.contains(target) || input.contains(target) || input.parentElement?.contains(target)) return;
            this.closeDatePicker();
        };
        setTimeout(() => {
            if (this.datePickerOutsideHandler) {
                document.addEventListener('pointerdown', this.datePickerOutsideHandler, true);
            }
        }, 0);
    },

    parseDateValue(value) {
        const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    },

    formatDateValue(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    async handleSubmit() {
        const mode = document.getElementById('yhquan-zf-mode')?.value;
        const submitBtn = document.getElementById('yhquan-zf-submit');
        const selectedFilteredIds = this.getSelectedFilteredStoreIds();

        if (mode === 'store' && selectedFilteredIds.length === 0) {
            this.showNotification('请选择要作废的药店。', 'warning');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 处理中...';

        try {
            const credentials = await YhquanGongju.getCredentials();
            if (!credentials) {
                this.showNotification('请先登录。', 'error');
                return;
            }

            let requestBody;
            if (mode === 'coupon') {
                requestBody = {
                    action: 'revokeType',
                    credentials: credentials,
                    couponId: this.currentCoupon.id
                };
            } else {
                requestBody = {
                    action: 'revokeBatch',
                    credentials: credentials,
                    couponId: this.currentCoupon.id,
                    instanceIds: selectedFilteredIds
                };
            }

            const response = await fetch(this.config.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification(result.message || '作废成功。', 'success');

                if (mode === 'coupon') {
                    // 作废整张券：更新卡片图标，关闭弹窗
                    const couponId = this.currentCoupon.id;
                    const cleanupResult = await window.YhquanModule?.removeSharedCouponSnapshot?.(couponId, credentials)
                        || { removed: false, reason: 'SKIPPED' };
                    if (cleanupResult.reason === 'ERROR') {
                        this.showNotification('已作废，但共享快照清理失败。', 'warning');
                    }
                    const coupon = YhquanModule.state.allCoupons.find(c => String(c.id) === String(couponId));
                    if (coupon) {
                        coupon.couponStatus = '0';
                        coupon.isSharing = false;
                    }
                    window.YhquanModule?.syncCouponCardState?.(couponId);
                    this.hide();
                    return;
                } else {
                    // 按药店ID作废：刷新列表，按钮恢复可用
                    this.selectedIds.clear();
                    this.storeList = [];
                    this.filteredList = [];
                    await this.loadStoreList();
                }
            } else {
                this.showNotification(result.message || '作废失败。', 'error');
            }
        } catch (error) {
            console.error('作废失败：', error);
            this.showNotification('作废失败：' + (error.message || '未知错误。'), 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '作废';
        }
    },

    showNotification(message, type = 'info') {
        if (window.Tongzhi) {
            Tongzhi.show(message, type);
        } else {
            alert(message);
        }
    }
};

window.ZfYewu = ZfYewu;
