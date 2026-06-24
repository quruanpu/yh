// BI summary trend algorithm business: expose summary-level analysis.
const YejiPlcxQsSuanfaYewu = {
buildBatchTrendSummary(rows = [], context = this.state.batchTrendContext) {
    return window.YejiPlcxQsSuanfaGuize?.analyzeTrendSummary(rows || [], context) || null;
}
};

window.YejiPlcxQsSuanfaYewu = YejiPlcxQsSuanfaYewu;
