// 智聊指令 - 活动指令模块
const ZhiLiaoHdCommand = {
    // 配置
    config: {
        zsApiUrl: 'https://1317825751-7vayk0nz7f.ap-guangzhou.tencentscf.com',
        sendInterval: 2500
    },

    // 状态
    state: {
        sharedCoupons: [],
        selectedCoupons: [],
        isLoading: false,
        lastRequestTime: 0
    },

    // 初始化并注册指令
    init() {
        if (!window.ZhiLiaoCaidanModule) {
            console.warn('指令系统未加载，延迟注册活动指令');
            setTimeout(() => this.init(), 500);
            return;
        }

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
        const welcomeScreen = document.getElementById('welcome-screen');
        const messageContainer = document.getElementById('message-container');
        if (welcomeScreen?.style.display !== 'none') {
            welcomeScreen.style.display = 'none';
            messageContainer?.classList.add('active');
        }

        if (this.state.selectedCoupons.length > 0 && extraContent && extraContent.trim() !== '') {
            await this.sendSelectedCoupons(extraContent);
        } else if (!extraContent || extraContent.trim() === '') {
            await this.showSharedCoupons();
        } else {
            await this.parseAndSendCoupons(extraContent);
        }
    },

    // 获取共享优惠券列表
    async getSharedCoupons() {
        try {
            if (!window.FirebaseModule) throw new Error('Firebase模块未加载');
            await window.FirebaseModule.init();

            const db = window.FirebaseModule.state.database;
            if (!db) throw new Error('数据库连接失败');

            const snapshot = await db.ref('yhq_gx').once('value');
            const data = snapshot.val() || {};

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
        this.addUserMessage('@活动');
        const container = this.createSystemMessage();

        try {
            container.innerHTML = '<span style="color:#666;">正在获取...</span>';
            const coupons = await this.getSharedCoupons();

            if (coupons.length === 0) {
                container.innerHTML = '<p>暂无共享优惠券，请先在优惠券模块中开启共享</p>';
                return;
            }

            container.innerHTML = this.renderCouponCards(coupons);
        } catch (error) {
            container.innerHTML = `<p>获取失败: ${error.message}</p>`;
        }

        this.scrollToBottom();
    },

    // 渲染优惠券卡片
    renderCouponCards(coupons) {
        const cardsHtml = coupons.map(coupon => `
            <div class="zhiliao-hd-card" data-id="${coupon.id}" data-keyword="${this.escapeHtml(coupon.keyword)}" onclick="ZhiLiaoHdCommand.toggleCardSelect(this)">
                <div class="zhiliao-hd-card-name">${this.escapeHtml(coupon.name)}</div>
                <div class="zhiliao-hd-card-info">总${coupon.totalLimit}张·限${coupon.storeLimit}张</div>
            </div>
        `).join('');

        return `<p><b>🎁已共享优惠券👇</b></p><div class="zhiliao-hd-cards">${cardsHtml}</div>`;
    },

    // 解析关键字并发送优惠券
    async parseAndSendCoupons(content) {
        const parseContainer = this.createSystemMessage();
        parseContainer.innerHTML = '<p>正在解析关键字...</p>';
        this.scrollToBottom();

        try {
            const coupons = await this.getSharedCoupons();
            if (coupons.length === 0) {
                this.addUserMessage(`@活动 ${content}`, [], parseContainer);
                parseContainer.innerHTML = '<p>暂无共享优惠券可用</p>';
                return;
            }

            // 使用解析模块匹配关键字
            const matchedCoupons = window.ZhiLiaoHdJiexiModule.matchKeywords(content, coupons);

            if (matchedCoupons.length === 0) {
                this.addUserMessage(`@活动 ${content}`, [], parseContainer);
                parseContainer.innerHTML = `<p>未匹配到优惠券关键字<br><span style="color:#999;font-size:12px;">可用关键字: ${coupons.map(c => c.keyword).join('、')}</span></p>`;
                return;
            }

            parseContainer.closest('.system-message')?.remove();
            const couponTags = matchedCoupons.map(c => ({ id: c.id, name: c.name }));
            this.addUserMessage(content, couponTags);

            await this.sendCouponQueue(matchedCoupons, content);
        } catch (error) {
            parseContainer.innerHTML = `<p>处理失败: ${error.message}</p>`;
        }

        this.scrollToBottom();
    },

    // 发送选中的优惠券
    async sendSelectedCoupons(targets) {
        const selectedCoupons = [...this.state.selectedCoupons];
        this.addUserMessage(targets, selectedCoupons);
        this.clearSelectedCoupons();
        await this.sendCouponQueue(selectedCoupons, targets);
    },

    // 发送优惠券队列
    async sendCouponQueue(couponList, content) {
        const total = couponList.length;
        const progressContainer = this.createSystemMessage();
        progressContainer.innerHTML = `<p>赠送中1/${total}，请勿退出...</p>`;
        this.scrollToBottom();

        try {
            const credentials = await window.YhquanAPIModule?.getCredentials();
            if (!credentials) {
                progressContainer.innerHTML = '<p>请先登录</p>';
                return;
            }

            const coupons = await this.getSharedCoupons();

            for (let i = 0; i < couponList.length; i++) {
                const item = couponList[i];
                const coupon = coupons.find(c => c.id === item.id);

                progressContainer.innerHTML = `<p>赠送中${i + 1}/${total}，请勿退出...</p>`;
                this.scrollToBottom();

                const resultContainer = this.createSystemMessage();
                resultContainer.innerHTML = `<p>正在发送${this.escapeHtml(item.name)}...</p>`;
                this.scrollToBottom();

                if (!coupon) {
                    resultContainer.innerHTML = `<p><b>${this.escapeHtml(item.name)}</b><br><span style="color:#ef4444;">✗ 优惠券不存在</span></p>`;
                    continue;
                }

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

            progressContainer.innerHTML = `<p>全部任务处理完毕！</p>`;
        } catch (error) {
            progressContainer.innerHTML = `<p>❌ 发送失败: ${error.message}</p>`;
        }

        this.scrollToBottom();
    },

    // 发送单个优惠券
    async sendSingleCoupon(coupon, content, credentials) {
        const startTime = Date.now();
        console.log(`[发券日志] 开始发送优惠券: ${coupon.name} (ID: ${coupon.id})`);

        const now = Date.now();
        const timeSinceLastRequest = now - this.state.lastRequestTime;

        if (this.state.lastRequestTime > 0 && timeSinceLastRequest < this.config.sendInterval) {
            const waitTime = this.config.sendInterval - timeSinceLastRequest;
            console.log(`[发券日志] 距离上次请求完成 ${timeSinceLastRequest}ms，需要等待 ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            console.log(`[发券日志] 等待完成，开始发送请求`);
        } else {
            console.log(`[发券日志] 距离上次请求完成 ${timeSinceLastRequest}ms，无需等待`);
        }

        const requestStartTime = Date.now();
        const requestBody = {
            action: 'giveAll',
            credentials,
            inputText: content,
            couponTypeId: String(coupon.id),
            amount: 1,
            storeMode: 'batch',
            interval: this.config.sendInterval,
            retryCount: 3
        };

        console.log(`[发券日志] 发送请求到云函数，时间: ${new Date().toLocaleTimeString()}.${Date.now() % 1000}`);

        const response = await fetch(this.config.zsApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const requestEndTime = Date.now();
        const requestDuration = requestEndTime - requestStartTime;
        console.log(`[发券日志] 收到云函数响应，耗时: ${requestDuration}ms`);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        const totalDuration = Date.now() - startTime;
        this.state.lastRequestTime = Date.now();

        console.log(`[发券日志] 优惠券 ${coupon.name} 发送完成`);
        console.log(`[发券日志] - 总耗时: ${totalDuration}ms`);
        console.log(`[发券日志] - 云函数处理: ${requestDuration}ms`);
        console.log(`[发券日志] - 结果: ${result.success ? '成功' : '失败'}`);
        if (result.data) {
            console.log(`[发券日志] - 成功数: ${result.data.success?.length || 0}`);
            console.log(`[发券日志] - 失败数: ${Object.values(result.data.failed || {}).flat().length || 0}`);
        }
        console.log('---');

        return result;
    },

    // 渲染单个优惠券的发送结果
    renderSingleResult(couponName, result) {
        const data = result.data || {};
        const lines = [`<b>${this.escapeHtml(couponName)}</b>`];

        if (data.success?.length > 0) {
            lines.push(`<span style="color:#22c55e;">✓ 成功：${data.success.join('、')}</span>`);
        }

        if (data.failed && typeof data.failed === 'object') {
            for (const [reason, items] of Object.entries(data.failed)) {
                if (items?.length > 0) {
                    lines.push(`<span style="color:#ef4444;">✗ ${reason}：${items.join('、')}</span>`);
                }
            }
        }

        if (lines.length === 1) {
            lines.push(`<span style="color:#22c55e;">✓ 发送成功</span>`);
        }

        return `<p style="font-size:12px;">${lines.join('<br>')}</p>`;
    },

    // 添加用户消息
    addUserMessage(text, coupons = []) {
        const container = document.getElementById('message-container');
        if (!container) return;

        const div = document.createElement('div');
        div.className = 'user-message';
        div.textContent = text;
        container.appendChild(div);

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
            this.state.selectedCoupons.splice(index, 1);
            cardElement.classList.remove('selected');
        } else {
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

        if (!tagsContainer) {
            tagsContainer = document.createElement('div');
            tagsContainer.id = 'zhiliao-hd-tags';
            tagsContainer.className = 'zhiliao-hd-tags';
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
