/**
 * 通知系统 - 统一接口
 *
 * 使用方式：
 * Tongzhi.success('操作成功！');
 * Tongzhi.error('操作失败！');
 * Tongzhi.warning('请注意！');
 * Tongzhi.info('提示信息');
 */
const Tongzhi = {
    icons: {
        success: '<i class="fa-solid fa-circle-check"></i>',
        error: '<i class="fa-solid fa-circle-xmark"></i>',
        warning: '<i class="fa-solid fa-triangle-exclamation"></i>',
        info: '<i class="fa-solid fa-circle-info"></i>'
    },

    show(message, type = 'info') {
        if (window.TongzhiYangshi?.inject) {
            TongzhiYangshi.inject();
        }
        const displayMessage = this.normalizeMessage(message, type);

        const notification = document.createElement('div');
        notification.className = `tongzhi tongzhi-${type}`;

        const safeTop = window.visualViewport?.offsetTop || 0;
        notification.style.top = `${20 + safeTop}px`;

        notification.innerHTML = `
            <div class="tongzhi-icon">${this.icons[type] || this.icons.info}</div>
            <div class="tongzhi-content">${this.escapeHtml(displayMessage).replace(/\n/g, '<br>')}</div>
            <button class="tongzhi-close"><i class="fa-solid fa-xmark"></i></button>
        `;

        document.body.appendChild(notification);
        this.reorderNotifications(notification);

        const remove = () => this.remove(notification);
        notification.querySelector('.tongzhi-close')?.addEventListener('click', remove);
        setTimeout(() => { if (notification.parentNode) remove(); }, 8000);

        return notification;
    },

    remove(notification) {
        notification.classList.add('tongzhi-hide');
        setTimeout(() => {
            notification.remove();
            this.reorderAll();
        }, 500);
    },

    reorderNotifications(newNotif) {
        requestAnimationFrame(() => {
            const height = newNotif.offsetHeight;
            const safeTop = window.visualViewport?.offsetTop || 0;
            document.querySelectorAll('.tongzhi').forEach(notif => {
                if (notif !== newNotif) {
                    const currentTop = parseInt(notif.style.top) || (20 + safeTop);
                    notif.style.top = `${currentTop + height + 10}px`;
                }
            });
        });
    },

    reorderAll() {
        const safeTop = window.visualViewport?.offsetTop || 0;
        let top = 20 + safeTop;
        document.querySelectorAll('.tongzhi').forEach(notif => {
            notif.style.top = `${top}px`;
            top += notif.offsetHeight + 10;
        });
    },

    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    normalizeMessage(message, type = 'info') {
        const text = String(message ?? '').trim();
        if (!text) return '';
        if (/[。！？.!?…）)】\]》」』”"']$/.test(text)) return text;
        return `${text}。`;
    },

    success(message) { return this.show(message, 'success'); },
    error(message) { return this.show(message, 'error'); },
    warning(message) { return this.show(message, 'warning'); },
    info(message) { return this.show(message, 'info'); },

    /**
     * 确认弹窗
     * @param {string} message - 提示信息
     * @param {object} opts - 可选配置
     * @param {string} opts.confirmText - 确认按钮文字，默认"确认"
     * @param {string} opts.cancelText - 取消按钮文字，默认"取消"
     * @param {string} opts.type - 图标类型，默认"warning"
     * @returns {Promise<boolean>}
     */
    confirm(message, opts = {}) {
        if (window.TongzhiYangshi?.inject) {
            TongzhiYangshi.inject();
        }
        const { confirmText = '确认' } = opts;

        return new Promise(resolve => {
            const mask = document.createElement('div');
            mask.className = 'tongzhi-confirm-mask';
            mask.innerHTML = `<div class="tongzhi-confirm-box">
                <div class="tongzhi-confirm-header">
                    <div class="tongzhi-confirm-header-title">通知</div>
                    <button class="tongzhi-confirm-close"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="tongzhi-confirm-body">${this.escapeHtml(message)}</div>
                <div class="tongzhi-confirm-footer">
                    <button class="tongzhi-confirm-btn ok">${this.escapeHtml(confirmText)}</button>
                </div>
            </div>`;
            document.body.appendChild(mask);

            const close = (result) => {
                mask.querySelector('.tongzhi-confirm-box').classList.add('tongzhi-confirm-out');
                mask.classList.add('tongzhi-confirm-mask-out');
                setTimeout(() => { mask.remove(); resolve(result); }, 200);
            };

            mask.querySelector('.tongzhi-confirm-btn.ok').onclick = () => close(true);
            mask.querySelector('.tongzhi-confirm-close').onclick = () => close(false);
        });
    }
};

window.Tongzhi = Tongzhi;
