// BI operation result rendering business.
const YejiJgYewu = {
 renderUltraResult(json, options = {}) {
    const cm = json?.response?.chartMain;
    if (!cm) {
        if (!options.preserveSummary) this.renderSummaryState('');
        this.clearTable('响应中没有chartMain数据。');
        return;
    }

    const rowMeta = cm.row?.meta || [];
    const rowValues = cm.row?.values || [];
    const columnValues = cm.column?.values || [];
    const data = cm.data || [];
    const metricHeaders = this.normalizeMetricHeaders(columnValues);
    const formats = cm.column?.metricFieldFormat?.numberFormat || [];

    const rows = this.normalizeUltraRows(rowValues, data);
    const grandRows = rows.filter(row => row.isGrandtotal);
    const normalRows = rows.filter(row => !row.isGrandtotal);

    if (!grandRows.length && !normalRows.length) {
        if (!options.preserveSummary) this.renderSummaryState('');
        this.clearTable('暂无数据，请调整筛选条件后重试。');
        return;
    }

    const aggregateRow = !rowMeta.length && !rowValues.length && normalRows.length ? normalRows[0] : null;
    if (grandRows.length || aggregateRow) {
        const summaryRow = grandRows[0] || aggregateRow;
        this.state.summarySnapshot = {
            grandRow: summaryRow,
            metricHeaders,
            formats
        };
        this.renderSummaryCards(summaryRow, metricHeaders, formats);
    } else if (options.preserveSummary && this.state.summarySnapshot) {
        this.renderSummarySnapshot();
    } else {
        this.renderSummaryCards(null, metricHeaders, formats);
    }
    this.renderTable(rowMeta, metricHeaders, normalRows, formats);
    this.renderPager(cm, grandRows.length, normalRows.length);
},

normalizeUltraRows(rowValues = [], data = []) {
    if (rowValues.length) {
        return rowValues.map((dims, index) => ({
            dims: dims || [],
            metrics: data[index] || [],
            isGrandtotal: (dims || []).some(cell => cell?.isGrandtotal)
        }));
    }
    if (!Array.isArray(data) || !data.length) return [];
    const metrics = Array.isArray(data[0]) ? data[0] : data;
    return [{
        dims: [],
        metrics,
        isGrandtotal: false
    }];
},

normalizeMetricHeaders(columnValues) {
    const headers = columnValues.map(group => {
        if (Array.isArray(group)) return group[group.length - 1] || group[0] || {};
        return group || {};
    });
    if (headers.length) return headers;
    return this.getQueryMetricFields().map((field, index) => ({
        title: this.getMetricFieldDisplayName(field),
        name: this.getMetricFieldDisplayName(field),
        key: field.key,
        fdId: field.fdId,
        fmt_idx: index
    }));
},

renderSummaryCards(grandRow, metricHeaders, formats, options = {}) {
    const wrap = document.getElementById('yeji-summary-cards');
    if (!wrap) return;

    wrap.innerHTML = metricHeaders.map((metric, index) => {
        const fmtIndex = metric?.fmt_idx ?? index;
        const value = grandRow ? this.formatMetric(grandRow.metrics?.[index]?.v, formats[fmtIndex]) : '-';
        const label = this.getMetricFieldDisplayName(metric || this.getQueryMetricFields()[index] || {});
        const valueHtml = options.loading
            ? '<i class="fa-solid fa-spinner fa-spin"></i>'
            : this.escapeHtml(value || '-');
        return `
            <div class="yeji-summary-card">
                <div class="yeji-summary-label">${this.escapeHtml(label)}</div>
                <div class="yeji-summary-value">${valueHtml}</div>
            </div>
        `;
    }).join('');
},

renderSummarySnapshot() {
    const snapshot = this.state.summarySnapshot;
    if (!snapshot) return;
    this.renderSummaryCards(snapshot.grandRow, snapshot.metricHeaders, snapshot.formats);
},

renderSummaryState(message = '') {
    const metricHeaders = this.getQueryMetricFields();
    this.renderSummaryCards(null, metricHeaders, [], {
        loading: String(message || '').includes('查询中') || String(message || '').includes('加载中')
    });
},

hasVisibleTableData() {
    const wrap = document.getElementById('yeji-table-wrap');
    if (!wrap) return false;
    return !!wrap.querySelector('.yeji-table tbody tr:not(.yeji-empty-row)');
},

renderTable(rowMeta, metricHeaders, rows, formats) {
    const wrap = document.getElementById('yeji-table-wrap');
    if (!wrap) return;

    if (!rows.length) {
        this.clearTable('暂无数据，请调整筛选条件后重试。');
        return;
    }

    const dimensionHeaders = this.getDimensionHeaders(rowMeta);
    const ths = [
        ...dimensionHeaders.map((meta, index) => this.renderSortableHeader(meta, 'row', index)),
        ...metricHeaders.map((meta, index) => this.renderSortableHeader(meta, 'metric', index))
    ].join('');
    const trs = rows.map(row => `
        <tr>
            ${dimensionHeaders.map((_, index) => `<td>${this.escapeHtml(row.dims?.[index]?.title ?? '')}</td>`).join('')}
            ${metricHeaders.map((metric, index) => {
                const fmtIndex = metric?.fmt_idx ?? index;
                const value = this.formatMetric(row.metrics?.[index]?.v, formats[fmtIndex]);
                return `<td class="metric num">${this.escapeHtml(value)}</td>`;
            }).join('')}
        </tr>
    `).join('');

    wrap.innerHTML = `<table class="yeji-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
},

getDimensionHeaders(rowMeta = []) {
    return rowMeta.length
        ? rowMeta
        : this.getQueryRowFields().map(field => ({ title: this.getRowFieldDisplayName(field), name: this.getRowFieldDisplayName(field), key: field.key }));
},

getMetricHeaders(metricHeaders = []) {
    return metricHeaders.length
        ? metricHeaders
        : this.getQueryMetricFields().map(field => ({ title: this.getMetricFieldDisplayName(field), name: this.getMetricFieldDisplayName(field), key: field.key }));
},

renderTableState(message) {
    const wrap = document.getElementById('yeji-table-wrap');
    if (!wrap) return;
    const dimensionHeaders = this.getDimensionHeaders();
    const metricHeaders = this.getMetricHeaders();
    const ths = [
        ...dimensionHeaders.map((meta, index) => this.renderSortableHeader(meta, 'row', index)),
        ...metricHeaders.map((meta, index) => this.renderSortableHeader(meta, 'metric', index))
    ].join('');
    const colspan = Math.max(1, dimensionHeaders.length + metricHeaders.length);
    wrap.innerHTML = `<table class="yeji-table yeji-table-shell">
        <thead><tr>${ths}</tr></thead>
        <tbody>
            <tr class="yeji-empty-row">
                <td colspan="${colspan}">
                    <div class="yeji-empty">${this.escapeHtml(message || '正在查询中......')}</div>
                </td>
            </tr>
        </tbody>
    </table>`;
},

renderSortableHeader(meta = {}, type = 'row', index = 0) {
    const isMetric = type === 'metric';
    const label = isMetric ? this.getMetricFieldDisplayName(meta) : this.getRowFieldDisplayName(meta);
    const active = this.isActiveMainSortField(meta, label);
    const order = active ? this.state.mainSort?.order : '';
    const icon = order === 'asc' ? 'fa-sort-up' : order === 'desc' ? 'fa-sort-down' : 'fa-sort';
    const title = active && order === 'desc' ? '点击升序排序' : '点击降序排序';
    const fieldKey = this.escapeHtml(meta.key || '');
    const fieldName = this.escapeHtml(label);
    return `<th class="${isMetric ? 'metric' : ''}" data-main-sort-zone="${type}" data-main-sort-index="${index}">
        <span class="yeji-sort-header">
            <span class="yeji-sort-label">${fieldName}</span>
            <button type="button" class="yeji-sort-btn ${active ? 'active' : ''}" title="${title}" aria-label="${title}：${fieldName}"
                data-main-sort-field="${fieldKey}" data-main-sort-name="${fieldName}">
                <i class="fa-solid ${icon}"></i>
            </button>
        </span>
    </th>`;
},

isActiveMainSortField(meta = {}, label = '') {
    const sort = this.normalizeMainSort?.(this.state.mainSort);
    if (!sort) return false;
    if (sort.fieldKey && meta.key && sort.fieldKey === meta.key) return true;
    return !!sort.fieldName && sort.fieldName === label;
},

renderPager(cm, grandCount, normalCount) {
    this.state.totalCount = cm.count ?? 0;
    this.state.hasMoreData = !!cm.hasMoreData;

    const wrap = document.getElementById('yeji-pager-wrap');
    if (!wrap) return;

    const curPage = Math.floor(this.state.offset / this.ultra.limit) + 1;
    const totalPages = Math.max(1, Math.ceil(this.state.totalCount / this.ultra.limit));
    const pages = this.calcPageNums(curPage, totalPages, window.innerWidth <= 480 ? 5 : 7);
    const pageBtns = pages.map(page => {
        if (page === '...') return '<span class="yeji-pager-dots">...</span>';
        const cls = page === curPage ? 'yeji-pager-btn active' : 'yeji-pager-btn';
        return `<button class="${cls}" data-page="${page}">${page}</button>`;
    }).join('');

    wrap.innerHTML = `<div class="yeji-pager">
        <span class="yeji-pager-total">共 <b>${this.formatCount(this.state.totalCount)}</b> 条，本页明细 ${normalCount} 行，汇总 ${grandCount} 行</span>
        <div class="yeji-pager-nav">
            <button class="yeji-pager-btn" id="yeji-prev" ${curPage <= 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>
            ${pageBtns}
            <button class="yeji-pager-btn" id="yeji-next" ${!this.state.hasMoreData ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <div class="yeji-pager-jump">跳至 <input type="text" class="yeji-pager-input" id="yeji-jump" value="${curPage}" /> 页</div>
        <div class="yeji-conn-indicator">
            <span class="yeji-conn-dot ${this.state.proxyReady ? 'connected' : 'disconnected'}"></span>
        </div>
    </div>`;
    this.bindPagerEvents();
},

clearTable(message) {
    this.renderTableState(message);
    this.renderPagerShell();
    this.state.totalCount = 0;
    this.state.hasMoreData = false;
},

renderPagerShell() {
    const wrap = document.getElementById('yeji-pager-wrap');
    if (!wrap) return;
    wrap.innerHTML = `<div class="yeji-pager">
        <span class="yeji-pager-total">共 <b>0</b> 条，本页明细 0 行，汇总 0 行</span>
        <div class="yeji-pager-nav">
            <button class="yeji-pager-btn" disabled><i class="fa-solid fa-chevron-left"></i></button>
            <button class="yeji-pager-btn active" disabled>1</button>
            <button class="yeji-pager-btn" disabled><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <div class="yeji-pager-jump">跳至 <input type="text" class="yeji-pager-input" value="1" disabled /> 页</div>
        <div class="yeji-conn-indicator">
            <span class="yeji-conn-dot ${this.state.proxyReady ? 'connected' : 'disconnected'}"></span>
        </div>
    </div>`;
},

calcPageNums(cur, total, maxVisible = 7) {
    if (total <= maxVisible) return Array.from({ length: total }, (_, index) => index + 1);
    const pages = [];
    const side = Math.floor((maxVisible - 2) / 2);
    if (cur <= side + 2) {
        for (let i = 1; i <= maxVisible - 2; i++) pages.push(i);
        pages.push('...', total);
    } else if (cur >= total - side - 1) {
        pages.push(1, '...');
        for (let i = total - (maxVisible - 3); i <= total; i++) pages.push(i);
    } else {
        pages.push(1, '...');
        for (let i = cur - side + 1; i <= cur + side - 1; i++) pages.push(i);
        pages.push('...', total);
    }
    return pages;
},

getDefaultDateRange() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = this.addDays(today, -1);
    if (start > end) start = end;
    return [this.formatDate(start), this.formatDate(end)];
},

addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
},

formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
},

formatMetric(value, format) {
    if (value == null || Number.isNaN(Number(value))) return '';
    const numeric = Number(value);
    if (format?.specifier?.includes('%')) {
        const places = Number(format.decimalPlaces ?? 2);
        const divisor = Number(format.divideDataBy ?? 1) || 1;
        return `${((numeric / divisor) * 100).toFixed(places)}%`;
    }
    return numeric.toLocaleString('zh-CN', {
        useGrouping: false,
        minimumFractionDigits: Number(format?.decimalPlaces ?? 0),
        maximumFractionDigits: Number(format?.decimalPlaces ?? 2)
    });
},

formatCount(value) {
    return Number(value || 0).toLocaleString('zh-CN');
},

escapeHtml(value) {
    if (window.YejiGongju?.escapeHtml) return window.YejiGongju.escapeHtml(value);
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
},

_resetSearchBtn() {
    this.setQueryBusy(false);
},

_showToast(msg, type = 'info') {
    const normalizedType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
    if (window.Tongzhi) {
        if (typeof window.Tongzhi[normalizedType] === 'function') {
            window.Tongzhi[normalizedType](msg);
            return;
        }
        if (typeof window.Tongzhi.show === 'function') {
            window.Tongzhi.show(msg, normalizedType);
            return;
        }
    }

    console[normalizedType === 'error' ? 'error' : 'log'](`[yeji] ${msg}`);
},
};

window.YejiJgYewu = YejiJgYewu;

