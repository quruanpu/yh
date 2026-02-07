/**
 * 优惠券模块 - 二维码弹窗样式
 */
const EwmYangshi = {
    styleId: 'yhquan-ewm-styles',

    getOverlayStyles() {
        return `
/* ========== 遮罩层 ========== */
.ewm-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.45);
}

/* ========== 弹窗主体 ========== */
.ewm-popup {
    background: #fff;
    border-radius: 16px;
    width: 300px;
    max-width: 88%;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
    animation: ewmFadeIn 0.2s ease;
    text-align: center;
    position: relative;
    padding: 28px 24px 24px;
}

/* ========== 关闭按钮 ========== */
.ewm-popup-close {
    position: absolute;
    top: 10px;
    right: 10px;
    background: none;
    border: none;
    font-size: 15px;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 6px;
    transition: color 0.2s, background 0.2s;
    z-index: 1;
    line-height: 1;
}

.ewm-popup-close:hover {
    color: #374151;
    background: #f3f4f6;
}
        `;
    },

    getTitleStyles() {
        return `
/* ========== 活动名称 ========== */
.ewm-popup-title {
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 auto 16px;
    padding: 0;
    line-height: 1.4;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 230px;
}

/* ========== 名言区域 ========== */
.ewm-popup-quote {
    font-size: 11px;
    color: #9ca3af;
    margin: 0 auto 18px;
    padding: 0;
    line-height: 1.5;
    text-align: left;
    max-width: 230px;
}
        `;
    },

    getQrStyles() {
        return `
/* ========== 二维码区域 ========== */
.ewm-popup-qr {
    width: 230px;
    max-width: 100%;
    aspect-ratio: 1 / 1;
    padding: 10px;
    box-sizing: border-box;
    margin: 0 auto 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    overflow: hidden;
    position: relative;
}

.ewm-popup-qr img,
.ewm-popup-qr canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
}

/* ========== 状态文字（加载中） ========== */
.ewm-popup-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
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

.ewm-status-success .ewm-status-text {
    color: #10b981;
}

.ewm-status-error .ewm-status-text {
    color: #ef4444;
}
        `;
    },

    getButtonStyles() {
        return `
/* ========== 底部按钮 ========== */
.ewm-popup-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
}

.ewm-popup-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 9px 22px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    line-height: 1;
}

.ewm-popup-btn:disabled {
    background: #d1d5db !important;
    color: #9ca3af !important;
    cursor: not-allowed;
}

.ewm-btn-link {
    background: #3b82f6;
    color: #fff;
}

.ewm-btn-link:hover:not(:disabled) {
    background: #2563eb;
}

.ewm-btn-image {
    background: #10b981;
    color: #fff;
}

.ewm-btn-image:hover:not(:disabled) {
    background: #059669;
}

/* 按钮加载中 */
.ewm-popup-btn.ewm-btn-loading {
    background: #d1d5db !important;
    color: #9ca3af !important;
    cursor: not-allowed;
    pointer-events: none;
}
        `;
    },

    getAnimationStyles() {
        return `
/* ========== 动画 ========== */
@keyframes ewmFadeIn {
    from { opacity: 0; transform: scale(0.92); }
    to { opacity: 1; transform: scale(1); }
}

@keyframes ewmSpin {
    to { transform: rotate(360deg); }
}

/* ========== 手机端适配 ========== */
@media (max-width: 768px) {
    .ewm-popup {
        width: 280px;
        padding: 24px 20px 20px;
    }

    .ewm-popup-qr {
        width: 210px;
    }

    .ewm-popup-title,
    .ewm-popup-quote {
        max-width: 210px;
    }
}
        `;
    },

    inject() {
        if (document.getElementById(this.styleId)) return;
        const style = document.createElement('style');
        style.id = this.styleId;
        style.textContent =
            this.getOverlayStyles() +
            this.getTitleStyles() +
            this.getQrStyles() +
            this.getButtonStyles() +
            this.getAnimationStyles();
        document.head.appendChild(style);
    }
};

window.EwmYangshi = EwmYangshi;
