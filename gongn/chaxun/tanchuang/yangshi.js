/**
 * 商品查询模块 - 弹窗样式
 */
const TanchuangYangshi = {
    styleId: 'chaxun-tanchuang-styles',

    getStyles() {
        return `
/* ========== 商品详情弹窗 ========== */
.chaxun-detail-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: none;
}

.chaxun-detail-overlay.active {
    display: flex;
    align-items: center;
    justify-content: center;
}

.chaxun-detail-modal {
    background: white;
    border-radius: 12px;
    width: 90%;
    max-width: 600px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.chaxun-detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
}

.chaxun-detail-title {
    font-size: 15px;
    font-weight: 600;
    color: #111827;
}

.chaxun-detail-close {
    width: 28px;
    height: 28px;
    border: none;
    background: #f3f4f6;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b7280;
    transition: var(--chaxun-transition);
}

.chaxun-detail-close:hover {
    background: #e5e7eb;
    color: #374151;
}

.chaxun-detail-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
}

.chaxun-detail-section {
    margin-bottom: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
}

.chaxun-detail-section:last-child {
    margin-bottom: 0;
}

.chaxun-detail-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #f9fafb;
    cursor: pointer;
    user-select: none;
}

.chaxun-detail-section-title {
    font-size: 12px;
    font-weight: 600;
    color: #374151;
    display: flex;
    align-items: center;
    gap: 6px;
}

.chaxun-detail-section-toggle {
    font-size: 10px;
    color: #9ca3af;
    transition: transform 0.2s;
}

.chaxun-detail-section.collapsed .chaxun-detail-section-toggle {
    transform: rotate(-90deg);
}

.chaxun-detail-section-content {
    padding: 10px 12px;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
}

.chaxun-detail-section.collapsed .chaxun-detail-section-content {
    display: none;
}

.chaxun-detail-field {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.chaxun-detail-field.full-width {
    grid-column: 1 / -1;
}

.chaxun-detail-label {
    font-size: 10px;
    color: #9ca3af;
}

.chaxun-detail-value {
    font-size: 11px;
    color: #374151;
    word-break: break-all;
}

.chaxun-detail-value.highlight {
    color: #059669;
    font-weight: 600;
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

window.TanchuangYangshi = TanchuangYangshi;
