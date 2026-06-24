// BI main page AI private tool app.
const YejiMainAiGjApp = window.YejiAiApp.createToolApp({
    guize: window.YejiMainAiGjGuize,
    chaxun: window.YejiMainAiGjChaxun,
    toolNameKey: 'queryPage',
    methodName: 'queryPage',
    unknownError: toolName => `未知 BI 主查询工具：${toolName}。`
});

window.YejiMainAiGjApp = YejiMainAiGjApp;
