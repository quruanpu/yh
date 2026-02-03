// 商品查询模块
const ChaxunModule = {
    // 模块状态
    state: {
        isVisible: false,
        isSearching: false,
        allProducts: [],
        displayedCount: 0,
        currentKeyword: '',
        currentStatus: 0,            // 商品状态，默认进行中
        selectedTypes: [],           // 选中的商品类型数组
        hasAutoSearched: false
    },

    async init() {
        console.log('商品查询模块初始化');
        this.loadSubModules();
        this.render();
        this.bindEvents();
        AppFramework.setModuleInstance('chaxun', this);
    },

    async waitForAPIModule(maxRetries = 20, delayMs = 100) {
        for (let i = 0; i < maxRetries; i++) {
            if (window.ChaxunAPIModule?.searchProducts) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        return false;
    },

    loadSubModules() {
        // 加载配置文件
        if (!document.querySelector('script[src="gongn/chaxun/config.js"]')) {
            const configScript = document.createElement('script');
            configScript.src = 'gongn/chaxun/config.js';
            document.head.appendChild(configScript);
        }

        // 加载工具模块
        const basePath = 'gongn/chaxun/gongj/';
        ['utils.js', 'api.js', 'card.js', 'detail.js'].forEach(mod => {
            if (!document.querySelector(`script[src="${basePath}${mod}"]`)) {
                const script = document.createElement('script');
                script.src = basePath + mod;
                document.head.appendChild(script);
            }
        });
    },

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
                <!-- 右下角状态筛选按钮 -->
                <button id="chaxun-status-fab" class="chaxun-status-fab">
                    <i class="fa-solid fa-chevron-up"></i>
                </button>
                <!-- 状态选择弹窗 -->
                <div id="chaxun-status-popup" class="chaxun-status-popup" style="display: none;">
                    ${this.renderStatusList()}
                </div>
                <!-- 商品详情弹窗 -->
                <div id="chaxun-detail-overlay" class="chaxun-detail-overlay">
                    <div class="chaxun-detail-modal">
                        <div class="chaxun-detail-header">
                            <span class="chaxun-detail-title">商品详情</span>
                            <button id="chaxun-detail-close" class="chaxun-detail-close">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <div id="chaxun-detail-body" class="chaxun-detail-body"></div>
                    </div>
                </div>
            </main>
        `);
    },

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

        // 类型下拉按钮点击
        typeToggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTypeDropdown();
        });

        // 状态筛选按钮点击
        statusFab?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleStatusPopup();
        });

        // 状态选项点击
        statusPopup?.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = e.target.closest('.chaxun-status-item');
            if (item) {
                this.selectStatus(item.dataset.value, item.textContent.trim());
            }
        });

        // 点击其他地方关闭状态弹窗（类型区域只能通过按钮控制）
        document.addEventListener('click', () => {
            this.hideStatusPopup();
        });

        // 类型复选框变化
        typeCheckboxes?.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                this.updateSelectedTypes();
            }
        });

        // 详情按钮点击（事件委托）
        const cardsContainer = document.getElementById('chaxun-cards-container');
        cardsContainer?.addEventListener('click', (e) => {
            const detailBtn = e.target.closest('.chaxun-detail-btn');
            if (detailBtn) {
                const index = parseInt(detailBtn.dataset.index) - 1;
                this.showDetail(index);
                return;
            }

            // 品种负责人小眼睛点击
            const eyeIcon = e.target.closest('.chaxun-contactor-eye');
            if (eyeIcon) {
                this.queryContactor(eyeIcon);
            }
        });

        // 详情弹窗关闭按钮
        const detailClose = document.getElementById('chaxun-detail-close');
        detailClose?.addEventListener('click', () => this.hideDetail());

        // 分组折叠点击（事件委托）
        const detailBody = document.getElementById('chaxun-detail-body');
        detailBody?.addEventListener('click', (e) => {
            const header = e.target.closest('.chaxun-detail-section-header');
            if (header) {
                const section = header.closest('.chaxun-detail-section');
                section?.classList.toggle('collapsed');
            }
        });
    },

    updateSelectedTypes() {
        const checkboxes = document.querySelectorAll('#chaxun-type-checkboxes input[type="checkbox"]:checked');
        this.state.selectedTypes = Array.from(checkboxes).map(cb => parseInt(cb.value));
    },

    toggleStatusPopup() {
        const popup = document.getElementById('chaxun-status-popup');
        const isVisible = popup?.style.display !== 'none';

        if (isVisible) {
            this.hideStatusPopup();
        } else {
            if (popup) popup.style.display = 'block';
        }
    },

    hideStatusPopup() {
        const popup = document.getElementById('chaxun-status-popup');
        if (popup) popup.style.display = 'none';
    },

    toggleTypeDropdown() {
        const dropdown = document.getElementById('chaxun-type-checkboxes');
        const toggle = document.getElementById('chaxun-type-toggle');
        if (!dropdown) return;

        const isVisible = dropdown.style.display !== 'none';
        dropdown.style.display = isVisible ? 'none' : 'flex';

        // 更新箭头方向
        if (toggle) {
            const icon = toggle.querySelector('i');
            if (icon) {
                icon.className = isVisible ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
            }
        }
    },

    selectStatus(value, label) {
        // 更新状态
        this.state.currentStatus = parseInt(value);

        // 更新按钮上的标签
        const badge = document.getElementById('chaxun-status-badge');
        if (badge) badge.textContent = label;

        // 更新选中状态
        const items = document.querySelectorAll('.chaxun-status-item');
        items.forEach(item => {
            item.classList.toggle('active', item.dataset.value === value);
        });

        // 关闭弹窗
        this.hideStatusPopup();

        // 触发搜索
        this.handleSearch();
    },

    async handleSearch() {
        const searchInput = document.getElementById('chaxun-search-input');
        const keyword = searchInput?.value.trim() || '';

        if (this.state.isSearching) return;

        this.state.allProducts = [];
        this.state.displayedCount = 0;
        this.state.currentKeyword = keyword;

        const container = document.getElementById('chaxun-cards-container');
        const contentArea = document.getElementById('chaxun-content');

        if (container) container.innerHTML = '';
        if (contentArea) contentArea.scrollTop = 0;

        this.updateSearchButton(true);
        this.showLoadingWithText('正在搜索中......');

        await this.loadProducts(keyword);
    },

    async loadProducts(keyword = '') {
        this.state.isSearching = true;

        try {
            const result = await window.ChaxunAPIModule.searchProducts(
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
            this.state.displayedCount = 0;

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

    displayProducts() {
        const container = document.getElementById('chaxun-cards-container');
        if (!container || this.state.allProducts.length === 0) return;

        container.innerHTML = window.ChaxunCardModule.generateCards(this.state.allProducts, 1);
        this.state.displayedCount = this.state.allProducts.length;
    },

    // 查询品种负责人
    async queryContactor(eyeIcon) {
        const wholesaleId = eyeIcon.dataset.wholesaleid;
        const drugCode = eyeIcon.dataset.drugcode;
        const valueSpan = document.querySelector(`.chaxun-contactor-value[data-wholesaleid="${wholesaleId}"]`);

        if (!drugCode || !valueSpan) {
            if (valueSpan) valueSpan.textContent = '-';
            return;
        }

        // 显示加载状态
        eyeIcon.className = 'fa-solid fa-spinner fa-spin chaxun-contactor-eye';

        const result = await window.ChaxunAPIModule.queryPmsContactor(drugCode);

        if (result.success) {
            valueSpan.textContent = result.contactor;
            eyeIcon.style.display = 'none';
        } else {
            valueSpan.textContent = result.error || '查询失败';
            valueSpan.style.color = '#ef4444';
            eyeIcon.className = 'fa-regular fa-eye chaxun-contactor-eye';
        }
    },

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

    showLoginRequired() {
        const container = document.getElementById('chaxun-cards-container');
        if (!container) return;
        container.innerHTML = `
            <div class="chaxun-login-required">
                <div class="chaxun-login-icon">
                    <i class="fa-solid fa-user-lock"></i>
                </div>
                <div class="chaxun-login-text">请先登录SCM账户</div>
                <div class="chaxun-login-hint">点击左下角"登录账户"进行登录</div>
            </div>
        `;
    },

    updateSearchButton(isLoading) {
        const searchBtn = document.getElementById('chaxun-search-btn');
        if (!searchBtn) return;
        searchBtn.disabled = isLoading;
        searchBtn.style.opacity = isLoading ? '0.6' : '1';
        searchBtn.style.cursor = isLoading ? 'not-allowed' : 'pointer';
    },

    // 显示商品详情弹窗
    showDetail(index) {
        const product = this.state.allProducts[index];
        if (!product) return;

        const overlay = document.getElementById('chaxun-detail-overlay');
        const body = document.getElementById('chaxun-detail-body');
        if (!overlay || !body) return;

        body.innerHTML = this.renderDetailContent(product);
        overlay.classList.add('active');
    },

    // 隐藏商品详情弹窗
    hideDetail() {
        const overlay = document.getElementById('chaxun-detail-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    // 渲染详情内容
    renderDetailContent(product) {
        const sections = window.ChaxunDetailModule?.getAllSections() || [];
        return sections.map(section => this.renderSection(section, product)).join('');
    },

    // 渲染单个分组
    renderSection(section, product) {
        const fieldsHtml = section.fields
            .map(field => this.renderField(field, product))
            .join('');

        return `
            <div class="chaxun-detail-section">
                <div class="chaxun-detail-section-header">
                    <span class="chaxun-detail-section-title">
                        <span>${section.icon}</span> ${section.title}
                    </span>
                    <i class="fa-solid fa-chevron-down chaxun-detail-section-toggle"></i>
                </div>
                <div class="chaxun-detail-section-content">${fieldsHtml}</div>
            </div>
        `;
    },

    // 渲染单个字段
    renderField(field, product) {
        let value = product[field.key];

        // 格式化价格
        if (field.highlight && value !== null && value !== undefined) {
            value = ChaxunUtils.formatPrice(value);
        }
        // 格式化日期
        if (field.isDate && value) {
            value = ChaxunUtils.formatDate(value);
        }

        const displayValue = value ?? '-';
        const fullWidthClass = field.fullWidth ? ' full-width' : '';
        const highlightClass = field.highlight ? ' highlight' : '';

        return `
            <div class="chaxun-detail-field${fullWidthClass}">
                <span class="chaxun-detail-label">${field.label}</span>
                <span class="chaxun-detail-value${highlightClass}">${ChaxunUtils.escapeHtml(displayValue)}</span>
            </div>
        `;
    },

    async show() {
        this.state.isVisible = true;
        const page = document.getElementById('page-chaxun');
        if (page) page.style.display = 'flex';

        if (!this.state.hasAutoSearched) {
            this.state.hasAutoSearched = true;

            if (!await this.waitForAPIModule()) {
                this.showEmpty('系统初始化失败，请刷新页面');
                return;
            }

            // 首次进入自动搜索
            this.handleSearch();
        }
    },

    hide() {
        this.state.isVisible = false;
        const page = document.getElementById('page-chaxun');
        if (page) page.style.display = 'none';
    }
};

// 注册模块到主框架
AppFramework.register({
    id: 'chaxun',
    name: '商品查询',
    icon: 'fa-solid fa-box',
    path: 'gongn/chaxun',
    order: 3
});

ChaxunModule.init();
