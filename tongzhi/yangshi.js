/**
 * 通知系统 - 样式模块
 */
const TongzhiYangshi = {
    styleId: 'tongzhi-styles',

    getStyles() {
        return `
/* 通知组件 */
.tongzhi {
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 400px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 10001;
    animation: tongzhi-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    transition: top 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    border: 1px solid rgba(0, 0, 0, 0.06);
}

.tongzhi-hide {
    animation: tongzhi-fade-out 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes tongzhi-slide-in {
    from { transform: translateY(-100px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

@keyframes tongzhi-fade-out {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
}

.tongzhi-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
}

.tongzhi-content {
    flex: 1;
    font-size: 13px;
    line-height: 1.5;
    color: #1f2937;
    white-space: pre-wrap;
    word-break: break-word;
    font-weight: 500;
}

.tongzhi-close {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border: none;
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s;
    font-size: 14px;
}

.tongzhi-close:hover {
    background: rgba(0, 0, 0, 0.08);
    color: #4b5563;
}

/* 成功 */
.tongzhi-success {
    background: rgba(236, 253, 245, 0.95);
    border-left: 3px solid #10b981;
}
.tongzhi-success .tongzhi-icon { color: #10b981; }

/* 错误 */
.tongzhi-error {
    background: rgba(254, 242, 242, 0.95);
    border-left: 3px solid #ef4444;
}
.tongzhi-error .tongzhi-icon { color: #ef4444; }

/* 警告 */
.tongzhi-warning {
    background: rgba(255, 251, 235, 0.95);
    border-left: 3px solid #f59e0b;
}
.tongzhi-warning .tongzhi-icon { color: #f59e0b; }

/* 信息 */
.tongzhi-info {
    background: rgba(239, 246, 255, 0.95);
    border-left: 3px solid #3b82f6;
}
.tongzhi-info .tongzhi-icon { color: #3b82f6; }

/* 手机端 */
@media (max-width: 768px) {
    .tongzhi {
        top: 10px;
        right: 10px;
        left: 10px;
        min-width: auto;
        max-width: none;
        padding: 10px 12px;
    }
    .tongzhi-icon { width: 18px; height: 18px; font-size: 14px; }
    .tongzhi-content { font-size: 12px; }
    .tongzhi-close { width: 18px; height: 18px; font-size: 12px; }
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

window.TongzhiYangshi = TongzhiYangshi;
