// BI unified AI app adapter.
const YejiBiAiApp = {
    register(app = window.YejiModule) {
        if (!window.YejiAiApp?.registerAdapter) return null;
        return window.YejiAiApp.registerAdapter({
            panelId: window.YejiBiAiGuize?.panelId || 'bi-unified',
            name: 'BI通用AI助手',
            scope: 'bi-unified',
            getSnapshot: () => window.YejiBiAiGuize?.buildSnapshot?.(app) || null,
            buildSystemPrompt: (snapshot, options = {}) => window.YejiBiAiGuize?.buildSystemPrompt?.(snapshot, options) || '',
            getTools: () => window.YejiBiAiGuize?.getTools?.(app) || [],
            executeTool: (toolName, rawArgs) => window.YejiBiAiGuize?.executeTool?.(app, toolName, rawArgs),
            open: () => {
                const aiState = app?.getBiAiState?.() || app?.state;
                if (aiState) aiState.biAiOpen = true;
                app?.renderBiAiSurface?.();
                return { ok: true };
            },
            close: () => {
                const aiState = app?.getBiAiState?.() || app?.state;
                if (aiState) aiState.biAiOpen = false;
                app?.renderBiAiSurface?.();
                return { ok: true };
            }
        });
    }
};

window.YejiBiAiApp = YejiBiAiApp;
