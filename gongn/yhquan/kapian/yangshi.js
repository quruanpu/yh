/**
 * 优惠券模块 - 卡片样式
 */
const KapianYangshi = {
    styleId: 'yhquan-kapian-styles',

    getStyles() {
        return `
/* ========== 优惠券卡片 ========== */
.yhquan-card {
    background: white;
    border-radius: 8px;
    padding: 4px 12px 6px 12px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
    min-width: 0;
    box-sizing: border-box;
}

.yhquan-card-row {
    margin-bottom: 6px;
    min-width: 0;
    max-width: 100%;
}

.yhquan-card-row:last-child {
    margin-bottom: 0;
}

/* 第一行：序号 + ID + 操作按钮 */
.yhquan-card-header {
    padding-bottom: 6px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.yhquan-card-index {
    font-size: 10px;
    font-weight: 600;
    color: #3b82f6;
    word-break: break-word;
    overflow-wrap: break-word;
    line-height: 1;
}

/* 操作按钮区域 */
.yhquan-card-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}

.yhquan-action-btn {
    padding: 1px 6px;
    font-size: 9px;
    color: var(--yhquan-primary);
    background: var(--yhquan-primary-light);
    border: 1px solid var(--yhquan-primary);
    border-radius: 3px;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
}

.yhquan-action-btn:hover {
    background: var(--yhquan-primary);
    color: white;
}

/* 第二行：优惠券名称 */
.yhquan-card-title {
    font-size: 10px;
    font-weight: 700;
    color: #111827;
    line-height: 1.3;
    margin-top: 6px;
    word-break: break-word;
    overflow-wrap: break-word;
    display: flex;
    align-items: center;
    gap: 4px;
}

/* 状态图标 */
.yhquan-status-icon {
    font-size: 10px;
    display: inline-flex;
    align-items: center;
}

/* 第三行：标签 */
.yhquan-card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.yhquan-tag {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 500;
}

.yhquan-tag-condition {
    background: #fee2e2;
    color: #dc2626;
}

.yhquan-tag-category {
    background: #dbeafe;
    color: #2563eb;
}

.yhquan-tag-price {
    background: #fef3c7;
    color: #d97706;
}

/* 第四行：有效期 */
.yhquan-card-valid {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    color: #6b7280;
}

.yhquan-card-valid i {
    color: #6b7280;
    font-size: 10px;
}

/* 第五行：创建人和时间 */
.yhquan-card-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #6b7280;
}

.yhquan-card-meta i {
    font-size: 10px;
}

.yhquan-card-separator {
    color: #6b7280;
    margin: 0 2px;
}

/* 第六行：使用/领取 + GMV */
.yhquan-card-stats {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #6b7280;
}

.yhquan-card-stats i {
    font-size: 10px;
}

.yhquan-stats-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.yhquan-gmv-item {
    display: inline-flex;
    align-items: center;
    gap: 0;
}

.yhquan-gmv-value {
    color: #059669;
    font-weight: 500;
}

.yhquan-gmv-eye {
    cursor: pointer;
    color: #9ca3af;
    transition: color 0.2s;
    font-size: 10px;
    line-height: 1;
    vertical-align: middle;
}

.yhquan-gmv-eye:hover {
    color: var(--yhquan-primary);
}

/* 第七行：使用说明 */
.yhquan-card-desc {
    font-size: 10px;
    color: #6b7280;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
    word-break: break-all;
    padding-bottom: 0;
    cursor: pointer;
    position: relative;
}

.yhquan-card-desc:hover {
    color: var(--yhquan-primary);
}

/* ========== 二维码标签 ========== */
.yhquan-tag-ewm {
    background: #ede9fe;
    color: #7c3aed;
    cursor: pointer;
    transition: all 0.2s;
}

@media (hover: hover) {
    .yhquan-tag-ewm:hover {
        background: #7c3aed;
        color: #fff;
    }
}

.yhquan-tag-ewm:active {
    background: #7c3aed;
    color: #fff;
}

/* ========== 手机端响应式 ========== */
@media screen and (max-width: 768px) {
    .yhquan-card {
        padding: 12px;
    }

    .yhquan-card-tags {
        flex-wrap: wrap;
    }

    .yhquan-card-row {
        min-width: 0;
        max-width: 100%;
    }

    .yhquan-card-index,
    .yhquan-card-desc {
        word-break: break-word;
        overflow-wrap: break-word;
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

window.KapianYangshi = KapianYangshi;
