// Trend AI private tool app: scoped execution for the rhythm analysis assistant.
const YejiPlcxQsAiGjApp = window.YejiAiApp.createToolApp({
    guize: window.YejiPlcxQsAiGjGuize,
    chaxun: window.YejiPlcxQsAiGjChaxun,
    toolNameKey: 'queryPanel',
    methodName: 'queryPanel',
    unknownError: toolName => `未知指标详解工具：${toolName}。`
});

window.YejiPlcxQsAiGjApp = YejiPlcxQsAiGjApp;
