/**
 * 商品查询模块 - 主框架业务
 *
 * 职责：
 * 1. 页面渲染和布局
 * 2. 搜索交互和状态管理
 * 3. 协调卡片和弹窗模块
 */
const KuangjiaYewu = {
    // 模块状态
    state: {
        isVisible: false,
        isSearching: false,
        allProducts: [],
        currentKeyword: '',
        currentStatus: 0,
        selectedTypes: [],
        hasAutoSearched: false
    },

    /**
     * 初始化
     */
    init() {
        this.render();
        this.bindEvents();
    },

    /**
     * 渲染页面结构
     */
    render() {
        if (document.getElementById('page-chaxun')) return;

        const container = document.getElementById('module-container');
        container.insertAdjacentHTML('beforeend', `
            <main id="page-chaxun" class="chaxun-page" style="display: none;">
                <div class="chaxun-search-container">
                    <div class="chaxun-search-box">
                        <div class="chaxun-search-input-wrapper">
                            <input type="text" id="chaxun-search-input" class="chaxun-search-input"
                                placeholder="搜索商品..." autocomplete="off" />
                            <button id="chaxun-search-clear" class="chaxun-search-clear" style="display: none;">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <button id="chaxun-type-toggle" class="chaxun-type-toggle">
                            <i class="fa-solid fa-chevron-down"></i>
                        </button>
                        <button id="chaxun-search-btn" class="chaxun-search-btn">
                            <i class="fa-solid fa-magnifying-glass"></i>
                            <span>搜索</span>
                        </button>
                    </div>
                    <div class="chaxun-type-checkboxes" id="chaxun-type-checkboxes" style="display: none;">
                        ${this.renderTypeCheckboxes()}
                    </div>
                </div>
                <div id="chaxun-content" class="chaxun-content">
                    <div id="chaxun-cards-container" class="chaxun-cards-container"></div>
                </div>
                <button id="chaxun-status-fab" class="chaxun-status-fab">
                    <i class="fa-solid fa-chevron-up"></i>
                </button>
                <div id="chaxun-status-popup" class="chaxun-status-popup" style="display: none;">
                    ${this.renderStatusList()}
                </div>
                <!-- 详情弹窗由tanchuang模块渲染 -->
            </main>
        `);

        // 渲染详情弹窗
        if (window.TanchuangYewu) {
            TanchuangYewu.render();
        }
    },

    /**
     * 渲染状态列表
     */
    renderStatusList() {
        const statusTypes = window.ChaxunConfig?.statusTypes || {
            '0': '进行中', '1': '待开始', '3': '未上架',
            '2': '缺货下架', '8': '未动销下架', '4': '已下架',
            '5': '资质待审核', '7': '已结束', '6': '资质不通过'
        };
        return Object.entries(statusTypes)
            .map(([value, label]) => `
                <div class="chaxun-status-item${value === '0' ? ' active' : ''}" data-value="${value}">
                    ${label}
                </div>
            `).join('');
    },

    /**
     * 渲染类型复选框
     */
    renderTypeCheckboxes() {
        const wholesaleTypes = window.ChaxunConfig?.wholesaleTypes || {
            1: '一口价', 2: '特价', 3: '限时特价', 4: '特价不可用券',
            5: '赠品', 7: '普通拼团', 8: '批购包邮', 9: '诊所拼团'
        };
        return Object.entries(wholesaleTypes)
            .map(([value, label]) => `
                <label class="chaxun-type-checkbox">
                    <input type="checkbox" value="${value}" />
                    <span class="chaxun-checkbox-label">${label}</span>
                </label>
            `).join('');
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        const searchInput = document.getElementById('chaxun-search-input');
        const searchBtn = document.getElementById('chaxun-search-btn');
        const searchClear = document.getElementById('chaxun-search-clear');
        const typeToggle = document.getElementById('chaxun-type-toggle');
        const typeCheckboxes = document.getElementById('chaxun-type-checkboxes');
        const statusFab = document.getElementById('chaxun-status-fab');
        const statusPopup = document.getElementById('chaxun-status-popup');

        searchBtn?.addEventListener('click', () => this.handleSearch());
        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });

        searchInput?.addEventListener('input', (e) => {
            if (searchClear) {
                searchClear.style.display = e.target.value.trim() ? 'flex' : 'none';
            }
        });

        searchClear?.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
                searchClear.style.display = 'none';
            }
        });

        typeToggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTypeDropdown();
        });

        statusFab?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleStatusPopup();
        });

        statusPopup?.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = e.target.closest('.chaxun-status-item');
            if (item) {
                this.selectStatus(item.dataset.value, item.textContent.trim());
            }
        });

        document.addEventListener('click', () => {
            this.hideStatusPopup();
        });

        typeCheckboxes?.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                this.updateSelectedTypes();
            }
        });

        // 卡片容器事件委托
        const cardsContainer = document.getElementById('chaxun-cards-container');
        cardsContainer?.addEventListener('click', (e) => {
            const detailBtn = e.target.closest('.chaxun-detail-btn');
            if (detailBtn) {
                const index = parseInt(detailBtn.dataset.index) - 1;
                this.showDetail(index);
                return;
            }

            const eyeIcon = e.target.closest('.chaxun-contactor-eye');
            if (eyeIcon) {
                this.queryContactor(eyeIcon);
            }
        });
    },

    /**
     * 更新选中的类型
     */
    updateSelectedTypes() {
        const checkboxes = document.querySelectorAll('#chaxun-type-checkboxes input[type="checkbox"]:checked');
        this.state.selectedTypes = Array.from(checkboxes).map(cb => parseInt(cb.value));
    },

    /**
     * 切换状态弹窗
     */
    toggleStatusPopup() {
        const popup = document.getElementById('chaxun-status-popup');
        const isVisible = popup?.style.display !== 'none';
        if (isVisible) {
            this.hideStatusPopup();
        } else {
            if (popup) popup.style.display = 'block';
        }
    },

    /**
     * 隐藏状态弹窗
     */
    hideStatusPopup() {
        const popup = document.getElementById('chaxun-status-popup');
        if (popup) popup.style.display = 'none';
    },

    /**
     * 切换类型下拉
     */
    toggleTypeDropdown() {
        const dropdown = document.getElementById('chaxun-type-checkboxes');
        const toggle = document.getElementById('chaxun-type-toggle');
        if (!dropdown) return;

        const isVisible = dropdown.style.display !== 'none';
        dropdown.style.display = isVisible ? 'none' : 'flex';

        if (toggle) {
            const icon = toggle.querySelector('i');
            if (icon) {
                icon.className = isVisible ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
            }
        }
    },

    /**
     * 选择状态
     */
    selectStatus(value, label) {
        this.state.currentStatus = parseInt(value);

        const items = document.querySelectorAll('.chaxun-status-item');
        items.forEach(item => {
            item.classList.toggle('active', item.dataset.value === value);
        });

        this.hideStatusPopup();
        this.handleSearch();
    },

    /**
     * 处理搜索
     */
    async handleSearch() {
        const searchInput = document.getElementById('chaxun-search-input');
        const keyword = searchInput?.value.trim() || '';

        if (this.state.isSearching) return;

        this.state.allProducts = [];
        this.state.currentKeyword = keyword;

        const container = document.getElementById('chaxun-cards-container');
        const contentArea = document.getElementById('chaxun-content');

        if (container) container.innerHTML = '';
        if (contentArea) contentArea.scrollTop = 0;

        this.updateSearchButton(true);
        this.showLoadingWithText('正在搜索中......');

        await this.loadProducts(keyword);
    },

    /**
     * 加载商品
     */
    async loadProducts(keyword = '') {
        this.state.isSearching = true;

        try {
            const result = await window.GongjuApi.searchProducts(
                keyword,
                this.state.selectedTypes,
                this.state.currentStatus
            );

            if (!result.success) {
                if (result.error === 'NO_LOGIN') {
                    this.showLoginRequired();
                } else {
                    this.showEmpty(result.error || '加载失败');
                }
                return;
            }

            this.state.allProducts = result.data || [];

            if (this.state.allProducts.length === 0) {
                this.showEmpty(keyword ? '未找到相关商品' : '暂无商品数据');
                return;
            }

            this.displayProducts();

        } catch (error) {
            console.error('加载商品错误:', error);
            this.showEmpty('加载出错，请稍后重试');
        } finally {
            this.state.isSearching = false;
            this.updateSearchButton(false);
        }
    },

    /**
     * 显示商品列表
     */
    displayProducts() {
        const container = document.getElementById('chaxun-cards-container');
        if (!container || this.state.allProducts.length === 0) return;

        container.innerHTML = window.ChaxunKapianYewu.generateCards(this.state.allProducts, 1);
    },

    /**
     * 查询品种负责人
     */
    async queryContactor(eyeIcon) {
        const parentTag = eyeIcon.parentElement;
        const drugCode = parentTag?.dataset.drugcode;
        const valueSpan = parentTag?.querySelector('.chaxun-contactor-value');

        if (!drugCode || !valueSpan) {
            if (valueSpan) valueSpan.textContent = '-';
            return;
        }

        eyeIcon.className = 'fa-solid fa-spinner fa-spin chaxun-contactor-eye';

        const result = await window.GongjuApi.queryPmsContactor(drugCode);

        if (result.success) {
            valueSpan.textContent = result.contactor;
            eyeIcon.style.display = 'none';
        } else {
            // PMS登录失效时使用通知提示
            if (result.error === 'NO_PMS_LOGIN') {
                if (window.Tongzhi) {
                    Tongzhi.warning('请重新登录Pms！');
                }
                valueSpan.textContent = '登录失效！';
            } else {
                valueSpan.textContent = result.error || '查询失败';
            }
            valueSpan.style.color = '#ef4444';
            eyeIcon.className = 'fa-regular fa-eye chaxun-contactor-eye';
        }
    },

    /**
     * 显示详情弹窗
     */
    showDetail(index) {
        const product = this.state.allProducts[index];
        if (!product) return;

        if (window.TanchuangYewu) {
            TanchuangYewu.show(product);
        }
    },

    /**
     * 显示加载状态
     */
    showLoadingWithText(text = '正在搜索中......') {
        const container = document.getElementById('chaxun-cards-container');
        if (!container) return;
        container.innerHTML = `
            <div class="chaxun-loading-full">
                <div class="chaxun-loading-spinner"></div>
                <div class="chaxun-loading-text">${text}</div>
            </div>
        `;
    },

    /**
     * 显示空状态
     */
    showEmpty(message = '暂无数据') {
        const container = document.getElementById('chaxun-cards-container');
        if (!container) return;
        container.innerHTML = `
            <div class="chaxun-empty">
                <i class="fa-solid fa-box-open"></i>
                <div class="chaxun-empty-text">${message}</div>
            </div>
        `;
    },

    /**
     * 显示登录提示
     */
    showLoginRequired() {
        const container = document.getElementById('chaxun-cards-container');
        if (!container) return;
        container.innerHTML = `
            <div class="chaxun-login-required">
                <div class="chaxun-login-icon">
                    <i class="fa-solid fa-user-lock"></i>
                </div>
                <div class="chaxun-login-text">无有效登录，请重新登录并重新搜索！</div>
                <div class="chaxun-login-hint">点击左下角"登录账户"进行登录</div>
            </div>
        `;
    },

    /**
     * 更新搜索按钮状态
     */
    updateSearchButton(isLoading) {
        const searchBtn = document.getElementById('chaxun-search-btn');
        if (!searchBtn) return;
        searchBtn.disabled = isLoading;
        searchBtn.style.opacity = isLoading ? '0.6' : '1';
        searchBtn.style.cursor = isLoading ? 'not-allowed' : 'pointer';
    },

    /**
     * 显示模块
     */
    async show() {
        this.state.isVisible = true;
        const page = document.getElementById('page-chaxun');
        if (page) page.style.display = 'flex';

        if (!this.state.hasAutoSearched) {
            this.state.hasAutoSearched = true;
            this.handleSearch();
        }
    },

    /**
     * 隐藏模块
     */
    hide() {
        this.state.isVisible = false;
        const page = document.getElementById('page-chaxun');
        if (page) page.style.display = 'none';
    }
};

window.KuangjiaYewu = KuangjiaYewu;
