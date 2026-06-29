// Summary card styles for the BI operation page.
const KapianYejiYangshi = {
    injected: false,
    inject() {
        if (this.injected) return;
        this.injected = true;
        const style = document.createElement('style');
        style.textContent = `
.yeji-summary-bar {
    background: var(--yeji-card-bg);
    border-radius: var(--yeji-radius);
    padding: 8px 12px;
}
.yeji-summary-inner {
    width: fit-content;
    max-width: 100%;
    margin: 0 auto;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 4px;
    scrollbar-width: thin;
    scrollbar-color: rgba(148, 163, 184, .58) transparent;
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
}
.yeji-summary-inner::-webkit-scrollbar {
    height: 4px;
}
.yeji-summary-inner::-webkit-scrollbar-track {
    background: transparent;
}
.yeji-summary-inner::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(148, 163, 184, .58);
}
.yeji-summary-inner::-webkit-scrollbar-thumb:hover {
    background: rgba(100, 116, 139, .72);
}
.yeji-summary-cards {
    display: flex;
    gap: 32px;
    flex-wrap: nowrap;
    justify-content: flex-start;
    width: max-content;
}
.yeji-summary-state {
    width: 100%;
    min-height: 54px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--yeji-text-secondary);
    font-size: 13px;
    text-align: center;
}
.yeji-summary-card {
    flex: 0 0 auto;
    min-width: 136px;
    max-width: 220px;
    background: #f8fafc;
    border-radius: var(--yeji-radius);
    padding: 6px 14px;
    text-align: center;
}
.yeji-summary-label {
    font-size: 12px;
    color: var(--yeji-text-secondary);
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.yeji-summary-value {
    font-size: 15px;
    font-weight: 600;
    color: var(--yeji-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.yeji-summary-value .fa-spinner {
    font-size: 13px;
}
@media (max-width: 768px) {
    .yeji-summary-inner {
        width: 100%;
        max-width: 100%;
    }
    .yeji-summary-cards { gap: 8px; }
    .yeji-summary-card {
        min-width: 108px;
        max-width: 180px;
        padding: 4px 10px;
    }
    .yeji-summary-value { font-size: 13px; }
}
@media (max-width: 480px) {
    .yeji-summary-cards { gap: 6px; }
    .yeji-summary-card {
        min-width: 100px;
        max-width: 160px;
    }
    .yeji-summary-label { font-size: 11px; margin-bottom: 1px; }
    .yeji-summary-value { font-size: 12px; }
}
`;
        document.head.appendChild(style);
    }
};

window.KapianYejiYangshi = KapianYejiYangshi;
