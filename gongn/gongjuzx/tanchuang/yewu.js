// 工具中心模块 - 弹窗业务
const GongjuzxTanchuangYewu = {
    state: {
        mode: 'create',
        itemId: '',
        onSave: null,
        isSaving: false
    },

    init() {
        if (window.GongjuzxTanchuangYangshi?.inject) {
            GongjuzxTanchuangYangshi.inject();
        }
    },

    openCreate(onSave) {
        this.open({
            mode: 'create',
            item: null,
            onSave
        });
    },

    openEdit(item, onSave) {
        this.open({
            mode: 'edit',
            item,
            onSave
        });
    },

    open({ mode = 'create', item = null, onSave = null } = {}) {
        this.close();
        this.init();

        this.state.mode = mode === 'edit' ? 'edit' : 'create';
        this.state.itemId = String(item?.id || '').trim();
        this.state.onSave = typeof onSave === 'function' ? onSave : null;
        this.state.isSaving = false;

        const title = this.state.mode === 'edit' ? '编辑资源' : '新增资源';
        const saveText = this.state.mode === 'edit' ? '保存' : '添加';
        const name = window.GongjuzxGongju?.escapeHtml
            ? GongjuzxGongju.escapeHtml(item?.name || '')
            : String(item?.name || '');
        const url = window.GongjuzxGongju?.escapeHtml
            ? GongjuzxGongju.escapeHtml(item?.url || '')
            : String(item?.url || '');
        const description = window.GongjuzxGongju?.escapeHtml
            ? GongjuzxGongju.escapeHtml(item?.description || '')
            : String(item?.description || '');
        const isShared = item?.is_shared === true;

        const modalHtml = `
            <div class="gongjuzx-modal" id="gongjuzx-modal">
                <div class="gongjuzx-modal-overlay"></div>
                <div class="gongjuzx-modal-content">
                    <div class="gongjuzx-modal-header">
                        <h3 class="gongjuzx-modal-title">${title}</h3>
                        <button class="gongjuzx-modal-close" id="gongjuzx-modal-close" type="button" aria-label="关闭">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div class="gongjuzx-modal-body">
                        <div class="gongjuzx-form-item">
                            <label class="gongjuzx-form-label" for="gongjuzx-name-input">1. 网站名称</label>
                            <input id="gongjuzx-name-input" class="gongjuzx-form-input" type="text" maxlength="80" value="${name}" placeholder="请输入网站名称" />
                        </div>
                        <div class="gongjuzx-form-item">
                            <label class="gongjuzx-form-label" for="gongjuzx-url-input">2. 网站URL</label>
                            <input id="gongjuzx-url-input" class="gongjuzx-form-input" type="text" maxlength="2048" value="${url}" placeholder="https://example.com" />
                        </div>
                        <div class="gongjuzx-form-item">
                            <label class="gongjuzx-form-label" for="gongjuzx-desc-input">3. 资源描述</label>
                            <textarea id="gongjuzx-desc-input" class="gongjuzx-form-textarea" maxlength="200" placeholder="请输入资源描述">${description}</textarea>
                        </div>
                        <div class="gongjuzx-form-item">
                            <label class="gongjuzx-form-label" for="gongjuzx-shared-input">4. 共享工具</label>
                            <select id="gongjuzx-shared-input" class="gongjuzx-form-select">
                                <option value="false"${isShared ? '' : ' selected'}>不共享</option>
                                <option value="true"${isShared ? ' selected' : ''}>共享</option>
                            </select>
                        </div>
                    </div>
                    <div class="gongjuzx-modal-footer">
                        <button class="gongjuzx-modal-btn gongjuzx-modal-btn-cancel" id="gongjuzx-modal-cancel" type="button">取消</button>
                        <button class="gongjuzx-modal-btn gongjuzx-modal-btn-save" id="gongjuzx-modal-save" type="button">${saveText}</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.bindEvents();

        const nameInput = document.getElementById('gongjuzx-name-input');
        if (nameInput) nameInput.focus();
    },

    close() {
        const modal = document.getElementById('gongjuzx-modal');
        if (modal) modal.remove();
        this.state.isSaving = false;
    },

    bindEvents() {
        document.getElementById('gongjuzx-modal-close')?.addEventListener('click', () => this.close());
        document.getElementById('gongjuzx-modal-cancel')?.addEventListener('click', () => this.close());
        document.getElementById('gongjuzx-modal-save')?.addEventListener('click', () => this.handleSave());

        document.getElementById('gongjuzx-modal')?.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.close();
                return;
            }
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                this.handleSave();
            }
        });
    },

    setSavingState(isSaving) {
        this.state.isSaving = isSaving;
        const saveButton = document.getElementById('gongjuzx-modal-save');
        const cancelButton = document.getElementById('gongjuzx-modal-cancel');
        const closeButton = document.getElementById('gongjuzx-modal-close');
        if (saveButton) saveButton.disabled = isSaving;
        if (cancelButton) cancelButton.disabled = isSaving;
        if (closeButton) closeButton.disabled = isSaving;
    },

    async handleSave() {
        if (this.state.isSaving) return;
        if (typeof this.state.onSave !== 'function') return;

        const payload = {
            name: document.getElementById('gongjuzx-name-input')?.value || '',
            url: document.getElementById('gongjuzx-url-input')?.value || '',
            description: document.getElementById('gongjuzx-desc-input')?.value || '',
            is_shared: document.getElementById('gongjuzx-shared-input')?.value === 'true'
        };

        this.setSavingState(true);
        try {
            await this.state.onSave(payload, {
                mode: this.state.mode,
                itemId: this.state.itemId
            });
            this.close();
        } catch (error) {
            const message = String(error?.message || '保存失败，请稍后重试');
            if (window.Tongzhi?.error) {
                window.Tongzhi.error(message);
            } else {
                console.error('[工具中心] 保存失败:', error);
            }
        } finally {
            this.setSavingState(false);
        }
    }
};

window.GongjuzxTanchuangYewu = GongjuzxTanchuangYewu;
