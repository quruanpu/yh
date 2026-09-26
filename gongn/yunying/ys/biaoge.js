// Table, pager, and empty-state styles for the BI operation page.
const BiaogeYangshi = {
    injected: false,
    inject() {
        if (this.injected) return;
        this.injected = true;
        const style = document.createElement('style');
        style.textContent = `
.yeji-table-wrap {
    background: var(--yeji-card-bg);
    border-radius: 0 0 var(--yeji-radius) var(--yeji-radius);
    overflow-x: auto;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
}
.yeji-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    white-space: nowrap;
}
.yeji-table th {
    background: #f8fafc;
    color: var(--yeji-text-secondary);
    font-weight: 600;
    padding: 8px 10px;
    border-bottom: 1px solid var(--yeji-border);
    position: sticky;
    top: 0;
    z-index: 1;
    text-align: left;
}
.yeji-sort-header {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    vertical-align: middle;
}
.yeji-sort-label {
    overflow: hidden;
    text-overflow: ellipsis;
}
.yeji-sort-btn {
    width: 16px;
    height: 16px;
    min-width: 16px;
    border: 0;
    padding: 0;
    border-radius: 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
    font-size: 10px;
}
.yeji-sort-btn:hover,
.yeji-sort-btn.active {
    color: var(--yeji-primary);
    background: #e8f2ff;
}
.yeji-table td {
    padding: 7px 10px;
    border-bottom: 1px solid #f1f3f5;
    color: var(--yeji-text);
}
.yeji-table tr:hover td { background: #f0f7ff; }
.yeji-table .num { text-align: right; }
.yeji-table-shell {
    flex: 1;
    height: 100%;
}
.yeji-table-shell tbody {
    height: 100%;
}
.yeji-empty-row td {
    height: 100%;
    border-bottom: none;
}
.yeji-empty-row:hover td {
    background: transparent;
}
.yeji-pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 10px 12px;
    font-size: 12px;
    color: var(--yeji-text-secondary);
    background: var(--yeji-card-bg);
    border-top: 1px solid var(--yeji-border);
}
.yeji-pager-total b { color: var(--yeji-text); }
.yeji-pager-nav { display: flex; align-items: center; gap: 4px; }
.yeji-pager-dots { padding: 0 4px; color: #999; user-select: none; }
.yeji-pager-btn {
    min-width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 6px;
    border: 1px solid var(--yeji-border);
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    font-size: 12px;
    color: var(--yeji-text);
}
.yeji-pager-btn:hover:not(:disabled):not(.active) {
    border-color: var(--yeji-primary);
    color: var(--yeji-primary);
}
.yeji-pager-btn:disabled { opacity: .4; cursor: not-allowed; }
.yeji-pager-btn.active {
    background: var(--yeji-primary);
    color: #fff;
    border-color: var(--yeji-primary);
}
.yeji-pager-jump {
    display: flex;
    align-items: center;
    gap: 4px;
}
.yeji-pager-input {
    width: 40px;
    height: 28px;
    box-sizing: border-box;
    text-align: center;
    border: 1px solid var(--yeji-border);
    border-radius: 4px;
    font-size: 12px;
    outline: none;
}
.yeji-pager-input:focus { border-color: var(--yeji-primary); }
.yeji-empty,
.yeji-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-height: 120px;
    color: var(--yeji-text-secondary);
    font-size: 13px;
    gap: 6px;
}
.yeji-table-state {
    flex: 1;
    min-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}
.yeji-table-state .yeji-empty {
    flex: none;
    min-height: 0;
    width: 100%;
    box-sizing: border-box;
    padding: 24px;
    text-align: center;
}
@media (max-width: 480px) {
    .yeji-pager {
        padding: 4px 6px;
        gap: 4px;
        font-size: 10px;
        flex-wrap: wrap;
        justify-content: center;
    }
    .yeji-pager-total { display: none; }
    .yeji-pager-btn {
        min-width: 22px;
        height: 22px;
        font-size: 10px;
        padding: 0 3px;
    }
    .yeji-pager-nav { gap: 1px; }
    .yeji-pager-jump { font-size: 10px; }
    .yeji-pager-input {
        width: 32px;
        height: 20px;
        font-size: 10px;
    }
}
`;
        document.head.appendChild(style);
    }
};

window.BiaogeYangshi = BiaogeYangshi;
