// 商品查询卡片渲染模块
const ChaxunCardModule = {
    /**
     * 生成标签HTML（活动类型 + 规格 + 有效期）
     */
    generateTags(product) {
        const tags = [];
        const escape = ChaxunUtils.escapeHtml;
        const formatDate = ChaxunUtils.formatDate;

        // 活动类型标签
        if (product.wholesaleTypeName) {
            const style = ChaxunUtils.getTypeStyle(product.wholesaleTypeName);
            tags.push(`<span class="chaxun-tag" style="background:${style.bg};color:${style.color}">${escape(product.wholesaleTypeName)}</span>`);
        }

        // 规格标签
        if (product.pack) {
            tags.push(`<span class="chaxun-tag chaxun-tag-pack">${escape(product.pack)}</span>`);
        }

        // 有效期标签
        if (product.validDate) {
            tags.push(`<span class="chaxun-tag chaxun-tag-date">${formatDate(product.validDate)}</span>`);
        }

        return tags.join('');
    },

    /**
     * 生成价格表格HTML
     */
    generatePriceTable(product) {
        const format = ChaxunUtils.formatPrice;
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

    /**
     * 生成单个商品卡片HTML
     */
    generateCard(product, index) {
        const escape = ChaxunUtils.escapeHtml;
        const formatPrice = ChaxunUtils.formatPrice;
        const formatDate = ChaxunUtils.formatDate;

        return `
            <div class="chaxun-card" data-id="${product.wholesaleId}">
                <div class="chaxun-card-row chaxun-card-header">
                    <span class="chaxun-card-index">#${index} | 活动ID: ${product.wholesaleId || '-'} | 商品id：${product.drugId || '-'}</span>
                </div>
                <div class="chaxun-card-row chaxun-card-title">
                    <span>💊</span> ${escape(product.drugName || '未知商品')} (${escape(product.provDrugCode || '-')})
                </div>
                <div class="chaxun-card-row chaxun-card-tags">
                    ${this.generateTags(product)}
                </div>
                ${this.generatePriceTable(product)}
                <div class="chaxun-card-row chaxun-card-cost">
                    <span>💰 含税成本价：${formatPrice(product.unitPrice9)}</span>
                </div>
                <div class="chaxun-card-row chaxun-card-factory">
                    <span>🏭</span> ${escape(product.factoryName || '未知厂家')}
                </div>
            </div>
        `;
    },

    /**
     * 批量生成卡片HTML
     */
    generateCards(products, startIndex = 1) {
        if (!Array.isArray(products) || products.length === 0) {
            return '';
        }
        return products.map((product, idx) =>
            this.generateCard(product, startIndex + idx)
        ).join('');
    }
};

window.ChaxunCardModule = ChaxunCardModule;
