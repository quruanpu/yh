// 公共工具模块
const UtilsModule = {
    // 计时器工具
    Timer: {
        timers: new Map(),

        // 开始计时
        start(timerId) {
            this.timers.set(timerId, Date.now());
        },

        // 获取时长（秒）
        getDuration(timerId) {
            const startTime = this.timers.get(timerId);
            if (!startTime) return 0;
            return Math.round((Date.now() - startTime) / 1000);
        },

        // 停止计时并返回时长
        stop(timerId) {
            const duration = this.getDuration(timerId);
            this.timers.delete(timerId);
            return duration;
        },

        // 清除计时器
        clear(timerId) {
            this.timers.delete(timerId);
        }
    }
};

// 导出模块
window.UtilsModule = UtilsModule;
