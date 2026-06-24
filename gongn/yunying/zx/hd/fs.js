// Fullscreen control for BI operation dialogs.
const YejiHudongFullscreen = {
    toggle(dialog, button = null) {
        if (!dialog) return;
        dialog.classList.toggle('yeji-modal-fullscreen');
        this.syncButton(dialog, button || dialog.querySelector('[data-modal-fullscreen]'));
    },

    syncButton(dialog, button) {
        if (!dialog || !button) return;
        const fullscreen = dialog.classList.contains('yeji-modal-fullscreen');
        button.title = fullscreen ? '退出全屏' : '全屏';
        button.setAttribute('aria-label', button.title);
        button.innerHTML = `<i class="fa-solid ${fullscreen ? 'fa-compress' : 'fa-expand'}"></i>`;
    }
};

window.YejiHudongFullscreen = YejiHudongFullscreen;
