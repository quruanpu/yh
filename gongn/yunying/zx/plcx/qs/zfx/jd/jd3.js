// Value trend stage 3: weighted forecast, history curve calibration, and remaining pressure.
const YejiPlcxQsZfxJd3 = {
    decorateStage3Rows(rows = [], context = {}) {
        return (rows || []).map((row, index, list) => {
            if (row.loading) return row;
            const baseRow = this.decorateStage3BaseRow(row, index, list, context);
            return this.decorateStage3ForecastRow(baseRow, context);
        });
    },

    decorateRows(rows = [], context = {}) {
        const stage1Rows = typeof this.decorateStage1Rows === 'function'
            ? this.decorateStage1Rows(rows)
            : rows;
        const stage2Rows = typeof this.decorateStage2Rows === 'function'
            ? this.decorateStage2Rows(stage1Rows, context)
            : stage1Rows;
        return this.decorateStage3Rows(stage2Rows, context);
    }
};

window.YejiPlcxQsZfxJd3 = YejiPlcxQsZfxJd3;
