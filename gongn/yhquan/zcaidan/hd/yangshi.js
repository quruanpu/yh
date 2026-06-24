/**
 * Coupon module - shared popup styles
 */
const HdYangshi = {
    styleId: 'yhquan-hd-styles',

    getStyles() {
        return `
/* Modal container */
.yhquan-hd-modal {
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

/* Overlay */
.yhquan-hd-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
}

/* Popup content */
.yhquan-hd-content {
    position: relative;
    background: white;
    border-radius: 8px;
    width: 85%;
    max-width: 400px;
    max-height: calc(100vh - 48px);
    max-height: min(800px, calc(100vh - 48px));
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

/* Popup header */
.yhquan-hd-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #e5e7eb;
    flex: 0 0 auto;
}

.yhquan-hd-title {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    display: flex;
    align-items: center;
    gap: 8px;
}

.yhquan-hd-title i {
    color: #3b82f6;
}

.yhquan-hd-close {
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

.yhquan-hd-close:hover {
    background: #e5e7eb;
}

.yhquan-hd-close i {
    font-size: 14px;
    color: #6b7280;
}

/* Popup main body */
.yhquan-hd-body {
    flex: 0 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 12px;
}

/* Section */
.yhquan-hd-section {
    margin-bottom: 12px;
}

.yhquan-hd-section:last-child {
    margin-bottom: 0;
}

.yhquan-hd-section-title {
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    color: #374151;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
}

.yhquan-hd-section-title > span {
    display: inline-flex;
    align-items: center;
    line-height: 16px;
}

/* Coupon info */
.yhquan-hd-info-grid {
    background: #f9fafb;
    border-radius: 6px;
    padding: 8px;
}

.yhquan-hd-info-row {
    display: flex;
    margin-bottom: 5px;
    font-size: 11px;
}

.yhquan-hd-info-row:last-child {
    margin-bottom: 0;
}

.yhquan-hd-info-label {
    color: #6b7280;
    min-width: 50px;
    flex-shrink: 0;
}

.yhquan-hd-info-value {
    color: #111827;
    flex: 1;
}

/* Input field */
.yhquan-hd-input {
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

/* Quantity row */
.yhquan-hd-limit-row {
    display: flex;
    gap: 10px;
}

.yhquan-hd-limit-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.yhquan-hd-limit-label {
    font-size: 10px;
    color: #6b7280;
}

.yhquan-hd-input:focus {
    border-color: #3b82f6;
}

.yhquan-hd-input:hover {
    border-color: #9ca3af;
}

/* Dropdown selector */
.yhquan-hd-select-wrap {
    position: relative;
}

.yhquan-hd-select {
    width: 100%;
    height: 32px;
    padding: 0 10px;
    padding-right: 28px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 12px;
    outline: none;
    transition: all 0.2s;
    background: white;
    box-sizing: border-box;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
}

.yhquan-hd-select:focus {
    border-color: #3b82f6;
}

.yhquan-hd-select:hover {
    border-color: #9ca3af;
}

.yhquan-hd-select-icon {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 10px;
    color: #6b7280;
    pointer-events: none;
    transition: color 0.2s;
}

.yhquan-hd-select-wrap:hover .yhquan-hd-select-icon {
    color: #374151;
}

.yhquan-hd-select-wrap:focus-within .yhquan-hd-select-icon {
    color: #2563eb;
}

.yhquan-hd-select:disabled + .yhquan-hd-select-icon {
    color: #9ca3af;
}

/* Icon buttons */
.yhquan-hd-icon-btn {
    width: 12px;
    height: 12px;
    padding: 0;
    border: none;
    border-radius: 0;
    background: transparent;
    color: #9ca3af;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: color 0.2s;
    flex-shrink: 0;
    line-height: 1;
}

.yhquan-hd-icon-btn:hover {
    color: #2563eb;
}

.yhquan-hd-icon-btn i {
    font-size: 9px;
    line-height: 1;
    display: block;
}

/* Activity row */
.yhquan-hd-activity-row {
    display: flex;
    align-items: center;
    gap: 6px;
    position: relative;
}

.yhquan-hd-activity-trigger,
.yhquan-hd-activity-name-input {
    flex: 1;
    min-width: 0;
}

.yhquan-hd-activity-trigger {
    height: 32px;
    padding: 0 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: white;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    color: #111827;
    font-size: 12px;
}

.yhquan-hd-activity-trigger:disabled {
    cursor: not-allowed;
    background: #f9fafb;
    color: #9ca3af;
}

.yhquan-hd-activity-trigger:disabled i {
    color: #9ca3af;
}

.yhquan-hd-activity-trigger.open {
    border-color: #3b82f6;
}

.yhquan-hd-activity-trigger-text {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.yhquan-hd-activity-menu {
    display: none;
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 40px;
    max-height: 240px;
    overflow-y: auto;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #fff;
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.12);
    z-index: 12;
}

.yhquan-hd-activity-menu.open {
    display: block;
}

.yhquan-hd-activity-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 8px;
    font-size: 11px;
    color: #374151;
    cursor: pointer;
}

.yhquan-hd-activity-item:hover {
    background: #f9fafb;
}

.yhquan-hd-activity-item.active {
    background: #eff6ff;
    color: #1d4ed8;
}

.yhquan-hd-activity-item-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.yhquan-hd-activity-delete {
    width: auto;
    height: auto;
    border: none;
    border-radius: 0;
    background: transparent;
    color: #9ca3af;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.2s;
}

.yhquan-hd-activity-delete:hover {
    color: #ef4444;
}

.yhquan-hd-activity-empty {
    padding: 8px;
    color: #9ca3af;
    font-size: 11px;
}

.yhquan-hd-plus-btn {
    width: 32px;
    height: 32px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #fff;
    color: #6b7280;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.yhquan-hd-plus-btn:hover {
    background: #eff6ff;
    border-color: #60a5fa;
    color: #2563eb;
}


/* Popup footer */
.yhquan-hd-footer {
    padding: 10px 14px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex: 0 0 auto;
}

.yhquan-hd-footer-left {
    display: flex;
    gap: 8px;
}

.yhquan-hd-footer-right {
    display: flex;
    gap: 8px;
}

/* Action menu */
.yhquan-hd-btn {
    height: 28px;
    padding: 0 16px;
    border: none;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.yhquan-hd-btn-primary {
    background: #3b82f6;
    color: white;
}

.yhquan-hd-btn-primary:hover {
    background: #2563eb;
}

.yhquan-hd-btn-secondary {
    background: #f3f4f6;
    color: #374151;
}

.yhquan-hd-btn-secondary:hover {
    background: #e5e7eb;
}

.yhquan-hd-btn-danger {
    background: #ef4444;
    color: white;
}

.yhquan-hd-btn-danger:hover {
    background: #dc2626;
}

.yhquan-hd-btn-success {
    background: #10b981;
    color: white;
}

.yhquan-hd-btn-success:hover {
    background: #059669;
}

.yhquan-hd-btn-warning {
    background: #f59e0b;
    color: white;
}

.yhquan-hd-btn-warning:hover {
    background: #d97706;
}

.yhquan-hd-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
    opacity: 0.6;
}

.yhquan-hd-btn.loading {
    position: relative;
    color: transparent;
    pointer-events: none;
}

.yhquan-hd-btn.loading::after {
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

/* Multi-select tag container */
.yhquan-hd-chips,
.yhquan-hd-area-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

/* Collapse header row */
.yhquan-hd-collapse-header {
    display: flex;
    align-items: center;
    gap: 6px;
}

/* Collapse content box */
.yhquan-hd-collapse-body {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding-top: 2px;
    max-height: 120px;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
}

/* Expand/collapse button */
.yhquan-hd-expand-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background: #f3f4f6;
    color: #6b7280;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;
    flex-shrink: 0;
}

.yhquan-hd-expand-btn:hover {
    background: #e5e7eb;
    color: #374151;
}

/* Summary text */
.yhquan-hd-collapse-summary {
    font-size: 9px;
    color: #9ca3af;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Loading hint */
.yhquan-hd-collapse-loading {
    font-size: 9px;
    color: #9ca3af;
    padding: 4px 0;
}

.yhquan-hd-chip {
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

.yhquan-hd-chip:hover {
    border-color: #93c5fd;
    background: #eff6ff;
}

.yhquan-hd-chip.active {
    border-color: #3b82f6;
    background: #dbeafe;
    color: #1d4ed8;
    font-weight: 500;
}

/* Date row */
.yhquan-hd-date-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) 32px;
    align-items: center;
    gap: 6px;
    width: 100%;
}

.yhquan-hd-date-input {
    width: 100%;
    min-width: 0;
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

.yhquan-hd-date-input:focus {
    border-color: #3b82f6;
}

.yhquan-hd-date-sep {
    color: #9ca3af;
    font-size: 12px;
    flex-shrink: 0;
}

.yhquan-hd-time-setting-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: #fff;
    color: #6b7280;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s, background 0.2s;
}

.yhquan-hd-time-setting-btn:hover {
    border-color: #9ca3af;
    color: #2563eb;
    background: #f9fafb;
}

.yhquan-hd-time-setting-btn:disabled {
    cursor: not-allowed;
    color: #c7ccd3;
    border-color: #e5e7eb;
    background: #f9fafb;
}

.yhquan-hd-time-setting-btn i {
    font-size: 12px;
    line-height: 1;
}

/* Hint text */
.yhquan-hd-hint {
    font-size: 10px;
    color: #9ca3af;
    margin-top: 4px;
    line-height: 1.4;
}

/* Mobile adaptation */
/* Confirm popup */
.yhquan-hd-confirm-mask {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 10020;
    display: flex;
    align-items: center;
    justify-content: center;
}

.yhquan-hd-confirm-box {
    width: min(320px, 90%);
    background: #fff;
    border-radius: 8px;
    padding: 12px;
    box-sizing: border-box;
}

.yhquan-hd-confirm-title {
    font-size: 13px;
    font-weight: 600;
    color: #111827;
}

.yhquan-hd-confirm-text {
    margin-top: 8px;
    font-size: 12px;
    color: #4b5563;
}

.yhquan-hd-confirm-actions {
    margin-top: 12px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

@media (max-width: 768px) {
    .yhquan-hd-content {
        width: 85%;
        max-height: calc(100vh - 32px);
        max-height: min(800px, calc(100vh - 32px));
    }

    .yhquan-hd-body {
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        -ms-overflow-style: none;
    }

    .yhquan-hd-body::-webkit-scrollbar {
        display: none;
    }

    /* No extra styles */
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

window.HdYangshi = HdYangshi;

