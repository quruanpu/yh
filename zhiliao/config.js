// 智聊模块统一配置
const ZhiLiaoConfig = {
    // 云函数配置
    cloudFunction: {
        uploadUrl: 'https://1317825751-jtfz816235.ap-guangzhou.tencentscf.com',
        gatewayUrl: 'https://ai.cfdaili.top/api',
        modelGatewayUrl: 'https://ai.cfdaili.top/api',
        networkToolUrl: 'https://1317825751-iw2m0lz7e9.ap-guangzhou.tencentscf.com',
        imageToolUrl: 'https://ai.cfdaili.top/api'
    },

    // 文件处理配置
    file: {
        maxTextLength: 10485760, // 10MB
        maxCsvRows: 50,
        maxExcelRows: 50,
        maxPdfPages: 1000,
        uploadSizeThreshold: 5242880 // 5MB（超过后走预签名 URL 上传）
    },

    // 轻量内存文件仓库配置（替代 IndexedDB）
    fileStore: {
        maxFilesPerSession: 20,
        maxTotalBytesPerSession: 32 * 1024 * 1024, // 32MB
        maxContentChars: 200000,
        maxAgeHours: 2
    },

    // 历史消息配置
    message: {
        maxHistoryRounds: 8,
        maxTokens: 120000
    },

    debug: {
        enabled: false
    }
};

window.ZhiLiaoConfig = ZhiLiaoConfig;

const ZhiLiaoLog = {
    isEnabled() {
        return window.ZhiLiaoConfig?.debug?.enabled === true;
    },

    debug(...args) {
        if (this.isEnabled()) console.debug('[智聊]', ...args);
    }
};

window.ZhiLiaoLog = ZhiLiaoLog;
