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

        const notification = document.createElement('div');
        notification.className = `tongzhi tongzhi-${type}`;

        const safeTop = window.visualViewport?.offsetTop || 0;
        notification.style.top = `${20 + safeTop}px`;

        notification.innerHTML = `
            <div class="tongzhi-icon">${this.icons[type] || this.icons.info}</div>
            <div class="tongzhi-content">${this.escapeHtml(message).replace(/\n/g, '<br>')}</div>
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

    success(message) { return this.show(message, 'success'); },
    error(message) { return this.show(message, 'error'); },
    warning(message) { return this.show(message, 'warning'); },
    info(message) { return this.show(message, 'info'); }
};

window.Tongzhi = Tongzhi;
