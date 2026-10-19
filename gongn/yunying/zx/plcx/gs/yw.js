// BI summary formula business: storage, dialog, and virtual row building.
const YejiPlcxGsYewu = {
FORMULAS_COLLECTION: 'yeji_formulas',

// ---------- 存储（sjk 中控：yeji_formulas 集合，一个 pid 一份公式全文） ----------

_formulasDocId(pid) {
    const text = String(pid ?? '').trim();
    return text.replace(/[.#$/[\]]/g, '_') || 'unknown';
},

async fetchFormulas(pid) {
    const doc = await window.SjkModule.get(this.FORMULAS_COLLECTION, this._formulasDocId(pid));
    return doc || null;
},

async saveFormulaDoc(pid, text) {
    await window.SjkModule.set(this.FORMULAS_COLLECTION, this._formulasDocId(pid), {
        version: 1,
        module: 'ultra',
        text: String(text || ''),
        updatedAt: Date.now()
    });
},

async ensureBatchFormulasLoaded({ force = false } = {}) {
    if (this.state.batchFormulaLoaded && !force) return this.state.batchFormulaText || '';
    const pid = this.getTemplateProviderId();
    if (!pid || !window.SjkModule) {
        this.state.batchFormulaText = '';
        this.state.batchFormulaLoaded = true;
        return '';
    }
    try {
        const doc = await this.fetchFormulas(pid);
        this.state.batchFormulaText = doc?.text || '';
    } catch (error) {
        console.error('[yeji] 公式加载失败', error);
    }
    this.state.batchFormulaLoaded = true;
    return this.state.batchFormulaText || '';
},

// ---------- 公式注册表与虚拟行 ----------

// 可引用名 = 真实模板名 + 合并组名（公式结果名在解析时叠加）
getFormulaBaseRegistryNames() {
    const templates = this.state.templates || [];
    const names = templates.map(tpl => String(tpl.name || '').trim()).filter(Boolean);
    const bases = window.YejiPlcxJhGuize?.buildMergeableBaseSet
        ? [...window.YejiPlcxJhGuize.buildMergeableBaseSet(templates)]
        : [];
    return [...new Set([...names, ...bases])];
},

// 展示层漏斗尾部钩子：公式虚拟行置于顶部，其余行依次顺移。
// options.includeChildren：模板下载等场景（同时展开合并子项）；
// options.includeFormulaChildren：导出场景（仅展开公式参与行，合并行维持既有收起行为）。
buildBatchFormulaRows(displayRows = [], options = {}) {
    const text = this.state.batchFormulaText || '';
    if (!text.trim() || !window.YejiPlcxGsGuize) return displayRows;
    const { specs } = window.YejiPlcxGsGuize.parseFormulaText(text);
    if (!specs.length) return displayRows;

    const sourceRows = displayRows.filter(row => row.displayType !== 'formula');
    const byName = new Map();
    sourceRows.forEach(row => {
        const name = String(row.name || '').trim();
        if (name && !byName.has(name)) byName.set(name, row);
    });

    const metricFields = this.getBatchQueryMetricFields();
    const formulaRows = [];
    const definedRows = new Map();

    specs.forEach(spec => {
        const registry = [...byName.keys(), ...definedRows.keys()];
        const tokenized = window.YejiPlcxGsGuize.tokenizeFormula(spec.expr, registry);
        if (tokenized.error) {
            formulaRows.push(this.buildFormulaErrorRow(spec, tokenized.error, metricFields));
            return;
        }
        const resolveRow = name => byName.get(name) || definedRows.get(name) || null;
        const evaluation = window.YejiPlcxGsGuize.evalFormulaRow(
            { ...spec, terms: tokenized.terms }, resolveRow, metricFields);
        const rawRows = evaluation.missing.length
            ? []
            : tokenized.terms.map(term => resolveRow(term.name)).filter(Boolean);
        const formulaTree = evaluation.missing.length
            ? []
            : tokenized.terms.map(term => {
                const refRow = resolveRow(term.name);
                if (!refRow) return { op: term.op, name: term.name, key: '', keys: [] };
                if (refRow.displayType === 'formula') {
                    return { op: term.op, name: term.name, children: refRow.formulaTree || [] };
                }
                const memberKeys = (refRow.rawRows || [refRow]).map(item => item.key).filter(Boolean);
                // key = 显示行 rowKey（目标派生用：单模板 _key / 合并组 merge:base）；
                // keys = 成员 key（趋势节点聚合用）
                return { op: term.op, name: term.name, key: refRow.key || '', keys: memberKeys };
            });
        const error = evaluation.missing.length
            ? `引用不存在：${evaluation.missing.join('、')}`
            : (evaluation.hasErrorRow ? '引用行查询失败' : '');
        const groupKey = `gs:${spec.name}`;
        // 参与行（子项）：模板行 / 合并组行 / 其他公式行；合并组与公式行保留自身折叠按钮，可递归展开
        const childRows = evaluation.missing.length
            ? []
            : tokenized.terms.map(term => {
                const refRow = resolveRow(term.name);
                if (!refRow) return null;
                return this.decorateBatchDisplayRow(refRow, {
                    type: refRow.displayType === 'single' ? 'child' : '',
                    parentKey: groupKey
                });
            }).filter(Boolean);
        const row = {
            key: groupKey,
            name: spec.name,
            displayType: 'formula',
            groupKey,
            formulaError: error,
            formulaTree,
            childRows,
            rawRows,
            metricFields,
            loading: evaluation.anyLoading && !evaluation.missing.length,
            error,
            valuesByKey: evaluation.valuesByKey,
            formatsByKey: evaluation.formatsByKey
        };
        formulaRows.push(row);
        definedRows.set(spec.name, row);
        const expanded = options.includeChildren
            || options.includeFormulaChildren
            || this.isBatchGroupRowExpanded(groupKey);
        if (childRows.length && expanded) {
            formulaRows.push(...childRows);
        }
    });

    return [...formulaRows, ...displayRows];
},

buildFormulaErrorRow(spec, message, metricFields = []) {
    const valuesByKey = {};
    const formatsByKey = {};
    metricFields.forEach(field => {
        valuesByKey[field.key] = '';
        formatsByKey[field.key] = field.fieldFormat?.numberFormat || null;
    });
    return {
        key: `gs:${spec.name}`,
        name: spec.name,
        displayType: 'formula',
        groupKey: `gs:${spec.name}`,
        formulaError: message,
        formulaTree: [],
        childRows: [],
        rawRows: [],
        metricFields,
        loading: false,
        error: message,
        valuesByKey,
        formatsByKey
    };
},

// ---------- 趋势节点求值（公式行下钻：UI 链与服务链共用） ----------

computeBatchFormulaNodeValue(context = {}, sourceRows = []) {
    if (!context.formulaTree || !window.YejiPlcxGsGuize?.evalFormulaNode) return '';
    const byKey = new Map((sourceRows || []).map(item => [item.key, item]));
    const value = window.YejiPlcxGsGuize.evalFormulaNode(context.formulaTree, {
        getSingle: key => byKey.get(key)?.valuesByKey?.[context.metric.key] ?? '',
        aggregate: keys => window.YejiPlcxHbGuize.aggregateField(
            keys.map(key => byKey.get(key)).filter(Boolean),
            context.metric,
            context.metricFields,
            item => this.getMetricFieldDisplayName(item)
        )
    });
    return value == null ? '' : value;
},

// ---------- 设置弹窗 ----------

async openFormulaDialog() {
    await this.ensureBatchFormulasLoaded();
    this.renderFormulaDialog();
},

closeFormulaDialog() {
    document.getElementById('yeji-formula-modal')?.remove();
},

renderFormulaDialog() {
    this.closeFormulaDialog();
    const text = this.state.batchFormulaText || '';
    const mask = document.createElement('div');
    mask.id = 'yeji-formula-modal';
    mask.className = 'yeji-target-modal';
    mask.innerHTML = `
        <div class="yeji-target-backdrop"></div>
        <div class="yeji-target-dialog" role="dialog" aria-modal="true" aria-label="模板公式">
            <div class="yeji-target-header">
                <div class="yeji-target-title">模板公式</div>
                <button type="button" class="yeji-target-close" data-formula-close title="关闭">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="yeji-target-body" style="display:block;padding:12px;">
                <textarea id="yeji-formula-text" spellcheck="false" wrap="soft"
                    style="display:block;width:100%;height:300px;box-sizing:border-box;padding:10px;border:1px solid #d9d9d9;border-radius:6px;font-family:Consolas,monospace;font-size:13px;line-height:1.6;resize:none;"
                    placeholder="每行一条：结果名=模板名+模板名-模板名">${this.escapeHtml(text)}</textarea>
            </div>
            <div class="yeji-target-footer" style="display:flex;align-items:center;gap:8px;padding:10px 16px;">
                <div id="yeji-formula-validate" style="flex:1;text-align:left;font-size:12px;line-height:1.5;color:#e64340;min-width:0;"></div>
                <button type="button" class="yeji-filter-mini primary" id="yeji-formula-save">保存</button>
            </div>
        </div>
    `;
    document.body.appendChild(mask);

    const textarea = mask.querySelector('#yeji-formula-text');
    textarea?.addEventListener('input', () => this.updateFormulaValidation(textarea.value));
    this.updateFormulaValidation(text?.value || '');
    mask.querySelectorAll('[data-formula-close]').forEach(el => {
        el.addEventListener('click', () => this.closeFormulaDialog());
    });
    mask.querySelector('#yeji-formula-save')?.addEventListener('click', () => {
        this.saveFormulaText();
    });
},

updateFormulaValidation(text) {
    const box = document.getElementById('yeji-formula-validate');
    if (!box) return;
    const report = this.validateFormulaText(text);
    if (report.ok) {
        box.innerHTML = '';
        return;
    }
    box.innerHTML = report.errors.map(err =>
        `<div style="color:#e64340;">第 ${err.line} 行：${this.escapeHtml(err.message)}</div>`
    ).join('');
},

// 保存前全量校验：语法 + 词典分词（含链式引用）
validateFormulaText(text) {
    const guize = window.YejiPlcxGsGuize;
    if (!guize) return { ok: false, specs: [], errors: [{ line: 0, message: '公式规则模块未加载。' }] };
    const { specs, errors } = guize.parseFormulaText(text);
    const registry = this.getFormulaBaseRegistryNames();
    const defined = [];
    specs.forEach(spec => {
        const tokenized = guize.tokenizeFormula(spec.expr, [...registry, ...defined]);
        if (tokenized.error) {
            errors.push({ line: spec.line, message: tokenized.error });
            return;
        }
        defined.push(spec.name);
    });
    return { ok: errors.length === 0, specs, errors };
},

async saveFormulaText() {
    const textarea = document.getElementById('yeji-formula-text');
    const text = String(textarea?.value || '').trim();
    const report = this.validateFormulaText(text);
    if (!report.ok) {
        this.updateFormulaValidation(text);
        return;
    }
    const saveBtn = document.getElementById('yeji-formula-save');
    if (saveBtn) saveBtn.disabled = true;
    try {
        const pid = this.getTemplateProviderId();
        if (!pid || !window.SjkModule) throw new Error('公式数据库未就绪');
        await this.saveFormulaDoc(pid, text);
        this.state.batchFormulaText = text;
        this.state.batchFormulaLoaded = true;
        this.closeFormulaDialog();
        this._showToast(text ? '公式已保存' : '公式已清空', 'success');
        if (this.state.batchQueryOpen) this.renderBatchQueryBody();
    } catch (error) {
        console.error('[yeji] 公式保存失败', error);
        this._showToast(error.message || '公式保存失败', 'error');
        if (saveBtn) saveBtn.disabled = false;
    }
}
};

window.YejiPlcxGsYewu = YejiPlcxGsYewu;
