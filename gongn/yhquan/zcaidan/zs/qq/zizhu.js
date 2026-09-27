/**
 * Coupon self-service gift task monitor.
 * Listens to shared coupons (coupons collection) tasks and reuses the normal gift API.
 */
const ZsZizhuYewu = {
    providerId: null,
    unwatch: null,
    callback: null,
    processing: false,
    latestData: null,
    needsScan: false,
    maxTaskRecords: 10,

    _normalizeId(value) {
        return String(value ?? '').trim().replace(/[.#$/[\]]/g, '_') || 'unknown';
    },

    _couponDocId(providerId, couponId) {
        return `${this._normalizeId(providerId)}::${this._normalizeId(couponId)}`;
    },

    _toSharingMap(docs = []) {
        return docs.reduce((acc, doc) => {
            const couponId = doc.couponId || String(doc._id || '').split('::')[1] || '';
            if (!couponId) return acc;
            const node = { ...doc };
            delete node.provider_id;
            delete node.couponId;
            delete node._id;
            acc[couponId] = node;
            return acc;
        }, {});
    },

    async start() {
        const ready = await this.waitForRuntime();
        if (!ready) return;

        const providerId = await this.getProviderId();
        if (!providerId || !window.SjkModule) return;

        if (this.providerId === providerId && this.unwatch && this.callback) return;
        this.stop();

        this.providerId = providerId;
        this.callback = ({ docs }) => this.handleSnapshot(this._toSharingMap(docs));
        this.unwatch = window.SjkModule.watchWhere('coupons', 'provider_id', providerId, this.callback);
    },

    stop() {
        if (this.unwatch) {
            this.unwatch();
        }
        this.unwatch = null;
        this.callback = null;
        this.processing = false;
        this.latestData = null;
        this.needsScan = false;
    },

    async waitForRuntime(retries = 40) {
        for (let i = 0; i < retries; i++) {
            const hasGiftService = window.YhquanBackgroundRuntime?.callGiveAllAPI || window.ZsYewu?.callGiveAllAPI;
            if (window.SjkModule?.init && window.LoginModule && window.YhquanGongju && hasGiftService) {
                try {
                    await window.SjkModule.init();
                    return true;
                } catch (error) {
                    // 初始化未就绪，继续等待下一轮
                }
            }
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        return false;
    },

    async getProviderId() {
        const loginResult = await window.LoginModule?.requireCredentials?.('scm', { silent: true });
        const credentials = loginResult?.ok ? loginResult.credentials : null;
        return credentials?.provider_id || null;
    },

    handleSnapshot(data) {
        this.latestData = data || {};
        if (this.processing) {
            this.needsScan = true;
            return;
        }
        this.processLatest();
    },

    collectPendingTasks(providerData) {
        const tasks = [];
        if (!providerData || typeof providerData !== 'object') return tasks;

        Object.entries(providerData).forEach(([couponId, couponNode]) => {
            if (!couponNode || typeof couponNode !== 'object') return;
            const taskMap = couponNode.tasks;
            if (!taskMap || typeof taskMap !== 'object') return;

            Object.entries(taskMap).forEach(([taskId, task]) => {
                if (!task || typeof task !== 'object') return;
                if (task.status !== 'pending') return;
                tasks.push({
                    couponId,
                    couponName: couponNode.coupon_name || task.activity_name || '优惠券',
                    taskId,
                    task,
                    createdAt: Number(task.created_at) || 0
                });
            });
        });

        return tasks.sort((a, b) => a.createdAt - b.createdAt);
    },

    async processLatest() {
        if (this.processing) return;
        this.processing = true;

        try {
            do {
                this.needsScan = false;
                const tasks = this.collectPendingTasks(this.latestData);
                for (const item of tasks) {
                    await this.processOne(item);
                }
            } while (this.needsScan);
        } catch (error) {
            console.error('自助赠送任务处理失败：', error);
        } finally {
            this.processing = false;
        }
    },

    // 任务抢占：原子条件更新（json_patch 递归合并 + status='pending' 条件），与原事务语义一致
    async claimTask(providerId, couponId, taskId) {
        const now = Date.now();
        try {
            const res = await window.SjkModule.updateWhere(
                'coupons',
                this._couponDocId(providerId, couponId),
                { tasks: { [taskId]: { status: 'processing', processing_at: now, updated_at: now } } },
                'tasks.' + taskId + '.status',
                'pending'
            );
            return !!(res && res.changed);
        } catch (error) {
            console.warn('[自助领取] 抢占任务失败:', error?.message || error);
            return false;
        }
    },

    async processOne(item) {
        if (!this.providerId || !window.SjkModule) return;
        const claimed = await this.claimTask(this.providerId, item.couponId, item.taskId);
        if (!claimed) return;

        const task = item.task || {};
        const inputText = String(task.input_text || '').trim();
        const parseMode = String(task.parse_mode || 'auto').trim() || 'auto';

        if (!inputText) {
            await this.finishTask(this.providerId, item.couponId, item.taskId, false, null, '赠送目标为空。');
            await this.cleanupOldTasks(item.couponId);
            return;
        }

        const coupon = {
            id: item.couponId,
            name: item.couponName
        };

        try {
            const result = await this.callGiftApi(coupon, inputText, 1, parseMode);
            if (result?.success === false) {
                throw new Error(result.message || '赠送失败。');
            }
            await this.finishTask(this.providerId, item.couponId, item.taskId, true, result, '');
        } catch (error) {
            await this.finishTask(this.providerId, item.couponId, item.taskId, false, null, error?.message || '赠送失败。');
        } finally {
            await this.cleanupOldTasks(item.couponId);
        }
    },

    async callGiftApi(coupon, inputText, amount, parseMode) {
        if (window.YhquanBackgroundRuntime?.callGiveAllAPI) {
            return window.YhquanBackgroundRuntime.callGiveAllAPI(coupon, inputText, amount, parseMode);
        }

        if (window.ZsYewu?.callGiveAllAPI) {
            const giftContext = Object.create(window.ZsYewu);
            giftContext.currentCoupon = coupon;
            return window.ZsYewu.callGiveAllAPI.call(giftContext, inputText, amount, parseMode);
        }

        throw new Error('赠券服务未就绪。');
    },

    async finishTask(providerId, couponId, taskId, success, result, errorMessage) {
        const docId = this._couponDocId(providerId, couponId);
        const doc = await window.SjkModule.get('coupons', docId);
        if (!doc) return;
        const tasks = { ...(doc.tasks || {}) };
        tasks[taskId] = {
            ...(tasks[taskId] || {}),
            status: success ? 'done' : 'failed',
            result: result || null,
            error: errorMessage || '',
            updated_at: Date.now()
        };
        await window.SjkModule.update('coupons', docId, { tasks });
    },

    async cleanupOldTasks(couponId) {
        if (!this.providerId || !couponId || !window.SjkModule) return;
        const docId = this._couponDocId(this.providerId, couponId);
        const doc = await window.SjkModule.get('coupons', docId);
        const taskMap = doc?.tasks;
        if (!taskMap || typeof taskMap !== 'object') return;

        const list = Object.entries(taskMap)
            .map(([id, task]) => ({
                id,
                status: task?.status || '',
                ts: Number(task?.updated_at || task?.created_at) || 0
            }))
            .sort((a, b) => a.ts - b.ts);

        const overflow = list.length - this.maxTaskRecords;
        if (overflow <= 0) return;

        const removable = list.filter(item => item.status === 'done' || item.status === 'failed');
        const tasks = { ...taskMap };
        removable.slice(0, overflow).forEach(item => { delete tasks[item.id]; });
        await window.SjkModule.update('coupons', docId, { tasks });
    }
};

window.ZsZizhuYewu = ZsZizhuYewu;
