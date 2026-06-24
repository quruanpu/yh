/**
 * 优惠券后台运行时
 *
 * 只承载登录后的共享节点维护和远程赠券任务。
 * 不渲染优惠券页面，不接管优惠券 UI 模块。
 */
const YhquanBackgroundRuntime = {
    state: {
        starting: null,
        started: false,
        providerId: '',
        cleanupDone: false,
        giftMonitorOwned: false
    },

    scripts: {
        giftMonitor: [
            'gongn/yhquan/gongju.js',
            'gongn/yhquan/zcaidan/zs/qq/zizhu.js'
        ]
    },

    loadScript(src) {
        if (window.AppFramework?.loadScript) {
            return window.AppFramework.loadScript(src);
        }
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`脚本加载失败：${src}`));
            document.head.appendChild(script);
        });
    },

    async loadScripts(scripts = []) {
        for (let i = 0; i < scripts.length; i += 1) {
            await this.loadScript(scripts[i]);
        }
    },

    waitForLoginModule(timeout = 10000) {
        const startedAt = Date.now();
        return new Promise((resolve) => {
            const check = () => {
                if (window.LoginModule?.requireCredentials) {
                    resolve(window.LoginModule);
                    return;
                }
                if (Date.now() - startedAt >= timeout) {
                    resolve(null);
                    return;
                }
                setTimeout(check, 100);
            };
            check();
        });
    },

    waitForScmAuthenticated(timeout = 300000) {
        if (window.LoginModule?.state?.scmAuthenticated) return Promise.resolve(true);
        return new Promise((resolve) => {
            const onReady = () => {
                clearTimeout(timer);
                resolve(true);
            };
            const timer = setTimeout(() => {
                document.removeEventListener('scmAuthenticated', onReady);
                resolve(false);
            }, timeout);
            document.addEventListener('scmAuthenticated', onReady, { once: true });
        });
    },

    async getScmCredentials() {
        const login = await this.waitForLoginModule();
        if (!login?.requireCredentials) return null;
        const result = await login.requireCredentials('scm', { silent: true, timeout: 10000 });
        return result?.ok ? result.credentials : null;
    },

    async getDatabase() {
        if (!window.FirebaseModule && window.LoginModule?.ensureDependencies) {
            await window.LoginModule.ensureDependencies();
        }
        if (!window.FirebaseModule?.init) return null;
        await window.FirebaseModule.init();
        return window.FirebaseModule.state?.database || null;
    },

    hasSharedActivities(shareInfo) {
        const activities = shareInfo?.activities;
        if (!activities || typeof activities !== 'object') return false;
        return Object.values(activities).some(item => item && typeof item === 'object');
    },

    getSharedActivities(shareInfo) {
        const activities = shareInfo?.activities;
        if (!activities || typeof activities !== 'object') return {};
        const normalized = {};
        Object.entries(activities).forEach(([activityId, activity]) => {
            if (activity && typeof activity === 'object') normalized[activityId] = activity;
        });
        return normalized;
    },

    getTaskEntries(shareInfo) {
        const tasks = shareInfo?.tasks;
        if (!tasks || typeof tasks !== 'object') return [];
        return Object.entries(tasks).filter(([, task]) => task && typeof task === 'object');
    },

    hasProtectedTasks(shareInfo) {
        return this.getTaskEntries(shareInfo).some(([, task]) => {
            const status = String(task.status || '').trim().toLowerCase();
            return !['done', 'failed', 'cancelled', 'canceled'].includes(status);
        });
    },

    buildTaskOnlyNode(info) {
        const node = {
            coupon_name: info?.coupon_name || '',
            updated_at: Date.now(),
            tasks: info?.tasks || {}
        };
        if (info?.coupon_expire_at) node.coupon_expire_at = info.coupon_expire_at;
        return node;
    },

    buildSharedNode(info, activities) {
        const node = this.buildTaskOnlyNode(info);
        node.activities = activities;
        return node;
    },

    parseShareTime(value) {
        const text = String(value || '').trim();
        if (!text) return NaN;
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
            return new Date(text + 'T23:59:59').getTime();
        }

        const normalized = text.includes('T') ? text : text.replace(' ', 'T');
        const timestamp = new Date(normalized).getTime();
        if (!Number.isNaN(timestamp)) return timestamp;

        const datePart = text.split(' ')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            return new Date(datePart + 'T23:59:59').getTime();
        }
        return NaN;
    },

    isShareTimeExpired(value, now = Date.now()) {
        const timestamp = this.parseShareTime(value);
        return !Number.isNaN(timestamp) && timestamp < now;
    },

    async loadSharingData(db, providerId) {
        const snapshot = await db.ref(`yhq_gx/${providerId}`).once('value');
        return snapshot.val() || {};
    },

    async cleanupEmptySharedCoupons(db, providerId, sharingData, onCouponStatusChange) {
        const emptyIds = Object.entries(sharingData || {})
            .filter(([, info]) => !this.hasSharedActivities(info) && !this.hasProtectedTasks(info))
            .map(([couponId]) => couponId);
        if (emptyIds.length === 0) return;

        await Promise.all(emptyIds.map(async (couponId) => {
            await db.ref(`yhq_gx/${providerId}/${couponId}`).remove();
            onCouponStatusChange?.(couponId, false);
        }));
    },

    async cleanupExpiredSnapshots(db, providerId, sharingData, onCouponStatusChange) {
        const expiredItems = Object.entries(sharingData || {})
            .filter(([, info]) => info?.coupon_expire_at && this.isShareTimeExpired(info.coupon_expire_at));
        if (expiredItems.length === 0) return;

        await Promise.all(expiredItems.map(async ([couponId, info]) => {
            const couponRef = db.ref(`yhq_gx/${providerId}/${couponId}`);
            if (this.hasProtectedTasks(info)) {
                await couponRef.set(this.buildTaskOnlyNode(info));
            } else {
                await couponRef.remove();
            }
            onCouponStatusChange?.(couponId, false);
        }));
    },

    async cleanupExpiredActivitySnapshots(db, providerId, sharingData, onCouponStatusChange) {
        await Promise.all(Object.entries(sharingData || {}).map(async ([couponId, info]) => {
            const activities = this.getSharedActivities(info);
            if (Object.keys(activities).length === 0) return;

            const nextActivities = {};
            let changed = false;
            Object.entries(activities).forEach(([activityId, activity]) => {
                const endAt = activity?.grab_time?.end;
                if (endAt && this.isShareTimeExpired(endAt)) {
                    changed = true;
                } else {
                    nextActivities[activityId] = activity;
                }
            });
            if (!changed) return;

            const couponRef = db.ref(`yhq_gx/${providerId}/${couponId}`);
            if (Object.keys(nextActivities).length === 0) {
                if (this.hasProtectedTasks(info)) {
                    await couponRef.set(this.buildTaskOnlyNode(info));
                } else {
                    await couponRef.remove();
                }
                onCouponStatusChange?.(couponId, false);
                return;
            }

            await couponRef.set(this.buildSharedNode(info, nextActivities));
            onCouponStatusChange?.(couponId, true);
        }));
    },

    async cleanupShareIndexIfEmpty(db, providerId) {
        const providerSnap = await db.ref(`yhq_gx/${providerId}`).once('value');
        if (!providerSnap.exists()) {
            await db.ref(`yhq_gx_index/${providerId}`).remove();
        }
    },

    async cleanupSharedData(options = {}) {
        const providerId = String(options.providerId || this.state.providerId || '').trim();
        const db = options.db || await this.getDatabase();
        if (!providerId || !db) return false;

        const onCouponStatusChange = typeof options.onCouponStatusChange === 'function'
            ? options.onCouponStatusChange
            : null;

        await this.cleanupEmptySharedCoupons(db, providerId, await this.loadSharingData(db, providerId), onCouponStatusChange);
        await this.cleanupExpiredSnapshots(db, providerId, await this.loadSharingData(db, providerId), onCouponStatusChange);
        await this.cleanupExpiredActivitySnapshots(db, providerId, await this.loadSharingData(db, providerId), onCouponStatusChange);
        await this.cleanupShareIndexIfEmpty(db, providerId);
        this.state.cleanupDone = true;
        return true;
    },

    async callGiveAllAPI(coupon, inputText, amount, parseMode = 'auto') {
        const credentials = await window.YhquanGongju?.getCredentials?.();
        if (!credentials) throw new Error('未找到登录凭证，请先登录。');

        const couponTypeId = coupon?.id;
        if (!couponTypeId) throw new Error('优惠券 ID 无效。');

        const requestBody = {
            action: 'giveAll',
            credentials,
            inputText,
            couponTypeId: String(couponTypeId),
            amount,
            parseMode,
            storeMode: 'batch',
            interval: 2500,
            retryCount: 3
        };

        const response = await fetch('https://1317825751-7vayk0nz7f.ap-guangzhou.tencentscf.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (response.status === 400) throw new Error('COUPON_LIMIT');
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

        const result = await response.json();
        if (result.success === false && (result.needLogin || result.message?.includes('登录') || result.message?.includes('token'))) {
            throw new Error('LOGIN_EXPIRED');
        }
        return result;
    },

    async startMonitors() {
        await this.loadScripts(this.scripts.giftMonitor);
        await window.ZsZizhuYewu?.start?.();
        this.state.giftMonitorOwned = !!window.ZsZizhuYewu?.callback;
    },

    stopMonitors() {
        if (this.state.giftMonitorOwned && window.ZsZizhuYewu?.stop) {
            window.ZsZizhuYewu.stop();
        }
        this.state.giftMonitorOwned = false;
    },

    ownsGiftMonitor() {
        return !!(this.state.started || this.state.starting || this.state.giftMonitorOwned);
    },

    async start(reason = 'auto') {
        if (this.state.starting) return this.state.starting;
        this.state.starting = (async () => {
            try {
                const authenticated = await this.waitForScmAuthenticated();
                if (!authenticated) return false;

                const credentials = await this.getScmCredentials();
                const providerId = String(credentials?.provider_id || credentials?.providerId || '').trim();
                if (!providerId) return false;

                if (this.state.started && this.state.providerId === providerId) return true;
                if (this.state.started && this.state.providerId !== providerId) {
                    this.stopMonitors();
                    this.state.started = false;
                    this.state.cleanupDone = false;
                }

                this.state.providerId = providerId;
                await this.cleanupSharedData({ providerId });
                await this.startMonitors();
                this.state.started = true;
                console.log('[优惠券后台] 已启动：', reason);
                return true;
            } catch (error) {
                console.warn('[优惠券后台] 启动失败：', error);
                return false;
            } finally {
                this.state.starting = null;
            }
        })();
        return this.state.starting;
    },

    bind() {
        document.addEventListener('scmAuthenticated', () => {
            this.start('scmAuthenticated');
        });

        const run = () => {
            setTimeout(() => this.start('startup'), 0);
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run, { once: true });
        } else {
            run();
        }
    }
};

window.YhquanBackgroundRuntime = YhquanBackgroundRuntime;
YhquanBackgroundRuntime.bind();
