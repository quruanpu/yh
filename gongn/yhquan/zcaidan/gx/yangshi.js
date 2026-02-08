/**
 * 优惠券模块 - 共享弹窗样式
 */
const GxYangshi = {
    styleId: 'yhquan-gx-styles',

    getStyles() {
        return `
/* 模态框 */
.yhquan-gx-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* 遮罩层 */
.yhquan-gx-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
}

/* 弹窗内容 */
.yhquan-gx-content {
    position: relative;
    background: white;
    border-radius: 8px;
    width: 80%;
    max-width: 400px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

/* 弹窗头部 */
.yhquan-gx-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #e5e7eb;
}

.yhquan-gx-title {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    display: flex;
    align-items: center;
    gap: 8px;
}

.yhquan-gx-title i {
    color: #3b82f6;
}

.yhquan-gx-close {
    width: 28px;
    height: 28px;
    border: none;
    background: #f3f4f6;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.yhquan-gx-close:hover {
    background: #e5e7eb;
}

.yhquan-gx-close i {
    font-size: 14px;
    color: #6b7280;
}

/* 弹窗主体 */
.yhquan-gx-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
}

/* 区块 */
.yhquan-gx-section {
    margin-bottom: 12px;
}

.yhquan-gx-section:last-child {
    margin-bottom: 0;
}

.yhquan-gx-section-title {
    font-size: 12px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 8px;
}

/* 优惠券信息 */
.yhquan-gx-info-grid {
    background: #f9fafb;
    border-radius: 6px;
    padding: 8px;
}

.yhquan-gx-info-row {
    display: flex;
    margin-bottom: 5px;
    font-size: 11px;
}

.yhquan-gx-info-row:last-child {
    margin-bottom: 0;
}

.yhquan-gx-info-label {
    color: #6b7280;
    min-width: 50px;
    flex-shrink: 0;
}

.yhquan-gx-info-value {
    color: #111827;
    flex: 1;
}

/* 输入框 */
.yhquan-gx-input {
    width: 100%;
    height: 32px;
    padding: 0 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 12px;
    outline: none;
    transition: all 0.2s;
    background: white;
    box-sizing: border-box;
}

/* 数量设置行 */
.yhquan-gx-limit-row {
    display: flex;
    gap: 10px;
}

.yhquan-gx-limit-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.yhquan-gx-limit-label {
    font-size: 10px;
    color: #6b7280;
}

.yhquan-gx-input:focus {
    border-color: #3b82f6;
}

.yhquan-gx-input:hover {
    border-color: #9ca3af;
}

/* 弹窗底部 */
.yhquan-gx-footer {
    padding: 10px 14px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.yhquan-gx-footer-left {
    display: flex;
    gap: 8px;
}

.yhquan-gx-btn {
    height: 28px;
    padding: 0 16px;
    border: none;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.yhquan-gx-btn-primary {
    background: #3b82f6;
    color: white;
}

.yhquan-gx-btn-primary:hover {
    background: #2563eb;
}

.yhquan-gx-btn-secondary {
    background: #f3f4f6;
    color: #374151;
}

.yhquan-gx-btn-secondary:hover {
    background: #e5e7eb;
}

.yhquan-gx-btn-danger {
    background: #ef4444;
    color: white;
}

.yhquan-gx-btn-danger:hover {
    background: #dc2626;
}

.yhquan-gx-btn-warning {
    background: #f97316;
    color: white;
}

.yhquan-gx-btn-warning:hover {
    background: #ea580c;
}

.yhquan-gx-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
    opacity: 0.6;
}

.yhquan-gx-btn.loading {
    position: relative;
    color: transparent;
    pointer-events: none;
}

.yhquan-gx-btn.loading::after {
    content: '';
    position: absolute;
    width: 12px;
    height: 12px;
    top: 50%;
    left: 50%;
    margin-left: -6px;
    margin-top: -6px;
    border: 2px solid #ffffff;
    border-radius: 50%;
    border-top-color: transparent;
    animation: spin 0.6s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* 多选标签容器 */
.yhquan-gx-chips,
.yhquan-gx-area-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.yhquan-gx-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 7px;
    border: 1px solid #d1d5db;
    border-radius: 10px;
    font-size: 9px;
    color: #374151;
    background: #f9fafb;
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
}

.yhquan-gx-chip:hover {
    border-color: #93c5fd;
    background: #eff6ff;
}

.yhquan-gx-chip.active {
    border-color: #3b82f6;
    background: #dbeafe;
    color: #1d4ed8;
    font-weight: 500;
}

/* 日期行 */
.yhquan-gx-date-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.yhquan-gx-date-input {
    flex: 1;
    height: 32px;
    padding: 0 8px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 12px;
    outline: none;
    transition: all 0.2s;
    background: white;
    box-sizing: border-box;
}

.yhquan-gx-date-input:focus {
    border-color: #3b82f6;
}

.yhquan-gx-date-sep {
    color: #9ca3af;
    font-size: 12px;
    flex-shrink: 0;
}

/* 提示文字 */
.yhquan-gx-hint {
    font-size: 10px;
    color: #9ca3af;
    margin-top: 4px;
    line-height: 1.4;
}

/* 手机端适配 */
@media (max-width: 768px) {
    .yhquan-gx-content {
        width: 95%;
        max-height: 85vh;
    }

    .yhquan-gx-body {
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        -ms-overflow-style: none;
    }

    .yhquan-gx-body::-webkit-scrollbar {
        display: none;
    }
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

window.GxYangshi = GxYangshi;
