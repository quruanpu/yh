// BI summary formula rules: virtual template parsing, validation, and evaluation.
const YejiPlcxGsGuize = {
    OPERATORS: new Set(['+', '-', '*', '/']),

    // 全角运算符归一（＝＋－×÷—–＊／ → 半角）
    normalizeText(text = '') {
        return String(text || '')
            .replace(/＝/g, '=')
            .replace(/＋/g, '+')
            .replace(/[－—–]/g, '-')
            .replace(/×/g, '*')
            .replace(/＊/g, '*')
            .replace(/÷/g, '/')
            .replace(/／/g, '/');
    },

    // 逐行解析：结果名=表达式；# 注释；空行跳过
    parseFormulaText(text = '') {
        const specs = [];
        const errors = [];
        const defined = new Set();
        String(text || '').split(/\r?\n/).forEach((rawLine, index) => {
            const line = this.normalizeText(rawLine).trim();
            const lineNo = index + 1;
            if (!line || line.startsWith('#')) return;
            const eq = line.indexOf('=');
            if (eq <= 0) {
                errors.push({ line: lineNo, message: '缺少“结果名=”' });
                return;
            }
            const name = line.slice(0, eq).trim();
            const expr = line.slice(eq + 1).trim();
            if (!name) { errors.push({ line: lineNo, message: '结果名为空' }); return; }
            if (!expr) { errors.push({ line: lineNo, message: '表达式为空' }); return; }
            if (defined.has(name)) {
                errors.push({ line: lineNo, message: `结果名“${name}”重复定义` });
                return;
            }
            defined.add(name);
            specs.push({ line: lineNo, name, expr });
        });
        return { specs, errors };
    },

    // 词典最长匹配分词：名字可含 - 等字符而不被切碎。
    // registry：全部可用引用名（模板名 + 合并组名 + 已定义公式结果名）。
    // 允许首项带符号（如 -退款+总销售）。
    tokenizeFormula(expr = '', registry = []) {
        const sorted = [...new Set(registry)].filter(Boolean).sort((a, b) => b.length - a.length);
        const terms = [];
        let pos = 0;
        let op = '+';
        let expectOperand = true;
        while (pos < expr.length) {
            const ch = expr[pos];
            if (ch === ' ') { pos += 1; continue; }
            if (this.OPERATORS.has(ch)) {
                if (expectOperand && terms.length > 0) return { error: `运算符位置错误（位置 ${pos + 1}）`, terms };
                op = ch;
                pos += 1;
                expectOperand = true;
                continue;
            }
            if (!expectOperand) return { error: `缺少运算符（位置 ${pos + 1}）`, terms };
            const rest = expr.slice(pos);
            const match = sorted.find(name => rest.startsWith(name));
            if (!match) return { error: `无法识别的名称（位置 ${pos + 1}）`, terms };
            terms.push({ op, name: match });
            pos += match.length;
            expectOperand = false;
        }
        if (expectOperand && terms.length) return { error: '表达式以运算符结尾', terms };
        if (!terms.length) return { error: '表达式为空', terms };
        return { terms };
    },

    toNumberValue(value) {
        if (window.YejiPlcxHbGuize?.toNumber) return window.YejiPlcxHbGuize.toNumber(value);
        if (value == null || value === '') return null;
        const numeric = Number(String(value).replace(/,/g, '').trim());
        return Number.isFinite(numeric) ? numeric : null;
    },

    // 带优先级的折叠：先乘除后加减；任一操作数非数值 → null（对应列空，不猜 0）。
    // resolve(term) 返回参与项原始值。
    foldTerms(terms = [], resolve) {
        const readValue = term => (typeof resolve === 'function' ? resolve(term) : null);
        const folded = [];
        (terms || []).forEach(term => {
            if (folded.length && (term.op === '*' || term.op === '/')) {
                const previous = folded[folded.length - 1];
                const right = this.toNumberValue(readValue(term));
                previous.value = term.op === '*'
                    ? (previous.value == null || right == null ? null : previous.value * right)
                    : (previous.value == null || right == null || right === 0 ? null : previous.value / right);
                return;
            }
            folded.push({ op: term.op, value: this.toNumberValue(readValue(term)) });
        });
        let total = null;
        folded.forEach((item, index) => {
            if (index === 0) {
                total = item.value == null ? null : (item.op === '-' ? -item.value : item.value);
                return;
            }
            if (total == null || item.value == null) {
                total = null;
                return;
            }
            total = item.op === '-' ? total - item.value : total + item.value;
        });
        return total;
    },

    // 计算核心（显示行与趋势节点共用，单一事实源）：
    // 值列 = 参与项按公式折叠；率列（rateDeps 有依赖定义）= 分子列、分母列分别按同一公式折叠后相除（加权口径）。
    // resolve(term) 返回参与行（含 valuesByKey）；任一操作数空 / 分母空或 0 → 该列空。
    computeFormulaValues(terms = [], resolve, metricFields = [], rateDeps = {}) {
        const valuesByKey = {};
        const formatsByKey = {};
        const resolved = (terms || []).map(term => ({
            ...term,
            row: typeof resolve === 'function' ? resolve(term) : null
        }));
        metricFields.forEach(field => {
            let value = null;
            const deps = rateDeps?.[field.key];
            if (deps?.numeratorKey && deps?.denominatorKey) {
                const numerator = this.foldTerms(resolved, term => term.row?.valuesByKey?.[deps.numeratorKey]);
                const denominator = this.foldTerms(resolved, term => term.row?.valuesByKey?.[deps.denominatorKey]);
                value = numerator == null || denominator == null || denominator === 0
                    ? null
                    : numerator / denominator;
            } else {
                value = this.foldTerms(resolved, term => term.row?.valuesByKey?.[field.key]);
            }
            valuesByKey[field.key] = value == null ? '' : value;
            formatsByKey[field.key] = resolved.find(item => item.row?.formatsByKey?.[field.key])?.row.formatsByKey[field.key]
                || field.fieldFormat?.numberFormat
                || null;
        });
        return { valuesByKey, formatsByKey };
    },

    // 目标派生：对目标 items 折叠公式（率目标同样按百分点口径）。
    // terms: [{op,name,key}]；任一参与项缺失/为空 → ''（不猜 0）。
    evalFormulaTargets(terms = [], items = {}, metricName = '') {
        if (!terms.length) return '';
        const value = this.foldTerms(terms, term => items?.[term.key]?.targets?.[metricName]);
        return value == null ? '' : value;
    },

    // 显示行求值：resolveRow(key) 按参与项 key 返回显示行或 null。
    // 任一引用缺失/参与行查询失败/参与行 loading → 该行列空。
    evalFormulaRow(spec = {}, resolveRow, metricFields = [], rateDeps = {}) {
        const resolved = (spec.terms || []).map(term => ({
            ...term,
            row: typeof resolveRow === 'function' ? resolveRow(term.key) : null
        }));
        const missing = resolved.filter(item => !item.row).map(item => item.name);
        const hasErrorRow = resolved.some(item => item.row?.error);
        const anyLoading = resolved.some(item => item.row?.loading);
        const blocked = missing.length > 0 || hasErrorRow;

        const empty = { valuesByKey: {}, formatsByKey: {} };
        metricFields.forEach(field => {
            empty.valuesByKey[field.key] = '';
            empty.formatsByKey[field.key] = field.fieldFormat?.numberFormat || null;
        });
        const computed = blocked || anyLoading
            ? empty
            : this.computeFormulaValues(resolved, term => term.row, metricFields, rateDeps);

        return {
            valuesByKey: computed.valuesByKey,
            formatsByKey: computed.formatsByKey,
            missing,
            hasErrorRow,
            anyLoading,
            blocked
        };
    },

    // 展开公式中全部参与项模板 key（趋势查询模板清单用，去重保序）
    flattenTreeKeys(terms = []) {
        const keys = [];
        (terms || []).forEach(term => {
            const key = term.key;
            if (key && !keys.includes(key)) keys.push(key);
        });
        return keys;
    },

    // 趋势节点求值：按参与项 key 取节点行（单 key 直接取值），率列按分子分母分别折叠后相除。
    evalFormulaNode(terms = [], options = {}) {
        const getSingle = options.getSingle || (() => null);
        const resolve = term => {
            const key = term.key;
            return key ? getSingle(key) : null;
        };
        return this.computeFormulaValues(terms, resolve, options.metricFields || [], options.rateDeps || {});
    }
};

window.YejiPlcxGsGuize = YejiPlcxGsGuize;
