/**
 * 出库统计Ultra - 筛选弹窗与查询结果补充样式
 */
const YejiUltraYangshi = {
    injected: false,
    inject() {
        if (this.injected) return;
        this.injected = true;
        const style = document.createElement('style');
        style.id = 'yeji-ultra-layout-fix';
        style.textContent = `
.yeji-summary-bar,
#yeji-pager-wrap {
    flex-shrink: 0;
}
.yeji-table-wrap {
    flex: 1;
}
.yeji-table-zone {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
}
.yeji-table-zone .yeji-table-wrap {
    flex: 1;
}
.yeji-main-action-stack {
    display: none;
}
.yeji-global-action-stack {
    position: fixed;
    right: 10px;
    bottom: 10px;
    z-index: 2147483002;
    display: flex;
    flex-direction: column-reverse;
    align-items: flex-end;
    gap: 10px;
    pointer-events: none;
}
.yeji-global-action-stack .yeji-batch-query-btn,
.yeji-global-action-stack .yeji-field-config-btn,
.yeji-main-action-stack .yeji-batch-query-btn,
.yeji-main-action-stack .yeji-field-config-btn {
    pointer-events: auto;
}
.yeji-global-action-stack .yeji-batch-query-btn:hover,
.yeji-global-action-stack .yeji-field-config-btn:hover,
.yeji-main-action-stack .yeji-batch-query-btn:hover,
.yeji-main-action-stack .yeji-field-config-btn:hover {
    background: #1d4ed8;
}
.yeji-global-action-stack .yeji-field-config-btn:hover {
    background: #1d4ed8;
    color: #fff;
}
.yeji-table td.metric,
.yeji-table th.metric {
    text-align: right;
}
.yeji-conn-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
}
.yeji-conn-dot.connected { background: #52c41a; }
.yeji-conn-dot.disconnected { background: #ff4d4f; }
.yeji-search-clear { z-index: 2; }
.yeji-quick-selector-wrap {
    position: relative;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    width: 108px;
    height: 36px;
}
.yeji-quick-selector {
    position: absolute;
    inset: 0;
    opacity: 0;
    pointer-events: none;
}
.yeji-quick-selector-btn {
    width: 100%;
    height: 36px;
    padding: 0 24px;
    border: 1.5px solid #d1d5db;
    border-radius: 8px;
    background: #fff;
    color: #374151;
    font-size: 12px;
    outline: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    white-space: nowrap;
}
.yeji-quick-selector-arrow {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: #6b7280;
    font-size: 10px;
    line-height: 1;
    pointer-events: none;
}
.yeji-quick-selector-btn:focus,
.yeji-quick-selector-btn.open {
    border-color: var(--yeji-primary);
    box-shadow: 0 4px 16px rgba(64, 128, 255, 0.15);
}
.yeji-quick-selector-wrap:focus-within .yeji-quick-selector-arrow {
    color: var(--yeji-primary);
}
.yeji-quick-selector-panel[hidden] { display: none; }
.yeji-quick-selector-panel {
    position: absolute;
    top: calc(100% + 2px);
    left: 0;
    z-index: 9100;
    width: 108px;
    padding: 3px 0;
    border: 1px solid #666;
    background: #fff;
    box-shadow: 0 6px 16px rgba(15, 23, 42, .12);
}
.yeji-quick-option {
    width: 100%;
    height: 24px;
    padding: 0 6px;
    border: none;
    background: #fff;
    color: #111827;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    text-align: center;
    white-space: nowrap;
}
.yeji-quick-option:hover,
.yeji-quick-option.active {
    background: #f0f5ff;
    color: var(--yeji-primary);
}
.yeji-search-input:disabled {
    background: #f3f4f6;
    color: #9ca3af;
    cursor: not-allowed;
}
.yeji-batch-query-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: var(--yeji-primary);
    color: #fff;
    font-size: 13px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
}
.yeji-batch-query-btn:hover {
    background: var(--yeji-primary);
}
.yeji-field-config-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: var(--yeji-primary);
    color: #fff;
    font-size: 13px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 20px rgba(37, 99, 235, .24);
    pointer-events: auto;
}
.yeji-field-config-btn:hover {
    background: #1d4ed8;
}
.yeji-bi-ai-root {
    position: fixed;
    inset: 0;
    z-index: 2147483000;
    pointer-events: none;
}
.yeji-bi-ai-btn {
    position: static;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: var(--yeji-primary);
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0;
    cursor: pointer;
    box-shadow: 0 8px 20px rgba(37, 99, 235, .24);
    pointer-events: auto;
}
.yeji-bi-ai-btn:hover {
    background: #1d4ed8;
}
.yeji-main-action-stack .yeji-batch-query-btn {
    order: initial;
}
.yeji-main-action-stack .yeji-field-config-btn {
    order: initial;
}
.yeji-field-modal {
    position: fixed;
    inset: 0;
    z-index: 9850;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
}
.yeji-field-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, .36);
}
.yeji-field-dialog {
    position: relative;
    z-index: 1;
    width: min(820px, calc(100vw - 36px));
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 16px 48px rgba(15, 23, 42, .24);
    overflow: hidden;
}
.yeji-field-config-dialog {
    height: min(720px, 90vh);
}
.yeji-field-header {
    height: 48px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--yeji-border);
    background: #f8fafc;
}
.yeji-field-title {
    color: var(--yeji-text);
    font-size: 15px;
    font-weight: 700;
}
.yeji-field-close {
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--yeji-text-secondary);
    cursor: pointer;
}
.yeji-field-close:hover {
    background: #eef2f7;
    color: var(--yeji-text);
}
.yeji-field-body {
    flex: 1;
    min-height: 0;
    padding: 12px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.yeji-field-loading {
    min-height: 180px;
    color: var(--yeji-text-secondary);
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.yeji-field-section {
    flex: 1 1 0;
    min-height: 0;
    padding: 8px;
    border: 1px solid var(--yeji-border);
    border-radius: 8px;
    background: #fff;
    display: flex;
    flex-direction: column;
}
.yeji-field-section-title {
    flex-shrink: 0;
    margin-bottom: 8px;
    color: var(--yeji-text);
    font-size: 12px;
    font-weight: 700;
}
.yeji-field-grid {
    flex: 1;
    min-height: 0;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding-right: 2px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    align-content: start;
    gap: 6px;
}
.yeji-field-item {
    min-width: 0;
    height: 30px;
    padding: 0 8px;
    border: 1px solid var(--yeji-border);
    border-radius: 6px;
    background: #fff;
    color: var(--yeji-text);
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
}
.yeji-field-item:hover {
    border-color: var(--yeji-primary);
    background: #f8fbff;
}
.yeji-field-item input {
    display: none;
}
.yeji-field-check {
    width: 12px;
    height: 12px;
    border: 1px solid #b8c2d1;
    border-radius: 3px;
    box-sizing: border-box;
    flex-shrink: 0;
}
.yeji-field-item input:checked + .yeji-field-check {
    border-color: var(--yeji-primary);
    background: var(--yeji-primary);
    box-shadow: inset 0 0 0 2px #fff;
}
.yeji-field-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.yeji-field-empty {
    grid-column: 1 / -1;
    padding: 20px 0;
    color: var(--yeji-text-secondary);
    font-size: 12px;
    text-align: center;
}
.yeji-field-footer {
    min-height: 48px;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    border-top: 1px solid var(--yeji-border);
    background: #fff;
}
.yeji-batch-modal[hidden] { display: none; }
.yeji-batch-modal {
    position: fixed;
    inset: 0;
    z-index: 9700;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
}
.yeji-batch-modal-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, .36);
}
.yeji-batch-dialog {
    position: relative;
    z-index: 1;
    width: max-content;
    max-width: min(80vw, calc(100vw - 36px));
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 16px 48px rgba(15, 23, 42, .24);
    overflow: visible;
}
.yeji-batch-header {
    height: 48px;
    padding: 0 16px;
    min-width: 0;
    max-width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--yeji-border);
    background: #f8fafc;
}
.yeji-batch-title {
    color: var(--yeji-text);
    font-size: 15px;
    font-weight: 700;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
}
.yeji-batch-title > span,
.yeji-trend-title > span {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.yeji-batch-title small {
    min-width: 0;
    color: var(--yeji-text-secondary);
    font-size: 12px;
    font-weight: 400;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.yeji-modal-actions-wrap {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}
.yeji-modal-actions {
    display: flex;
    align-items: center;
    gap: 4px;
}
.yeji-modal-action-btn,
.yeji-batch-close,
.yeji-trend-close {
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--yeji-text-secondary);
    cursor: pointer;
    flex-shrink: 0;
}
.yeji-modal-action-btn:hover,
.yeji-batch-close:hover,
.yeji-trend-close:hover {
    background: #eef2f7;
    color: var(--yeji-text);
}
.yeji-modal-action-btn:disabled {
    cursor: not-allowed;
    opacity: .65;
}
.yeji-batch-body {
    flex: 1;
    min-height: 0;
    max-height: calc(80vh - 48px);
    max-width: 100%;
    padding: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.yeji-batch-table-area {
    flex: 1;
    min-height: 0;
    max-height: 100%;
    max-width: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
}
.yeji-batch-table-wrap {
    flex: 1;
    min-height: 0;
    max-height: 100%;
    max-width: 100%;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
}
.yeji-batch-dialog.yeji-modal-fullscreen,
.yeji-trend-dialog.yeji-modal-fullscreen {
    width: calc(100vw - 24px);
    max-width: calc(100vw - 24px);
    height: calc(100vh - 24px);
    max-height: calc(100vh - 24px);
}
.yeji-batch-dialog.yeji-modal-fullscreen .yeji-batch-body,
.yeji-trend-dialog.yeji-modal-fullscreen .yeji-trend-body {
    max-height: none;
}
.yeji-table-capture-shell {
    display: inline-block;
    background: #fff;
}
.yeji-table-capture-shell .yeji-batch-merge-toggle,
.yeji-table-capture-shell .yeji-batch-merge-toggle span,
.yeji-table-capture-shell .yeji-batch-child-name,
.yeji-table-capture-shell .yeji-trend-table td:last-child {
    max-width: none;
    overflow: visible;
    text-overflow: clip;
    white-space: nowrap;
}
.yeji-table-capture-shell .yeji-batch-table th:first-child,
.yeji-table-capture-shell .yeji-batch-table td:first-child {
    position: static;
    left: auto;
    z-index: auto;
}
.yeji-batch-status {
    height: 46px;
    margin: 10px -12px -12px;
    padding: 0 14px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: var(--yeji-text-secondary);
    font-size: 12px;
    line-height: 1;
    border-top: 1px solid var(--yeji-border);
}
.yeji-batch-status span {
    display: inline-flex;
    align-items: center;
    min-height: 26px;
    line-height: 1;
}
.yeji-target-picker {
    position: relative;
    flex-shrink: 0;
}
.yeji-target-picker-btn {
    max-width: 240px;
    height: 26px;
    padding: 0 10px;
    box-sizing: border-box;
    border: 1px solid var(--yeji-primary);
    border-radius: 5px;
    background: #fff;
    color: var(--yeji-primary);
    font-size: 12px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    line-height: 1;
    white-space: nowrap;
}
.yeji-target-picker-btn span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.yeji-target-picker-menu[hidden] {
    display: none;
}
.yeji-target-picker-menu {
    position: absolute;
    left: 0;
    bottom: calc(100% + 6px);
    z-index: 30;
    width: max-content;
    min-width: 128px;
    max-width: calc(100vw - 36px);
    max-height: 50vh;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 4px;
    box-sizing: border-box;
    border: 1px solid var(--yeji-border);
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 10px 28px rgba(15, 23, 42, .18);
}
.yeji-target-picker-item {
    width: max-content;
    min-width: 118px;
    max-width: calc(100vw - 56px);
    height: 30px;
    padding: 0 4px 0 10px;
    border-radius: 6px;
    color: var(--yeji-text);
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.yeji-target-picker-item:hover,
.yeji-target-picker-item.active {
    background: #f0f5ff;
    color: var(--yeji-primary);
}
.yeji-target-picker-item span {
    min-width: 0;
    max-width: min(320px, calc(100vw - 96px));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.yeji-target-picker-del {
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.yeji-target-picker-del:hover {
    background: #e8efff;
}
.yeji-target-picker-empty {
    padding: 14px 18px;
    color: var(--yeji-text-secondary);
    font-size: 12px;
    text-align: center;
    white-space: nowrap;
}
.yeji-batch-actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 26px;
    flex-shrink: 0;
}
.yeji-batch-icon-btn {
    width: 26px;
    height: 26px;
    padding: 0;
    box-sizing: border-box;
    border: 1px solid var(--yeji-primary);
    border-radius: 5px;
    background: #fff;
    color: var(--yeji-primary);
    font-size: 12px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
}
.yeji-batch-icon-btn:disabled {
    opacity: .55;
    cursor: not-allowed;
}
.yeji-batch-table th:first-child,
.yeji-batch-table td:first-child {
    position: sticky;
    left: 0;
    z-index: 2;
    background: #fff;
}
.yeji-batch-table th:first-child {
    background: #f8fafc;
    z-index: 3;
}
.yeji-loading-cell {
    color: var(--yeji-primary);
    text-align: center;
}
.yeji-target-edit-cell {
    cursor: text;
}
.yeji-target-edit-cell.editing {
    padding: 4px 6px;
}
.yeji-target-edit-input {
    width: 96px;
    max-width: 100%;
    height: 24px;
    padding: 0 6px;
    box-sizing: border-box;
    border: 1px solid var(--yeji-primary);
    border-radius: 4px;
    outline: none;
    color: var(--yeji-text);
    font: inherit;
    text-align: right;
    background: #fff;
}
.yeji-batch-table td[data-trend-entry] {
    cursor: pointer;
}
.yeji-trend-entry-value {
    text-decoration: underline;
    text-decoration-style: dotted;
    text-underline-offset: 3px;
}
.yeji-trend-modal {
    position: fixed;
    inset: 0;
    z-index: 9800;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
}
.yeji-trend-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, .30);
}
.yeji-trend-dialog {
    position: relative;
    z-index: 1;
    width: max-content;
    max-width: min(80vw, calc(100vw - 36px));
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 16px 48px rgba(15, 23, 42, .22);
    overflow: hidden;
}
.yeji-trend-header {
    height: 48px;
    flex: 0 0 48px;
    padding: 0 16px;
    box-sizing: border-box;
    min-width: 0;
    max-width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 1px solid var(--yeji-border);
    background: #f8fafc;
}
.yeji-trend-title {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--yeji-text);
    font-size: 15px;
    font-weight: 700;
}
.yeji-trend-title small {
    min-width: 0;
    color: var(--yeji-text-secondary);
    font-size: 12px;
    font-weight: 400;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.yeji-trend-checking {
    margin-left: 6px;
    color: var(--yeji-text-secondary);
    font-size: 12px;
    font-weight: 400;
}
.yeji-trend-body {
    flex: 1 1 auto;
    min-height: 0;
    max-height: calc(80vh - 48px);
    max-width: 100%;
    padding: 12px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.yeji-trend-table-wrap {
    flex: 1;
    min-height: 0;
    max-height: 100%;
    max-width: 100%;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
}
.yeji-trend-table th,
.yeji-trend-table td {
    white-space: nowrap;
}
.yeji-trend-table td:last-child {
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
}
.yeji-trend-table td.yeji-trend-rate-action {
    min-width: 280px;
    max-width: none;
    white-space: normal;
    line-height: 1.45;
    overflow: visible;
    text-overflow: clip;
}
.yeji-trend-ai-btn {
    position: absolute;
    right: 14px;
    bottom: 14px;
    z-index: 3;
    width: 38px;
    height: 38px;
    border: none;
    border-radius: 50%;
    background: var(--yeji-primary);
    color: #fff;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0;
    cursor: pointer;
    box-shadow: 0 8px 20px rgba(37, 99, 235, .28);
}
.yeji-trend-ai-btn:hover {
    background: #1d4ed8;
}
.yeji-trend-ai-panel {
    position: fixed;
    right: 49px;
    top: auto;
    bottom: 49px;
    z-index: 10040;
    width: min(360px, calc(100% - 28px));
    height: min(620px, calc(100vh - 64px));
    max-height: calc(100vh - 64px);
    display: flex;
    flex-direction: column;
    border: 1px solid var(--yeji-border);
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 14px 36px rgba(15, 23, 42, .18);
    overflow: hidden;
}
.yeji-trend-ai-header {
    height: 38px;
    padding: 0 10px 0 12px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--yeji-border);
    background: #f8fafc;
    color: var(--yeji-text);
    font-size: 13px;
    font-weight: 700;
}
.yeji-trend-ai-header button {
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--yeji-text-secondary);
    cursor: pointer;
}
.yeji-trend-ai-header button:hover {
    background: #eef2f7;
    color: var(--yeji-text);
}
.yeji-trend-ai-messages {
    flex: 1 1 auto;
    min-height: 180px;
    padding: 10px;
    box-sizing: border-box;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    background: #fff;
}
.yeji-trend-ai-empty {
    height: 100%;
    min-height: 130px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--yeji-text-secondary);
    font-size: 12px;
    text-align: center;
}
.yeji-trend-ai-message {
    display: flex;
    margin-bottom: 8px;
    font-size: 12px;
    line-height: 1.6;
}
.yeji-trend-ai-message > div {
    max-width: 88%;
    padding: 7px 9px;
    border-radius: 7px;
    box-sizing: border-box;
    word-break: break-word;
}
.yeji-trend-ai-message.user {
    justify-content: flex-end;
}
.yeji-trend-ai-message.user > div {
    background: var(--yeji-primary);
    color: #fff;
}
.yeji-trend-ai-message.assistant > div {
    background: #f1f5f9;
    color: var(--yeji-text);
}
.yeji-trend-ai-message.status > div {
    background: #f8fafc;
    color: var(--yeji-text-secondary);
}
.yeji-trend-ai-message.error > div {
    background: #fef2f2;
    color: #b91c1c;
}
.yeji-trend-ai-compose {
    flex-shrink: 0;
    padding: 8px;
    box-sizing: border-box;
    display: flex;
    align-items: flex-end;
    gap: 8px;
    border-top: 1px solid var(--yeji-border);
    background: #f8fafc;
}
.yeji-trend-ai-compose textarea {
    flex: 1 1 auto;
    min-height: 32px;
    max-height: 196px;
    padding: 7px 9px;
    box-sizing: border-box;
    border: 1px solid var(--yeji-border);
    border-radius: 6px;
    outline: none;
    resize: none;
    color: var(--yeji-text);
    font: inherit;
    font-size: 12px;
    line-height: 1.5;
    background: #fff;
    overflow-y: hidden;
    scrollbar-width: thin;
}
.yeji-trend-ai-compose textarea:focus {
    border-color: var(--yeji-primary);
}
.yeji-trend-ai-compose button {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border: none;
    border-radius: 6px;
    background: var(--yeji-primary);
    color: #fff;
    cursor: pointer;
}
.yeji-trend-ai-compose button.stop {
    background: #dc2626;
}
.yeji-trend-ai-compose button.stop:hover {
    background: #b91c1c;
}
.yeji-trend-ai-compose button:disabled {
    cursor: not-allowed;
    opacity: .72;
}
.yeji-bi-ai-panel {
    position: fixed;
    right: 49px;
    top: auto;
    bottom: 49px;
    z-index: 2147483001;
    width: min(360px, calc(100vw - 64px));
    height: min(620px, calc(100vh - 64px));
    max-height: calc(100vh - 64px);
    display: flex;
    flex-direction: column;
    border: 1px solid var(--yeji-border);
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 14px 36px rgba(15, 23, 42, .18);
    overflow: hidden;
    pointer-events: auto;
}
.yeji-batch-merge-toggle {
    max-width: 260px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--yeji-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    line-height: 1;
}
.yeji-batch-merge-toggle span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.yeji-batch-merge-toggle i {
    color: var(--yeji-primary);
    font-size: 11px;
    flex-shrink: 0;
}
.yeji-batch-child-name {
    position: relative;
    display: inline-block;
    padding-left: 18px;
    color: var(--yeji-text-secondary);
}
.yeji-batch-child-name::before {
    content: "";
    position: absolute;
    left: 6px;
    top: 50%;
    width: 6px;
    height: 1px;
    background: #9ca3af;
}
.yeji-target-modal {
    position: fixed;
    inset: 0;
    z-index: 9900;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
}
.yeji-target-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, .36);
}
.yeji-target-dialog {
    position: relative;
    z-index: 1;
    width: min(307px, calc(100vw - 36px));
    max-height: min(420px, 90vh);
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 16px 48px rgba(15, 23, 42, .24);
    overflow: hidden;
}
.yeji-target-header {
    height: 48px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--yeji-border);
    background: #f8fafc;
}
.yeji-target-title {
    color: var(--yeji-text);
    font-size: 15px;
    font-weight: 700;
}
.yeji-target-close {
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--yeji-text-secondary);
    cursor: pointer;
}
.yeji-target-close:hover {
    background: #eef2f7;
    color: var(--yeji-text);
}
.yeji-target-body {
    flex: none;
    min-height: 0;
    display: flex;
}
.yeji-target-main {
    position: relative;
    flex: 1;
    min-width: 0;
    padding: 16px;
    display: flex;
    align-items: stretch;
}
.yeji-target-upload {
    flex: 1;
    width: 100%;
    min-height: 150px;
    border: 1px dashed #b8c2d1;
    border-radius: 8px;
    background: #fbfdff;
    color: var(--yeji-text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 10px;
    font-size: 13px;
}
.yeji-target-upload i {
    color: var(--yeji-primary);
    font-size: 26px;
}
.yeji-target-upload.dragover {
    border-color: var(--yeji-primary);
    background: #f2f7ff;
    color: var(--yeji-primary);
}
.yeji-target-upload.disabled {
    opacity: .55;
    cursor: not-allowed;
    pointer-events: none;
}
.yeji-target-uploading {
    position: absolute;
    inset: 16px;
    border-radius: 8px;
    background: rgba(255, 255, 255, .82);
    color: var(--yeji-text-secondary);
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
}
.yeji-target-footer {
    min-height: 48px;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-top: 1px solid var(--yeji-border);
    background: #fff;
}
.yeji-target-actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}
.yeji-filter-modal[hidden] { display: none; }
.yeji-filter-modal {
    position: fixed;
    inset: 0;
    z-index: 9800;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
}
.yeji-filter-modal-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, .36);
}
.yeji-filter-dialog {
    position: relative;
    z-index: 1;
    width: min(920px, calc(100vw - 36px));
    max-height: min(620px, 90vh);
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 16px 48px rgba(15, 23, 42, .24);
    overflow: hidden;
}
.yeji-filter-dialog-header {
    height: 48px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--yeji-border);
    background: #f8fafc;
}
.yeji-filter-dialog-title {
    color: var(--yeji-text);
    font-size: 15px;
    font-weight: 700;
}
.yeji-filter-dialog-close {
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--yeji-text-secondary);
    cursor: pointer;
}
.yeji-filter-dialog-close:hover {
    background: #eef2f7;
    color: var(--yeji-text);
}
.yeji-filter-dialog-body {
    flex: 1;
    min-height: 0;
    padding: 16px;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    scrollbar-width: thin;
}
.yeji-filter-dialog-footer {
    min-height: 48px;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-top: 1px solid var(--yeji-border);
    background: #fff;
}
.yeji-filter-dialog-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}
.yeji-filter-modal-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-template-rows: repeat(5, 64px);
    gap: 12px;
}
.yeji-filter-cell {
    position: relative;
    display: flex;
    align-items: stretch;
    justify-content: flex-start;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
}
.yeji-filter-cell-label {
    min-width: 0;
    max-width: none;
    color: var(--yeji-text-secondary);
    font-size: 12px;
    line-height: 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.yeji-filter-chip {
    flex: 1;
    width: 100%;
    min-width: 0;
    max-width: none;
    height: 34px;
    max-height: 34px;
    padding: 0 8px;
    border: 1px solid var(--yeji-border);
    border-radius: var(--yeji-radius);
    background: #fff;
    color: var(--yeji-text);
    font-size: 12px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
}
.yeji-filter-chip:hover,
.yeji-filter-chip.open,
.yeji-filter-chip.has-value {
    border-color: var(--yeji-primary);
    color: var(--yeji-primary);
    background: #f0f5ff;
}
.yeji-filter-cell.quick-locked .yeji-filter-cell-label {
    color: var(--yeji-primary);
}
.yeji-filter-cell.quick-locked .yeji-filter-chip,
.yeji-filter-cell.quick-locked .yeji-filter-chip:disabled {
    border-color: #bfdbfe;
    color: var(--yeji-primary);
    background: #eff6ff;
    cursor: not-allowed;
    opacity: 1;
}
.yeji-filter-chip-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.yeji-filter-chip-clear {
    display: none;
    color: #9ca3af;
    font-size: 11px;
}
.yeji-filter-chip.has-value:hover .fa-caret-down { display: none; }
.yeji-filter-chip.has-value:hover .yeji-filter-chip-clear { display: inline; }
.yeji-filter-popover {
    position: fixed;
    z-index: 9900;
    width: max-content;
    max-width: calc(100vw - 24px);
    max-height: min(430px, 70vh);
    border: 1px solid var(--yeji-border);
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 8px 28px rgba(0, 0, 0, .16);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}
.yeji-filter-popover[hidden] { display: none; }
.yeji-filter-popover-head,
.yeji-filter-toolbar,
.yeji-filter-batch,
.yeji-filter-footer {
    padding: 8px 10px;
    border-bottom: 1px solid #eef1f5;
}
.yeji-filter-footer {
    border-top: 1px solid #eef1f5;
    border-bottom: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.yeji-filter-toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--yeji-text-secondary);
    font-size: 12px;
}
.yeji-filter-toolbar label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
}
.yeji-filter-count {
    margin-left: auto;
    color: var(--yeji-primary);
    font-size: 11px;
    white-space: nowrap;
}
.yeji-filter-input,
.yeji-filter-textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    color: var(--yeji-text);
    font-size: 12px;
    outline: none;
}
.yeji-filter-input {
    height: 30px;
    padding: 0 8px;
}
.yeji-filter-textarea {
    min-height: 80px;
    padding: 8px;
    resize: vertical;
}
.yeji-date-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.yeji-filter-options {
    max-height: 230px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 4px 0;
}
.yeji-filter-option,
.yeji-tree-row {
    min-height: 28px;
    padding: 4px 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--yeji-text);
    cursor: pointer;
}
.yeji-filter-option:hover,
.yeji-tree-row:hover { background: #f8fafc; }
.yeji-filter-option span,
.yeji-tree-row span {
    max-width: min(520px, calc(100vw - 96px));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.yeji-filter-check {
    width: 13px;
    height: 13px;
    margin: 0;
    flex-shrink: 0;
    accent-color: var(--yeji-primary);
}
.yeji-filter-check.partial {
    appearance: none;
    -webkit-appearance: none;
    border: 1px solid var(--yeji-primary);
    border-radius: 2px;
    background: var(--yeji-primary);
}
.yeji-tree-check {
    width: 13px;
    height: 13px;
    margin: 0;
    flex-shrink: 0;
    accent-color: var(--yeji-primary);
}
.yeji-tree-check.partial {
    appearance: none;
    -webkit-appearance: none;
    border: 1px solid var(--yeji-primary);
    border-radius: 2px;
    background: var(--yeji-primary);
}
.yeji-tree-toggle {
    width: 14px;
    text-align: center;
    color: #9ca3af;
    cursor: pointer;
    flex-shrink: 0;
}
.yeji-filter-empty {
    padding: 24px 12px;
    text-align: center;
    color: var(--yeji-text-secondary);
    font-size: 12px;
}
.yeji-filter-mini {
    height: 26px;
    padding: 0 10px;
    border: 1px solid var(--yeji-border);
    border-radius: 5px;
    background: #fff;
    color: var(--yeji-text);
    font-size: 12px;
    cursor: pointer;
}
.yeji-filter-mini:disabled,
.yeji-target-close:disabled {
    opacity: .55;
    cursor: not-allowed;
}
.yeji-filter-mini.primary {
    border-color: var(--yeji-primary);
    background: var(--yeji-primary);
    color: #fff;
}
.yeji-filter-mini.link {
    border-color: var(--yeji-primary);
    color: var(--yeji-primary);
}
.yeji-tpl-item.active {
    background: #f0f5ff;
    color: var(--yeji-primary);
}
.yeji-tpl-name {
    display: flex;
    align-items: center;
    gap: 6px;
}
.yeji-tpl-del {
    border: none;
    background: transparent;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.yeji-tpl-dialog {
    width: 300px;
    padding: 20px;
}
.yeji-tpl-dialog-row {
    align-items: stretch;
}
.yeji-tpl-dialog-input {
    flex: 1;
    min-width: 0;
    height: 40px;
}
.yeji-tpl-dialog-cancel,
.yeji-tpl-dialog-ok {
    height: 40px;
    padding: 0 18px;
    border-radius: 8px;
    border: none;
    color: #fff;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
}
.yeji-tpl-dialog-cancel {
    background: #ff4d4f;
}
.yeji-tpl-dialog-ok {
    background: var(--yeji-primary);
}
@media screen and (max-width: 480px) {
    .yeji-filter-modal {
        padding: 10px;
        align-items: center;
    }
    .yeji-filter-dialog {
        width: 100%;
        max-height: 90vh;
    }
    .yeji-global-action-stack {
        right: 8px;
        bottom: 8px;
        gap: 8px;
    }
    .yeji-global-action-stack .yeji-batch-query-btn,
    .yeji-global-action-stack .yeji-field-config-btn,
    .yeji-main-action-stack .yeji-batch-query-btn,
    .yeji-main-action-stack .yeji-field-config-btn,
    .yeji-batch-query-btn {
        width: 32px;
        height: 32px;
        font-size: 13px;
    }
    .yeji-field-config-btn {
        width: 32px;
        height: 32px;
        font-size: 13px;
    }
    .yeji-bi-ai-btn {
        width: 32px;
        height: 32px;
        font-size: 11px;
    }
    .yeji-bi-ai-panel {
        right: 45px;
        bottom: 45px;
        width: min(360px, calc(100vw - 20px));
        height: min(620px, calc(100vh - 55px));
        max-height: calc(100vh - 55px);
    }
    .yeji-batch-dialog {
        width: max-content;
        max-width: min(80vw, calc(100vw - 20px));
        max-height: 80vh;
    }
    .yeji-trend-dialog {
        width: max-content;
        max-width: min(80vw, calc(100vw - 20px));
        max-height: 80vh;
    }
    .yeji-batch-title {
        gap: 6px;
    }
    .yeji-batch-title small {
        max-width: 46vw;
    }
    .yeji-batch-body {
        max-height: calc(80vh - 48px);
        padding: 10px;
    }
    .yeji-trend-body {
        max-height: calc(80vh - 48px);
        padding: 10px;
    }
    .yeji-batch-status {
        margin: 10px -10px -10px;
        padding: 0 10px;
        gap: 8px;
    }
    .yeji-target-picker-btn {
        max-width: 118px;
        padding: 0 8px;
    }
    .yeji-target-picker-menu {
        max-width: calc(100vw - 28px);
    }
    .yeji-target-picker-item {
        max-width: calc(100vw - 48px);
    }
    .yeji-target-dialog {
        width: 100%;
        max-height: 90vh;
    }
    .yeji-target-main {
        padding: 12px;
    }
    .yeji-target-upload {
        min-height: 132px;
    }
    .yeji-field-dialog {
        width: 100%;
        max-height: 90vh;
    }
    .yeji-field-body {
        padding: 12px;
    }
    .yeji-field-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .yeji-filter-dialog-body { padding: 12px; }
    .yeji-quick-selector-wrap {
        width: 76px;
        height: 32px;
    }
    .yeji-quick-selector-btn {
        height: 32px;
        font-size: 12px;
        padding: 0 20px;
    }
    .yeji-quick-selector-arrow {
        right: 8px;
    }
    .yeji-quick-selector-panel {
        width: 76px;
    }
    .yeji-quick-option {
        height: 24px;
        font-size: 11px;
    }
    .yeji-filter-modal-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-template-rows: none;
        gap: 10px;
    }
    .yeji-filter-chip {
        height: 32px;
        max-height: 32px;
    }
}
        `;
        document.head.appendChild(style);
    }
};

window.YejiUltraYangshi = YejiUltraYangshi;
