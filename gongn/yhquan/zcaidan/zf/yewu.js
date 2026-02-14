/**
 * 优惠券模块 - 作废业务逻辑
 */
const ZfYewu = {
    currentCoupon: null,
    storeList: [],
    filteredList: [],
    selectedIds: new Set(),

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
                        ${this.renderStoreList()}
                    </div>
                    <div class="yhquan-zf-footer">
                        <button class="yhquan-zf-btn yhquan-zf-btn-danger" id="yhquan-zf-submit" ${status.text !== '有效' ? 'disabled' : ''}>作废</button>
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
                <div class="yhquan-zf-section-title">2.选择作废方式</div>
                <select id="yhquan-zf-mode" class="yhquan-zf-select">
                    <option value="coupon">按优惠券</option>
                    <option value="store">按药店ID</option>
                </select>
            </div>
        `;
    },

    renderStoreList() {
        return `
            <div class="yhquan-zf-section" id="yhquan-zf-store-section">
                <div class="yhquan-zf-section-title">3.药店列表</div>
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
    },

    handleModeChange() {
        this.selectedIds.clear();
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
                this.filteredList = [...this.storeList];
                this.renderStoreTable();
            } else {
                listContainer.innerHTML = `<div class="yhquan-zf-empty">${result.message || '加载失败'}</div>`;
            }
        } catch (error) {
            console.error('加载药店列表失败:', error);
            listContainer.innerHTML = '<div class="yhquan-zf-empty">加载失败</div>';
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
            const checked = e.target.checked;
            this.filteredList.forEach(store => {
                if (store.canCancel) {
                    if (checked) {
                        this.selectedIds.add(store.id);
                    } else {
                        this.selectedIds.delete(store.id);
                    }
                }
            });
            this.renderStoreTable();
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
        const keyword = e.target.value.trim().toLowerCase();

        if (!keyword) {
            this.filteredList = [...this.storeList];
        } else {
            this.filteredList = this.storeList.filter(store =>
                String(store.storeId).includes(keyword) ||
                (store.storeName || '').toLowerCase().includes(keyword) ||
                (store.storeCode || '').toLowerCase().includes(keyword) ||
                (store.statusDesc || '').toLowerCase().includes(keyword)
            );
        }

        this.renderStoreTable();
    },

    async handleSubmit() {
        const mode = document.getElementById('yhquan-zf-mode')?.value;
        const submitBtn = document.getElementById('yhquan-zf-submit');

        if (mode === 'store' && this.selectedIds.size === 0) {
            this.showNotification('请选择要作废的药店', 'warning');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 处理中...';

        try {
            const credentials = await YhquanGongju.getCredentials();
            if (!credentials) {
                this.showNotification('请先登录', 'error');
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
                    instanceIds: Array.from(this.selectedIds)
                };
            }

            const response = await fetch(this.config.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification(result.message || '作废成功', 'success');

                if (mode === 'coupon') {
                    // 作废整张券：更新卡片图标，关闭弹窗
                    const couponId = this.currentCoupon.id;
                    const coupon = YhquanModule.state.allCoupons.find(c => String(c.id) === String(couponId));
                    if (coupon) {
                        coupon.couponStatus = '0';
                        const card = document.querySelector(`.yhquan-card[data-id="${couponId}"]`);
                        if (card) {
                            const statusIcon = card.querySelector('.yhquan-status-icon');
                            if (statusIcon) {
                                statusIcon.textContent = YhquanGongju.getStatusIcon(coupon);
                            }
                        }
                    }
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
                this.showNotification(result.message || '作废失败', 'error');
            }
        } catch (error) {
            console.error('作废失败:', error);
            this.showNotification('作废失败: ' + error.message, 'error');
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
