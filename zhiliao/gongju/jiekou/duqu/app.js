/**
 * File Read Tool Bootstrap
 * Registration layer only.
 */
const FileReadToolModule = {
    state: {
        registered: false,
        timer: null
    },

    registerTools() {
        if (this.state.registered) return true;
        if (!window.ToolRegistry) return false;
        if (!window.FileReadToolDefinitions) return false;

        const tools = FileReadToolDefinitions.create(window.FileReadService);
        if (!Array.isArray(tools) || tools.length === 0) return false;

        let successCount = 0;
        for (let i = 0; i < tools.length; i += 1) {
            const ok = ToolRegistry.register(tools[i]);
            if (ok) successCount += 1;
        }

        this.state.registered = successCount === tools.length;
        if (this.state.registered) {
            if (this.state.timer) {
                clearTimeout(this.state.timer);
                this.state.timer = null;
            }
            window.ZhiLiaoLog?.debug?.(`FileReadToolModule registered ${successCount} tools`);
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

window.FileReadToolModule = FileReadToolModule;
FileReadToolModule.init();
