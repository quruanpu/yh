/**
 * Tool Center AI Tool Bootstrap
 */
const ToolCenterAiToolModule = {
    state: {
        registered: false,
        timer: null
    },

    registerTools() {
        if (this.state.registered) return true;
        if (!window.ToolRegistry) return false;
        if (!window.ToolCenterAiToolDefinitions) return false;

        const tools = ToolCenterAiToolDefinitions.create(window.ToolCenterAiService);
        if (!Array.isArray(tools) || tools.length === 0) return false;

        let okCount = 0;
        for (let i = 0; i < tools.length; i += 1) {
            const ok = ToolRegistry.register(tools[i]);
            if (ok) okCount += 1;
        }

        this.state.registered = okCount === tools.length;
        if (this.state.registered) {
            if (this.state.timer) {
                clearTimeout(this.state.timer);
                this.state.timer = null;
            }
            window.ZhiLiaoLog?.debug?.(`ToolCenterAiToolModule registered ${okCount} tool(s)`);
        }

        return this.state.registered;
    },

    init() {
        const tryRegister = () => {
            const done = this.registerTools();
            if (done) return;
            this.state.timer = setTimeout(tryRegister, 120);
        };
        tryRegister();
    }
};

window.ToolCenterAiToolModule = ToolCenterAiToolModule;
ToolCenterAiToolModule.init();
