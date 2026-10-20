// BI summary formula business: storage, dialog, and computed row building.
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

// ---------- 公式注册表与计算行 ----------

// 可引用名 = 原始模板名（唯一计算来源：公式只引用原始模板，禁止嵌套）
getFormulaRegistryNames() {
    const templates = this.state.templates || [];
    return [...new Set(templates.map(tpl => String(tpl.name || '').trim()).filter(Boolean))];
},

// 是否配置了公式（查询计划据此为全部模板补查率字段的分子分母依赖）
hasBatchFormulas() {
    return !!(this.state.batchFormulaText || '').trim();
},

// 率字段的分子/分母依赖字段 key（率列 = 分子、分母分别按公式折叠后相除）
getFormulaRateDeps(metricFields = []) {
    const deps = {};
    (metricFields || []).forEach(field => {
        const name = this.getMetricFieldDisplayName(field);
        const depNames = window.YejiPlcxJhGuize?.dependencyNames?.(name) || [];
        if (depNames.length < 2) return;
        const numerator = this.findBatchMetricFieldByDisplayName?.(depNames[0], metricFields);
        const denominator = this.findBatchMetricFieldByDisplayName?.(depNames[1], metricFields);
        if (numerator?.key && denominator?.key) {
            deps[field.key] = { numeratorKey: numerator.key, denominatorKey: denominator.key };
        }
    });
    return deps;
},

// 展示层漏斗钩子：公式计算行（合并行）置于顶部，其余行依次顺移。
// 参与项不再独立呈现，仅作为合并行的子行出现（展开可见）；
// 合并行出错（引用不存在/参与行查询失败）时其参与项保留独立行，保证数据可见。
// options.includeChildren：强制展开参与项（导出/下载/AI 快照场景）。
buildBatchFormulaRows(displayRows = [], options = {}) {
    const text = this.state.batchFormulaText || '';
    if (!text.trim() || !window.YejiPlcxGsGuize) return displayRows;
    const { specs } = window.YejiPlcxGsGuize.parseFormulaText(text);
    if (!specs.length) return displayRows;

    const byName = new Map();
    (displayRows || []).forEach(row => {
        const name = String(row.name || '').trim();
        if (name && !byName.has(name)) byName.set(name, row);
    });

    const metricFields = this.getBatchQueryMetricFields();
    const rateDeps = this.getFormulaRateDeps(metricFields);
    const formulaRows = [];
    const participantKeys = new Set();

    specs.forEach(spec => {
        const registry = this.getFormulaRegistryNames();
        const formulaNames = new Set(specs.map(item => item.name));
        const tokenized = window.YejiPlcxGsGuize.tokenizeFormula(spec.expr, [...registry, ...formulaNames]);
        if (tokenized.error) {
            formulaRows.push(this.buildFormulaErrorRow(spec, tokenized.error, metricFields));
            return;
        }
        // 已存的旧公式若引用其他公式结果（不支持层层嵌套）→ 显式降级
        const nested = tokenized.terms.filter(term => formulaNames.has(term.name));
        if (nested.length) {
            formulaRows.push(this.buildFormulaErrorRow(
                spec, `公式不能引用其他公式结果（不支持层层嵌套）：${nested.map(term => term.name).join('、')}`, metricFields));
            return;
        }
        const resolveRow = name => byName.get(name) || null;
        const formulaTree = tokenized.terms.map(term => ({
            op: term.op,
            name: term.name,
            key: resolveRow(term.name)?.key || ''
        }));
        const evaluation = window.YejiPlcxGsGuize.evalFormulaRow(
            { ...spec, terms: formulaTree },
            key => (displayRows || []).find(row => row.key === key) || null,
            metricFields,
            rateDeps
        );
        const error = evaluation.missing.length
            ? `引用不存在：${evaluation.missing.join('、')}`
            : (evaluation.hasErrorRow ? '引用行查询失败' : '');
        const groupKey = `merge:${spec.name}`;
        // 参与项（子项）：公式直接引用的原始模板行
        const childRows = evaluation.missing.length
            ? []
            : tokenized.terms.map(term => {
                const refRow = resolveRow(term.name);
                if (!refRow) return null;
                return this.decorateBatchDisplayRow(refRow, { type: 'child' });
            }).filter(Boolean);
        const row = {
            key: groupKey,
            name: spec.name,
            displayType: 'merged',
            groupKey,
            formulaError: error,
            formulaTree,
            childRows,
            rawRows: childRows,
            metricFields,
            loading: evaluation.anyLoading && !evaluation.missing.length,
            error,
            valuesByKey: evaluation.valuesByKey,
            formatsByKey: evaluation.formatsByKey
        };
        formulaRows.push(row);
        // 成功计算的公式行：参与项收归子行，不再独立呈现
        if (!error && childRows.length) {
            childRows.forEach(child => participantKeys.add(child.key));
        }
        const expanded = options.includeChildren
            || this.isBatchGroupRowExpanded(groupKey);
        if (childRows.length && expanded) {
            formulaRows.push(...childRows);
        }
    });

    return [...formulaRows, ...displayRows.filter(row => !participantKeys.has(row.key))];
},

buildFormulaErrorRow(spec, message, metricFields = []) {
    const valuesByKey = {};
    const formatsByKey = {};
    metricFields.forEach(field => {
        valuesByKey[field.key] = '';
        formatsByKey[field.key] = field.fieldFormat?.numberFormat || null;
    });
    return {
        key: `merge:${spec.name}`,
        name: spec.name,
        displayType: 'merged',
        groupKey: `merge:${spec.name}`,
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

// ---------- 趋势节点求值（计算行下钻：UI 链与服务链共用） ----------

computeBatchFormulaNodeValues(context = {}, sourceRows = []) {
    if (!context.formulaTree || !window.YejiPlcxGsGuize?.evalFormulaNode) return {};
    const byKey = new Map((sourceRows || []).map(item => [item.key, item]));
    return window.YejiPlcxGsGuize.evalFormulaNode(context.formulaTree, {
        getSingle: key => byKey.get(key) || null,
        metricFields: context.metricFields || [],
        rateDeps: this.getFormulaRateDeps(context.metricFields || [])
    }).valuesByKey || {};
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

// 保存前全量校验：语法 + 词典分词（仅原始模板名可引用，拒绝层层嵌套）
validateFormulaText(text) {
    const guize = window.YejiPlcxGsGuize;
    if (!guize) return { ok: false, specs: [], errors: [{ line: 0, message: '公式规则模块未加载。' }] };
    const { specs, errors } = guize.parseFormulaText(text);
    const registry = this.getFormulaRegistryNames();
    const formulaNames = new Set(specs.map(spec => spec.name));
    specs.forEach(spec => {
        if (registry.includes(spec.name)) {
            errors.push({ line: spec.line, message: `结果名与模板名重复：${spec.name}` });
            return;
        }
        // 词典含公式结果名：分词成功后若命中公式名 → 层层嵌套，拒绝
        const tokenized = guize.tokenizeFormula(spec.expr, [...registry, ...formulaNames]);
        if (tokenized.error) {
            errors.push({ line: spec.line, message: tokenized.error });
            return;
        }
        const nested = tokenized.terms.filter(term => formulaNames.has(term.name));
        if (nested.length) {
            errors.push({ line: spec.line, message: `公式不能引用其他公式结果（不支持层层嵌套）：${nested.map(term => term.name).join('、')}` });
            return;
        }
        const unknown = tokenized.terms.filter(term => !registry.includes(term.name));
        if (unknown.length) {
            errors.push({ line: spec.line, message: `无法识别的名称：${unknown.map(term => term.name).join('、')}` });
        }
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
