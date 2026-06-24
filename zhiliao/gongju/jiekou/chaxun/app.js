/**
 * 商品查询模块 - 注册与逻辑
 */
function initChaxunToolModule() {
    if (!window.ToolRegistry || !window.GongjuApi) {
        setTimeout(initChaxunToolModule, 100);
        return;
    }

    ToolRegistry.register({
        id: 'search_product',
        name: '查询',
        command: '@查询',
        icon: 'fa-solid fa-magnifying-glass',
        registerType: 'both',
        description: '查询商品信息，支持活动id、商品编码、国药准字、药品名称、厂家名等。',
        parameters: {
            type: 'object',
            properties: {
                keyword: {
                    type: 'string',
                    description: '查询关键词，由模型从用户消息中提取（商品编码、药品名称、国药准字、活动id等）'
                }
            },
            required: ['keyword']
        },
        handler: (params) => ChaxunToolModule.handleQuery(params)
    });

    window.ZhiLiaoLog?.debug?.('ChaxunToolModule registered: search_product');
}

const ChaxunToolModule = {
    async handleQuery(params) {
        const queryParams = typeof params === 'string' ? { keyword: params } : (params || {});
        const keyword = this.normalizeKeyword(queryParams.keyword);
        const fromAI = queryParams._fromAI === true;

        if (!keyword) {
            if (!fromAI) {
                window.ZhiLiaoModule?.addUserMessage?.('@查询');
                const container = window.ZhiLiaoModule?.createStreamingMessage?.().textContainer || null;
                if (container) {
                    container.innerHTML = '<p>请输入商品编码或商品名称进行查询！<br><span style="color:#999;font-size:12px;">示例：@查询 阿莫西林</span></p>';
                }
                window.ZhiLiaoModule?.scrollToBottom?.();
            }
            return { success: true };
        }

        if (!fromAI) {
            window.ZhiLiaoModule?.addUserMessage?.(`@查询 ${keyword}`);
        }

        let loadingContainer = null;
        if (!fromAI) {
            loadingContainer = window.ZhiLiaoModule?.createStreamingMessage?.().textContainer || null;
            if (loadingContainer) {
                loadingContainer.innerHTML = '<span style="color:#666;"><i class="fa-solid fa-spinner fa-spin"></i> 正在查询...</span>';
                window.ZhiLiaoModule?.scrollToBottom?.();
            }
        }

        const result = await window.GongjuApi.searchProducts(keyword, [], -1, {
            includeImages: true
        });

        if (!result.success) {
            if (loadingContainer) {
                loadingContainer.innerHTML = `<p style="color:#ef4444;">${result.error || '查询失败'}</p>`;
            }
            return { success: false, error: result.error || '查询失败' };
        }

        const products = Array.isArray(result.data) ? result.data.slice() : [];
        if (products.length === 0) {
            if (loadingContainer) {
                loadingContainer.innerHTML = '<p>暂无此商品</p>';
            }
            return { success: true, count: 0, message: '暂无此商品' };
        }

        if (loadingContainer) {
            loadingContainer.closest('.system-message')?.remove();
        }

        products.sort((a, b) => {
            const costA = parseFloat(a?.totalCost) || 0;
            const costB = parseFloat(b?.totalCost) || 0;
            return costB - costA;
        });

        if (!fromAI && window.ChaxunYsModule?.renderResults) {
            window.ChaxunYsModule.renderResults(products, result.summary);
        }

        const output = {
            success: true,
            count: products.length,
            products,
            summary: result.summary,
            render_cards: true
        };

        const firstCardProduct = this.pickFirstCardProduct(products);
        if (firstCardProduct) {
            const firstCardIndex = products.indexOf(firstCardProduct);
            if (firstCardIndex >= 0) {
                output.first_card_index = firstCardIndex;
            }

            const firstCardImageUrls = this.extractImageUrls(firstCardProduct);
            if (firstCardImageUrls.length > 0) {
                output.first_card_image_url = firstCardImageUrls[0];
                output.first_card_image_urls = firstCardImageUrls;
            }
        }

        const imageUrls = this.findFirstProductImageUrls(products);
        if (imageUrls.length > 0) {
            output.image_url = imageUrls[0];
            output.image_urls = imageUrls;
        }

        return output;
    },

    normalizeKeyword(keyword) {
        if (typeof keyword === 'string') return keyword.trim();
        if (keyword === null || keyword === undefined) return '';
        return String(keyword).trim();
    },

    extractImageUrls(product) {
        if (!product || typeof product !== 'object') return [];

        const candidates = [];
        const seen = new Set();
        const append = (value) => {
            const url = this.normalizeKeyword(value);
            if (!url) return;
            if (!/^https?:\/\//i.test(url)) return;
            if (seen.has(url)) return;
            seen.add(url);
            candidates.push(url);
        };

        append(product.image_url);
        append(product.logoUrl);
        append(product.logo);
        append(product.drugLogo);

        if (Array.isArray(product.image_urls)) product.image_urls.forEach(append);
        if (Array.isArray(product.picUrlList)) product.picUrlList.forEach(append);

        return candidates;
    },

    findFirstProductImageUrls(products) {
        if (!Array.isArray(products)) return [];
        for (let i = 0; i < products.length; i += 1) {
            const urls = this.extractImageUrls(products[i]);
            if (urls.length > 0) return urls;
        }
        return [];
    },

    pickFirstCardProduct(products) {
        if (!Array.isArray(products) || products.length === 0) return null;

        const yikoujiaList = [];
        const tejiaList = [];
        const otherList = [];

        products.forEach((product) => {
            const typeName = this.normalizeKeyword(product?.wholesaleTypeName);
            const item = {
                product,
                totalCost: parseFloat(product?.totalCost) || 0
            };

            if (typeName === '一口价') {
                yikoujiaList.push(item);
            } else if (typeName.includes('特价')) {
                tejiaList.push(item);
            } else {
                otherList.push(item);
            }
        });

        const sortBySales = (a, b) => b.totalCost - a.totalCost;
        yikoujiaList.sort(sortBySales);
        tejiaList.sort(sortBySales);
        otherList.sort(sortBySales);

        if (yikoujiaList.length > 0) return yikoujiaList[0].product;
        if (tejiaList.length > 0) return tejiaList[0].product;
        if (otherList.length > 0) return otherList[0].product;
        return products[0] || null;
    }
};

window.ChaxunToolModule = ChaxunToolModule;
initChaxunToolModule();
