/**
 * 商品查询模块 - 卡片样式
 */
const ChaxunKapianYangshi = {
    styleId: 'chaxun-kapian-styles',

    getStyles() {
        return `
/* ========== 商品卡片 ========== */
.chaxun-card {
    background: white;
    border-radius: 8px;
    padding: 8px 12px 10px 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    min-width: 0;
    box-sizing: border-box;
}

.chaxun-card-row {
    margin-bottom: 6px;
    min-width: 0;
    max-width: 100%;
}

.chaxun-card-row:last-child {
    margin-bottom: 0;
}

.chaxun-card-header {
    padding-bottom: 6px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.chaxun-card-index {
    font-size: 10px;
    color: #3b82f6;
    word-break: break-word;
}

.chaxun-detail-btn {
    padding: 1px 6px;
    font-size: 9px;
    color: var(--chaxun-primary);
    background: var(--chaxun-primary-light);
    border: 1px solid var(--chaxun-primary);
    border-radius: 3px;
    cursor: pointer;
    transition: var(--chaxun-transition);
    flex-shrink: 0;
}

.chaxun-detail-btn:hover {
    background: var(--chaxun-primary);
    color: white;
}

.chaxun-card-title {
    font-size: 10px;
    font-weight: 700;
    color: #111827;
    line-height: 1.4;
    margin-top: 6px;
    display: flex;
    align-items: flex-start;
    gap: 4px;
}

.chaxun-card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.chaxun-tag {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 500;
}

.chaxun-tag-pack {
    background: #e0f2fe;
    color: #0369a1;
}

.chaxun-tag-date {
    background: #fef3c7;
    color: #92400e;
}

.chaxun-tag-contactor {
    background: #f3e8ff;
    color: #9333ea;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 2px;
}

.chaxun-tag-contactor .chaxun-contactor-eye {
    color: #9333ea;
    margin-left: 0;
}

.chaxun-tag-contactor .chaxun-contactor-value {
    color: #059669;
    font-weight: 500;
}

.chaxun-card-cost {
    font-size: 10px;
    color: #6b7280;
}

.chaxun-contactor-value {
    color: #059669;
    font-weight: 500;
}

.chaxun-contactor-eye {
    cursor: pointer;
    color: #9ca3af;
    margin-left: 2px;
}

.chaxun-contactor-eye:hover {
    color: var(--chaxun-primary);
}

.chaxun-price-table {
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    margin-bottom: 6px;
}

.chaxun-price-row {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    text-align: center;
}

.chaxun-price-header {
    font-size: 10px;
    color: #6b7280;
    padding: 4px 0;
    border-bottom: 1px solid #e5e7eb;
}

.chaxun-price-header span {
    border-right: 1px solid #e5e7eb;
}

.chaxun-price-header span:last-child {
    border-right: none;
}

.chaxun-price-values {
    font-size: 10px;
    font-weight: 600;
    color: #059669;
    padding: 4px 0;
}

.chaxun-price-values span {
    border-right: 1px solid #e5e7eb;
}

.chaxun-price-values span:last-child {
    border-right: none;
}

.chaxun-card-factory {
    font-size: 10px;
    color: #6b7280;
    display: flex;
    align-items: center;
    gap: 4px;
}

/* ========== 手机端响应式 ========== */
@media screen and (max-width: 480px) {
    .chaxun-card {
        padding: 6px 8px 8px 8px;
        overflow: hidden;
    }

    .chaxun-price-row {
        font-size: 9px;
    }

    .chaxun-price-header,
    .chaxun-price-values {
        font-size: 9px;
        padding: 3px 0;
    }

    .chaxun-price-header span,
    .chaxun-price-values span {
        padding: 0 2px;
        word-break: break-all;
    }

    .chaxun-card-title {
        font-size: 11px;
        word-break: break-word;
    }

    .chaxun-tag {
        font-size: 8px;
        padding: 1px 4px;
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

window.ChaxunKapianYangshi = ChaxunKapianYangshi;
