// 智聊模块统一配置
const ZhiLiaoConfig = {
    // GLM-4.6V API 配置
    api: {
        key: 'b19c0371e3af4b5b83c6682baff9ac30.ruRGrlPzrOZ5YjAp',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        model: 'glm-4.6v'
    },

    // 云函数配置
    cloudFunction: {
        uploadUrl: 'https://1317825751-jtfz816235.ap-guangzhou.tencentscf.com'
    },

    // 文件处理配置
    file: {
        maxTextLength: 10485760,      // 10MB
        maxCsvRows: 50,
        maxExcelRows: 50,
        maxPdfPages: 1000,
        uploadSizeThreshold: 5242880   // 5MB (超过此大小使用预签名URL)
    },

    // 消息历史配置
    message: {
        maxHistoryRounds: 8,           // 保留最近8轮对话（16条消息）- 充分利用128K上下文
        maxTokens: 120000              // 最大120K tokens（接近128K上限，留8K安全边界）
    },

    // 数据清理配置
    cleanup: {
        hoursToKeep: 1,                // 保留最近1小时的数据（每次刷新清理）
        autoCleanup: true              // 启动时自动清理
    }
};

// 导出配置
window.ZhiLiaoConfig = ZhiLiaoConfig;
