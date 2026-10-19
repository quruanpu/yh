// BI summary formula rules: virtual template parsing, validation, and evaluation.
const YejiPlcxGsGuize = {
    OPERATORS: new Set(['+', '-']),

    // 全角运算符归一（＝＋－—– → 半角）
    normalizeText(text = '') {
        return String(text || '')
            .replace(/＝/g, '=')
            .replace(/＋/g, '+')
            .replace(/[－—–]/g, '-');
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
                op = ch === '-' ? '-' : '+';
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

    // 目标派生：对目标 items 按 +/- 逐项累计（率目标同样按百分点口径）。
    // terms: [{op,name,key}]（key = 参与行的 rowKey）；任一参与项缺失/为空 → ''（不猜 0）。
    evalFormulaTargets(terms = [], items = {}, metricName = '') {
        let total = null;
        for (const term of terms) {
            const raw = items?.[term.key]?.targets?.[metricName];
            const numeric = this.toNumberValue(raw);
            if (numeric == null) return '';
            total = total == null
                ? (term.op === '-' ? -numeric : numeric)
                : (term.op === '-' ? total - numeric : total + numeric);
        }
        return terms.length ? total : '';
    },

    // 对一批指标列求值。resolveRow(name) 返回参与行（真实/合并/已定义公式行）或 null。
    // 口径：数值列 = 各项按 +/- 累计；率列同样按百分点加减（严禁分子分母运算）。
    // 任一引用缺失/参与行查询失败/任一操作数为空 → 该列空。
    evalFormulaRow(spec = {}, resolveRow, metricFields = []) {
        const resolved = (spec.terms || []).map(term => ({
            ...term,
            row: typeof resolveRow === 'function' ? resolveRow(term.name) : null
        }));
        const missing = resolved.filter(item => !item.row).map(item => item.name);
        const hasErrorRow = resolved.some(item => item.row?.error);
        const anyLoading = resolved.some(item => item.row?.loading);
        const valuesByKey = {};
        const formatsByKey = {};
        const blocked = missing.length > 0 || hasErrorRow;

        metricFields.forEach(field => {
            let total = null;
            if (!blocked && !anyLoading) {
                for (const item of resolved) {
                    const numeric = this.toNumberValue(item.row.valuesByKey?.[field.key]);
                    if (numeric == null) { total = null; break; }
                    total = total == null
                        ? (item.op === '-' ? -numeric : numeric)
                        : (item.op === '-' ? total - numeric : total + numeric);
                }
            }
            valuesByKey[field.key] = total == null ? '' : total;
            formatsByKey[field.key] = resolved.find(item => item.row?.formatsByKey?.[field.key])?.row.formatsByKey[field.key]
                || field.fieldFormat?.numberFormat
                || null;
        });

        return {
            valuesByKey,
            formatsByKey,
            missing,
            hasErrorRow,
            anyLoading,
            blocked
        };
    }
};

window.YejiPlcxGsGuize = YejiPlcxGsGuize;
