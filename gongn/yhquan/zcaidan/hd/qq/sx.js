/**
 * 抢券活动 - 时间刷新模块
 * 独立负责刷新行为设置、共享节点字段维护和运行时定时刷新。
 */
const YhquanHdTimeRefreshModule = {
    field: 'time_refresh_behavior',
    autoValue: 'auto',
    manualValue: 'manual',
    intervalMs: 30 * 60 * 1000,
    styleId: 'yhquan-hd-time-refresh-styles',
    modalId: 'yhquan-hd-time-refresh-modal',
    timer: null,
    running: false,

    normalizeBehavior(value) {
        return String(value || '').trim() === this.autoValue ? this.autoValue : this.manualValue;
    },

    getBehaviorFromNode(activityNode) {
        return this.normalizeBehavior(activityNode?.[this.field]);
    },

    getActivityBehavior(shareData, activityId) {
        if (!activityId) return this.manualValue;
        return this.getBehaviorFromNode(shareData?.activities?.[String(activityId)]);
    },

    canConfigure(shareData, activityId) {
        if (!activityId) return false;
        const activity = shareData?.activities?.[String(activityId)];
        return !!(activity && typeof activity === 'object');
    },

    getDialogStyles() {
        return `
.yhquan-hd-time-refresh-mask {
    position: fixed;
    inset: 0;
    z-index: 10030;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
}

.yhquan-hd-time-refresh-box {
    width: min(260px, calc(100vw - 48px));
    background: #fff;
    border-radius: 8px;
    box-sizing: border-box;
    padding: 12px;
}

.yhquan-hd-time-refresh-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.yhquan-hd-time-refresh-title {
    font-size: 13px;
    font-weight: 600;
    color: #111827;
    min-width: 0;
    overflow-wrap: anywhere;
}

.yhquan-hd-time-refresh-close {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 6px;
    background: #f3f4f6;
    color: #6b7280;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.yhquan-hd-time-refresh-close:hover {
    background: #e5e7eb;
    color: #374151;
}

.yhquan-hd-time-refresh-body {
    margin-top: 10px;
    display: grid;
    gap: 8px;
}

.yhquan-hd-time-refresh-prompt {
    font-size: 12px;
    color: #374151;
    line-height: 1.45;
    overflow-wrap: anywhere;
}

.yhquan-hd-time-refresh-select-wrap {
    position: relative;
}

.yhquan-hd-time-refresh-select {
    width: 100%;
    height: 32px;
    padding: 0 28px 0 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #fff;
    color: #111827;
    font-size: 12px;
    outline: none;
    cursor: pointer;
    box-sizing: border-box;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
}

.yhquan-hd-time-refresh-select:hover {
    border-color: #9ca3af;
}

.yhquan-hd-time-refresh-select:focus {
    border-color: #3b82f6;
}

.yhquan-hd-time-refresh-select-icon {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: #6b7280;
    font-size: 10px;
    pointer-events: none;
}

.yhquan-hd-time-refresh-actions {
    margin-top: 12px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}
        `;
    },

    injectStyles() {
        if (document.getElementById(this.styleId)) return;
        const style = document.createElement('style');
        style.id = this.styleId;
        style.textContent = this.getDialogStyles();
        document.head.appendChild(style);
    },

    notify(message, type = 'info', customNotify = null) {
        if (typeof customNotify === 'function') {
            customNotify(message, type);
            return;
        }
        if (window.Tongzhi?.show) {
            window.Tongzhi.show(message, type);
            return;
        }
        alert(message);
    },

    async getDatabase() {
        if (window.FirebaseModule?.init) {
            await window.FirebaseModule.init();
            return window.FirebaseModule.state?.database || null;
        }
        return window.firebase?.database?.() || null;
    },

    async getProviderId() {
        const cached = window.YhquanModule?.state?.providerId;
        if (cached) return cached;

        const loginResult = await window.LoginModule?.requireCredentials?.('scm', { silent: true });
        const creds = loginResult?.ok ? loginResult.credentials : null;
        const providerId = creds?.provider_id || creds?.providerId || null;
        if (providerId && window.YhquanModule?.state) {
            window.YhquanModule.state.providerId = providerId;
        }
        return providerId;
    },

    openDialog(options = {}) {
        const {
            currentBehavior,
            onSaveBehavior,
            onSaved,
            notify
        } = options;

        if (typeof onSaveBehavior !== 'function') {
            this.notify('时间刷新设置保存回调未配置！', 'warning', notify);
            return;
        }

        this.injectStyles();
        document.getElementById(this.modalId)?.remove();

        const behavior = this.normalizeBehavior(currentBehavior);
        const html = `
            <div class="yhquan-hd-time-refresh-mask" id="${this.modalId}">
                <div class="yhquan-hd-time-refresh-box">
                    <div class="yhquan-hd-time-refresh-head">
                        <div class="yhquan-hd-time-refresh-title">&#9200; 刷新设置</div>
                        <button type="button" class="yhquan-hd-time-refresh-close" id="yhquan-hd-time-refresh-close" title="关闭">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div class="yhquan-hd-time-refresh-body">
                        <div class="yhquan-hd-time-refresh-prompt">开启后，系统会定时将抢券活动时间刷新到当前优惠券有效期内。</div>
                        <div class="yhquan-hd-time-refresh-select-wrap">
                            <select class="yhquan-hd-time-refresh-select" id="yhquan-hd-time-refresh-select">
                                <option value="${this.autoValue}"${behavior === this.autoValue ? ' selected' : ''}>自动刷新</option>
                                <option value="${this.manualValue}"${behavior === this.manualValue ? ' selected' : ''}>不自动刷新</option>
                            </select>
                            <i class="fa-solid fa-chevron-down yhquan-hd-time-refresh-select-icon"></i>
                        </div>
                    </div>
                    <div class="yhquan-hd-time-refresh-actions">
                        <button type="button" class="yhquan-hd-btn yhquan-hd-btn-secondary" id="yhquan-hd-time-refresh-cancel">取消</button>
                        <button type="button" class="yhquan-hd-btn yhquan-hd-btn-success" id="yhquan-hd-time-refresh-save">保存</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);

        const modal = document.getElementById(this.modalId);
        const close = () => modal?.remove();
        const saveBtn = document.getElementById('yhquan-hd-time-refresh-save');
        const select = document.getElementById('yhquan-hd-time-refresh-select');

        document.getElementById('yhquan-hd-time-refresh-close')?.addEventListener('click', close);
        document.getElementById('yhquan-hd-time-refresh-cancel')?.addEventListener('click', close);
        modal?.addEventListener('click', (event) => {
            if (event.target === modal) close();
        });

        saveBtn?.addEventListener('click', async () => {
            const nextBehavior = this.normalizeBehavior(select?.value);
            saveBtn.disabled = true;
            saveBtn.classList.add('loading');
            try {
                await onSaveBehavior(nextBehavior);
                close();
                if (typeof onSaved === 'function') await onSaved(nextBehavior);
                this.notify('时间刷新设置已保存！', 'success', notify);
            } catch (error) {
                console.error('保存时间刷新设置失败：', error);
                this.notify(error?.message || '时间刷新设置保存失败。', 'error', notify);
            } finally {
                saveBtn.disabled = false;
                saveBtn.classList.remove('loading');
            }
        });
    },

    start() {
        if (!this.timer) {
            this.timer = window.setInterval(() => this.runOnce('interval'), this.intervalMs);
        }
        this.runOnce('entry');
    },

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    },

    waitForRuntime(retries = 40) {
        return new Promise((resolve) => {
            const tick = () => {
                if (window.EwmYewu?.getActivityDetail && window.EwmYewu?.editActivity && window.LoginModule) {
                    resolve(true);
                    return;
                }
                if (retries <= 0) {
                    resolve(false);
                    return;
                }
                retries -= 1;
                setTimeout(tick, 250);
            };
            tick();
        });
    },

    collectAutoRefreshTasks(providerData) {
        const tasks = [];
        if (!providerData || typeof providerData !== 'object') return tasks;

        Object.entries(providerData).forEach(([couponId, couponNode]) => {
            if (!couponNode || typeof couponNode !== 'object') return;

            const activities = couponNode.activities;
            if (!activities || typeof activities !== 'object') return;

            Object.entries(activities).forEach(([activityId, activityNode]) => {
                if (!activityNode || typeof activityNode !== 'object') return;
                if (this.getBehaviorFromNode(activityNode) !== this.autoValue) return;

                tasks.push({ couponId, couponNode, activityId, activityNode });
            });
        });

        return tasks;
    },

    async refreshOneTask(db, providerId, task) {
        const coupon = {
            id: task.couponId,
            name: task.couponNode?.coupon_name || task.activityNode?.activity_name || '',
            endTime: task.couponNode?.coupon_expire_at || ''
        };

        const detail = await window.EwmYewu.getActivityDetail(task.activityId);
        const activity = {
            id: task.activityId,
            eventName: detail?.eventName || task.activityNode?.activity_name || coupon.name,
            detail
        };
        const range = window.EwmYewu.getGrabRangeByCoupon(coupon);
        const payload = window.EwmYewu.buildEditPayloadForRefresh(activity, coupon, range);

        await window.EwmYewu.editActivity(task.activityId, payload);

        const now = Date.now();
        await db.ref(`yhq_gx/${providerId}/${task.couponId}/activities/${task.activityId}`).update({
            grab_time: {
                begin: `${payload.beginTimeDate} ${payload.beginTimeHms || '00:00:00'}`,
                end: `${payload.endTimeDate} ${payload.endTimeHms || '23:59:59'}`
            },
            activity_name: payload.eventName || activity.eventName || coupon.name,
            total_limit: payload.couponAmount,
            store_limit: payload.couponNum,
            [this.field]: this.autoValue,
            updated_at: now,
            time_refresh_updated_at: now
        });
        await db.ref(`yhq_gx/${providerId}/${task.couponId}`).update({ updated_at: now });

        return { skipped: false, range };
    },

    async runOnce(reason = 'manual') {
        if (this.running) return;
        this.running = true;

        try {
            const ready = await this.waitForRuntime();
            if (!ready) return;

            const providerId = await this.getProviderId();
            const db = await this.getDatabase();
            if (!providerId || !db) return;

            const snapshot = await db.ref(`yhq_gx/${providerId}`).once('value');
            const tasks = this.collectAutoRefreshTasks(snapshot.val() || {});
            if (tasks.length === 0) return;

            const results = [];
            for (const task of tasks) {
                try {
                    const result = await this.refreshOneTask(db, providerId, task);
                    results.push({ couponId: task.couponId, activityId: task.activityId, ...result });
                } catch (error) {
                    console.error('自动刷新抢券时间失败：', {
                        reason,
                        couponId: task.couponId,
                        activityId: task.activityId,
                        error
                    });
                    results.push({
                        couponId: task.couponId,
                        activityId: task.activityId,
                        skipped: true,
                        reason: 'ERROR'
                    });
                }
            }

            console.log('抢券时间自动刷新完成：', { reason, results });
        } catch (error) {
            console.error('抢券时间自动刷新任务失败：', error);
        } finally {
            this.running = false;
        }
    }
};

window.YhquanHdTimeRefreshModule = YhquanHdTimeRefreshModule;
