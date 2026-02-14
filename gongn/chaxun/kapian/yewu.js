/**
 * 商品查询模块 - 卡片业务
 */
const ChaxunKapianYewu = {
    init() {
        ChaxunKapianYangshi.inject();
    },

    generateTags(product) {
        const tags = [];
        const escape = GongjuApi.escapeHtml;
        const formatDate = GongjuApi.formatDate;

        if (product.wholesaleTypeName) {
            const style = GongjuApi.getTypeStyle(product.wholesaleTypeName);
            tags.push(`<span class="chaxun-tag" style="background:${style.bg};color:${style.color}">${escape(product.wholesaleTypeName)}</span>`);
        }

        if (product.pack) {
            tags.push(`<span class="chaxun-tag chaxun-tag-pack">${escape(product.pack)}</span>`);
        }

        if (product.validDate) {
            tags.push(`<span class="chaxun-tag chaxun-tag-date">${formatDate(product.validDate)}</span>`);
        }

        tags.push(`<span class="chaxun-tag chaxun-tag-contactor" data-wholesaleid="${product.wholesaleId}" data-drugcode="${escape(product.provDrugCode || '')}"><i class="fa-regular fa-eye chaxun-contactor-eye"></i><span class="chaxun-contactor-value"></span></span>`);

        return tags.join('');
    },

    generatePriceTable(product) {
        const format = GongjuApi.formatPrice;
        return `
            <div class="chaxun-price-table">
                <div class="chaxun-price-row chaxun-price-header">
                    <span>单体价</span>
                    <span>一环价</span>
                    <span>省内价</span>
                    <span>周边价</span>
                    <span>连锁价</span>
                </div>
                <div class="chaxun-price-row chaxun-price-values">
                    <span>${format(product.unitPrice)}</span>
                    <span>${format(product.unitPrice1)}</span>
                    <span>${format(product.unitPrice2)}</span>
                    <span>${format(product.unitPrice7)}</span>
                    <span>${format(product.chainPrice)}</span>
                </div>
            </div>
        `;
    },

    generateCard(product, index) {
        const escape = GongjuApi.escapeHtml;
        const formatPrice = GongjuApi.formatPrice;

        return `
            <div class="chaxun-card" data-id="${product.wholesaleId}">
                <div class="chaxun-card-row chaxun-card-header">
                    <span class="chaxun-card-index">#${index} | ${product.wholesaleId || '-'}</span>
                    <button class="chaxun-detail-btn" data-index="${index}">详情</button>
                </div>
                <div class="chaxun-card-row chaxun-card-title">
                    💊 ${escape(product.drugName || '未知商品')} (${escape(product.provDrugCode || '-')})
                </div>
                <div class="chaxun-card-row chaxun-card-tags">
                    ${this.generateTags(product)}
                </div>
                ${this.generatePriceTable(product)}
                <div class="chaxun-card-row chaxun-card-cost">
                    💰 含税成本价：${formatPrice(product.unitPrice9)} | 库存：${product.stockAvailable ?? '-'}
                </div>
                <div class="chaxun-card-row chaxun-card-factory">
                    🏭 ${escape(product.factoryName || '未知厂家')}
                </div>
            </div>
        `;
    },

    generateCards(products, startIndex = 1) {
        if (!Array.isArray(products) || products.length === 0) {
            return '';
        }
        return products.map((product, idx) =>
            this.generateCard(product, startIndex + idx)
        ).join('');
    }
};

window.ChaxunKapianYewu = ChaxunKapianYewu;
