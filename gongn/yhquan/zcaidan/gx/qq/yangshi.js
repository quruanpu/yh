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

/* ========== 顶部工具栏 ========== */
.ewm-popup-toolbar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 4px;
    margin: -12px -8px 8px 0;
}

.ewm-popup-icon-btn {
    background: none;
    border: none;
    font-size: 12px;
    color: #9ca3af;
    cursor: pointer;
    padding: 3px 5px;
    border-radius: 5px;
    transition: color 0.2s, background 0.2s;
    line-height: 1;
}

.ewm-popup-icon-btn:hover:not(:disabled) {
    color: #374151;
    background: #f3f4f6;
}

.ewm-popup-icon-btn:disabled {
    color: #d1d5db;
    cursor: not-allowed;
}

.ewm-copy-btn {
    font-size: 10px;
    padding: 2px 4px;
}

.ewm-close-btn {
    font-size: 14px;
    padding: 3px 5px;
}

.ewm-popup-icon-btn.ewm-copy-active {
    color: #10b981;
}
        `;
    },

    getTitleStyles() {
        return `
/* ========== 名言区域 ========== */
.ewm-popup-quote {
    font-size: 11px;
    color: #9ca3af;
    margin: 0 auto;
    padding: 0;
    line-height: 1.5;
    text-align: left;
    max-width: 230px;
}

.ewm-popup-multi .ewm-popup-quote {
    max-width: none;
    padding: 0 10px;
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

/* ========== 多二维码网格 ========== */
.ewm-qr-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 16px;
    margin: 0 auto 8px;
    max-width: 100%;
}

.ewm-qr-item {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    flex-shrink: 0;
}

.ewm-qr-item .ewm-popup-qr {
    margin-bottom: 0;
}

.ewm-qr-label {
    font-size: 13px;
    font-weight: 600;
    color: #1f2937;
    text-align: left;
    max-width: 230px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.4;
    margin-bottom: 8px;
}

/* 多个二维码时弹窗加宽（桌面端横排，最多4个） */
.ewm-popup-multi {
    width: auto;
    max-width: min(92%, 1040px);
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
        return '';
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

    .ewm-popup-multi {
        width: 280px;
        max-width: 95%;
        max-height: 90vh;
        overflow-y: auto;
    }

    .ewm-popup-qr {
        width: 100%;
        max-width: 210px;
    }

    .ewm-qr-grid {
        flex-direction: column;
        align-items: center;
        flex-wrap: nowrap;
        gap: 12px;
    }

    .ewm-qr-item {
        align-items: stretch;
        width: 100%;
        max-width: 210px;
    }

    .ewm-qr-label {
        max-width: 210px;
        font-size: 11px;
    }

    .ewm-popup-quote {
        max-width: 210px;
    }

    #ewm-copy-img {
        display: none;
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
