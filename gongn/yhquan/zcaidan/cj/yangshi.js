/**
 * 优惠券模块 - 创建优惠券弹窗样式
 */
const CjYangshi = {
    styleId: 'yhquan-cj-styles',

    getStyles() {
        return `
/* 悬浮创建按钮 */
.yhquan-cj-fab {
    position: absolute;
    bottom: 10px;
    right: 10px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #3d6dff;
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    font-size: 16px;
}

@media (hover: hover) {
    .yhquan-cj-fab:hover {
        background: #2b5be0;
    }
}

.yhquan-cj-fab:active {
    background: #1e4abf;
}

/* 模态框 */
.yhquan-cj-modal {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.yhquan-cj-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.5);
}

/* 弹窗内容 */
.yhquan-cj-content {
    position: relative;
    background: white;
    border-radius: 8px;
    width: 80%;
    height: 80vh;
    max-width: 420px;
    max-height: 800px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
}

/* 头部 */
.yhquan-cj-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid #e5e7eb;
}

.yhquan-cj-title {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    display: flex;
    align-items: center;
    gap: 8px;
}

.yhquan-cj-title i { color: #3d6dff; }

.yhquan-cj-discount-hint {
    font-size: 11px;
    font-weight: 400;
    color: #ef4444;
}

.yhquan-cj-close {
    width: 28px; height: 28px;
    border: none;
    background: #f3f4f6;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.yhquan-cj-close:hover { background: #e5e7eb; }
.yhquan-cj-close i { font-size: 14px; color: #6b7280; }

/* 主体 */
.yhquan-cj-body {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
}

/* 区块 */
.yhquan-cj-section { margin-bottom: 10px; }
.yhquan-cj-section:last-child { margin-bottom: 0; }

.yhquan-cj-section-title {
    font-size: 12px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 6px;
}

/* 券类型Tab */
.yhquan-cj-type-tabs { display: flex; gap: 8px; }

.yhquan-cj-type-tab {
    flex: 1;
    height: 34px;
    border: 1.5px solid #d1d5db;
    border-radius: 6px;
    background: white;
    font-size: 11px;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
}

.yhquan-cj-type-tab:hover { border-color: #3d6dff; color: #3d6dff; }

.yhquan-cj-type-tab.active {
    border-color: #3d6dff;
    background: #eef2ff;
    color: #3d6dff;
    font-weight: 600;
}

/* 表单 */
.yhquan-cj-form-group { margin-bottom: 8px; }
.yhquan-cj-form-group:last-child { margin-bottom: 0; }

.yhquan-cj-label {
    display: block;
    font-size: 11px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 4px;
}

.yhquan-cj-label .required { color: #ef4444; margin-left: 2px; }

.yhquan-cj-input,
.yhquan-cj-select,
.yhquan-cj-textarea {
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

.yhquan-cj-textarea {
    height: 48px;
    padding: 6px 10px;
    resize: none;
    line-height: 1.4;
}

.yhquan-cj-input:focus,
.yhquan-cj-select:focus,
.yhquan-cj-textarea:focus {
    border-color: #3d6dff;
    box-shadow: 0 0 0 2px rgba(61, 109, 255, 0.1);
}

.yhquan-cj-input::placeholder,
.yhquan-cj-textarea::placeholder { color: #9ca3af; }

/* 有效期类型切换 */
.yhquan-cj-validity-tabs { display: flex; gap: 6px; margin-bottom: 8px; }

.yhquan-cj-validity-tab {
    flex: 1; height: 28px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: white;
    font-size: 11px;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
}

.yhquan-cj-validity-tab.active {
    border-color: #3d6dff;
    background: #eef2ff;
    color: #3d6dff;
    font-weight: 500;
}

/* 有效期面板 */
.yhquan-cj-validity-panel { display: none; }
.yhquan-cj-validity-panel.active { display: block; }

.yhquan-cj-date-row { display: flex; gap: 8px; align-items: center; }
.yhquan-cj-date-row .yhquan-cj-input { flex: 1; }
.yhquan-cj-date-sep { color: #9ca3af; font-size: 11px; flex-shrink: 0; }

/* 天数/小时行 */
.yhquan-cj-days-row { display: flex; gap: 8px; align-items: center; }
.yhquan-cj-days-row .yhquan-cj-input { flex: 1; }
.yhquan-cj-days-row .yhquan-cj-select { width: 80px; flex-shrink: 0; }

/* 首推反哺券 */
.yhquan-cj-radio-group { display: flex; gap: 12px; flex-wrap: wrap; }

.yhquan-cj-radio-item {
    display: flex; align-items: center; gap: 4px;
    font-size: 11px; color: #374151; cursor: pointer;
}

.yhquan-cj-radio-item input[type="radio"] {
    width: 13px; height: 13px; margin: 0; cursor: pointer;
}

/* 底部 */
.yhquan-cj-footer {
    padding: 8px 12px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.yhquan-cj-btn {
    height: 30px; padding: 0 18px;
    border: none; border-radius: 6px;
    font-size: 12px; font-weight: 500;
    cursor: pointer; transition: all 0.2s;
}

.yhquan-cj-btn-cancel { background: #f3f4f6; color: #374151; }
.yhquan-cj-btn-cancel:hover { background: #e5e7eb; }

.yhquan-cj-btn-primary { background: #3d6dff; color: white; }
.yhquan-cj-btn-primary:hover { background: #2b5be0; }
.yhquan-cj-btn-primary:disabled { background: #9ca3af; cursor: not-allowed; opacity: 0.6; }

/* 手机端适配 */
@media (max-width: 768px) {
    .yhquan-cj-content { width: 90%; height: 85vh; }
    .yhquan-cj-type-tab { font-size: 10px; }
    .yhquan-cj-body {
        scrollbar-width: none;
        -ms-overflow-style: none;
    }
    .yhquan-cj-body::-webkit-scrollbar {
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

window.CjYangshi = CjYangshi;
