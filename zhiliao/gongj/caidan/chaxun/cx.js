// 智聊指令 - 查询指令模块
const ZhiLiaoCxCommand = {
    // 状态
    state: {
        products: [],           // 当前查询结果（已排序）
        isSearching: false,
        displayedCount: 0,      // 已显示的卡片数量
        currentContainer: null, // 当前消息容器
        batchSize: 5,           // 每次展开的数量
        isExpanded: false,      // 是否已展开
        initialCards: []        // 初始显示的卡片
    },

    // 初始化并注册指令
    init() {
        if (!window.ZhiLiaoCaidanModule) {
            console.warn('指令系统未加载，延迟注册查询指令');
            setTimeout(() => this.init(), 500);
            return;
        }

        ZhiLiaoCaidanModule.registerCommand({
            id: 'cx',
            name: '查询',
            icon: 'fa-solid fa-magnifying-glass',
            description: '查询商品信息',
            handler: (extraContent) => this.handleCommand(extraContent)
        });

        console.log('查询指令已注册');
    },

    // 处理指令
    async handleCommand(extraContent) {
        // 显示聊天界面
        const welcomeScreen = document.getElementById('welcome-screen');
        const messageContainer = document.getElementById('message-container');
        if (welcomeScreen?.style.display !== 'none') {
            welcomeScreen.style.display = 'none';
            messageContainer?.classList.add('active');
        }

        const keyword = extraContent?.trim() || '';

        // 检测是否有上传的图片
        const uploadedFiles = window.ZhiLiaoModule?.state?.uploadedFiles || [];
        const imageFiles = uploadedFiles.filter(f => f.type.startsWith('image/'));
        const hasImages = imageFiles.length > 0;

        if (!keyword && !hasImages) {
            this.addUserMessage('@查询');
            const container = this.createSystemMessage();
            container.innerHTML = '<p>请输入商品编码或商品名称进行查询<br><span style="color:#999;font-size:12px;">示例：@查询 阿莫西林<br>或上传药品图片自动识别</span></p>';
            this.scrollToBottom();
            return;
        }

        // 有图片，发送给AI识别
        if (hasImages) {
            await this.handleImageQuery(keyword, imageFiles);
            return;
        }

        // 有关键词，直接查询
        this.addUserMessage(`@查询 ${keyword}`);
        await this.searchProducts(keyword);
    },

    // 搜索商品（支持传入已存在的容器）
    async searchProducts(keyword, existingContainer = null) {
        if (this.state.isSearching) return;
        this.state.isSearching = true;

        const container = existingContainer || this.createSystemMessage();
        container.innerHTML = '<span style="color:#666;"><i class="fa-solid fa-spinner fa-spin"></i> 正在查询...</span>';
        this.scrollToBottom();

        try {
            // 等待API模块加载
            if (!window.ChaxunAPIModule) {
                await this.waitForModule('ChaxunAPIModule', 20);
            }

            if (!window.ChaxunAPIModule) {
                container.innerHTML = '<p style="color:#ef4444;">商品查询模块未加载</p>';
                return;
            }

            const result = await window.ChaxunAPIModule.searchProducts(keyword, [], 0);

            if (!result.success) {
                if (result.error === 'NO_LOGIN') {
                    container.innerHTML = '<p style="color:#ef4444;">请先登录SCM账户</p>';
                } else {
                    container.innerHTML = `<p style="color:#ef4444;">${result.error || '查询失败'}</p>`;
                }
                return;
            }

            this.state.products = result.data || [];

            if (this.state.products.length === 0) {
                container.innerHTML = '<p>暂无此商品！</p>';
                return;
            }

            // 按销售金额降序排序
            this.state.products.sort((a, b) => {
                const costA = parseFloat(a.totalCost) || 0;
                const costB = parseFloat(b.totalCost) || 0;
                return costB - costA;
            });

            // 重置显示状态
            this.state.displayedCount = 0;
            this.state.currentContainer = container;

            // 渲染商品卡片（初始只显示一口价和特价各一个）
            container.innerHTML = this.renderProductCards(this.state.products);
            this.bindCardEvents(container);

        } catch (error) {
            console.error('查询商品失败:', error);
            container.innerHTML = `<p style="color:#ef4444;">查询失败: ${error.message}</p>`;
        } finally {
            this.state.isSearching = false;
            this.scrollToBottom();
        }
    },

    // 尝试搜索商品（用于级联查询，返回是否成功）
    async trySearchProducts(keyword, container) {
        try {
            // 等待API模块加载
            if (!window.ChaxunAPIModule) {
                await this.waitForModule('ChaxunAPIModule', 20);
            }

            if (!window.ChaxunAPIModule) {
                return false;
            }

            const result = await window.ChaxunAPIModule.searchProducts(keyword, [], 0);

            if (!result.success) {
                if (result.error === 'NO_LOGIN') {
                    container.innerHTML = '<p style="color:#ef4444;">请先登录SCM账户</p>';
                    return true; // 登录错误不继续尝试
                }
                return false;
            }

            const products = result.data || [];
            if (products.length === 0) {
                return false; // 无结果，继续尝试下一个关键词
            }

            // 有结果，渲染卡片
            this.state.products = products;

            // 按销售金额降序排序
            this.state.products.sort((a, b) => {
                const costA = parseFloat(a.totalCost) || 0;
                const costB = parseFloat(b.totalCost) || 0;
                return costB - costA;
            });

            // 重置显示状态
            this.state.displayedCount = 0;
            this.state.currentContainer = container;

            // 渲染商品卡片
            container.innerHTML = this.renderProductCards(this.state.products);
            this.bindCardEvents(container);
            this.scrollToBottom();

            return true; // 查询成功
        } catch (error) {
            console.error('查询商品失败:', error);
            return false;
        }
    },

    // 等待模块加载
    async waitForModule(moduleName, maxRetries = 20) {
        for (let i = 0; i < maxRetries; i++) {
            if (window[moduleName]) return true;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return false;
    },

    // 处理图片查询（AI识别后调用查询模块）
    async handleImageQuery(keyword, imageFiles) {
        if (!window.ZhiLiaoModule) {
            console.error('智聊模块未加载');
            return;
        }

        // 显示用户消息（包含图片）
        const userText = keyword ? `@查询 ${keyword}` : '@查询';
        ZhiLiaoModule.addUserMessage(userText, imageFiles);

        // 清空文件列表
        ZhiLiaoModule.state.uploadedFiles = [];
        ZhiLiaoModule.updateFileTags();

        // 创建系统消息容器，显示识别状态
        const container = this.createSystemMessage();
        container.innerHTML = '<span style="color:#666;"><i class="fa-solid fa-spinner fa-spin"></i> 正在识别图片...</span>';
        this.scrollToBottom();

        try {
            // 解析图片文件
            const parseData = await ZhiLiaoModule.parseFiles(imageFiles);
            const fileIds = parseData.fileIds;

            // 构建多模态内容
            const promptText = '请识别图片中的药品信息，返回JSON格式：{"code":"商品编码","approval":"国药准字","name":"药品名称","factory":"厂家"}，只填写能识别到的字段，其他留空字符串。';
            const userContent = await ZhiLiaoModule.buildMultimodalContent(
                promptText,
                imageFiles,
                fileIds
            );

            // 调用AI识别（非流式）
            container.innerHTML = '<span style="color:#666;"><i class="fa-solid fa-spinner fa-spin"></i> AI分析中...</span>';
            this.scrollToBottom();

            const systemPrompt = `你是药品识别专家，请从图片中提取可查询的信息。

返回JSON：{"code":"","drugId":"","approval":"","name":"","factory":""}

字段说明：
- code: 商品编码（2位字母开头+数字，排除价格/条形码/批号）
- drugId: 药品ID（7位纯数字）
- approval: 批准文号（国药准字等完整编号）
- name: 药品名称（通用名或商品名，不含规格剂型）
- factory: 生产厂家（完整企业名称）

请运用你的药品行业知识智能判断每个字段，只填写图片中实际看到的完整信息，不确定的留空。
只返回JSON。`;

            const response = await fetch(ZhiLiaoModule.config.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ZhiLiaoModule.config.apiKey}`
                },
                body: JSON.stringify({
                    model: 'glm-4.6v',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userContent }
                    ],
                    max_tokens: 300,
                    temperature: 0.2,
                    stream: false,
                    thinking: { type: 'disabled' }
                })
            });

            const result = await response.json();
            const aiResponse = result.choices?.[0]?.message?.content?.trim() || '';
            console.log('AI原始返回:', aiResponse);

            // 解析AI返回的JSON
            let drugInfo = { code: '', drugId: '', approval: '', name: '', factory: '' };
            try {
                // 先移除markdown代码块标记
                let cleanResponse = aiResponse
                    .replace(/```json\s*/gi, '')
                    .replace(/```\s*/g, '')
                    .trim();

                // 尝试提取JSON部分
                const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    drugInfo = JSON.parse(jsonMatch[0]);
                }
                console.log('解析后drugInfo:', drugInfo);
            } catch (e) {
                console.error('JSON解析失败:', e, '原始内容:', aiResponse);
                // 如果解析失败，尝试直接使用返回内容作为名称
                drugInfo.name = aiResponse;
            }

            // 构建查询候选列表（按优先级排序）
            const candidates = [];

            // 验证函数（宽松判断，信任AI的识别结果）
            const isNotPrice = (value) => {
                if (!value) return false;
                // 只排除明显的价格格式（带小数点的数字、带货币符号的）
                if (/^\d+\.\d+$/.test(value)) return false; // 如 168.50
                if (/^[¥￥$€£]\d/.test(value)) return false; // 如 ¥99
                return true;
            };

            // 按优先级添加候选关键词：商品编码 > 商品ID > 批准文号 > 商品名称 > 厂家
            // 1. 用户指定的关键词（最高优先级）
            if (keyword) {
                candidates.push({ keyword: keyword.trim(), type: '用户指定' });
            }
            // 2. 商品编码
            if (drugInfo.code && isNotPrice(drugInfo.code)) {
                candidates.push({ keyword: drugInfo.code.trim(), type: '商品编码' });
            }
            // 3. 商品ID
            if (drugInfo.drugId && isNotPrice(drugInfo.drugId)) {
                candidates.push({ keyword: drugInfo.drugId.trim(), type: '商品ID' });
            }
            // 4. 批准文号
            if (drugInfo.approval && drugInfo.approval.length >= 5 && isNotPrice(drugInfo.approval)) {
                candidates.push({ keyword: drugInfo.approval.trim(), type: '批准文号' });
            }
            // 5. 药品名称
            if (drugInfo.name && drugInfo.name.trim()) {
                candidates.push({ keyword: drugInfo.name.trim(), type: '药品名称' });
            }
            // 6. 厂家
            if (drugInfo.factory && drugInfo.factory.trim()) {
                candidates.push({ keyword: drugInfo.factory.trim(), type: '厂家' });
            }

            console.log('查询候选列表:', candidates);

            if (candidates.length === 0) {
                container.innerHTML = '<p style="color:#ef4444;">无法识别图片中的药品信息，请重新拍摄清晰图片</p>';
                return;
            }

            // 级联查询：依次尝试每个候选关键词
            for (let i = 0; i < candidates.length; i++) {
                const { keyword: kw, type } = candidates[i];
                console.log(`尝试第${i + 1}个关键词:`, kw, '类型:', type);

                // 显示当前查询状态
                container.innerHTML = `<span style="color:#666;"><i class="fa-solid fa-spinner fa-spin"></i> 识别到${type}：${kw}，正在查询...</span>`;
                this.scrollToBottom();

                // 尝试查询
                const success = await this.trySearchProducts(kw, container);
                if (success) {
                    console.log('查询成功，使用关键词:', kw);
                    return; // 查询成功，退出
                }

                // 如果还有下一个候选，显示重试提示
                if (i < candidates.length - 1) {
                    console.log('查询无结果，尝试下一个关键词');
                }
            }

            // 所有候选都查询失败
            container.innerHTML = '<p>暂无此商品！</p>';

        } catch (error) {
            console.error('图片查询失败:', error);
            container.innerHTML = `<p style="color:#ef4444;">图片识别失败: ${error.message}</p>`;
        }
    },

    // 渲染商品卡片列表（初始显示）
    renderProductCards(products) {
        const count = products.length;
        const header = `<p><b>🎁找到 ${count} 个商品🔍</b></p>`;

        // 获取初始显示的卡片（一口价+特价各一个）
        const initialCards = this.getInitialCards(products);
        this.state.initialCards = initialCards;
        this.state.displayedCount = initialCards.length;
        this.state.isExpanded = false;

        // 调用商品查询模块的卡片生成方法
        const cardsHtml = initialCards.map((item) =>
            window.ChaxunCardModule.generateCard(item.product, item.index + 1)
        ).join('');

        // 如果还有更多卡片，显示展开按钮
        const hasMore = products.length > this.state.displayedCount;
        const expandBtn = hasMore ? this.renderToggleButton() : '';

        return header + `<div class="zhiliao-cx-cards">${cardsHtml}</div>${expandBtn}`;
    },

    // 在智聊对话中渲染商品卡片（供AI工具调用使用，与查询命令使用相同逻辑）
    renderProductCardsInChat(products, parentContainer, textContainer) {
        if (!products || products.length === 0) return null;

        // 按销售金额降序排序
        products.sort((a, b) => {
            const costA = parseFloat(a.totalCost) || 0;
            const costB = parseFloat(b.totalCost) || 0;
            return costB - costA;
        });

        // 保存商品数据到state（供详情弹窗使用）
        this.state.products = products;

        // 创建卡片容器
        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'product-cards-result';

        // 使用统一的渲染逻辑（包含展开/折叠功能）
        const cardsHtml = this.renderProductCards(products);

        // 创建文本容器的包装元素
        const textWrapper = document.createElement('div');
        textWrapper.className = 'system-text text-gray-700';
        textWrapper.innerHTML = cardsHtml;

        // 保存当前容器引用
        this.state.currentContainer = textWrapper;

        // 将卡片容器插入到textContainer之前
        cardsDiv.appendChild(textWrapper);
        parentContainer.insertBefore(cardsDiv, textContainer);

        // 绑定事件监听器（详情按钮、小眼睛等）
        this.bindCardEvents(textWrapper);

        return cardsDiv;
    },

    // 获取初始显示的卡片（一口价+特价各一个）
    getInitialCards(products) {
        const result = [];
        let foundYikoujia = false;
        let foundTejia = false;

        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            const typeName = product.wholesaleTypeName || '';

            // 找一口价
            if (!foundYikoujia && typeName === '一口价') {
                result.push({ product, index: i });
                foundYikoujia = true;
                continue;
            }

            // 找特价或限时特价
            if (!foundTejia && (typeName === '特价' || typeName === '限时特价')) {
                result.push({ product, index: i });
                foundTejia = true;
                continue;
            }

            // 如果都找到了，退出
            if (foundYikoujia && foundTejia) break;
        }

        // 如果没找到特价，补充其它类型（金额最高的）
        if (foundYikoujia && !foundTejia && products.length > 1) {
            for (let i = 0; i < products.length; i++) {
                const alreadyAdded = result.some(item => item.index === i);
                if (!alreadyAdded) {
                    result.push({ product: products[i], index: i });
                    break;
                }
            }
        }

        // 如果没找到一口价，补充其它类型（金额最高的）
        if (!foundYikoujia && foundTejia && products.length > 1) {
            for (let i = 0; i < products.length; i++) {
                const alreadyAdded = result.some(item => item.index === i);
                if (!alreadyAdded) {
                    result.push({ product: products[i], index: i });
                    break;
                }
            }
        }

        // 如果只有一个商品
        if (result.length === 0 && products.length > 0) {
            result.push({ product: products[0], index: 0 });
        }

        // 按原始索引排序
        result.sort((a, b) => a.index - b.index);

        return result;
    },

    // 渲染展开/折叠按钮组
    renderToggleButton() {
        const remaining = this.state.products.length - this.state.displayedCount;
        const initialCount = this.state.initialCards.length;
        const canCollapse = this.state.displayedCount - initialCount;
        const collapseCount = Math.min(canCollapse, this.state.batchSize);
        const hasMore = remaining > 0;

        return `
            <div class="zhiliao-cx-btn-group">
                <div class="zhiliao-cx-collapse-btn ${canCollapse <= 0 ? 'disabled' : ''}" onclick="ZhiLiaoCxCommand.collapseCards()">
                    <i class="fa-solid fa-chevron-up"></i>
                    <span>收起${canCollapse > 0 ? ` (${collapseCount})` : ''}</span>
                </div>
                <div class="zhiliao-cx-expand-btn ${!hasMore ? 'disabled' : ''}" onclick="ZhiLiaoCxCommand.expandMore()">
                    <span>展开${hasMore ? ` (${Math.min(remaining, this.state.batchSize)})` : ''}</span>
                    <i class="fa-solid fa-chevron-down"></i>
                </div>
            </div>
        `;
    },

    // 切换展开/折叠
    toggleCards() {
        if (this.state.isExpanded) {
            this.collapseCards();
        } else {
            this.expandMore();
        }
    },

    // 展开更多卡片
    expandMore() {
        const container = this.state.currentContainer;
        if (!container) return;

        const products = this.state.products;
        const currentCount = this.state.displayedCount;
        const batchSize = this.state.batchSize;

        // 获取已显示的索引集合
        const displayedIndices = this.getDisplayedIndices();

        // 获取下一批要显示的卡片
        const nextBatch = [];
        for (let i = 0; i < products.length && nextBatch.length < batchSize; i++) {
            if (!displayedIndices.has(i)) {
                nextBatch.push({ product: products[i], index: i });
            }
        }

        if (nextBatch.length === 0) return;

        // 更新已显示数量
        this.state.displayedCount = currentCount + nextBatch.length;

        // 渲染新卡片（调用商品查询模块）
        const newCardsHtml = nextBatch.map((item) =>
            window.ChaxunCardModule.generateCard(item.product, item.index + 1)
        ).join('');

        // 找到卡片容器和展开按钮
        const cardsContainer = container.querySelector('.zhiliao-cx-cards');
        const expandBtn = container.querySelector('.zhiliao-cx-expand-btn');

        // 添加新卡片
        if (cardsContainer) {
            cardsContainer.insertAdjacentHTML('beforeend', newCardsHtml);
        }

        // 更新按钮组状态
        this.updateButtonGroup(container);

        // 重新绑定事件
        this.bindCardEvents(container);
        this.scrollToBottom();
    },

    // 折叠卡片（每次收起batchSize个）
    collapseCards() {
        const container = this.state.currentContainer;
        if (!container) return;

        const cardsContainer = container.querySelector('.zhiliao-cx-cards');
        if (!cardsContainer) return;

        const initialCount = this.state.initialCards.length;
        const currentCount = this.state.displayedCount;
        const batchSize = this.state.batchSize;

        // 计算收起后的数量（不能少于初始数量）
        const newCount = Math.max(initialCount, currentCount - batchSize);

        if (newCount >= currentCount) return; // 无法再收起

        // 获取需要保留的卡片索引
        const allCards = cardsContainer.querySelectorAll('.chaxun-card');
        const cardsToRemove = currentCount - newCount;

        // 从后往前移除卡片
        for (let i = 0; i < cardsToRemove && allCards.length > newCount; i++) {
            const lastCard = cardsContainer.querySelector('.chaxun-card:last-child');
            if (lastCard) {
                lastCard.remove();
            }
        }

        // 更新状态
        this.state.displayedCount = newCount;

        // 更新按钮组状态
        this.updateButtonGroup(container);

        // 重新绑定事件
        this.bindCardEvents(container);
    },

    // 更新按钮组状态
    updateButtonGroup(container) {
        const btnGroup = container.querySelector('.zhiliao-cx-btn-group');
        if (!btnGroup) return;

        const remaining = this.state.products.length - this.state.displayedCount;
        const initialCount = this.state.initialCards.length;
        const canCollapse = this.state.displayedCount - initialCount;
        const collapseCount = Math.min(canCollapse, this.state.batchSize);
        const expandCount = Math.min(remaining, this.state.batchSize);
        const hasMore = remaining > 0;

        // 更新折叠按钮
        const collapseBtn = btnGroup.querySelector('.zhiliao-cx-collapse-btn');
        if (collapseBtn) {
            if (canCollapse <= 0) {
                collapseBtn.classList.add('disabled');
                collapseBtn.querySelector('span').textContent = '收起';
            } else {
                collapseBtn.classList.remove('disabled');
                collapseBtn.querySelector('span').textContent = `收起 (${collapseCount})`;
            }
        }

        // 更新展开按钮
        const expandBtn = btnGroup.querySelector('.zhiliao-cx-expand-btn');
        if (expandBtn) {
            if (hasMore) {
                expandBtn.classList.remove('disabled');
                expandBtn.querySelector('span').textContent = `展开 (${expandCount})`;
            } else {
                expandBtn.classList.add('disabled');
                expandBtn.querySelector('span').textContent = '展开';
            }
        }
    },

    // 获取已显示的卡片索引
    getDisplayedIndices() {
        const indices = new Set();
        const container = this.state.currentContainer;
        if (!container) return indices;

        container.querySelectorAll('.chaxun-card').forEach(card => {
            const id = card.dataset.id;
            // 通过wholesaleId找到对应的索引
            const index = this.state.products.findIndex(p => String(p.wholesaleId) === id);
            if (index !== -1) {
                indices.add(index);
            }
        });

        return indices;
    },

    // 绑定卡片事件
    bindCardEvents(container) {
        container.querySelectorAll('.chaxun-detail-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index) - 1;
                this.showDetail(index);
            });
        });

        // 品种负责人小眼睛点击
        container.querySelectorAll('.chaxun-contactor-eye').forEach(eye => {
            eye.addEventListener('click', (e) => {
                e.stopPropagation();
                this.queryContactor(eye);
            });
        });
    },

    // 查询品种负责人
    async queryContactor(eyeIcon) {
        // 数据属性在父标签上
        const parentTag = eyeIcon.parentElement;
        const wholesaleId = parentTag?.dataset.wholesaleid;
        const drugCode = parentTag?.dataset.drugcode;
        const valueSpan = parentTag?.querySelector('.chaxun-contactor-value');

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

    // 确保详情弹窗DOM存在
    ensureDetailOverlay() {
        if (document.getElementById('zhiliao-cx-detail-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'zhiliao-cx-detail-overlay';
        overlay.className = 'zhiliao-cx-detail-overlay';
        overlay.innerHTML = `
            <div class="zhiliao-cx-detail-modal">
                <div class="zhiliao-cx-detail-header">
                    <span class="zhiliao-cx-detail-title">商品详情</span>
                    <button class="zhiliao-cx-detail-close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="zhiliao-cx-detail-body"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        // 绑定关闭事件
        overlay.querySelector('.zhiliao-cx-detail-close').addEventListener('click', () => this.hideDetail());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.hideDetail();
        });

        // 绑定分组折叠事件
        overlay.querySelector('.zhiliao-cx-detail-body').addEventListener('click', (e) => {
            const header = e.target.closest('.zhiliao-cx-detail-section-header');
            if (header) {
                header.closest('.zhiliao-cx-detail-section')?.classList.toggle('collapsed');
            }
        });
    },

    // 显示详情弹窗
    showDetail(index) {
        const product = this.state.products[index];
        if (!product) return;

        this.ensureDetailOverlay();

        const overlay = document.getElementById('zhiliao-cx-detail-overlay');
        const body = overlay.querySelector('.zhiliao-cx-detail-body');

        body.innerHTML = this.renderDetailContent(product);
        overlay.classList.add('active');
    },

    // 隐藏详情弹窗
    hideDetail() {
        const overlay = document.getElementById('zhiliao-cx-detail-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    // 渲染详情内容
    renderDetailContent(product) {
        const sections = window.ChaxunDetailModule?.sections || [];
        return sections.map(section => this.renderSection(section, product)).join('');
    },

    // 渲染详情分组
    renderSection(section, product) {
        const fieldsHtml = section.fields.map(field => this.renderField(field, product)).join('');
        return `
            <div class="zhiliao-cx-detail-section">
                <div class="zhiliao-cx-detail-section-header">
                    <span class="zhiliao-cx-detail-section-title">
                        <span>${section.icon}</span> ${section.title}
                    </span>
                    <i class="fa-solid fa-chevron-down zhiliao-cx-detail-section-toggle"></i>
                </div>
                <div class="zhiliao-cx-detail-section-content">${fieldsHtml}</div>
            </div>
        `;
    },

    // 渲染详情字段
    renderField(field, product) {
        let value = product[field.key];
        if (field.highlight && value !== null && value !== undefined) {
            value = ChaxunUtils.formatPrice(value);
        }
        if (field.isDate && value) {
            value = ChaxunUtils.formatDate(value);
        }
        const displayValue = value ?? '-';
        const fullWidthClass = field.fullWidth ? ' full-width' : '';
        const highlightClass = field.highlight ? ' highlight' : '';

        return `
            <div class="zhiliao-cx-detail-field${fullWidthClass}">
                <span class="zhiliao-cx-detail-label">${field.label}</span>
                <span class="zhiliao-cx-detail-value${highlightClass}">${ChaxunUtils.escapeHtml(displayValue)}</span>
            </div>
        `;
    },

    // 添加用户消息
    addUserMessage(text) {
        const container = document.getElementById('message-container');
        if (!container) return;
        const div = document.createElement('div');
        div.className = 'user-message';
        div.textContent = text;
        container.appendChild(div);
    },

    // 创建系统消息容器
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

    // 滚动到底部
    scrollToBottom() {
        const container = document.getElementById('message-container');
        if (container) container.scrollTop = container.scrollHeight;
    }
};

// 导出模块
window.ZhiLiaoCxCommand = ZhiLiaoCxCommand;

// 自动初始化
ZhiLiaoCxCommand.init();
