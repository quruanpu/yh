// Value trend stage 1: linear achievement, pace, speed, and acceleration.
const YejiPlcxQsZfxJd1 = {
    toNumber(value) {
        if (window.YejiPlcxQsGuize?.toNumber) return window.YejiPlcxQsGuize.toNumber(value);
        if (value == null || value === '') return null;
        const numeric = Number(String(value).replace(/,/g, '').trim());
        return Number.isFinite(numeric) ? numeric : null;
    },

    calcAchievement(actual, target) {
        const actualNumber = this.toNumber(actual);
        const targetNumber = this.toNumber(target);
        if (actualNumber == null || targetNumber == null || targetNumber === 0) return '';
        return actualNumber / targetNumber;
    },

    calcGap(achievement, progress) {
        const value = this.toNumber(achievement);
        const base = this.toNumber(progress);
        if (value == null || base == null) return '';
        return value - base;
    },

    calcPace(achievement, progress) {
        const value = this.toNumber(achievement);
        const base = this.toNumber(progress);
        if (value == null || base == null || base === 0) return '';
        return value / base;
    },

    calcSpeed(previous, current) {
        if (!previous || !current) return '';
        const achievementDiff = this.calcGap(current.achievement, previous.achievement);
        const progressDiff = this.calcGap(current.queryProgress, previous.queryProgress);
        if (achievementDiff === '' || progressDiff === '' || progressDiff === 0) return '';
        return achievementDiff / progressDiff;
    },

    calcAcceleration(previousSpeed, currentSpeed) {
        const previous = this.toNumber(previousSpeed);
        const current = this.toNumber(currentSpeed);
        if (previous == null || current == null) return '';
        return current - previous;
    },

    decorateStage1Rows(rows = []) {
        let previous = null;
        let previousSpeed = '';
        return rows.map(row => {
            const speed = this.calcSpeed(previous, row);
            const acceleration = this.calcAcceleration(previousSpeed, speed);
            const next = {
                ...row,
                gap: this.calcGap(row.achievement, row.queryProgress),
                pace: this.calcPace(row.achievement, row.queryProgress),
                speed,
                acceleration
            };
            previous = next;
            if (speed !== '') previousSpeed = speed;
            return next;
        });
    },

    decorateRows(rows = []) {
        return this.decorateStage1Rows(rows);
    }
};

window.YejiPlcxQsZfxJd1 = YejiPlcxQsZfxJd1;
