/**
 * 优惠券模块 - 注册与逻辑
 *
 * 职责：
 * 1. 注册优惠券工具到ToolRegistry
 * 2. 处理查询逻辑和数据处理
 * 3. 调用渲染模块(ys.js)显示结果
 * 4. 自动加载依赖模块(jx.js, ys.js)
 */

// 动态加载脚本
function loadYhquanScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// 加载依赖模块并初始化
async function loadYhquanDependencies() {
    const basePath = 'zhiliao/gongju/jiekou/yhquan/';

    try {
        // 按顺序加载依赖模块
        if (!window.YhquanJxModule) {
            await loadYhquanScript(basePath + 'jx.js');
        }
        if (!window.YhquanYsModule) {
            await loadYhquanScript(basePath + 'ys.js');
        }
        console.log('✅ 优惠券依赖模块加载完成');
    } catch (error) {
        console.error('❌ 优惠券依赖模块加载失败:', error);
    }
}

// 等待依赖模块加载
function initYhquanToolModule() {
    if (!window.ToolRegistry) {
        setTimeout(initYhquanToolModule, 100);
        return;
    }

    // 注册优惠券查询工具
    ToolRegistry.register({
        id: 'query_coupon',
        name: '活动',
        command: '@活动',
        icon: 'fa-solid fa-gift',
        registerType: 'both',
        description: '查看共享优惠券或发送优惠券。无参数时显示可用优惠券列表；有参数时系统自动解析门店和优惠券规格并发券。识别到发券意图时直接调用，将用户原始内容完整传入即可。',
        parameters: {
            type: 'object',
            properties: {
                keyword: {
                    type: 'string',
                    description: '用户的原始发券内容，直接完整传入不要修改或提取，系统会自动解析门店编码和优惠券规格'
                }
            }
        },
        handler: async (params) => {
            return await YhquanToolModule.handleQuery(params);
        }
    });

    console.log('✅ 优惠券工具已注册');
}

// 优惠券工具模块
const YhquanToolModule = {
    // 配置
    config: {
        zsApiUrl: 'https://1317825751-7vayk0nz7f.ap-guangzhou.tencentscf.com',
        sendInterval: 2500
    },

    // 状态
    state: {
        selectedCoupons: [],
        sharedCoupons: [],
        lastRequestTime: 0
    },

    /**
     * 处理查询请求 - 获取共享优惠券或发送优惠券
     * @param {Object|string} params - 参数
     * @param {boolean} params._fromAI - 是否来自AI工具调用
     */
    async handleQuery(params) {
        const keyword = typeof params === 'string' ? params : (params.keyword || '');
        const fromAI = typeof params === 'object' && params._fromAI === true;
        const selectedCoupons = this.state.selectedCoupons;

        // 场景1: 有选中优惠券 + 有输入内容 → 发送选中的优惠券
        if (selectedCoupons.length > 0 && keyword.trim()) {
            return await this.sendSelectedCoupons(keyword, fromAI);
        }

        // 场景2: 无输入内容 → 显示共享优惠券列表
        if (!keyword.trim()) {
            return await this.showSharedCoupons(fromAI);
        }

        // 场景3: 有输入内容但无选中 → 解析关键字并发送
        return await this.parseAndSendCoupons(keyword, fromAI);
    },

    /**
     * 显示共享优惠券列表
     * @param {boolean} fromAI - 是否来自AI工具调用
     */
    async showSharedCoupons(fromAI = false) {
        // AI调用时不显示加载提示
        const loadingDiv = fromAI ? null : this.showLoadingMessage();

        try {
            const coupons = await this.getSharedCoupons();
            if (loadingDiv) loadingDiv.remove();

            if (coupons.length === 0) {
                return { success: true, count: 0, message: '暂无共享优惠券' };
            }

            if (window.YhquanYsModule) {
                YhquanYsModule.renderResults(coupons);
            }

            return {
                success: true,
                count: coupons.length,
                message: `已查询到${coupons.length}个共享优惠券！`
            };
        } catch (error) {
            if (loadingDiv) loadingDiv.remove();
            console.error('获取共享优惠券失败:', error);
            return { success: false, message: error.message || '获取失败' };
        }
    },

    /**
     * 从Firebase获取共享优惠券
     */
    async getSharedCoupons() {
        if (!window.FirebaseModule) {
            throw new Error('Firebase模块未加载');
        }
        await window.FirebaseModule.init();

        const db = window.FirebaseModule.state.database;
        if (!db) {
            throw new Error('数据库连接失败');
        }

        // 获取当前供应商ID（路径隔离）
        const creds = await window.LoginModule?.getScmCredentials();
        const providerId = creds?.provider_id;
        if (!providerId) {
            throw new Error('无法获取供应商ID');
        }

        const snapshot = await db.ref(`yhq_gx/${providerId}`).once('value');
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
                    sentCount: info.yifafangzongshu || 0
                });
            }
        }

        this.state.sharedCoupons = sharedCoupons;
        return sharedCoupons;
    },

    /**
     * 解析关键字并发送优惠券
     * @param {string} content - 用户输入内容
     * @param {boolean} fromAI - 是否来自AI工具调用
     */
    async parseAndSendCoupons(content, fromAI = false) {
        // AI调用时不显示解析提示
        let parseContainer = null;
        if (!fromAI) {
            parseContainer = this.createSystemMessage();
            parseContainer.innerHTML = '<p>正在解析关键字...</p>';
            this.scrollToBottom();
        }

        try {
            const coupons = await this.getSharedCoupons();
            if (coupons.length === 0) {
                // 解析失败，显示用户消息（仅命令触发时）
                if (!fromAI && window.YhquanYsModule) {
                    YhquanYsModule.addUserMessage(`@活动 ${content}`);
                }
                if (parseContainer) {
                    parseContainer.innerHTML = '<p>暂无共享优惠券可用</p>';
                }
                return { success: false, message: '暂无共享优惠券' };
            }

            // 使用解析模块匹配关键字
            if (!window.YhquanJxModule) {
                if (!fromAI && window.YhquanYsModule) {
                    YhquanYsModule.addUserMessage(`@活动 ${content}`);
                }
                if (parseContainer) {
                    parseContainer.innerHTML = '<p>解析模块未加载</p>';
                }
                return { success: false, message: '解析模块未加载' };
            }

            const matchedCoupons = YhquanJxModule.matchKeywords(content, coupons);

            if (matchedCoupons.length === 0) {
                // 未匹配到，显示用户消息（仅命令触发时）
                if (!fromAI && window.YhquanYsModule) {
                    YhquanYsModule.addUserMessage(`@活动 ${content}`);
                }
                if (parseContainer) {
                    parseContainer.innerHTML = `<p>未匹配到优惠券关键字<br><span style="color:#999;font-size:12px;">可用关键字: ${coupons.map(c => c.keyword).join('、')}</span></p>`;
                }
                return { success: false, message: '未匹配到关键字' };
            }

            // 解析成功，移除解析容器，显示用户消息（仅命令触发时）
            if (parseContainer) {
                parseContainer.closest('.system-message')?.remove();
            }
            if (!fromAI && window.YhquanYsModule) {
                const couponTags = matchedCoupons.map(c => ({ id: c.id, name: c.name }));
                YhquanYsModule.addUserMessage(content, couponTags);
            }

            await this.sendCouponQueue(matchedCoupons, content);
            return { success: true };
        } catch (error) {
            if (parseContainer) {
                parseContainer.innerHTML = `<p>处理失败: ${error.message}</p>`;
            }
            return { success: false, message: error.message };
        }
    },

    /**
     * 显示加载提示
     */
    showLoadingMessage() {
        const container = document.getElementById('message-container');
        if (!container) return null;

        const div = document.createElement('div');
        div.className = 'system-message';
        div.innerHTML = `
            <img src="logo/ai.svg" alt="AI" class="system-avatar">
            <div class="system-text text-gray-700">
                <span style="color:#666;">系统查询中......</span>
            </div>
        `;
        container.appendChild(div);
        this.scrollToBottom();
        return div;
    },

    /**
     * 发送选中的优惠券
     * @param {string} targets - 目标内容
     * @param {boolean} fromAI - 是否来自AI工具调用
     */
    async sendSelectedCoupons(targets, fromAI = false) {
        const selectedCoupons = [...this.state.selectedCoupons];

        // 仅命令触发时显示用户消息
        if (!fromAI && window.YhquanYsModule) {
            YhquanYsModule.addUserMessage(targets, selectedCoupons);
            YhquanYsModule.clearSelectedCoupons();
        }
        this.state.selectedCoupons = [];

        await this.sendCouponQueue(selectedCoupons, targets);
        return { success: true, message: '发送完成' };
    },

    /**
     * 发送优惠券队列
     */
    async sendCouponQueue(couponList, content) {
        const total = couponList.length;
        const progressContainer = this.createSystemMessage();
        progressContainer.innerHTML = `<p>赠送中1/${total}，请勿退出...</p>`;
        this.scrollToBottom();

        try {
            // 直接从 LoginModule 获取凭证
            if (!window.LoginModule) {
                progressContainer.innerHTML = '<p>登录模块未加载</p>';
                return;
            }
            const credentials = await window.LoginModule.getScmCredentials();
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

    /**
     * 发送单个优惠券
     */
    async sendSingleCoupon(coupon, content, credentials) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.state.lastRequestTime;

        if (this.state.lastRequestTime > 0 && timeSinceLastRequest < this.config.sendInterval) {
            const waitTime = this.config.sendInterval - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

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

        const response = await fetch(this.config.zsApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();
        this.state.lastRequestTime = Date.now();

        return result;
    },

    /**
     * 渲染单个优惠券发送结果
     */
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
     * HTML转义
     */
    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    /**
     * 获取选中的优惠券
     */
    getSelectedCoupons() {
        return this.state.selectedCoupons;
    },

    /**
     * 设置选中的优惠券
     */
    setSelectedCoupons(coupons) {
        this.state.selectedCoupons = coupons;
    },

    /**
     * 清空选中的优惠券
     */
    clearSelectedCoupons() {
        this.state.selectedCoupons = [];
    }
};

// 导出模块
window.YhquanToolModule = YhquanToolModule;

// 初始化：先加载依赖模块，再注册工具
loadYhquanDependencies().then(() => {
    initYhquanToolModule();
});
