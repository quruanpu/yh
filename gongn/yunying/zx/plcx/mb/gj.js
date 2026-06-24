// BI summary target helpers: date range, Excel template/upload, and achievement math.
const YejiPlcxMbGongju = {
    async ensureExcelLib() {
        if (window.AppFramework?.ensureExternalDependency) {
            await window.AppFramework.ensureExternalDependency('xlsx');
        }
        if (typeof XLSX === 'undefined') throw new Error('Excel导出库未加载');
    },

    normalizeDate(value) {
        if (value == null || value === '') return '';
        if (value instanceof Date && !Number.isNaN(value.getTime())) return this.formatDate(value);
        if (typeof value === 'number' && Number.isFinite(value)) {
            const compact = this.normalizeCompactDate(String(Math.trunc(value)));
            return compact || this.formatExcelSerialDate(value);
        }

        const text = String(value).trim();
        const compact = this.normalizeCompactDate(text);
        if (compact) return compact;
        const match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
        if (!match) return '';
        return this.normalizeDateParts(match[1], match[2], match[3]);
    },

    normalizeCompactDate(text) {
        const match = String(text || '').trim().match(/^(\d{4})(\d{2})(\d{2})$/);
        if (!match) return '';
        return this.normalizeDateParts(match[1], match[2], match[3]);
    },

    normalizeDateParts(yearText, monthText, dayText) {
        const year = Number(yearText);
        const month = Number(monthText);
        const day = Number(dayText);
        if (!year || month < 1 || month > 12 || day < 1 || day > 31) return '';
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
        return this.formatDate(date);
    },

    formatExcelSerialDate(serial) {
        const utc = Math.round((serial - 25569) * 86400 * 1000);
        const date = new Date(utc);
        if (Number.isNaN(date.getTime())) return '';
        return this.formatDate(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    },

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    makeRangeKey(startDate, endDate) {
        const start = this.normalizeDate(startDate);
        const end = this.normalizeDate(endDate);
        if (!start || !end) return '';
        return `${start.replaceAll('-', '')}_${end.replaceAll('-', '')}`;
    },

    makeRangeLabel(startDate, endDate) {
        return this.makeRangeKey(startDate, endDate);
    },

    async downloadTemplate({ rows: templateRows = [], metricNames = [], startDate = '', endDate = '', filename = '' } = {}) {
        await this.ensureExcelLib();
        const sheetRows = [
            ['开始日期', startDate ? startDate.replaceAll('-', '/') : '', '结束日期', endDate ? endDate.replaceAll('-', '/') : ''],
            ['模板ID', '项目名称', ...metricNames.map(name => `${name}目标`)],
            ...templateRows.map(item => [
                item.key || '',
                item.name || '未命名模板',
                ...metricNames.map(name => item.targets?.[name] ?? '')
            ])
        ];
        const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
        worksheet['!cols'] = [
            { wch: 18 },
            { wch: 28 },
            ...metricNames.map(name => ({ wch: Math.max(16, Math.min(28, String(name || '').length + 8)) }))
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '目标模板');
        XLSX.writeFile(workbook, filename || this.makeTargetTemplateFilename(startDate, endDate));
    },

    makeTargetTemplateFilename(startDate, endDate) {
        const key = this.makeRangeKey(startDate, endDate);
        return `BI目标模板_${key || '待填写日期'}.xlsx`;
    },

    async readWorkbook(file) {
        await this.ensureExcelLib();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => {
                try {
                    const workbook = XLSX.read(event.target.result, { type: 'array', cellDates: false });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
                    this.normalizeWorkbookDateCells(sheet, rows);
                    resolve(this.parseRows(rows));
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('目标文件读取失败'));
            reader.readAsArrayBuffer(file);
        });
    },

    normalizeWorkbookDateCells(sheet, rows) {
        rows[0] = rows[0] || [];
        rows[0][1] = this.readWorkbookDateCell(sheet, 'B1', rows[0][1]);
        rows[0][3] = this.readWorkbookDateCell(sheet, 'D1', rows[0][3]);
    },

    readWorkbookDateCell(sheet, address, fallback) {
        const cell = sheet?.[address];
        const candidates = [cell?.w, cell?.v, fallback];
        for (const candidate of candidates) {
            const normalized = this.normalizeDate(candidate);
            if (normalized) return normalized;
        }
        return fallback;
    },

    parseRows(rows = []) {
        const firstRow = rows[0] || [];
        const startDate = this.normalizeDate(firstRow[1]);
        const endDate = this.normalizeDate(firstRow[3]);
        const rangeKey = this.makeRangeKey(startDate, endDate);
        if (!startDate || !endDate || !rangeKey) throw new Error('目标模板日期格式不正确');
        if (new Date(`${startDate}T00:00:00`) > new Date(`${endDate}T00:00:00`)) {
            throw new Error('目标模板开始日期不能晚于结束日期');
        }

        const header = rows[1] || [];
        const metricColumns = header.slice(2).map((name, offset) => ({
            index: offset + 2,
            metricName: this.cleanMetricHeader(name)
        })).filter(item => item.metricName);

        if (!metricColumns.length) throw new Error('目标模板缺少目标字段');

        const items = rows.slice(2)
            .map(row => this.parseItemRow(row, metricColumns))
            .filter(item => item.templateKey || item.templateName);

        if (!items.length) throw new Error('目标模板没有可上传的项目数据');

        return {
            startDate,
            endDate,
            rangeKey,
            label: this.makeRangeLabel(startDate, endDate),
            metricNames: metricColumns.map(item => item.metricName),
            items
        };
    },

    cleanMetricHeader(name) {
        return String(name || '').trim().replace(/目标$/, '').trim();
    },

    parseItemRow(row = [], metricColumns = []) {
        const targets = {};
        metricColumns.forEach(column => {
            targets[column.metricName] = this.normalizeTargetValue(row[column.index]);
        });
        return {
            templateKey: String(row[0] || '').trim(),
            templateName: String(row[1] || '').trim(),
            targets
        };
    },

    normalizeTargetValue(value) {
        if (value == null || String(value).trim() === '') return '';
        const text = String(value).replace(/,/g, '').trim();
        const numeric = Number(text);
        return Number.isFinite(numeric) ? numeric : String(value).trim();
    },

    isRateMetric(metricName = '') {
        const name = String(metricName || '').trim();
        if (!name) return false;
        if (window.YejiPlcxQsLfxGuize?.getRateMeta?.(name)) return true;
        return /率$/.test(name);
    },

    toNumber(value) {
        if (value == null || value === '') return null;
        const text = String(value).replace(/,/g, '').trim();
        const numeric = Number(text.replace(/[%％]$/, ''));
        if (!Number.isFinite(numeric)) return null;
        return /[%％]$/.test(text) ? numeric / 100 : numeric;
    },

    normalizeRateTarget(value) {
        const numeric = this.toNumber(value);
        if (numeric == null) return null;
        return Math.abs(numeric) > 1 ? numeric / 100 : numeric;
    },

    formatRateTargetValue(value) {
        const numeric = this.normalizeRateTarget(value);
        if (numeric == null) return '-';
        return `${(numeric * 100).toFixed(2)}%`;
    },

    formatTargetValue(value, formatter, metricName = '') {
        if (value == null || value === '') return '-';
        if (this.isRateMetric(metricName)) return this.formatRateTargetValue(value);
        if (typeof formatter === 'function') return formatter(value, null) || '-';
        return String(value);
    },

    calcAchievement(actualValue, targetValue, metricName = '') {
        const actual = this.toNumber(actualValue);
        const target = this.isRateMetric(metricName)
            ? this.normalizeRateTarget(targetValue)
            : this.toNumber(targetValue);
        if (!Number.isFinite(actual) || !Number.isFinite(target) || target === 0) return '';
        return actual / target;
    },

    formatAchievement(value) {
        if (value == null || value === '' || !Number.isFinite(Number(value))) return '-';
        return `${(Number(value) * 100).toFixed(2)}%`;
    }
};

window.YejiPlcxMbGongju = YejiPlcxMbGongju;
