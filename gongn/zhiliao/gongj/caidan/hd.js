// 智聊指令 - 活动指令模块
const ZhiLiaoHdCommand = {
    // 配置
    config: {
        // 赠送API地址
        zsApiUrl: 'https://1317825751-7vayk0nz7f.ap-guangzhou.tencentscf.com'
    },

    // 状态
    state: {
        sharedCoupons: [],      // 共享优惠券列表
        selectedCoupons: [],    // 选中的优惠券列表
        isLoading: false
    },

    // 初始化并注册指令
    init() {
        if (!window.ZhiLiaoCaidanModule) {
            console.warn('指令系统未加载，延迟注册活动指令');
            setTimeout(() => this.init(), 500);
            return;
        }

        // 注册活动指令
        ZhiLiaoCaidanModule.registerCommand({
            id: 'hd',
            name: '活动',
            icon: 'fa-solid fa-gift',
            description: '查看/发送共享优惠券',
            handler: (extraContent) => this.handleCommand(extraContent)
        });

        console.log('活动指令已注册');
    },

    // 处理指令
    async handleCommand(extraContent) {
        // 显示欢迎界面隐藏
        const welcomeScreen = document.getElementById('welcome-screen');
        const messageContainer = document.getElementById('message-container');
        if (welcomeScreen?.style.display !== 'none') {
            welcomeScreen.style.display = 'none';
            messageContainer?.classList.add('active');
        }

        // 检查是否有选中的优惠券
        if (this.state.selectedCoupons.length > 0 && extraContent && extraContent.trim() !== '') {
            // 有选中的优惠券且有输入内容：发送选中的优惠券
            await this.sendSelectedCoupons(extraContent);
        } else if (!extraContent || extraContent.trim() === '') {
            // 未输入内容：显示共享优惠券卡片
            await this.showSharedCoupons();
        } else {
            // 输入了内容但没有选中优惠券：解析关键字并发券
            await this.parseAndSendCoupons(extraContent);
        }
    },

    // 获取共享优惠券列表
    async getSharedCoupons() {
        try {
            // 确保 Firebase 已初始化
            if (!window.FirebaseModule) {
                throw new Error('Firebase模块未加载');
            }
            await window.FirebaseModule.init();

            const db = window.FirebaseModule.state.database;
            if (!db) {
                throw new Error('数据库连接失败');
            }

            // 获取所有共享优惠券
            const snapshot = await db.ref('yhq_gx').once('value');
            const data = snapshot.val() || {};

            // 过滤出已开启共享的优惠券
            const sharedCoupons = [];
            for (const [couponId, info] of Object.entries(data)) {
                if (info.shifenggongxiang === true) {
                    sharedCoupons.push({
                        id: couponId,
                        keyword: info.guanjianzi || info.mingcheng || '',
                        name: info.mingcheng || info.guanjianzi || '未命名',
                        storeLimit: info.dandianxianzhi || 10,
                        totalLimit: info.zengsongzongshu || 100,
                        sentCount: info.yifafangzongshu || 0,
                        updateTime: info.gengxinshijian || ''
                    });
                }
            }

            this.state.sharedCoupons = sharedCoupons;
            return sharedCoupons;

        } catch (error) {
            console.error('获取共享优惠券失败:', error);
            throw error;
        }
    },

    // 显示共享优惠券卡片
    async showSharedCoupons() {
        // 添加用户消息
        this.addUserMessage('@活动');

        // 创建AI回复容器
        const container = this.createSystemMessage();

        try {
            // 显示加载状态
            container.innerHTML = '<span style="color:#666;">正在获取...</span>';

            // 获取共享优惠券
            const coupons = await this.getSharedCoupons();

            if (coupons.length === 0) {
                container.innerHTML = '<p>暂无共享优惠券，请先在优惠券模块中开启共享</p>';
                return;
            }

            // 渲染优惠券卡片
            container.innerHTML = this.renderCouponCards(coupons);

        } catch (error) {
            container.innerHTML = `<p>获取失败: ${error.message}</p>`;
        }

        this.scrollToBottom();
    },

    // 渲染优惠券卡片（一行两个，紧凑小字）
    renderCouponCards(coupons) {
        const cardsHtml = coupons.map(coupon => {
            return `
            <div class="zhiliao-hd-card" data-id="${coupon.id}" data-keyword="${this.escapeHtml(coupon.keyword)}" onclick="ZhiLiaoHdCommand.toggleCardSelect(this)">
                <div class="zhiliao-hd-card-name">${this.escapeHtml(coupon.name)}</div>
                <div class="zhiliao-hd-card-info">总${coupon.totalLimit}张·限${coupon.storeLimit}张</div>
            </div>
        `}).join('');

        return `
            <p><b>🎁已共享优惠券👇</b></p>
            <div class="zhiliao-hd-cards">${cardsHtml}</div>
        `;
    },

    // 解析关键字并发送优惠券（流程与选择发送一致）
    async parseAndSendCoupons(content) {
        // 创建解析状态容器
        const parseContainer = this.createSystemMessage();
        parseContainer.innerHTML = '<p>正在解析关键字...</p>';
        this.scrollToBottom();

        try {
            // 获取共享优惠券
            const coupons = await this.getSharedCoupons();

            if (coupons.length === 0) {
                // 添加用户消息
                this.addUserMessage(`@活动 ${content}`, [], parseContainer);
                parseContainer.innerHTML = '<p>暂无共享优惠券可用</p>';
                return;
            }

            // 匹配关键字
            const matchedCoupons = this.matchKeywords(content, coupons);

            if (matchedCoupons.length === 0) {
                // 添加用户消息
                this.addUserMessage(`@活动 ${content}`, [], parseContainer);
                parseContainer.innerHTML = `<p>未匹配到优惠券关键字<br><span style="color:#999;font-size:12px;">可用关键字: ${coupons.map(c => c.keyword).join('、')}</span></p>`;
                return;
            }

            // 移除解析状态容器
            parseContainer.closest('.system-message')?.remove();

            // 添加用户消息（带匹配到的优惠券标签）
            const couponTags = matchedCoupons.map(c => ({ id: c.id, name: c.name }));
            this.addUserMessage(content, couponTags);

            // 创建进度提示容器
            const total = matchedCoupons.length;
            const progressContainer = this.createSystemMessage();
            progressContainer.innerHTML = `<p>赠送中1/${total}，请勿退出...</p>`;
            this.scrollToBottom();

            // 获取登录凭证
            const credentials = await window.YhquanAPIModule?.getCredentials();
            if (!credentials) {
                progressContainer.innerHTML = '<p>请先登录</p>';
                return;
            }

            // 队列发送：一个一个发送，每个结果单独显示
            for (let i = 0; i < matchedCoupons.length; i++) {
                const coupon = matchedCoupons[i];

                // 更新进度提示
                progressContainer.innerHTML = `<p>赠送中${i + 1}/${total}，请勿退出...</p>`;
                this.scrollToBottom();

                // 创建该优惠券的结果容器，并显示发送中提示
                const resultContainer = this.createSystemMessage();
                resultContainer.innerHTML = `<p>正在发送${this.escapeHtml(coupon.name)}...</p>`;
                this.scrollToBottom();

                try {
                    const result = await this.sendSingleCoupon(coupon, content, credentials);
                    if (result.success) {
                        resultContainer.innerHTML = this.renderSingleResult(coupon.name, result);
                    } else {
                        resultContainer.innerHTML = `<p><b>${this.escapeHtml(coupon.name)}</b><br><span style="color:#ef4444;">✗ ${result.message || '发送失败'}</span></p>`;
                    }
                } catch (error) {
                    resultContainer.innerHTML = `<p><b>${this.escapeHtml(coupon.name)}</b><br><span style="color:#ef4444;">✗ ${error.message}</span></p>`;
                }

                this.scrollToBottom();
            }

            // 更新进度提示为完成状态
            progressContainer.innerHTML = `<p>全部任务处理完毕！</p>`;

        } catch (error) {
            parseContainer.innerHTML = `<p>处理失败: ${error.message}</p>`;
        }

        this.scrollToBottom();
    },

    // 匹配关键字（智能解析多种格式）
    matchKeywords(content, coupons) {
        const matched = [];
        const matchedKeywords = new Set();
        const contentLower = content.toLowerCase();

        // 从用户输入中提取并标准化优惠券描述
        const normalizedDescriptions = this.extractCouponDescriptions(content);

        for (const coupon of coupons) {
            const keyword = coupon.keyword.toLowerCase();
            if (matchedKeywords.has(keyword)) continue;

            // 方式1: 直接包含关键字
            if (contentLower.includes(keyword)) {
                matched.push(coupon);
                matchedKeywords.add(keyword);
                continue;
            }

            // 方式2: 标准化后匹配
            for (const desc of normalizedDescriptions) {
                if (this.isKeywordMatch(desc, keyword)) {
                    matched.push(coupon);
                    matchedKeywords.add(keyword);
                    break;
                }
            }
        }

        return matched;
    },

    // 从用户输入中提取并标准化优惠券描述
    extractCouponDescriptions(content) {
        const descriptions = new Set();
        let match;

        // 格式1: xxxx/xx折 或 xxx/xx折 (直接提取)
        const p1 = /(\d+)\s*\/\s*(\d+)\s*折/g;
        while ((match = p1.exec(content)) !== null) {
            descriptions.add(`${match[1]}/${match[2]}折`);
        }

        // 格式2: xxxx档xx折 或 xxx档xx折
        const p2 = /(\d+)\s*档\s*(\d+)\s*折/g;
        while ((match = p2.exec(content)) !== null) {
            descriptions.add(`${match[1]}/${match[2]}折`);
        }

        // 格式3: xxxx-xx 或 xxx-xx (满减格式)
        const p3 = /(\d{3,4})\s*[-]\s*(\d{2,3})/g;
        while ((match = p3.exec(content)) !== null) {
            descriptions.add(`${match[1]}/${match[2]}折`);
            descriptions.add(`${match[1]}-${match[2]}`);
            descriptions.add(`${match[1]}减${match[2]}`);
        }

        // 格式4: xxxx减xx 或 xxx减xx
        const p4 = /(\d{3,4})\s*减\s*(\d{2,3})/g;
        while ((match = p4.exec(content)) !== null) {
            descriptions.add(`${match[1]}/${match[2]}折`);
            descriptions.add(`${match[1]}-${match[2]}`);
            descriptions.add(`${match[1]}减${match[2]}`);
        }

        // 格式5: xx折（默认2000档）- 单独的折扣（兼容性写法，不使用lookbehind）
        const p5 = /(\d{2})\s*折/g;
        while ((match = p5.exec(content)) !== null) {
            const idx = match.index;
            const prevChar = idx > 0 ? content[idx - 1] : '';
            // 确保前面不是数字或斜杠（避免匹配 3000/98折 中的 98折）
            if (!/[\d\/]/.test(prevChar)) {
                descriptions.add(`2000/${match[1]}折`);
                descriptions.add(`${match[1]}折`);
            }
        }

        // 格式6: xx档（默认2000/xx档）（兼容性写法）
        const p6 = /(\d{2})\s*档/g;
        while ((match = p6.exec(content)) !== null) {
            const idx = match.index;
            const prevChar = idx > 0 ? content[idx - 1] : '';
            if (!/[\d\/]/.test(prevChar)) {
                descriptions.add(`2000/${match[1]}折`);
                descriptions.add(`${match[1]}档`);
            }
        }

        // 格式7: 如果没有匹配到任何格式，尝试提取单独的两位数字（90-99范围，常见折扣）
        if (descriptions.size === 0) {
            const p7 = /\b(9\d)\b/g;
            while ((match = p7.exec(content)) !== null) {
                descriptions.add(`2000/${match[1]}折`);
            }
        }

        return Array.from(descriptions);
    },

    // 检查描述是否匹配关键字
    isKeywordMatch(description, keyword) {
        // 完全匹配
        if (description === keyword) return true;

        // 提取数字进行比较
        const descNums = description.match(/\d+/g) || [];
        const keyNums = keyword.match(/\d+/g) || [];

        // 情况1: 两者都有两个数字（档位和折扣），比较两个数字
        if (descNums.length >= 2 && keyNums.length >= 2) {
            return descNums[0] === keyNums[0] && descNums[1] === keyNums[1];
        }

        // 情况2: keyword只有一个数字（如"99折"），description有两个数字（如"2000/99折"）
        // 比较折扣部分（第二个数字）
        if (keyNums.length === 1 && descNums.length >= 2) {
            return descNums[1] === keyNums[0];
        }

        // 情况3: 两者都只有一个数字，直接比较
        if (keyNums.length === 1 && descNums.length === 1) {
            return descNums[0] === keyNums[0];
        }

        return false;
    },

    // 发送选中的优惠券（队列发送）
    async sendSelectedCoupons(targets) {
        const selectedCoupons = [...this.state.selectedCoupons];
        const couponNames = selectedCoupons.map(c => c.name).join('、');
        const total = selectedCoupons.length;

        // 添加用户消息（带优惠券标签）
        this.addUserMessage(targets, selectedCoupons);

        // 清空选中状态
        this.clearSelectedCoupons();

        // 创建进度提示容器
        const progressContainer = this.createSystemMessage();
        progressContainer.innerHTML = `<p>赠送中1/${total}，请勿退出...</p>`;
        this.scrollToBottom();

        try {
            // 获取登录凭证
            const credentials = await window.YhquanAPIModule?.getCredentials();
            if (!credentials) {
                progressContainer.innerHTML = '<p>❌ 请先登录</p>';
                return;
            }

            // 获取完整的优惠券信息
            const coupons = await this.getSharedCoupons();
            let successCount = 0;
            let failCount = 0;

            // 队列发送：一个一个发送，每个结果单独显示
            for (let i = 0; i < selectedCoupons.length; i++) {
                const selected = selectedCoupons[i];
                const coupon = coupons.find(c => c.id === selected.id);

                // 更新进度提示
                progressContainer.innerHTML = `<p>赠送中${i + 1}/${total}，请勿退出...</p>`;
                this.scrollToBottom();

                // 创建该优惠券的结果容器，并显示发送中提示
                const resultContainer = this.createSystemMessage();
                resultContainer.innerHTML = `<p>正在发送${this.escapeHtml(selected.name)}...</p>`;
                this.scrollToBottom();

                if (!coupon) {
                    failCount++;
                    resultContainer.innerHTML = `<p><b>${this.escapeHtml(selected.name)}</b><br><span style="color:#ef4444;">✗ 优惠券不存在</span></p>`;
                    continue;
                }

                try {
                    const result = await this.sendSingleCoupon(coupon, targets, credentials);
                    if (result.success) {
                        successCount++;
                        resultContainer.innerHTML = this.renderSingleResult(coupon.name, result);
                    } else {
                        failCount++;
                        resultContainer.innerHTML = `<p><b>${this.escapeHtml(coupon.name)}</b><br><span style="color:#ef4444;">✗ ${result.message || '发送失败'}</span></p>`;
                    }
                } catch (error) {
                    failCount++;
                    resultContainer.innerHTML = `<p><b>${this.escapeHtml(coupon.name)}</b><br><span style="color:#ef4444;">✗ ${error.message}</span></p>`;
                }

                this.scrollToBottom();
            }

            // 更新进度提示为完成状态
            progressContainer.innerHTML = `<p>全部任务处理完毕！</p>`;

        } catch (error) {
            progressContainer.innerHTML = `<p>❌ 发送失败: ${error.message}</p>`;
        }

        this.scrollToBottom();
    },

    // 渲染单个优惠券的发送结果
    renderSingleResult(couponName, result) {
        const data = result.data || {};
        const lines = [`<b>${this.escapeHtml(couponName)}</b>`];

        // 成功的
        if (data.success?.length > 0) {
            lines.push(`<span style="color:#22c55e;">✓ 成功：${data.success.join('、')}</span>`);
        }

        // 失败的
        if (data.failed && typeof data.failed === 'object') {
            for (const [reason, items] of Object.entries(data.failed)) {
                if (items?.length > 0) {
                    lines.push(`<span style="color:#ef4444;">✗ ${reason}：${items.join('、')}</span>`);
                }
            }
        }

        // 如果没有详细结果，显示简单成功
        if (lines.length === 1) {
            lines.push(`<span style="color:#22c55e;">✓ 发送成功</span>`);
        }

        return `<p style="font-size:12px;">${lines.join('<br>')}</p>`;
    },

    // 发送优惠券
    async sendCoupons(coupons, originalContent) {
        const results = [];

        // 获取登录凭证
        const credentials = await window.YhquanAPIModule?.getCredentials();
        if (!credentials) {
            throw new Error('请先登录');
        }

        // 逐个发送优惠券
        for (const coupon of coupons) {
            try {
                const result = await this.sendSingleCoupon(coupon, originalContent, credentials);
                results.push({
                    coupon,
                    success: result.success,
                    message: result.message,
                    data: result.data
                });
            } catch (error) {
                results.push({
                    coupon,
                    success: false,
                    message: error.message
                });
            }
        }

        return results;
    },

    // 发送单个优惠券
    async sendSingleCoupon(coupon, content, credentials) {
        // 调用赠送API（与zs模块格式一致）
        const requestBody = {
            action: 'giveAll',
            credentials,
            inputText: content,
            couponTypeId: String(coupon.id),
            amount: 1,
            storeMode: 'batch',
            interval: 2000,
            retryCount: 3
        };

        const response = await fetch(this.config.zsApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();
    },

    // 渲染发送结果
    renderSendResults(results, content) {
        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;

        let statusText = '✅ 全部发送成功';
        if (failCount > 0 && successCount > 0) {
            statusText = `⚠️ 部分成功 (${successCount}/${results.length})`;
        } else if (failCount === results.length) {
            statusText = '❌ 发送失败';
        }

        const detailsHtml = results.map(r =>
            `${r.success ? '✓' : '✗'} ${this.escapeHtml(r.coupon.name)}: ${r.message || (r.success ? '成功' : '失败')}`
        ).join('<br>');

        return `<p><b>${statusText}</b></p><p style="font-size:12px;color:#666;">${detailsHtml}</p>`;
    },

    // 添加用户消息（支持优惠券标签）
    addUserMessage(text, coupons = []) {
        const container = document.getElementById('message-container');
        if (!container) return;

        // 创建用户消息
        const div = document.createElement('div');
        div.className = 'user-message';
        div.textContent = text;
        container.appendChild(div);

        // 如果有优惠券，创建独立的标签容器（在用户消息外部）
        if (coupons.length > 0) {
            const tagsDiv = document.createElement('div');
            tagsDiv.className = 'zhiliao-hd-msg-tags';
            tagsDiv.innerHTML = coupons.map(c => `
                <span class="zhiliao-hd-msg-tag">${this.escapeHtml(c.name)}</span>
            `).join('');
            container.appendChild(tagsDiv);
        }
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
    },

    // HTML转义
    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    // 切换卡片选中状态
    toggleCardSelect(cardElement) {
        const couponId = cardElement.dataset.id;
        const keyword = cardElement.dataset.keyword;
        const name = cardElement.querySelector('.zhiliao-hd-card-name')?.textContent || '';

        const index = this.state.selectedCoupons.findIndex(c => c.id === couponId);

        if (index >= 0) {
            // 已选中，取消选择
            this.state.selectedCoupons.splice(index, 1);
            cardElement.classList.remove('selected');
        } else {
            // 未选中，添加选择
            this.state.selectedCoupons.push({ id: couponId, keyword, name });
            cardElement.classList.add('selected');
        }

        this.updateSelectedTags();
    },

    // 更新选中标签显示
    updateSelectedTags() {
        let tagsContainer = document.getElementById('zhiliao-hd-tags');
        const fileTagsContainer = document.getElementById('file-tags-container');

        if (this.state.selectedCoupons.length === 0) {
            if (tagsContainer) tagsContainer.remove();
            return;
        }

        // 创建或获取标签容器
        if (!tagsContainer) {
            tagsContainer = document.createElement('div');
            tagsContainer.id = 'zhiliao-hd-tags';
            tagsContainer.className = 'zhiliao-hd-tags';
            // 插入到file-tags-container之前
            fileTagsContainer?.parentNode?.insertBefore(tagsContainer, fileTagsContainer);
        }

        tagsContainer.innerHTML = this.state.selectedCoupons.map(coupon => `
            <div class="zhiliao-hd-tag" data-id="${coupon.id}">
                <span>${this.escapeHtml(coupon.name)}</span>
                <span class="zhiliao-hd-tag-remove" onclick="ZhiLiaoHdCommand.removeSelectedCoupon('${coupon.id}')">✕</span>
            </div>
        `).join('');
    },

    // 移除选中的优惠券
    removeSelectedCoupon(couponId) {
        const index = this.state.selectedCoupons.findIndex(c => c.id === couponId);
        if (index >= 0) {
            this.state.selectedCoupons.splice(index, 1);
            // 更新卡片样式
            const card = document.querySelector(`.zhiliao-hd-card[data-id="${couponId}"]`);
            if (card) card.classList.remove('selected');
            this.updateSelectedTags();
        }
    },

    // 清空选中状态
    clearSelectedCoupons() {
        this.state.selectedCoupons = [];
        document.querySelectorAll('.zhiliao-hd-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
        const tagsContainer = document.getElementById('zhiliao-hd-tags');
        if (tagsContainer) tagsContainer.remove();
    }
};

// 导出模块
window.ZhiLiaoHdCommand = ZhiLiaoHdCommand;

// 自动初始化
ZhiLiaoHdCommand.init();
