/**
 * 优惠券模块 - 注册与业务逻辑
 */

function initYhquanToolModule() {
    if (!window.ToolRegistry) {
        setTimeout(initYhquanToolModule, 100);
        return;
    }

    ToolRegistry.register({
        id: 'query_coupon',
        name: '活动',
        command: '@活动',
        icon: 'fa-solid fa-gift',
        registerType: 'both',
        description: '发送优惠券或查看活动列表。有参数时系统自动解析门店和规格并发券；无参数时显示活动列表。',
        parameters: {
            type: 'object',
            properties: {
                keyword: {
                    type: 'string',
                    description: '用户原始消息全文，直接传入不做任何修改，系统自动解析门店id/门店码/手机号和优惠券规格'
                }
            }
        },
        handler: (params) => YhquanToolModule.handleQuery(params)
    });

    window.ZhiLiaoLog?.debug?.('优惠券工具已注册');
}

const YHQUAN_TEXT = {
    SHARED_TITLE: '🎁已共享优惠券👇',
    sharedCountMessage(count) {
        return `已查询到${count}个共享优惠券！`;
    }
};
window.YHQUAN_TEXT = YHQUAN_TEXT;

const YhquanToolModule = {
    config: {
        zsApiUrl: 'https://1317825751-7vayk0nz7f.ap-guangzhou.tencentscf.com',
        sendInterval: 2500
    },

    state: {
        selectedCoupons: [],
        lastRequestTime: 0
    },

    async handleQuery(params) {
        const queryParams = typeof params === 'string' ? { keyword: params } : (params || {});
        const rawKeyword = queryParams.keyword;
        const keyword = typeof rawKeyword === 'string' ? rawKeyword : rawKeyword == null ? '' : String(rawKeyword);
        const keywordForBranch = keyword.trim();
        const fromAI = queryParams._fromAI === true;
        const selectedCoupons = this.state.selectedCoupons;

        if (selectedCoupons.length > 0 && keywordForBranch) {
            return this.sendSelectedCoupons(keyword, fromAI);
        }

        if (!keywordForBranch) {
            return this.showSharedCoupons(fromAI);
        }

        return this.parseAndSendCoupons(keyword, fromAI);
    },

    async showSharedCoupons(fromAI = false) {
        const loadingDiv = fromAI ? null : this.showLoadingMessage();

        try {
            const coupons = await this.getSharedCoupons();
            if (coupons.length === 0) {
                return { success: true, count: 0, message: '暂无共享优惠券。' };
            }

            if (!fromAI) window.YhquanYsModule?.renderResults?.(coupons);

            return {
                success: true,
                count: coupons.length,
                message: YHQUAN_TEXT.sharedCountMessage(coupons.length)
            };
        } catch (error) {
            console.error('获取共享优惠券失败', error);
            return { success: false, message: error?.message || '获取失败' };
        } finally {
            loadingDiv?.remove?.();
        }
    },

    getTimestamp(value) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) return n;
        const t = Date.parse(String(value || ''));
        return Number.isFinite(t) ? t : 0;
    },

    pickPrimaryActivity(activities) {
        if (!Array.isArray(activities) || activities.length === 0) return null;
        const sorted = [...activities].sort((a, b) => {
            const byUpdated = this.getTimestamp(b?.updated_at) - this.getTimestamp(a?.updated_at);
            if (byUpdated !== 0) return byUpdated;
            const aEnd = this.getTimestamp(a?.grab_time?.end);
            const bEnd = this.getTimestamp(b?.grab_time?.end);
            return bEnd - aEnd;
        });
        return sorted[0] || null;
    },

    buildSharedCouponFromNode(couponId, node) {
        if (!node || typeof node !== 'object') return null;

        const activityNodes = node?.activities && typeof node.activities === 'object'
            ? Object.values(node.activities).filter((item) => item && typeof item === 'object')
            : [];
        if (activityNodes.length === 0) return null;

        const primary = this.pickPrimaryActivity(activityNodes);
        if (!primary) return null;

        const couponName = String(node.coupon_name || primary.activity_name || `优惠券${couponId}`).trim();
        const activityNames = activityNodes
            .map((item) => String(item?.activity_name || '').trim())
            .filter(Boolean);
        const keywords = Array.from(new Set([couponName, ...activityNames].filter(Boolean)));
        const totalLimit = Number(primary.total_limit);
        const storeLimit = Number(primary.store_limit);

        return {
            id: String(couponId),
            keyword: keywords[0] || couponName || String(couponId),
            keywords,
            name: couponName || '未命名',
            storeLimit: Number.isFinite(storeLimit) && storeLimit > 0 ? storeLimit : 10,
            totalLimit: Number.isFinite(totalLimit) && totalLimit > 0 ? totalLimit : 100,
            sentCount: 0,
            activityCount: activityNodes.length
        };
    },

    expandCouponsForKeywordMatch(coupons = []) {
        const expanded = [];
        coupons.forEach((coupon) => {
            const keywordList = Array.isArray(coupon?.keywords) && coupon.keywords.length > 0
                ? coupon.keywords
                : [coupon?.keyword];
            keywordList.forEach((keyword) => {
                const text = String(keyword || '').trim();
                if (!text) return;
                expanded.push({
                    ...coupon,
                    keyword: text
                });
            });
        });
        return expanded.length > 0 ? expanded : coupons;
    },

    collectDisplayKeywords(coupons = [], limit = 30) {
        const all = [];
        coupons.forEach((coupon) => {
            const keywordList = Array.isArray(coupon?.keywords) && coupon.keywords.length > 0
                ? coupon.keywords
                : [coupon?.keyword];
            keywordList.forEach((keyword) => {
                const text = String(keyword || '').trim();
                if (text) all.push(text);
            });
        });
        const uniq = Array.from(new Set(all));
        if (uniq.length <= limit) return uniq;
        return [...uniq.slice(0, limit), `...共${uniq.length}个关键词`];
    },

    async getSharedCoupons() {
        if (!window.FirebaseModule) {
            throw new Error('Firebase 模块未加载');
        }
        await window.FirebaseModule.init();

        const db = window.FirebaseModule.state.database;
        if (!db) {
            throw new Error('数据库连接失败');
        }

        const loginResult = await window.LoginModule?.requireCredentials?.('scm', { silent: true });
        const creds = loginResult?.ok ? loginResult.credentials : null;
        const providerId = creds?.provider_id;
        if (!providerId) {
            throw new Error('无法获取供应商 ID');
        }

        const snapshot = await db.ref(`yhq_gx/${providerId}`).once('value');
        const data = snapshot.val() || {};

        const sharedCoupons = [];
        for (const [couponId, info] of Object.entries(data)) {
            const parsed = this.buildSharedCouponFromNode(couponId, info);
            if (parsed) sharedCoupons.push(parsed);
        }
        return sharedCoupons;
    },

    async parseAndSendCoupons(content, fromAI = false) {
        let parseContainer = null;
        const addActivityUserMessage = () => {
            if (!fromAI) window.YhquanYsModule?.addUserMessage?.(`@活动 ${content}`);
        };
        const setParseMessage = (html) => {
            if (parseContainer) parseContainer.innerHTML = html;
        };

        if (!fromAI) {
            parseContainer = this.createSystemMessage();
            setParseMessage('<p>正在解析关键词...</p>');
            this.scrollToBottom();
        }

        try {
            const coupons = await this.getSharedCoupons();
            if (coupons.length === 0) {
                addActivityUserMessage();
                setParseMessage('<p>暂无共享优惠券。</p>');
                return { success: false, message: '暂无共享优惠券。' };
            }

            if (!window.YhquanJxModule) {
                addActivityUserMessage();
                setParseMessage('<p>解析模块未加载</p>');
                return { success: false, message: '解析模块未加载' };
            }

            const couponsForMatch = this.expandCouponsForKeywordMatch(coupons);
            const matchedCoupons = YhquanJxModule.matchKeywords(content, couponsForMatch);
            if (matchedCoupons.length === 0) {
                const keywordTips = this.collectDisplayKeywords(coupons).join('、') || '暂无关键词';
                addActivityUserMessage();
                setParseMessage(`<p>未匹配到优惠券关键词<br><span style="color:#999;font-size:12px;">可用关键词：${keywordTips}</span></p>`);
                return { success: false, message: '未匹配到关键词' };
            }

            parseContainer?.closest('.system-message')?.remove();

            if (!fromAI) {
                const couponTags = matchedCoupons.map((c) => ({ id: c.id, name: c.name }));
                window.YhquanYsModule?.addUserMessage?.(content, couponTags);
            }

            await this.sendCouponQueue(matchedCoupons, content);
            return { success: true };
        } catch (error) {
            setParseMessage(`<p>处理失败：${this.escapeHtml(error?.message || '未知错误')}</p>`);
            return { success: false, message: error?.message || '处理失败' };
        }
    },

    showLoadingMessage() {
        const container = document.getElementById('message-container');
        if (!container) return null;

        const div = document.createElement('div');
        div.className = 'system-message';
        div.innerHTML = `
            <img src="logo/ai.svg" alt="AI" class="system-avatar">
            <div class="system-text text-gray-700">
                <span style="color:#666;">系统查询中...</span>
            </div>
        `;
        container.appendChild(div);
        this.scrollToBottom();
        return div;
    },

    async sendSelectedCoupons(targets, fromAI = false) {
        const selectedCoupons = [...this.state.selectedCoupons];

        if (!fromAI) {
            window.YhquanYsModule?.addUserMessage?.(targets, selectedCoupons);
            window.YhquanYsModule?.clearSelectedCoupons?.();
        }

        this.state.selectedCoupons = [];
        await this.sendCouponQueue(selectedCoupons, targets);

        return { success: true, message: '发送完成' };
    },

    async sendCouponQueue(couponList, content) {
        const total = couponList.length;
        const progressContainer = this.createSystemMessage();
        if (!progressContainer) return;
        const renderSendError = (container, couponName, message) => {
            container.innerHTML = `<p><b>${this.escapeHtml(couponName)}</b><br><span style="color:#ef4444;">✗ ${this.escapeHtml(message || '发送失败')}</span></p>`;
        };

        progressContainer.innerHTML = `<p>赠送中 1/${total}，请勿退出...</p>`;
        this.scrollToBottom();

        try {
            if (!window.LoginModule) {
                progressContainer.innerHTML = '<p>登录模块未加载</p>';
                return;
            }

            const loginResult = await window.LoginModule.requireCredentials('scm');
            const credentials = loginResult.ok ? loginResult.credentials : null;
            if (!credentials) {
                progressContainer.innerHTML = '<p>请先登录</p>';
                return;
            }

            const coupons = await this.getSharedCoupons();

            for (let i = 0; i < couponList.length; i += 1) {
                const item = couponList[i];
                const coupon = coupons.find((c) => c.id === item.id);

                progressContainer.innerHTML = `<p>赠送中 ${i + 1}/${total}，请勿退出...</p>`;
                this.scrollToBottom();

                const resultContainer = this.createSystemMessage();
                if (!resultContainer) continue;

                resultContainer.innerHTML = `<p>正在发送 ${this.escapeHtml(item.name)}...</p>`;

                if (!coupon) {
                    renderSendError(resultContainer, item.name, '优惠券不存在');
                    continue;
                }

                try {
                    const result = await this.sendSingleCoupon(coupon, content, credentials);
                    if (result?.success) {
                        resultContainer.innerHTML = this.renderSingleResult(coupon.name, result);
                    } else {
                        renderSendError(resultContainer, coupon.name, result?.message || '发送失败');
                    }
                } catch (error) {
                    renderSendError(resultContainer, coupon.name, error?.message || '发送失败');
                }

                this.scrollToBottom();
            }

            progressContainer.innerHTML = '<p>全部任务处理完毕。</p>';
        } catch (error) {
            progressContainer.innerHTML = `<p>发送失败：${this.escapeHtml(error?.message || '未知错误')}</p>`;
        }

        this.scrollToBottom();
    },

    async sendSingleCoupon(coupon, content, credentials) {
        const timeSinceLastRequest = Date.now() - this.state.lastRequestTime;

        if (this.state.lastRequestTime > 0 && timeSinceLastRequest < this.config.sendInterval) {
            const waitTime = this.config.sendInterval - timeSinceLastRequest;
            await new Promise((resolve) => setTimeout(resolve, waitTime));
        }

        const requestBody = {
            action: 'giveAll',
            credentials,
            inputText: content,
            couponTypeId: String(coupon.id),
            amount: 1,
            parseMode: 'auto',
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

    renderSingleResult(couponName, result) {
        const data = result?.data || {};
        const lines = [`<b>${this.escapeHtml(couponName)}</b>`];

        if (Array.isArray(data.success) && data.success.length > 0) {
            lines.push(`<span style="color:#22c55e;">✓ 成功：${data.success.map((x) => this.escapeHtml(x)).join('、')}</span>`);
        }

        if (data.failed && typeof data.failed === 'object') {
            Object.entries(data.failed).forEach(([reason, items]) => {
                if (Array.isArray(items) && items.length > 0) {
                    lines.push(`<span style="color:#ef4444;">✗ ${this.escapeHtml(reason)}：${items.map((x) => this.escapeHtml(x)).join('、')}</span>`);
                }
            });
        }

        if (lines.length === 1) {
            lines.push('<span style="color:#22c55e;">✓ 发送成功</span>');
        }

        return `<p style="font-size:12px;">${lines.join('<br>')}</p>`;
    },

    createSystemMessage() {
        return window.ZhiLiaoModule?.createStreamingMessage?.()?.textContainer || null;
    },

    scrollToBottom() {
        window.ZhiLiaoModule?.scrollToBottom?.();
    },

    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    setSelectedCoupons(coupons) {
        this.state.selectedCoupons = Array.isArray(coupons) ? coupons : [];
    }
};

window.YhquanToolModule = YhquanToolModule;

initYhquanToolModule();


