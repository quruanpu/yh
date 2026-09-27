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
    z-index: 2147483000;
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
        max-width: 85%;
        padding: 10px 12px;
    }
    .tongzhi-icon { width: 18px; height: 18px; font-size: 14px; }
    .tongzhi-content { font-size: 12px; }
    .tongzhi-close { width: 18px; height: 18px; font-size: 12px; }
}

/* 确认弹窗 */
.tongzhi-confirm-mask {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    z-index: 2147483001;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: tongzhi-mask-in 0.2s ease;
}
.tongzhi-confirm-mask-out {
    animation: tongzhi-mask-out 0.2s ease forwards;
}
@keyframes tongzhi-mask-in {
    from { opacity: 0; }
    to { opacity: 1; }
}
@keyframes tongzhi-mask-out {
    from { opacity: 1; }
    to { opacity: 0; }
}

.tongzhi-confirm-box {
    background: #fff;
    border-radius: 10px;
    max-width: 360px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    animation: tongzhi-box-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
}
.tongzhi-confirm-out {
    animation: tongzhi-box-out 0.2s ease forwards;
}
@keyframes tongzhi-box-in {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
@keyframes tongzhi-box-out {
    from { transform: scale(1); opacity: 1; }
    to { transform: scale(0.9); opacity: 0; }
}

.tongzhi-confirm-icon {
    font-size: 32px;
    margin-bottom: 12px;
}
.tongzhi-confirm-icon-warning { color: #f59e0b; }
.tongzhi-confirm-icon-error { color: #ef4444; }
.tongzhi-confirm-icon-info { color: #3b82f6; }
.tongzhi-confirm-icon-success { color: #10b981; }

.tongzhi-confirm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid #f3f4f6;
}

.tongzhi-confirm-header-title {
    font-size: 13px;
    font-weight: 600;
    color: #111827;
}

.tongzhi-confirm-close {
    width: 20px;
    height: 20px;
    border: none;
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    transition: all 0.2s;
    margin-left: 8px;
}
.tongzhi-confirm-close:hover {
    background: #f3f4f6;
    color: #4b5563;
}

.tongzhi-confirm-body {
    padding: 12px 16px;
    font-size: 13px;
    color: #374151;
    line-height: 1.5;
}

.tongzhi-confirm-footer {
    padding: 10px 16px;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid #f3f4f6;
}

.tongzhi-confirm-btn.ok {
    padding: 6px 18px;
    border-radius: 6px;
    border: none;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    background: #3b82f6;
    color: #fff;
}
.tongzhi-confirm-btn.ok:hover {
    background: #2563eb;
}

.tongzhi-confirm-title {
    font-size: 16px;
    color: #111827;
    font-weight: 600;
    margin-bottom: 6px;
    text-align: center;
}

.tongzhi-confirm-desc {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 20px;
    text-align: center;
}

.tongzhi-confirm-msg {
    font-size: 14px;
    color: #1f2937;
    line-height: 1.6;
    margin-bottom: 16px;
    text-align: left;
    white-space: pre-line;
}

@media (max-width: 768px) {
    .tongzhi-confirm-box {
        width: 90%;
        max-width: 320px;
    }
    .tongzhi-confirm-header { padding: 14px 16px; }
    .tongzhi-confirm-header-title { font-size: 14px; }
    .tongzhi-confirm-body { padding: 18px 16px; font-size: 13px; }
    .tongzhi-confirm-footer { padding: 10px 16px 14px; }
    .tongzhi-confirm-btn.ok { font-size: 12px; padding: 7px 20px; }
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
