// BI summary query helpers: display formatting and Excel export.
const YejiPlcxGongju = {
    async ensureExcelLib() {
        if (window.AppFramework?.ensureExternalDependency) {
            await window.AppFramework.ensureExternalDependency('xlsx');
        }
        if (typeof XLSX === 'undefined') {
            throw new Error('Excel导出库未加载');
        }
    },

    formatDisplayValue(value, format, fallbackFormatter) {
        if (value == null || value === '') return '-';
        const numeric = Number(value);
        if (Number.isFinite(numeric) && numeric >= 10000) {
            return `${(numeric / 10000).toFixed(2)}万`;
        }
        if (typeof fallbackFormatter === 'function') {
            const formatted = fallbackFormatter(value, format);
            return formatted || '-';
        }
        return String(value);
    },

    normalizeExportValue(value) {
        if (value == null || value === '') return '';
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : value;
    },

    async downloadExcel({ exportRows = [], headers = [], filename = 'BI汇总查询.xlsx' } = {}) {
        await this.ensureExcelLib();
        const worksheet = XLSX.utils.json_to_sheet(exportRows, {
            header: headers
        });
        worksheet['!cols'] = [
            { wch: 24 },
            ...headers.slice(1).map(name => ({ wch: Math.max(14, Math.min(24, String(name || '').length + 6)) }))
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'BI汇总查询');
        XLSX.writeFile(workbook, filename);
    },

    makeFilename(prefix = 'BI汇总查询') {
        const now = new Date();
        const pad = value => String(value).padStart(2, '0');
        const stamp = [
            now.getFullYear(),
            pad(now.getMonth() + 1),
            pad(now.getDate())
        ].join('') + '_' + [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('');
        return `${prefix}_${stamp}.xlsx`;
    }
};

window.YejiPlcxGongju = YejiPlcxGongju;
