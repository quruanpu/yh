/**
 * 商品查询模块 - 弹窗业务
 */
const TanchuangYewu = {
    // 字段分组配置
    sections: [
        {
            id: 'basic',
            title: '基本信息',
            icon: '📦',
            fields: [
                { key: 'drugName', label: '商品名称', fullWidth: true },
                { key: 'drugId', label: '商品ID' },
                { key: 'wholesaleId', label: '活动ID' },
                { key: 'provDrugCode', label: '商品编码' },
                { key: 'approval', label: '批准文号' },
                { key: 'pack', label: '规格' },
                { key: 'busiScopeName', label: '经营范围' },
                { key: 'factoryName', label: '生产厂家', fullWidth: true }
            ]
        },
        {
            id: 'activity',
            title: '活动信息',
            icon: '🎯',
            fields: [
                { key: 'wholesaleTypeName', label: '活动类型' },
                { key: 'statusName', label: '活动状态' },
                { key: 'beginDateStr', label: '开始时间' },
                { key: 'endDateStr', label: '结束时间' },
                { key: 'promotionTitle', label: '促销标题', fullWidth: true }
            ]
        },
        {
            id: 'price',
            title: '价格信息',
            icon: '💰',
            fields: [
                { key: 'unitPrice', label: '单体价', highlight: true },
                { key: 'unitPrice1', label: '一环价', highlight: true },
                { key: 'unitPrice2', label: '省内价', highlight: true },
                { key: 'unitPrice7', label: '周边价', highlight: true },
                { key: 'chainPrice', label: '连锁价', highlight: true },
                { key: 'unitPrice9', label: '含税成本价', highlight: true },
                { key: 'advicePrice', label: '建议零售价' },
                { key: 'bottomPrice', label: '底价' }
            ]
        },
        {
            id: 'stock',
            title: '库存信息',
            icon: '📊',
            fields: [
                { key: 'stockAvailable', label: '可用库存' },
                { key: 'stockBalance', label: '库存余额' },
                { key: 'stockOccupation', label: '库存占用' },
                { key: 'canSaleDays', label: '可售天数' },
                { key: 'minAmount', label: '最小购买量' },
                { key: 'maxAmount', label: '最大购买量' }
            ]
        },
        {
            id: 'sales',
            title: '销售统计',
            icon: '📈',
            fields: [
                { key: 'storeNum', label: '门店数' },
                { key: 'buyNum', label: '购买数' },
                { key: 'userNum', label: '用户数' },
                { key: 'countAmount', label: '销售数量' },
                { key: 'totalCost', label: '销售总额' }
            ]
        },
        {
            id: 'supplier',
            title: '供应商信息',
            icon: '🏢',
            fields: [
                { key: 'providerName', label: '供应商名称', fullWidth: true },
                { key: 'providerId', label: '供应商ID' },
                { key: 'whName', label: '仓库名称' },
                { key: 'groupName', label: '商圈名称' }
            ]
        },
        {
            id: 'time',
            title: '时间信息',
            icon: '📅',
            fields: [
                { key: 'validDate', label: '有效期至', isDate: true },
                { key: 'prodDate', label: '生产日期', isDate: true },
                { key: 'addTimeStr', label: '创建时间' },
                { key: 'mtimeStr', label: '更新时间' }
            ]
        }
    ],

    init() {
        TanchuangYangshi.inject();
    },

    render() {
        const page = document.getElementById('page-chaxun');
        if (!page || document.getElementById('chaxun-detail-overlay')) return;

        page.insertAdjacentHTML('beforeend', `
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
        `);

        this.bindEvents();
    },

    bindEvents() {
        const detailClose = document.getElementById('chaxun-detail-close');
        detailClose?.addEventListener('click', () => this.hide());

        const detailBody = document.getElementById('chaxun-detail-body');
        detailBody?.addEventListener('click', (e) => {
            const header = e.target.closest('.chaxun-detail-section-header');
            if (header) {
                const section = header.closest('.chaxun-detail-section');
                section?.classList.toggle('collapsed');
            }
        });
    },

    show(product) {
        if (!product) return;

        const overlay = document.getElementById('chaxun-detail-overlay');
        const body = document.getElementById('chaxun-detail-body');
        if (!overlay || !body) return;

        body.innerHTML = this.renderContent(product);
        overlay.classList.add('active');
    },

    hide() {
        const overlay = document.getElementById('chaxun-detail-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    renderContent(product) {
        return this.sections.map(section => this.renderSection(section, product)).join('');
    },

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

    renderField(field, product) {
        let value = product[field.key];

        if (field.highlight && value !== null && value !== undefined) {
            value = GongjuApi.formatPrice(value);
        }
        if (field.isDate && value) {
            value = GongjuApi.formatDate(value);
        }

        const displayValue = value ?? '-';
        const fullWidthClass = field.fullWidth ? ' full-width' : '';
        const highlightClass = field.highlight ? ' highlight' : '';

        return `
            <div class="chaxun-detail-field${fullWidthClass}">
                <span class="chaxun-detail-label">${field.label}</span>
                <span class="chaxun-detail-value${highlightClass}">${GongjuApi.escapeHtml(displayValue)}</span>
            </div>
        `;
    }
};

window.TanchuangYewu = TanchuangYewu;
