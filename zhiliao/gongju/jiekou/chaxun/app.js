/**
 * 商品查询模块 - 注册与逻辑
 *
 * 职责：
 * 1. 注册商品查询工具到ToolRegistry
 * 2. 处理查询逻辑和数据处理
 * 3. 调用渲染模块(ys.js)显示结果
 */

// 等待依赖模块加载
function initChaxunToolModule() {
    if (!window.ToolRegistry || !window.GongjuApi) {
        setTimeout(initChaxunToolModule, 100);
        return;
    }

    // 注册商品查询工具
    ToolRegistry.register({
        id: 'search_product',
        name: '查询',
        command: '@查询',
        icon: 'fa-solid fa-magnifying-glass',
        registerType: 'both',
        description: '查询商品信息（支持商品编码、药品名称或国药准字）。当用户上传药品图片时，先识别图片中的商品编码/药品名称/国药准字，然后调用此工具查询。',
        parameters: {
            type: 'object',
            properties: {
                keyword: {
                    type: 'string',
                    description: '搜索关键词（商品编码、药品名称或国药准字）'
                }
            },
            required: ['keyword']
        },
        handler: async (params) => {
            return await ChaxunToolModule.handleQuery(params);
        }
    });

    console.log('✅ 商品查询工具已注册');
}

// 商品查询工具模块
const ChaxunToolModule = {
    /**
     * 处理查询请求
     * @param {Object|string} params - 参数（对象或字符串）
     * @param {boolean} params._fromAI - 是否来自AI工具调用（内部标记）
     */
    async handleQuery(params) {
        // 参数处理：支持字符串或对象格式
        const keyword = typeof params === 'string' ? params : params.keyword;
        // 判断是否来自AI工具调用（AI调用时不显示用户消息）
        const fromAI = typeof params === 'object' && params._fromAI === true;

        // 检测是否有上传的图片
        const uploadedFiles = window.ZhiLiaoModule?.state?.uploadedFiles || [];
        const imageFiles = uploadedFiles.filter(f => f.type.startsWith('image/'));
        const hasImages = imageFiles.length > 0;

        // 有图片时，调用图片识别模块
        if (hasImages) {
            return await this.handleImageQuery(keyword, imageFiles, fromAI);
        }

        // 无关键词时显示提示（仅命令触发时）
        if (!keyword || !keyword.trim()) {
            if (!fromAI) {
                this.addUserMessage('@查询');
                const container = this.createSystemMessage();
                container.innerHTML = '<p>请输入商品编码或商品名称进行查询！<br><span style="color:#999;font-size:12px;">示例：@查询 阿莫西林<br>或上传药品图片自动识别</span></p>';
                this.scrollToBottom();
            }
            return { success: true };
        }

        // 显示用户消息（仅命令触发时）
        if (!fromAI) {
            this.addUserMessage(`@查询 ${keyword.trim()}`);
        }

        // AI调用时不显示加载状态（由app.js统一处理）
        let loadingContainer = null;
        if (!fromAI) {
            loadingContainer = this.createSystemMessage();
            loadingContainer.innerHTML = '<span style="color:#666;"><i class="fa-solid fa-spinner fa-spin"></i> 正在查询...</span>';
            this.scrollToBottom();
        }

        // 调用商品查询接口
        const result = await GongjuApi.searchProducts(
            keyword.trim(),
            [],  // wholesaleTypes
            -1   // status
        );

        if (!result.success) {
            if (loadingContainer) {
                loadingContainer.innerHTML = `<p style="color:#ef4444;">${result.error || '查询失败'}</p>`;
            }
            return { success: false, error: result.error || '查询失败' };
        }

        const products = result.data || [];
        if (products.length === 0) {
            if (loadingContainer) {
                loadingContainer.innerHTML = '<p>暂无此商品</p>';
            }
            return { success: true, count: 0, message: '暂无此商品' };
        }

        // 移除加载状态容器
        if (loadingContainer) {
            loadingContainer.closest('.system-message')?.remove();
        }

        // 按销售金额降序排序
        products.sort((a, b) => {
            const costA = parseFloat(a.totalCost) || 0;
            const costB = parseFloat(b.totalCost) || 0;
            return costB - costA;
        });

        // 命令触发时渲染结果，AI调用时由app.js统一渲染
        if (!fromAI && window.ChaxunYsModule) {
            ChaxunYsModule.renderResults(products, result.summary);
        }

        return {
            success: true,
            count: products.length,
            products: products,
            summary: result.summary,
            render_cards: true  // 标记需要渲染卡片（供app.js使用）
        };
    },

    /**
     * 添加用户消息
     */
    addUserMessage(text) {
        const container = document.getElementById('message-container');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'user-message';
        div.textContent = text;
        container.appendChild(div);
    },

    /**
     * 创建系统消息容器
     */
    createSystemMessage() {
        const container = document.getElementById('message-container');
        if (!container) return null;
        const div = document.createElement('div');
        div.className = 'system-message';
        div.innerHTML = `
            <img src="logo/ai.svg" alt="AI" class="system-avatar">
            <div class="system-text text-gray-700"></div>
        `;
        container.appendChild(div);
        return div.querySelector('.system-text');
    },

    /**
     * 滚动到底部
     */
    scrollToBottom() {
        const container = document.getElementById('message-container');
        if (container) container.scrollTop = container.scrollHeight;
    },

    /**
     * 处理图片查询
     * @param {string} keyword - 关键词
     * @param {Array} imageFiles - 图片文件数组
     * @param {boolean} fromAI - 是否来自AI工具调用
     */
    async handleImageQuery(keyword, imageFiles, fromAI = false) {
        // 显示用户消息（仅命令触发时）
        if (!fromAI) {
            this.addUserMessageWithImages('@查询', imageFiles);
        }

        // 清除已上传的文件（数据和UI）
        if (window.ZhiLiaoModule?.state) {
            ZhiLiaoModule.state.uploadedFiles = [];
            if (window.ZhiLiaoBujuModule) {
                ZhiLiaoBujuModule.updateFileTags([]);
            }
        }

        // 创建状态容器
        const statusContainer = this.createSystemMessage();
        if (!statusContainer) {
            return { success: false, error: '无法创建消息容器' };
        }
        this.scrollToBottom();

        // 检查识别模块是否加载
        if (!window.ChaxunShibieModule) {
            statusContainer.innerHTML = '<p style="color:#ef4444;">图片识别模块未加载</p>';
            return { success: false, error: '模块未加载' };
        }

        // 调用识别模块
        const result = await ChaxunShibieModule.handleImageQuery(keyword, imageFiles, {
            onStatus: (msg) => {
                statusContainer.innerHTML = `<span style="color:#666;"><i class="fa-solid fa-spinner fa-spin"></i> ${msg}</span>`;
                this.scrollToBottom();
            },
            onQuery: (kw, type) => {
                statusContainer.innerHTML = `<span style="color:#666;"><i class="fa-solid fa-spinner fa-spin"></i> 正在查询：${kw}（${type}）</span>`;
                this.scrollToBottom();
            },
            onError: (msg) => {
                statusContainer.innerHTML = `<p style="color:#ef4444;">${msg}</p>`;
            },
            onSuccess: (products, summary) => {
                // 移除状态容器
                statusContainer.closest('.system-message')?.remove();
                // 渲染结果
                if (window.ChaxunYsModule) {
                    ChaxunYsModule.renderResults(products, summary);
                }
            },
            onFail: (msg) => {
                statusContainer.innerHTML = `<p>${msg}</p>`;
            }
        });

        return result;
    },

    /**
     * 添加带图片的用户消息
     */
    addUserMessageWithImages(text, imageFiles) {
        const container = document.getElementById('message-container');
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'user-message';

        // 文本
        const textSpan = document.createElement('span');
        textSpan.textContent = text;
        div.appendChild(textSpan);

        // 图片缩略图
        if (imageFiles && imageFiles.length > 0) {
            const imgContainer = document.createElement('div');
            imgContainer.style.cssText = 'display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;';

            imageFiles.forEach(file => {
                const img = document.createElement('img');
                const url = URL.createObjectURL(file);
                img.src = url;
                img.style.cssText = 'max-width:60px;max-height:60px;border-radius:4px;object-fit:cover;';
                img.className = 'yulan-clickable';
                img.onclick = () => window.showImagePreview?.(url);
                imgContainer.appendChild(img);
            });

            div.appendChild(imgContainer);
        }

        container.appendChild(div);
    }
};

// 导出模块
window.ChaxunToolModule = ChaxunToolModule;

// 初始化
initChaxunToolModule();
