const ZhiLiaoZjgMoxingModule = (() => {
    const methods = {
        async getActiveModelOption() {
            if (!window.ZhiLiaoMoxingYewuModule) {
                throw new Error('模型选择模块未加载');
            }

            const active = ZhiLiaoMoxingYewuModule.getActiveOption();
            if (active) {
                this.state.currentModelOption = active;
                return active;
            }

            const synced = await ZhiLiaoMoxingYewuModule.syncActiveOption();
            if (synced) {
                this.state.currentModelOption = synced;
                return synced;
            }

            throw new Error('当前无可用模型，请先在模型配置中添加并启用模型。');
        }
    };

    return {
        methods,
        applyTo(appModule) {
            if (!appModule || typeof appModule !== 'object') return appModule;
            Object.assign(appModule, methods);
            return appModule;
        }
    };
})();

window.ZhiLiaoZjgMoxingModule = ZhiLiaoZjgMoxingModule;
