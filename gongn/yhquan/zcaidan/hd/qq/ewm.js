/**
 * 优惠券抢券活动二维码模块
 *
 * 功能：
 * 1. start(coupon)                 - 点击二维码图标，按规则创建或更新抢券活动后生成二维码
 * 2. getActivityDetail(id)         - 根据活动 ID 获取抢券活动详情
 * 3. editActivity(id, params)      - Edit coupon activity
 * 4. openCollectionSharePopup(...) - Open collection QR share popup
 */
const EwmYewu = {
    // ========== 配置 ==========
    config: {
        apiUrl: 'https://1317825751-21j36twzqr.ap-guangzhou.tencentscf.com',
        couponPageBase: 'https://dian.ysbang.cn/#/grabCoupon?id=',
        qrLibUrls: [
            'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
            'https://cdn.bootcdn.net/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
        ],
        d2iLibUrls: [
            'https://cdnjs.cloudflare.com/ajax/libs/dom-to-image/2.6.0/dom-to-image.min.js',
            'https://cdn.bootcdn.net/ajax/libs/dom-to-image/2.6.0/dom-to-image.min.js'
        ]
    },
    styleId: 'yhquan-ewm-styles',

    // ========== 状态 ==========
    state: {
        isRunning: false,
        currentCoupon: null,
        currentUrls: [],  // [{activityId, url, name, couponName, providerName, endTime}]
        providerName: '',
        countdownTimer: null
    },

    // ========== 内置样式（二维码模块独立，不依赖 qq/yangshi.js） ==========
    getStyles() {
        return `
.ewm-overlay {
    position: fixed;
    inset: 0;
    z-index: 10100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(0,0,0,0.45);
}

.ewm-popup {
    width: auto;
    max-width: min(94vw, 1120px);
    max-height: 90vh;
    overflow: auto;
    animation: ewmFadeIn 0.2s ease;
}

.ewm-popup-icon-btn {
    background: none;
    border: none;
    font-size: 12px;
    color: #9ca3af;
    cursor: pointer;
    padding: 3px 5px;
    border-radius: 5px;
    transition: color 0.2s, background 0.2s;
    line-height: 1;
}

.ewm-popup-icon-btn:hover:not(:disabled) {
    color: #374151;
    background: #f3f4f6;
}

.ewm-popup-icon-btn:disabled {
    color: #d1d5db;
    cursor: not-allowed;
}

.ewm-popup-icon-btn.ewm-copy-active {
    color: #10b981;
}

.ewm-qr-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 280px));
    gap: 16px;
    justify-content: center;
    max-width: 100%;
}

.ewm-qr-card {
    width: 280px;
    max-width: 100%;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    overflow: hidden;
    text-align: left;
}

.ewm-qr-top {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid #e8e8e8;
    justify-content: space-between;
    gap: 8px;
}

.ewm-qr-title {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    color: #666;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ewm-qr-title .name {
    font-weight: 600;
    color: #1a1a1a;
}

.ewm-qr-actions {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.ewm-qr-code-area {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    padding: 10px 16px;
    background: #fff;
    position: relative;
}

.ewm-qr-canvas {
    aspect-ratio: 1 / 1;
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 220px;
    margin: 0 auto;
    padding: 10px;
    border: 1px solid #f0f0f0;
    border-radius: 10px;
    background: #fff;
}

.ewm-qr-canvas canvas,
.ewm-qr-canvas img {
    display: block;
    width: 100% !important;
    height: 100% !important;
}

.ewm-qr-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-top: 1px solid #e8e8e8;
    font-size: 12px;
    color: #999;
    gap: 8px;
    min-height: 30px;
}

.ewm-qr-timer {
    flex-shrink: 0;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
}

.ewm-qr-provider {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: right;
}

.ewm-popup-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    text-align: center;
}

.ewm-status-text {
    font-size: 13px;
    color: #6b7280;
    line-height: 1.5;
}

.ewm-status-loading .ewm-status-text {
    color: #3b82f6;
}

.ewm-status-loading .ewm-status-text::before {
    content: '';
    display: block;
    width: 28px;
    height: 28px;
    border: 3px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    margin: 0 auto 10px;
    animation: ewmSpin 0.8s linear infinite;
}

.ewm-status-success .ewm-status-text { color: #10b981; }
.ewm-status-error .ewm-status-text { color: #ef4444; }

.ewm-create-overlay {
    position: fixed;
    inset: 0;
    z-index: 10100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.35);
}

.ewm-create-popup {
    background: #fff;
    border-radius: 14px;
    width: 90vw;
    max-width: 360px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.2);
    animation: ewmFadeIn 0.2s ease;
    position: relative;
    box-sizing: border-box;
    overflow: hidden;
}

.ewm-create-header {
    height: 46px;
    padding: 0 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #e6e8eb;
}

.ewm-create-title {
    font-size: 15px;
    line-height: 1;
    font-weight: 600;
    color: #111827;
}

.ewm-create-close {
    background: none;
    border: none;
    font-size: 18px;
    color: #9aa0aa;
    cursor: pointer;
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s, background 0.2s;
    line-height: 1;
}

.ewm-create-close:hover {
    color: #6b7280;
    background: #f3f4f6;
}

.ewm-create-body {
    padding: 14px 20px 16px;
    font-size: 13px;
    color: #374151;
    line-height: 1.45;
    text-align: left;
}

.ewm-create-footer {
    padding: 8px 14px;
    border-top: 1px solid #e6e8eb;
    display: flex;
    justify-content: flex-end;
}

.ewm-create-btn {
    border: none;
    border-radius: 8px;
    background: #3b82f6;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    height: 30px;
    min-width: 56px;
    padding: 0 10px;
    cursor: pointer;
    transition: background 0.2s, transform 0.2s;
}

.ewm-create-btn:hover {
    background: #2f74ee;
    transform: translateY(-1px);
}

@keyframes ewmFadeIn {
    from { opacity: 0; transform: scale(0.92); }
    to { opacity: 1; transform: scale(1); }
}

@keyframes ewmSpin {
    to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
    .ewm-overlay { padding: 14px; }
    .ewm-popup {
        width: 100%;
        max-width: 280px;
    }

    .ewm-qr-grid {
        grid-template-columns: 1fr;
        gap: 12px;
    }

    .ewm-qr-card {
        width: 100%;
    }

    .ewm-qr-top { padding: 8px 10px; }
    .ewm-qr-title { font-size: 11px; }
    .ewm-qr-code-area { padding: 10px 12px; }
    .ewm-qr-bottom { padding: 8px 10px; font-size: 11px; }

    .ewm-create-popup {
        width: 90vw;
        max-width: 90vw;
    }

    .ewm-create-title { font-size: 14px; }
    .ewm-create-close { font-size: 16px; }
    .ewm-create-body {
        font-size: 12px;
        padding: 12px 16px 14px;
    }
    .ewm-create-footer { padding: 6px 12px; }
    .ewm-create-btn {
        font-size: 12px;
        height: 28px;
        min-width: 52px;
        padding: 0 9px;
    }
}
        `;
    },

    injectStyles() {
        const existed = document.getElementById(this.styleId);
        if (existed && existed.dataset && existed.dataset.owner === 'ewm-yewu') return;
        if (existed) existed.remove();

        const style = document.createElement('style');
        style.id = this.styleId;
        style.dataset.owner = 'ewm-yewu';
        style.textContent = this.getStyles();
        document.head.appendChild(style);
    },

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    loadScript(url) {
        return new Promise((resolve, reject) => {
            const existed = Array.from(document.scripts).find(script => script.src === url);
            const script = existed || document.createElement('script');

            if (existed && (script.dataset.loaded === '1' || script.readyState === 'loaded' || script.readyState === 'complete')) {
                resolve();
                return;
            }

            let settled = false;
            let timer = null;
            const done = (err) => {
                if (settled) return;
                settled = true;
                if (timer) clearTimeout(timer);
                script.removeEventListener('load', onLoad);
                script.removeEventListener('error', onError);
                if (err) reject(err);
                else resolve();
            };
            const onLoad = () => {
                script.dataset.loaded = '1';
                done();
            };
            const onError = () => done(new Error('资源加载失败：' + url));

            script.addEventListener('load', onLoad);
            script.addEventListener('error', onError);
            timer = setTimeout(() => done(new Error('资源加载超时：' + url)), 12000);

            if (!existed) {
                script.src = url;
                script.async = false;
                document.head.appendChild(script);
            }
        });
    },

    async loadFromCandidates(urls, isReady, message) {
        if (isReady()) return;
        let lastError = null;
        for (const url of urls) {
            try {
                await this.loadScript(url);
                if (isReady()) return;
            } catch (err) {
                lastError = err;
            }
        }
        throw lastError || new Error(message || '资源加载失败。');
    },

    // ========== 加载二维码库 ==========
    async loadQrLib() {
        if (window.QRCode) return;
        await this.loadFromCandidates(
            this.config.qrLibUrls,
            () => !!window.QRCode,
            '二维码库加载失败。'
        );
    },

    // ========== 加载截图依赖（dom-to-image） ==========
    async loadD2iLib() {
        if (window.domtoimage) return;
        await this.loadFromCandidates(
            this.config.d2iLibUrls,
            () => !!window.domtoimage,
            '截图库加载失败。'
        );
    },

    // ========== 入口方法 ==========
    async start(coupon) {
        if (this.state.isRunning) {
            this.notify('正在处理中，请稍候。', 'warning');
            return;
        }

        if (!coupon || !coupon.id) {
            this.notify('优惠券信息无效，无法生成二维码。', 'error');
            return;
        }

        if (!window.YhquanGongju?.getCouponStatus(coupon).valid) {
            this.notify('当前优惠券已失效，无法生成二维码。', 'warning');
            return;
        }

        this.state.currentCoupon = coupon;
        this.state.currentUrls = [];
        this.state.providerName = '';
        this.injectStyles();

        this.state.isRunning = true;

        try {
            // 并行加载二维码库和截图依赖。
            const qrLibPromise = this.loadQrLib();
            const d2iLibPromise = this.loadD2iLib();

            // 获取登录凭证。
            const credentials = await this.getCredentials();
            if (!credentials) {
                this.notify('没有有效登录信息，请先登录。', 'error');
                return;
            }
            this.state.providerName = this.getProviderName(credentials);

            // 先拿全部活动和明细，用于无活动判断与过期判断。
            let activities = await this.loadActivitiesWithDetail(coupon, credentials);

            if (activities.length === 0) {
                const shouldCreate = await this.confirmAction('暂无抢券活动，是否创建并生成二维码？');
                if (!shouldCreate) return;

                this.showPopup();
                const createdActivity = await this.createActivityForQr(coupon, credentials);
                activities = [createdActivity];
            }

            const hasExpired = activities.some(item => item.expired);
            const enabledActivitiesBeforeAction = this.getEnabledActivities(activities);
            const hasDisabledOnly = activities.length > 0 && enabledActivitiesBeforeAction.length === 0;

            if (hasExpired && hasDisabledOnly) {
                const shouldHandle = await this.confirmAction('抢券活动已过期且已禁用，是否更新抢券时间、启用并生成二维码？');
                if (!shouldHandle) return;

                this.showPopup();
                await this.refreshAllActivitiesTime(activities, coupon);
                await this.enableActivitiesForQr(activities);
                activities = await this.reloadActivitiesDetail(activities, credentials);
            } else {
                if (hasExpired) {
                    const shouldRefresh = await this.confirmAction('抢券活动已过期，是否更新时间并生成二维码？');
                    if (!shouldRefresh) return;

                    this.showPopup();
                    await this.refreshAllActivitiesTime(activities, coupon);
                    activities = await this.reloadActivitiesDetail(activities, credentials);
                }

                if (hasDisabledOnly) {
                    const shouldEnable = await this.confirmAction('抢券活动已禁用，是否启用并生成二维码？');
                    if (!shouldEnable) return;

                    this.showPopup();
                    await this.enableActivitiesForQr(activities);
                    activities = await this.reloadActivitiesDetail(activities, credentials);
                }
            }

            if (!document.getElementById('ewm-progress')) {
                this.showPopup();
            }

            const enabledActivities = this.getEnabledActivities(activities);

            const qrUrls = enabledActivities
                .map(a => ({
                    activityId: this.getActivityId(a),
                    name: a.eventName || a.activity_name || coupon.name || '未命名活动',
                    couponName: coupon.name || '优惠券',
                    providerName: this.state.providerName || '供应商',
                    endTime: this.getActivityEndTime(a)
                }))
                .filter(a => a.activityId);

            if (qrUrls.length === 0) {
                this.updateStatus('未找到抢券活动。', 'error');
                return;
            }

            // 等待依赖加载完成。
            this.updateStatus('生成二维码中...', 'loading');
            await qrLibPromise;
            await d2iLibPromise;

            // 构建启用状态抢券活动的二维码链接。
            this.state.currentUrls = qrUrls.map(a => ({
                activityId: a.activityId,
                url: this.config.couponPageBase + a.activityId,
                name: a.name,
                couponName: a.couponName,
                providerName: a.providerName,
                endTime: a.endTime
            }));

            // 渲染多张二维码卡片并启用按钮。
            this.renderQrCodes(this.state.currentUrls);

        } catch (err) {
            console.error('二维码生成失败：', err);
            if (document.getElementById('ewm-status')) {
                this.updateStatus('失败：' + err.message, 'error');
            } else {
                this.notify('二维码生成失败：' + (err.message || '未知错误。'), 'error');
            }
        } finally {
            this.state.isRunning = false;
        }
    },

    // ========== API 调用 ==========
    async getCredentials() {
        if (!window.LoginModule) return null;
        const result = await window.LoginModule.requireCredentials('scm');
        return result.ok ? result.credentials : null;
    },
    async requireCredentials() {
        const credentials = await this.getCredentials();
        if (!credentials) throw new Error('没有有效登录信息，请先登录。');
        return credentials;
    },

    getProviderName(credentials) {
        return String(
            window.LoginModule?.session?.providerInfo?.provider_name
            || credentials?.provider_name
            || credentials?.providerName
            || '供应商'
        ).trim() || '供应商';
    },

    combineDateHms(dateValue, hmsValue, defaultHms = '23:59:59') {
        const dateText = String(dateValue || '').trim();
        if (!dateText) return '';

        const hmsText = String(hmsValue || defaultHms).trim() || defaultHms;
        return `${dateText} ${hmsText}`;
    },

    getActivityTimeWindow(activity) {
        const detail = activity?.detail || {};

        const beginDate = detail.beginTimeDate || activity?.beginTimeDate || '';
        const beginHms = detail.beginTimeHms || activity?.beginTimeHms || '00:00:00';
        let beginTime = this.combineDateHms(beginDate, beginHms, '00:00:00');
        if (!beginTime) {
            beginTime = String(detail.beginTime || detail.begin_time || detail.grabBeginTime || '').trim();
        }

        const endDate = detail.endTimeDate || activity?.endTimeDate || '';
        const endHms = detail.endTimeHms || activity?.endTimeHms || '23:59:59';
        let endTime = this.combineDateHms(endDate, endHms, '23:59:59');
        if (!endTime) {
            endTime = String(detail.endTime || detail.end_time || detail.grabEndTime || '').trim();
        }

        return { beginTime, endTime };
    },

    getActivityEndTime(activity) {
        return this.getActivityTimeWindow(activity).endTime;
    },

    applyActivitySchedule(activity, schedule) {
        if (!activity || typeof activity !== 'object') return;
        const beginDate = String(schedule?.beginDate || '').trim();
        const beginHms = String(schedule?.beginHms || '00:00:00').trim() || '00:00:00';
        const endDate = String(schedule?.endDate || '').trim();
        const endHms = String(schedule?.endHms || '23:59:59').trim() || '23:59:59';

        if (!activity.detail || typeof activity.detail !== 'object') {
            activity.detail = {};
        }

        if (beginDate) {
            activity.detail.beginTimeDate = beginDate;
            activity.detail.beginTimeHms = beginHms;
            activity.detail.beginTime = `${beginDate} ${beginHms}`;
        }
        if (endDate) {
            activity.detail.endTimeDate = endDate;
            activity.detail.endTimeHms = endHms;
            activity.detail.endTime = `${endDate} ${endHms}`;
        }
    },

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    async loadActivityDetailById(activityId, credentials, retries = 1) {
        const id = Number(activityId);
        if (!Number.isFinite(id) || id <= 0) {
            throw new Error('活动 ID 无效。');
        }

        let lastError = null;
        const maxRetries = Math.max(0, Number(retries) || 0);

        for (let i = 0; i <= maxRetries; i += 1) {
            try {
                return await this.apiPost(credentials, 'getActivity', { id });
            } catch (err) {
                lastError = err;
                if (i < maxRetries) {
                    await this.wait(200 * (i + 1));
                }
            }
        }

        throw lastError || new Error('获取活动详情失败。');
    },

    async apiPost(credentials, action, params = {}) {
        const response = await fetch(this.config.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify({ credentials, action, ...params })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (!result.success) throw new Error(result.message || '操作失败。');
        return result.data;
    },

    // ========== 独立 API 方法（供外部调用） ==========
    async queryAllByCouponId(couponTypeId) {
        const credentials = await this.requireCredentials();
        return await this.apiPost(credentials, 'queryAllActivities', { couponTypeId });
    },

    async getActivityDetail(activityId) {
        const credentials = await this.requireCredentials();
        return await this.apiPost(credentials, 'getActivity', { id: activityId });
    },

    async editActivity(activityId, params) {
        const credentials = await this.requireCredentials();
        return await this.apiPost(credentials, 'editActivity', {
            id: activityId,
            ...params
        });
    },

    async createNewActivity(params) {
        const credentials = await this.requireCredentials();
        return await this.apiPost(credentials, 'createActivity', params);
    },

    async disableActivity(activityId, storeSubTypes) {
        const credentials = await this.requireCredentials();
        return await this.apiPost(credentials, 'disableActivity', {
            id: activityId,
            isClose: 1,
            storeSubTypes: storeSubTypes || [-1]
        });
    },

    async enableActivity(activityId, storeSubTypes) {
        const credentials = await this.requireCredentials();
        return await this.apiPost(credentials, 'disableActivity', {
            id: activityId,
            isClose: 0,
            storeSubTypes: storeSubTypes || [-1]
        });
    },

    async getAreaTree(parent, activityId, includeAreaIds) {
        const credentials = await this.requireCredentials();
        return await this.apiPost(credentials, 'getAreaTree', {
            parent: parent || '#',
            id: activityId || undefined,
            includeAreaIds: includeAreaIds || []
        });
    },
    async deleteActivity(activityId) {
        const credentials = await this.requireCredentials();
        return await this.apiPost(credentials, 'deleteActivity', {
            id: activityId
        });
    },

    getActivityId(activity) {
        return activity?.id || activity?.activityId;
    },

    getCreateResultActivityId(createResult) {
        const candidates = [
            createResult?.id,
            createResult?.activityId,
            createResult?.data?.id,
            createResult
        ];

        for (const item of candidates) {
            const n = Number(item);
            if (Number.isFinite(n) && n > 0) return n;
            const text = String(item ?? '').trim();
            if (/^\d+$/.test(text)) return Number(text);
        }

        throw new Error('创建成功但未返回活动 ID。');
    },

    formatLocalDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    getGrabRangeByCoupon(coupon) {
        const beginDate = this.formatLocalDate(new Date());
        const end = new Date();
        end.setDate(end.getDate() + 2);
        let endDate = this.formatLocalDate(end);

        const couponEnd = String(coupon?.endTime || '').split(' ')[0];
        if (couponEnd && couponEnd < endDate) endDate = couponEnd;
        if (endDate < beginDate) endDate = beginDate;

        return { beginDate, endDate };
    },

    normalizeStoreSubTypes(raw) {
        if (Array.isArray(raw)) {
            const values = raw
                .map(v => Number(v))
                .filter(v => Number.isInteger(v) && v >= -1);
            return values.length ? Array.from(new Set(values)) : [-1];
        }

        const text = String(raw ?? '').trim();
        if (!text || text === '-1') return [-1];

        if (text.includes(',')) {
            const values = text
                .split(',')
                .map(v => Number(v.trim()))
                .filter(v => Number.isInteger(v) && v >= -1);
            return values.length ? Array.from(new Set(values)) : [-1];
        }

        const values = text
            .split('')
            .map(v => Number(v))
            .filter(v => Number.isInteger(v) && v >= 0);
        return values.length ? Array.from(new Set(values)) : [-1];
    },

    normalizeAreaIds(raw) {
        if (!Array.isArray(raw)) return [];
        const ids = raw
            .map(v => Number(v))
            .filter(v => Number.isInteger(v) && v > 0);
        return Array.from(new Set(ids));
    },

    parseDateTime(value, defaultHms = '23:59:59') {
        const text = String(value || '').trim();
        if (!text) return NaN;

        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
            return new Date(`${text}T${defaultHms}`).getTime();
        }

        const normalized = text.includes('T') ? text : text.replace(' ', 'T');
        const ts = new Date(normalized).getTime();
        return Number.isNaN(ts) ? NaN : ts;
    },

    calcCountdown(endTimeStr) {
        if (!endTimeStr) return '';
        const end = this.parseDateTime(endTimeStr, '23:59:59');
        if (Number.isNaN(end)) return '';

        const diff = end - Date.now();
        if (diff <= 0) return 'ended';

        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if (d > 0) return d + '天 ' + h + '时 ' + m + '分 ' + s + '秒';
        return h + '时 ' + m + '分 ' + s + '秒';
    },

    updateCountdowns(root = document) {
        root.querySelectorAll('.ewm-qr-timer[data-end]').forEach(el => {
            const result = this.calcCountdown(el.dataset.end);
            if (!result) {
                el.innerHTML = '&#9203; --';
                return;
            }

            if (result === 'ended') {
                el.textContent = '已结束';
                return;
            }

            el.innerHTML = '&#9203; ' + this.escapeHtml(result);
        });
    },

    startCountdowns(root = document) {
        this.stopCountdowns();
        this.updateCountdowns(root);
        this.state.countdownTimer = setInterval(() => this.updateCountdowns(), 1000);
    },

    stopCountdowns() {
        if (this.state.countdownTimer) {
            clearInterval(this.state.countdownTimer);
            this.state.countdownTimer = null;
        }
    },

    isActivityExpired(detail, now = Date.now()) {
        if (!detail || typeof detail !== 'object') return false;

        const endDate = String(detail.endTimeDate || '').trim();
        const endHms = String(detail.endTimeHms || '23:59:59').trim() || '23:59:59';
        let endTs = NaN;

        if (endDate) {
            endTs = this.parseDateTime(`${endDate} ${endHms}`, '23:59:59');
        } else {
            endTs = this.parseDateTime(
                detail.endTime || detail.end_time || detail.grabEndTime || '',
                '23:59:59'
            );
        }

        return !Number.isNaN(endTs) && endTs < now;
    },

    isActivityEnabled(activity) {
        if (!activity || typeof activity !== 'object') return false;

        const isClose = activity?.detail?.isClose ?? activity?.isClose;
        return Number(isClose) === 0;
    },

    getEnabledActivities(activities) {
        const list = Array.isArray(activities) ? activities : [];
        return list.filter(item => this.isActivityEnabled(item));
    },

    getActivityStoreSubTypes(activity) {
        const detail = activity?.detail || {};
        return this.normalizeStoreSubTypes(
            detail.storeSubtypes
            ?? detail.storeSubTypes
            ?? activity?.storeSubtypes
            ?? activity?.storeSubTypes
        );
    },

    async enableActivitiesForQr(activities) {
        this.updateStatus('启用抢券活动中...', 'loading');

        await Promise.all((activities || []).map(async (item) => {
            const activityId = this.getActivityId(item);
            if (!activityId) return;

            const storeSubTypes = this.getActivityStoreSubTypes(item);
            await this.enableActivity(activityId, storeSubTypes);

            item.isClose = 0;
            if (item.detail && typeof item.detail === 'object') {
                item.detail.isClose = 0;
            }
        }));
    },

    async reloadActivitiesDetail(activities, credentials) {
        const list = Array.isArray(activities) ? activities : [];
        if (list.length === 0) return [];

        const detailed = await Promise.allSettled(list.map(async (item) => {
            const id = this.getActivityId(item);
            if (!id) return null;
            const detail = await this.loadActivityDetailById(id, credentials, 1);
            return {
                ...item,
                id,
                detail,
                eventName: detail?.eventName || item?.eventName || item?.activity_name || '',
                isClose: Number(detail?.isClose ?? item?.isClose ?? 0),
                expired: this.isActivityExpired(detail)
            };
        }));

        return detailed
            .filter(result => result.status === 'fulfilled' && result.value)
            .map(result => result.value);
    },

    async loadActivitiesWithDetail(coupon, credentials) {
        const rawList = await this.apiPost(credentials, 'queryAllActivities', { couponTypeId: coupon.id });
        const baseList = Array.isArray(rawList) ? rawList : [];

        const normalized = baseList
            .map(item => ({
                ...item,
                id: this.getActivityId(item)
            }))
            .filter(item => item.id);

        if (normalized.length === 0) return [];

        return await this.reloadActivitiesDetail(normalized, credentials);
    },

    buildEditPayloadForRefresh(activity, coupon, range) {
        const detail = activity?.detail || {};
        const storeSubTypes = this.normalizeStoreSubTypes(detail.storeSubtypes ?? detail.storeSubTypes);
        const isLimitArea = Number(detail.isLimitArea) === 1 ? 1 : 0;
        const selectedAreaIds = this.normalizeAreaIds(
            detail.selectedAreaIds ?? detail.includeAreaIds ?? detail.areaIds
        );

        return {
            eventName: detail.eventName || activity.eventName || coupon.name,
            couponTypeId: coupon.id,
            couponNum: Number(detail.couponNum) > 0 ? Number(detail.couponNum) : 5,
            couponAmount: Number(detail.couponAmount) > 0 ? Number(detail.couponAmount) : 10000,
            tagBeginTimeDate: range.beginDate,
            tagBeginTimeHms: '00:00:00',
            beginTimeDate: range.beginDate,
            beginTimeHms: '00:00:00',
            endTimeDate: range.endDate,
            endTimeHms: '23:59:59',
            storeSubTypes,
            isLimitArea,
            selectedAreaIds: isLimitArea ? selectedAreaIds : [],
            deselectedAreaIds: []
        };
    },

    async refreshAllActivitiesTime(activities, coupon) {
        this.updateStatus('更新抢券活动时间中...', 'loading');
        const range = this.getGrabRangeByCoupon(coupon);

        await Promise.all(activities.map(async (item) => {
            const activityId = this.getActivityId(item);
            if (!activityId) return;

            const payload = this.buildEditPayloadForRefresh(item, coupon, range);
            await this.editActivity(activityId, payload);
            this.applyActivitySchedule(item, {
                beginDate: payload.beginTimeDate,
                beginHms: payload.beginTimeHms || '00:00:00',
                endDate: payload.endTimeDate,
                endHms: payload.endTimeHms || '23:59:59'
            });
            item.expired = false;
        }));
    },

    // ========== 创建抢券活动（二维码后台工具，不写共享数据库） ==========
    async createActivityForQr(coupon, credentials = null) {
        this.updateStatus('创建抢券活动中...', 'loading');

        const range = this.getGrabRangeByCoupon(coupon);

        // 创建活动。
        const createResult = await this.createNewActivity({
            eventName: coupon.name,
            couponTypeId: coupon.id,
            couponNum: 5,
            couponAmount: 10000,
            tagBeginTimeDate: range.beginDate,
            tagBeginTimeHms: '00:00:00',
            beginTimeDate: range.beginDate,
            beginTimeHms: '00:00:00',
            endTimeDate: range.endDate,
            endTimeHms: '23:59:59',
            storeSubTypes: [-1],
            isLimitArea: 0,
            selectedAreaIds: [],
            deselectedAreaIds: []
        });

        const id = this.getCreateResultActivityId(createResult);
        const auth = credentials || await this.requireCredentials();
        const detail = await this.loadActivityDetailById(id, auth, 3);

        return {
            id,
            eventName: detail?.eventName || coupon.name,
            detail,
            expired: this.isActivityExpired(detail),
            isClose: Number(detail?.isClose ?? 0)
        };
    },

    // ========== 合集分享弹窗 ==========
    async openCollectionSharePopup(options = {}) {
        const shareUrl = String(options.url || '').trim();
        if (!shareUrl) {
            this.notify('合集分享地址未配置。', 'error');
            return;
        }

        if (this.state.isRunning) {
            this.notify('正在处理中，请稍候。', 'warning');
            return;
        }

        this.injectStyles();

        await this.loadQrLib();
        await this.loadD2iLib();

        const providerName = await this.getShareProviderName();
        const shareTitle = `${providerName}券集`;
        this.state.providerName = providerName;
        this.state.currentUrls = [{
            activityId: 'collection',
            url: shareUrl,
            name: shareTitle,
            couponName: '优惠券集合',
            providerName,
            endTime: '',
            isCollection: true
        }];

        this.showCollectionPopup();
        this.renderQrCodes(this.state.currentUrls, {
            gridId: 'ewm-share-qr-grid',
            popupId: 'ewm-share-popup',
            overlayId: 'ewm-share-progress',
            mode: 'collection'
        });
    },

    async getShareProviderName() {
        const fromSession = String(window.LoginModule?.session?.providerInfo?.provider_name || '').trim();
        if (fromSession) return fromSession;

        try {
            const credentials = await this.getCredentials();
            return this.getProviderName(credentials);
        } catch {}

        return '供应商';
    },

    showCollectionPopup() {
        document.getElementById('ewm-progress')?.remove();
        document.getElementById('ewm-share-progress')?.remove();
        this.stopCountdowns();

        const html = `
            <div class="ewm-overlay" id="ewm-share-progress">
                <div class="ewm-popup" id="ewm-share-popup">
                    <div class="ewm-qr-grid" id="ewm-share-qr-grid"></div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
    },

    // ========== UI：二维码弹窗 ==========
    showPopup() {
        const old = document.getElementById('ewm-progress');
        if (old) old.remove();
        this.stopCountdowns();

        const html = `
            <div class="ewm-overlay" id="ewm-progress">
                <div class="ewm-popup" id="ewm-popup">
                    <div class="ewm-qr-grid" id="ewm-qr-grid">
                        <div class="ewm-qr-card">
                            <div class="ewm-qr-top">
                                <div class="ewm-qr-title">&#129511; <span class="name">二维码</span></div>
                                <div class="ewm-qr-actions">
                                    <button type="button" class="ewm-popup-icon-btn ewm-copy-btn" disabled title="复制链接">
                                        <i class="fa-solid fa-link"></i>
                                    </button>
                                    <button type="button" class="ewm-popup-icon-btn ewm-copy-btn" disabled title="复制图片">
                                        <i class="fa-regular fa-image"></i>
                                    </button>
                                    <button type="button" class="ewm-popup-icon-btn" disabled title="访问链接">
                                        <i class="fa-solid fa-up-right-from-square"></i>
                                    </button>
                                    <button type="button" class="ewm-popup-icon-btn ewm-close-btn" id="ewm-close" title="关闭">
                                        <i class="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="ewm-qr-code-area">
                                <div class="ewm-qr-canvas">
                                    <div class="ewm-popup-status ewm-status-loading" id="ewm-status">
                                        <span class="ewm-status-text">准备中...</span>
                                    </div>
                                </div>
                            </div>
                            <div class="ewm-qr-bottom">
                                <span class="ewm-qr-timer">&#9203; --</span>
                                <span class="ewm-qr-provider">供应商</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', html);

        // 关闭按钮运行中不可关闭。
        document.getElementById('ewm-close').onclick = () => {
            if (!this.state.isRunning) {
                this.stopCountdowns();
                document.getElementById('ewm-progress')?.remove();
            }
        };
    },

    updateStatus(text, type = 'loading') {
        const statusEl = document.getElementById('ewm-status');
        if (!statusEl) return;
        statusEl.className = `ewm-popup-status ewm-status-${type}`;
        const textEl = statusEl.querySelector('.ewm-status-text');
        if (textEl) textEl.textContent = text;
    },

    confirmAction(message) {
        return new Promise((resolve) => {
            this.injectStyles();
            document.getElementById('ewm-create-confirm-progress')?.remove();

            const safeMessage = String(message || '').trim() || '是否继续当前操作？';
            const html = `
                <div class="ewm-create-overlay" id="ewm-create-confirm-progress">
                    <div class="ewm-create-popup" id="ewm-create-popup">
                        <div class="ewm-create-header">
                            <div class="ewm-create-title">通知</div>
                            <button type="button" class="ewm-create-close" id="ewm-create-close" title="关闭">
                                &times;
                            </button>
                        </div>
                        <div class="ewm-create-body">${this.escapeHtml(safeMessage)}</div>
                        <div class="ewm-create-footer">
                            <button type="button" class="ewm-create-btn" id="ewm-confirm-create">确认</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);

            let finished = false;
            const finish = (confirmed) => {
                if (finished) return;
                finished = true;

                document.getElementById('ewm-create-confirm-progress')?.remove();
                resolve(confirmed);
            };

            document.getElementById('ewm-confirm-create')?.addEventListener('click', () => finish(true), { once: true });
            document.getElementById('ewm-create-close')?.addEventListener('click', () => finish(false), { once: true });
        });
    },

    renderQrCodes(urlList, options = {}) {
        const grid = document.getElementById(options.gridId || 'ewm-qr-grid');
        if (!grid) return;

        const list = Array.isArray(urlList) ? urlList : [];

        grid.innerHTML = list.map((item, i) => this.buildQrCardHtml(item, i, options)).join('');

        const itemWidth = 280;
        const gap = 16;
        const maxCols = Math.min(Math.max(list.length, 1), 4);
        const gridWidth = maxCols * itemWidth + (maxCols - 1) * gap;
        grid.style.width = gridWidth + 'px';

        list.forEach((item, i) => {
            this.buildQRCode(document.getElementById(this.getQrId(i, options)), item.url);
        });

        this.bindQrCardActions(grid);
        if (options.mode === 'collection') {
            this.stopCountdowns();
        } else {
            this.startCountdowns(grid);
        }
    },

    getQrId(index, options = {}) {
        return (options.idPrefix || 'ewm-qr') + '-' + index;
    },

    getCardId(index, options = {}) {
        return (options.cardPrefix || 'ewm-qr-card') + '-' + index;
    },

    getWeekdayText() {
        const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        return days[new Date().getDay()] || '星期';
    },

    buildQrCardHtml(item, index, options = {}) {
        const qrId = this.getQrId(index, options);
        const cardId = this.getCardId(index, options);
        const couponName = String(item.couponName || this.state.currentCoupon?.name || '').trim() || '优惠券';
        const activityName = String(item.name || item.activityName || '').trim();
        const displayName = activityName || couponName || '优惠券';
        const providerName = item.providerName || this.state.providerName || '供应商';
        const titleInfo = '&#129511; <span class="name">' + this.escapeHtml(displayName) + '</span>';
        const isCollection = options.mode === 'collection' || item.isCollection === true;
        const footerRightText = isCollection ? this.getWeekdayText() : providerName;
        const footerLeftHtml = isCollection
            ? '<span class="ewm-qr-timer">&#127881; 药师帮 App 扫码领取 &#127881;</span>'
            : '<span class="ewm-qr-timer" data-end="' + this.escapeHtml(item.endTime || '') + '"></span>';
        const overlayId = options.overlayId || 'ewm-progress';
        const popupId = options.popupId || 'ewm-popup';

        return `
            <div class="ewm-qr-card"
                 id="${cardId}"
                 data-url="${this.escapeHtml(item.url)}"
                 data-title="${this.escapeHtml(displayName || '优惠券二维码')}"
                 data-overlay-id="${this.escapeHtml(overlayId)}"
                 data-popup-id="${this.escapeHtml(popupId)}"
                 data-open-target="${isCollection ? 'self' : 'blank'}">
                <div class="ewm-qr-top">
                    <div class="ewm-qr-title">${titleInfo}</div>
                    <div class="ewm-qr-actions">
                        <button type="button" class="ewm-popup-icon-btn ewm-copy-btn ewm-card-action" data-action="copy-link" title="复制链接">
                            <i class="fa-solid fa-link"></i>
                        </button>
                        <button type="button" class="ewm-popup-icon-btn ewm-copy-btn ewm-card-action" data-action="copy-image" title="复制图片">
                            <i class="fa-regular fa-image"></i>
                        </button>
                        <button type="button" class="ewm-popup-icon-btn ewm-card-action" data-action="open-link" title="访问链接">
                            <i class="fa-solid fa-up-right-from-square"></i>
                        </button>
                        <button type="button" class="ewm-popup-icon-btn ewm-close-btn ewm-card-action" data-action="close-overlay" title="关闭">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
                <div class="ewm-qr-code-area">
                    <div class="ewm-qr-canvas" id="${qrId}"></div>
                </div>
                <div class="ewm-qr-bottom">
                    ${footerLeftHtml}
                    <span class="ewm-qr-provider">${this.escapeHtml(footerRightText)}</span>
                </div>
            </div>
        `;
    },

    buildQRCode(container, url) {
        if (!container || !url) return;
        container.innerHTML = '';
        new QRCode(container, {
            text: url,
            width: 210,
            height: 210,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    },

    bindQrCardActions(grid) {
        if (!grid || grid.dataset.ewmCardBound === '1') return;
        grid.dataset.ewmCardBound = '1';
        grid.addEventListener('click', async (event) => {
            const btn = event.target.closest('.ewm-card-action');
            if (!btn) return;

            event.preventDefault();
            event.stopPropagation();

            const card = btn.closest('.ewm-qr-card');
            if (!card || btn.disabled) return;

            const action = btn.dataset.action;
            const url = card.dataset.url || '';
            const overlayId = card.dataset.overlayId || 'ewm-progress';

            if (action === 'close-overlay') {
                if (this.state.isRunning && overlayId === 'ewm-progress') return;
                this.stopCountdowns();
                document.getElementById(overlayId)?.remove();
                return;
            }

            if (action === 'open-link') {
                if (!url) return;
                if (card.dataset.openTarget === 'self' && !event.ctrlKey && !event.metaKey) {
                    window.location.href = url;
                    return;
                }
                window.open(url, '_blank', 'noopener,noreferrer');
                return;
            }

            btn.disabled = true;
            btn.classList.add('ewm-copy-active');
            try {
                if (action === 'copy-link') {
                    await this.copyText(url);
                    this.notify('已复制链接。', 'success');
                } else if (action === 'copy-image') {
                    await this.copyOrDownloadImage(
                        card.id,
                        ['.ewm-qr-actions'],
                        this.sanitizeFileName(card.dataset.title || '优惠券二维码') + '.png'
                    );
                }
            } catch (err) {
                console.error('卡片操作失败：', err);
                this.notify((action === 'copy-link' ? '复制链接失败：' : '复制图片失败：') + (err?.message || '未知错误。'), 'error');
            }

            setTimeout(() => {
                btn.disabled = false;
                btn.classList.remove('ewm-copy-active');
            }, 1000);
        });
    },

    sanitizeFileName(name) {
        return String(name || '优惠券二维码')
            .replace(/[\\/:*?"<>|]+/g, '_')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80) || '优惠券二维码';
    },

    async copyText(text) {
        const value = String(text || '').trim();
        if (!value) throw new Error('没有可复制的链接。');
        try {
            if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
                throw new Error('clipboard unavailable');
            }
            await navigator.clipboard.writeText(value);
        } catch (err) {
            const ta = document.createElement('textarea');
            ta.value = value;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            const ok = document.execCommand('copy');
            ta.remove();
            if (!ok) throw err;
        }
    },

    async copyOrDownloadImage(
        popupId = 'ewm-popup',
        hideSelectors = ['.ewm-qr-actions'],
        filename = '优惠券二维码.png'
    ) {
        if (!window.domtoimage) {
            this.notify('截图库未加载。', 'error');
            return;
        }

        const popup = document.getElementById(popupId);
        if (!popup) return;

        let wrapper = null;
        let clone = null;
        try {
            // 克隆弹窗。
            clone = popup.cloneNode(true);

            // cloneNode 不保留 canvas 绘制内容，手动复制。
            const origCanvases = popup.querySelectorAll('canvas');
            const cloneCanvases = clone.querySelectorAll('canvas');
            origCanvases.forEach((orig, i) => {
                if (cloneCanvases[i]) {
                    cloneCanvases[i].width = orig.width;
                    cloneCanvases[i].height = orig.height;
                    const ctx = cloneCanvases[i].getContext('2d');
                    ctx.drawImage(orig, 0, 0);
                }
            });

            // wrapper 用 opacity 隐藏，保留真实尺寸，确保 clone 布局正确。
            wrapper = document.createElement('div');
            wrapper.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none;z-index:-1;';
            clone.style.width = popup.offsetWidth + 'px';
            clone.style.minWidth = popup.offsetWidth + 'px';
            clone.style.maxWidth = 'none';
            clone.style.maxHeight = 'none';
            clone.style.overflow = 'visible';
            const selectors = Array.isArray(hideSelectors) ? hideSelectors : [];
            selectors.forEach((selector) => {
                clone.querySelectorAll(selector).forEach((el) => {
                    el.style.display = 'none';
                });
            });

            wrapper.appendChild(clone);
            document.body.appendChild(wrapper);

            const scale = 2;
            const blob = await domtoimage.toBlob(clone, {
                bgcolor: '#ffffff',
                width: clone.offsetWidth * scale,
                height: clone.offsetHeight * scale,
                style: {
                    transform: 'scale(' + scale + ')',
                    transformOrigin: 'top left',
                    opacity: '1'
                }
            });

            if (!blob) {
                this.notify('图片生成失败。', 'error');
                return;
            }

            if (window.innerWidth <= 768 || !navigator.clipboard || !window.ClipboardItem || typeof navigator.clipboard.write !== 'function') {
                this.downloadBlobFallback(blob, filename);
                return;
            }

            try {
                await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
                this.notify('已复制图片。', 'success');
            } catch {
                this.downloadBlobFallback(blob, filename);
            }
        } catch (err) {
            console.error('截图失败：', err);
            this.notify('截图失败：' + (err.message || '未知错误。'), 'error');
        } finally {
            if (wrapper) wrapper.remove();
        }
    },

    downloadBlobFallback(blob, filename = '优惠券二维码.png') {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = String(filename || '优惠券二维码.png');
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        this.notify('图片已保存。', 'success');
    },

    // ========== 通知 ==========
    notify(message, type = 'info') {
        if (window.Tongzhi) {
            Tongzhi.show(message, type);
        } else {
            alert(message);
        }
    }
};

window.EwmYewu = EwmYewu;
