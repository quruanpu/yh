/**
 * 图片预览模块 - 业务逻辑
 * 支持：放大缩小（滚轮/双指捏合）、拖拽移动
 */
const YulanModule = {
    state: {
        scale: 1,
        translateX: 0,
        translateY: 0,
        isDragging: false,
        startX: 0,
        startY: 0,
        lastTouchDist: 0
    },

    config: {
        minScale: 0.5,
        maxScale: 5,
        scaleStep: 0.15
    },

    overlay: null,
    image: null,
    globalPreviewBound: false,

    init() {
        if (this.overlay) {
            this.bindGlobalPreview();
            return;
        }

        if (window.YulanYangshi) {
            YulanYangshi.inject();
        }

        this.createOverlay();
        this.bindEvents();
        this.bindGlobalPreview();
        window.ZhiLiaoLog?.debug?.('图片预览模块已初始化');
    },

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'yulan-overlay';
        this.overlay.innerHTML = `
            <button class="yulan-close"><i class="fa-solid fa-xmark"></i></button>
            <img class="yulan-image" src="" alt="预览">
            <div class="yulan-hint">滚轮缩放 · 拖拽移动 · 关闭按钮或 Esc 关闭</div>
        `;

        document.body.appendChild(this.overlay);
        this.image = this.overlay.querySelector('.yulan-image');
    },

    bindEvents() {
        const overlay = this.overlay;
        const closeBtn = overlay.querySelector('.yulan-close');

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hide();
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) e.stopPropagation();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('active')) {
                this.hide();
            }
        });

        overlay.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

        overlay.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', () => this.handleMouseUp());

        overlay.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        overlay.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        overlay.addEventListener('touchend', () => this.handleTouchEnd());
    },

    shouldPreviewImage(img) {
        if (!img || img.tagName !== 'IMG') return false;
        if (img.classList.contains('system-avatar')) return false;
        if (img.classList.contains('yulan-image')) return false;
        if (img.closest('.yulan-overlay')) return false;
        if (img.closest('button, .sidebar, header, nav, .sidebar-menu, .sidebar-footer')) return false;
        if (img.closest('.message-actions, .footer-btn, .chat-tray-remove')) return false;

        const src = String(img.currentSrc || img.src || '').trim();
        if (!src) return false;

        const explicit = img.dataset.preview === 'image' ||
            img.classList.contains('yulan-clickable') ||
            img.closest('[data-preview="image"]');
        if (explicit) return true;

        return !!img.closest([
            '.user-message',
            '.system-text',
            '.message-file',
            '.chart-result',
            '.media-task-card',
            '.chat-tray-image',
            '.chaxun-detail-image-item'
        ].join(','));
    },

    bindGlobalPreview() {
        if (this.globalPreviewBound) return;
        this.globalPreviewBound = true;

        document.addEventListener('click', (event) => {
            const img = event.target?.closest?.('img');
            if (!this.shouldPreviewImage(img)) return;

            event.preventDefault();
            event.stopPropagation();
            this.show(img.currentSrc || img.src);
        }, true);
    },

    show(url) {
        if (!this.overlay) this.init();

        this.resetState();
        this.image.src = url;
        this.overlay.classList.add('active');
        this.overlay.classList.remove('interacted');
        document.body.style.overflow = 'hidden';
    },

    hide() {
        if (!this.overlay) return;
        this.overlay.classList.remove('active');
        document.body.style.overflow = '';
    },

    resetState() {
        this.state.scale = 1;
        this.state.translateX = 0;
        this.state.translateY = 0;
        this.updateTransform();
    },

    updateTransform() {
        const { scale, translateX, translateY } = this.state;
        this.image.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    },

    markInteracted() {
        this.overlay.classList.add('interacted');
    },

    handleWheel(e) {
        e.preventDefault();
        this.markInteracted();

        const delta = e.deltaY > 0 ? -this.config.scaleStep : this.config.scaleStep;
        this.zoom(delta, e.clientX, e.clientY);
    },

    zoom(delta, centerX, centerY) {
        const oldScale = this.state.scale;
        let newScale = oldScale + delta;
        newScale = Math.max(this.config.minScale, Math.min(this.config.maxScale, newScale));

        if (newScale === oldScale) return;

        const rect = this.image.getBoundingClientRect();
        const imgCenterX = rect.left + rect.width / 2;
        const imgCenterY = rect.top + rect.height / 2;
        const ratio = newScale / oldScale;

        this.state.translateX = centerX - (centerX - imgCenterX) * ratio - imgCenterX + this.state.translateX;
        this.state.translateY = centerY - (centerY - imgCenterY) * ratio - imgCenterY + this.state.translateY;
        this.state.scale = newScale;
        this.updateTransform();
    },

    handleMouseDown(e) {
        if (e.target === this.overlay.querySelector('.yulan-close')) return;

        this.state.isDragging = true;
        this.state.startX = e.clientX - this.state.translateX;
        this.state.startY = e.clientY - this.state.translateY;
        this.overlay.classList.add('dragging');
        this.markInteracted();
    },

    handleMouseMove(e) {
        if (!this.state.isDragging) return;

        this.state.translateX = e.clientX - this.state.startX;
        this.state.translateY = e.clientY - this.state.startY;
        this.updateTransform();
    },

    handleMouseUp() {
        this.state.isDragging = false;
        this.overlay.classList.remove('dragging');
    },

    handleTouchStart(e) {
        this.markInteracted();

        if (e.touches.length === 1) {
            this.state.isDragging = true;
            this.state.startX = e.touches[0].clientX - this.state.translateX;
            this.state.startY = e.touches[0].clientY - this.state.translateY;
        } else if (e.touches.length === 2) {
            this.state.isDragging = false;
            this.state.lastTouchDist = this.getTouchDistance(e.touches);
        }
    },

    handleTouchMove(e) {
        e.preventDefault();

        if (e.touches.length === 1 && this.state.isDragging) {
            this.state.translateX = e.touches[0].clientX - this.state.startX;
            this.state.translateY = e.touches[0].clientY - this.state.startY;
            this.updateTransform();
        } else if (e.touches.length === 2) {
            const dist = this.getTouchDistance(e.touches);
            const delta = (dist - this.state.lastTouchDist) * 0.01;
            const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

            this.zoom(delta, centerX, centerY);
            this.state.lastTouchDist = dist;
        }
    },

    handleTouchEnd() {
        this.state.isDragging = false;
    },

    getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
};

window.YulanModule = YulanModule;
window.showImagePreview = (url) => YulanModule.show(url);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => YulanModule.init());
} else {
    YulanModule.init();
}
