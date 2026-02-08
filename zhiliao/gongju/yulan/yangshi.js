/**
 * 图片预览模块 - 样式
 */
const YulanYangshi = {
    styleId: 'yulan-styles',

    getStyles() {
        return `
/* 图片预览遮罩层 */
.yulan-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.92);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 99999;
    cursor: grab;
    touch-action: none;
    user-select: none;
}

.yulan-overlay.active {
    display: flex;
}

.yulan-overlay.dragging {
    cursor: grabbing;
}

/* 预览图片 */
.yulan-image {
    max-width: 95vw;
    max-height: 95vh;
    object-fit: contain;
    transition: transform 0.1s ease-out;
    pointer-events: none;
    border-radius: 4px;
}

/* 关闭按钮 */
.yulan-close {
    position: fixed;
    top: 16px;
    right: 16px;
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.15);
    border: none;
    border-radius: 50%;
    color: white;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    z-index: 100000;
}

.yulan-close:hover {
    background: rgba(255, 255, 255, 0.25);
}

/* 缩放提示 */
.yulan-hint {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.6);
    color: rgba(255, 255, 255, 0.8);
    padding: 6px 14px;
    border-radius: 16px;
    font-size: 12px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s;
}

.yulan-overlay.active .yulan-hint {
    opacity: 1;
}

.yulan-overlay.interacted .yulan-hint {
    opacity: 0;
}

/* 可点击预览的图片样式 */
.yulan-clickable {
    cursor: zoom-in;
    transition: transform 0.2s, box-shadow 0.2s;
}

.yulan-clickable:hover {
    transform: scale(1.02);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
        `;
    },

    inject() {
        if (document.getElementById(this.styleId)) return;
        const style = document.createElement('style');
        style.id = this.styleId;
        style.textContent = this.getStyles();
        document.head.appendChild(style);
    }
};

window.YulanYangshi = YulanYangshi;
