// BI batch query AI private tool app.
const YejiPlcxAiGjApp = window.YejiAiApp.createToolApp({
    guize: window.YejiPlcxAiGjGuize,
    chaxun: window.YejiPlcxAiGjChaxun,
    toolNameKey: 'queryPanel',
    methodName: 'queryPanel',
    unknownError: toolName => `未知 BI 查询工具：${toolName}。`
});

window.YejiPlcxAiGjApp = YejiPlcxAiGjApp;
