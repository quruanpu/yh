/**
 * Notebook Tool Bootstrap
 */
const NotebookToolModule = {
    state: {
        registered: false,
        timer: null
    },

    registerTools() {
        if (this.state.registered) return true;
        if (!window.ToolRegistry) return false;
        if (!window.NotebookToolDefinitions) return false;

        const tools = NotebookToolDefinitions.create(window.NotebookService);
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
            window.ZhiLiaoLog?.debug?.(`NotebookToolModule registered ${okCount} tool(s)`);
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

window.NotebookToolModule = NotebookToolModule;
NotebookToolModule.init();
