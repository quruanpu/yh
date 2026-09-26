// BI field configuration business: modal UI, active config, and query field resolution.
const YejiPzYewu = {
getDefaultFieldConfig() {
    return this.normalizeFieldConfig({});
},

normalizeFieldConfig(config = {}) {
    return window.YejiPzGongju.normalizeConfig(config, window.YejiPzGongju.makeSource(this));
},

getActiveFieldConfig(context = this.state) {
    return this.normalizeFieldConfig(context?.fieldConfig || {});
},

getQueryRowFields(context = this.state) {
    return window.YejiPzGongju.resolveRows(this.getActiveFieldConfig(context), window.YejiPzGongju.makeSource(this));
},

getQueryMetricFields(context = this.state) {
    return window.YejiPzGongju.resolveMetrics(this.getActiveFieldConfig(context), window.YejiPzGongju.makeSource(this));
},

getBatchMetricFields() {
    return this.getQueryMetricFields(this.state);
},

setAvailableFields(rowFields = [], metricFields = []) {
    this.state.availableRowFields = window.YejiPzGongju.orderRowFields(
        window.YejiPzGongju.mergeFields(
            window.YejiPzShuju?.rowFields || [],
            this.state.availableRowFields || [],
            rowFields
        )
    );
    this.state.availableMetricFields = window.YejiPzGongju.orderMetricFields(
        window.YejiPzGongju.mergeFields(
            window.YejiPzShuju?.metricFields || [],
            this.state.availableMetricFields || [],
            metricFields
        )
    );
    this.state.fieldConfig = this.normalizeFieldConfig(this.state.fieldConfig || {});
},

async openFieldConfigModal() {
    this.renderFieldConfigLoadingModal();
    try {
        if (!this.state.metadataLoaded && this.state.proxyReady && this.state.tokenValid) {
            await this.loadUltraMetadata();
        }
    } catch (error) {
        console.warn('[yeji] 字段配置元数据加载失败，使用内置字段快照', error);
    }
    this.state.fieldConfigDraft = this.clonePlain(this.getActiveFieldConfig());
    this.renderFieldConfigModal();
},

closeFieldConfigModal() {
    this.state.fieldConfigDraft = null;
    document.getElementById('yeji-field-modal')?.remove();
},

renderFieldConfigModal() {
    document.getElementById('yeji-field-modal')?.remove();
    const draft = this.state.fieldConfigDraft || this.getActiveFieldConfig();
    const mask = document.createElement('div');
    mask.id = 'yeji-field-modal';
    mask.className = 'yeji-field-modal';
    mask.innerHTML = `
        <div class="yeji-field-backdrop"></div>
        <div class="yeji-field-dialog yeji-field-config-dialog" role="dialog" aria-modal="true" aria-label="字段配置">
            <div class="yeji-field-header">
                <div class="yeji-field-title">字段配置</div>
                <button type="button" class="yeji-field-close" data-field-close title="关闭">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="yeji-field-body">
                ${this.renderFieldConfigSection('row', '查询字段列表', this.state.availableRowFields, draft.rowKeys)}
                ${this.renderFieldConfigSection('metric', '聚合字段列表', this.state.availableMetricFields, draft.metricKeys)}
            </div>
            <div class="yeji-field-footer">
                <button type="button" class="yeji-filter-mini" id="yeji-field-reset">恢复默认</button>
                <button type="button" class="yeji-filter-mini primary" id="yeji-field-apply">确认</button>
            </div>
        </div>
    `;
    document.body.appendChild(mask);
    this.bindFieldConfigModal(mask);
},

renderFieldConfigLoadingModal() {
    document.getElementById('yeji-field-modal')?.remove();
    const mask = document.createElement('div');
    mask.id = 'yeji-field-modal';
    mask.className = 'yeji-field-modal';
    mask.innerHTML = `
        <div class="yeji-field-backdrop"></div>
        <div class="yeji-field-dialog" role="dialog" aria-modal="true" aria-label="字段配置">
            <div class="yeji-field-header">
                <div class="yeji-field-title">字段配置</div>
                <button type="button" class="yeji-field-close" data-field-close title="关闭">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="yeji-field-loading">正在加载中......</div>
        </div>
    `;
    document.body.appendChild(mask);
    mask.querySelector('[data-field-close]')?.addEventListener('click', () => this.closeFieldConfigModal());
},

renderFieldConfigSection(type, title, fields = [], selectedKeys = []) {
    const selected = new Set(selectedKeys || []);
    const items = (fields || []).map((field, index) => {
        const label = this.getFieldConfigLabel(type, field);
        return `
        <label class="yeji-field-item" title="${this.escapeHtml(label)}">
            <input type="checkbox" data-field-type="${type}" value="${this.escapeHtml(field.key || '')}" ${selected.has(field.key) ? 'checked' : ''} />
            <span class="yeji-field-check"></span>
            <span class="yeji-field-name">${index + 1}. ${this.escapeHtml(label)}</span>
        </label>
    `;
    }).join('');
    return `
        <section class="yeji-field-section">
            <div class="yeji-field-section-title">${this.escapeHtml(title)}</div>
            <div class="yeji-field-grid">${items || '<div class="yeji-field-empty">暂无字段</div>'}</div>
        </section>
    `;
},

getFieldConfigLabel(type, field = {}) {
    return this.getFieldDisplayName(type, field);
},

getFieldDisplayName(type, field = {}) {
    const labels = type === 'row'
        ? (window.YejiPzShuju?.rowFieldLabels || {})
        : (window.YejiPzShuju?.metricFieldLabels || {});
    return labels[field.key] || field.alias || field.title || field.originTitle || field.name || '-';
},

getMetricFieldDisplayName(field = {}) {
    return this.getFieldDisplayName('metric', field);
},

getRowFieldDisplayName(field = {}) {
    return this.getFieldDisplayName('row', field);
},

bindFieldConfigModal(mask) {
    mask.querySelector('[data-field-close]')?.addEventListener('click', () => this.closeFieldConfigModal());
    mask.querySelector('#yeji-field-reset')?.addEventListener('click', () => {
        this.state.fieldConfigDraft = this.getDefaultFieldConfig();
        this.renderFieldConfigModal();
    });
    mask.querySelectorAll('input[data-field-type]').forEach(input => {
        input.addEventListener('change', () => this.updateFieldConfigDraft(mask));
    });
    mask.querySelector('#yeji-field-apply')?.addEventListener('click', () => this.applyFieldConfigDraft(mask));
},

updateFieldConfigDraft(mask) {
    const rowKeys = [];
    const metricKeys = [];
    mask.querySelectorAll('input[data-field-type="row"]:checked').forEach(input => rowKeys.push(input.value));
    mask.querySelectorAll('input[data-field-type="metric"]:checked').forEach(input => metricKeys.push(input.value));
    this.state.fieldConfigDraft = this.normalizeFieldConfig({ rowKeys, metricKeys });
},

applyFieldConfigDraft(mask) {
    this.updateFieldConfigDraft(mask);
    const draft = this.state.fieldConfigDraft || this.getDefaultFieldConfig();
    if (!draft.metricKeys.length) {
        this._showToast('至少选择 1 个聚合字段', 'warning');
        return;
    }
    this.state.fieldConfig = this.normalizeFieldConfig(draft);
    this.state.offset = 0;
    this.closeFieldConfigModal();
    this.runDefaultQuery({ resetOffset: true, requireConnection: true });
},

getFieldConfigSummary(config = this.state.fieldConfig) {
    const normalized = this.normalizeFieldConfig(config || {});
    return `${normalized.rowKeys.length} 查询字段 / ${normalized.metricKeys.length} 聚合字段`;
}
};

window.YejiPzYewu = YejiPzYewu;
