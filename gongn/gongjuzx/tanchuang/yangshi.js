// 工具中心模块 - 弹窗样式注入
const GongjuzxTanchuangYangshi = {
    styleId: 'gongjuzx-modal-style',

    inject() {
        if (document.getElementById(this.styleId)) return;

        const style = document.createElement('style');
        style.id = this.styleId;
        style.textContent = `
            .gongjuzx-modal {
                position: fixed;
                inset: 0;
                z-index: 10010;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .gongjuzx-modal-overlay {
                position: absolute;
                inset: 0;
                background: rgba(15, 23, 42, 0.35);
                backdrop-filter: blur(1px);
            }

            .gongjuzx-modal-content {
                position: relative;
                width: min(500px, calc(100vw - 28px));
                max-height: min(90vh, 680px);
                overflow: hidden;
                border-radius: 12px;
                background: #ffffff;
                box-shadow: 0 12px 36px rgba(0, 0, 0, 0.2);
                display: flex;
                flex-direction: column;
            }

            .gongjuzx-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 14px 16px;
                border-bottom: 1px solid #eef1f5;
            }

            .gongjuzx-modal-title {
                margin: 0;
                font-size: 15px;
                font-weight: 600;
                color: #111827;
            }

            .gongjuzx-modal-close {
                border: none;
                background: transparent;
                width: 30px;
                height: 30px;
                border-radius: 8px;
                cursor: pointer;
                color: #6b7280;
            }

            .gongjuzx-modal-close:hover {
                background: #f3f4f6;
                color: #374151;
            }

            .gongjuzx-modal-body {
                padding: 16px;
                overflow: auto;
            }

            .gongjuzx-form-item {
                margin-bottom: 14px;
            }

            .gongjuzx-form-item:last-child {
                margin-bottom: 0;
            }

            .gongjuzx-form-label {
                display: block;
                margin-bottom: 7px;
                font-size: 13px;
                font-weight: 600;
                color: #374151;
            }

            .gongjuzx-form-input,
            .gongjuzx-form-select,
            .gongjuzx-form-textarea {
                width: 100%;
                box-sizing: border-box;
                border: 1.5px solid #d1d5db;
                border-radius: 8px;
                padding: 10px 12px;
                font-size: 13px;
                color: #1f2937;
                outline: none;
                transition: all 0.2s ease;
                font-family: inherit;
            }

            .gongjuzx-form-input:focus,
            .gongjuzx-form-select:focus,
            .gongjuzx-form-textarea:focus {
                border-color: #3d6dff;
                box-shadow: 0 0 0 3px rgba(61, 109, 255, 0.12);
            }

            .gongjuzx-form-select {
                height: 38px;
                background: #ffffff;
                cursor: pointer;
            }

            .gongjuzx-form-textarea {
                min-height: 108px;
                max-height: 220px;
                resize: none;
            }

            #gongjuzx-desc-input {
                width: 100%;
            }

            .gongjuzx-modal-footer {
                display: flex;
                justify-content: stretch;
                gap: 10px;
                padding: 12px 16px 16px;
                border-top: 1px solid #eef1f5;
            }

            .gongjuzx-modal-btn {
                flex: 1;
                min-width: 0;
                height: 34px;
                border-radius: 8px;
                border: none;
                font-size: 13px;
                cursor: pointer;
            }

            .gongjuzx-modal-btn-cancel {
                background: #f3f4f6;
                color: #374151;
            }

            .gongjuzx-modal-btn-cancel:hover {
                background: #e5e7eb;
            }

            .gongjuzx-modal-btn-save {
                background: #3d6dff;
                color: #ffffff;
                font-weight: 600;
            }

            .gongjuzx-modal-btn-save:hover {
                background: #2d5ce6;
            }

            .gongjuzx-modal-btn:disabled {
                opacity: 0.65;
                cursor: not-allowed;
            }
        `;

        document.head.appendChild(style);
    }
};

window.GongjuzxTanchuangYangshi = GongjuzxTanchuangYangshi;
