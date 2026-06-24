/**
 * Coupon self-service gift task monitor.
 * Listens to yhq_gx/{providerId}/{couponId}/tasks and reuses the normal gift API.
 */
const ZsZizhuYewu = {
    providerId: null,
    db: null,
    ref: null,
    callback: null,
    processing: false,
    latestData: null,
    needsScan: false,
    maxTaskRecords: 10,

    async start() {
        const ready = await this.waitForRuntime();
        if (!ready) return;

        const providerId = await this.getProviderId();
        const db = window.FirebaseModule?.state?.database;
        if (!providerId || !db) return;

        if (this.providerId === providerId && this.ref && this.callback) return;
        this.stop();

        this.providerId = providerId;
        this.db = db;
        this.ref = db.ref(`yhq_gx/${providerId}`);
        this.callback = snapshot => this.handleSnapshot(snapshot.val() || {});
        this.ref.on('value', this.callback);
    },

    stop() {
        if (this.ref && this.callback) {
            this.ref.off('value', this.callback);
        }
        this.ref = null;
        this.callback = null;
        this.processing = false;
        this.latestData = null;
        this.needsScan = false;
    },

    async waitForRuntime(retries = 40) {
        for (let i = 0; i < retries; i++) {
            const hasGiftService = window.YhquanBackgroundRuntime?.callGiveAllAPI || window.ZsYewu?.callGiveAllAPI;
            if (window.FirebaseModule?.init && window.LoginModule && window.YhquanGongju && hasGiftService) {
                await window.FirebaseModule.init();
                if (window.FirebaseModule?.state?.database) return true;
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

    async claimTask(taskRef) {
        const now = Date.now();
        const result = await taskRef.transaction(current => {
            if (!current || current.status !== 'pending') return;
            return {
                ...current,
                status: 'processing',
                processing_at: now,
                updated_at: now
            };
        });
        return result && result.committed;
    },

    async processOne(item) {
        if (!this.db || !this.providerId) return;
        const taskRef = this.db.ref(`yhq_gx/${this.providerId}/${item.couponId}/tasks/${item.taskId}`);
        const claimed = await this.claimTask(taskRef);
        if (!claimed) return;

        const task = item.task || {};
        const inputText = String(task.input_text || '').trim();
        const parseMode = String(task.parse_mode || 'auto').trim() || 'auto';

        if (!inputText) {
            await this.finishTask(taskRef, false, null, '赠送目标为空。');
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
            await this.finishTask(taskRef, true, result, '');
        } catch (error) {
            await this.finishTask(taskRef, false, null, error?.message || '赠送失败。');
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

    async finishTask(taskRef, success, result, errorMessage) {
        await taskRef.update({
            status: success ? 'done' : 'failed',
            result: result || null,
            error: errorMessage || '',
            updated_at: Date.now()
        });
    },

    async cleanupOldTasks(couponId) {
        if (!this.db || !this.providerId || !couponId) return;
        const tasksRef = this.db.ref(`yhq_gx/${this.providerId}/${couponId}/tasks`);
        const snapshot = await tasksRef.once('value');
        const taskMap = snapshot.val();
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
        await Promise.all(removable.slice(0, overflow).map(item => tasksRef.child(item.id).remove()));
    }
};

window.ZsZizhuYewu = ZsZizhuYewu;
