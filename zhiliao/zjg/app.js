const ZhiLiaoZjgAppModule = {
    applyTo(appModule) {
        if (!appModule || typeof appModule !== 'object') return appModule;

        const requiredModules = [
            'ZhiLiaoZjgYituModule',
            'ZhiLiaoZjgMoxingModule',
            'ZhiLiaoZjgMeitiCelueModule',
            'ZhiLiaoZjgMeitiChengguoModule',
            'ZhiLiaoZjgMeitiZiyuanModule',
            'ZhiLiaoZjgWenjianModule',
            'ZhiLiaoZjgYasuoModule',
            'ZhiLiaoZjgWangguanModule',
            'ZhiLiaoZjgXianshiModule',
            'ZhiLiaoZjgJiaohuModule',
            'ZhiLiaoZjgMeitiRenwuModule',
            'ZhiLiaoZjgLiushiModule',
            'ZhiLiaoZjgKuaizhaoModule',
            'ZhiLiaoZjgQidongModule',
            'ZhiLiaoZjgZhilingModule',
            'ZhiLiaoZjgLiaochengModule'
        ];

        for (let i = 0; i < requiredModules.length; i += 1) {
            const moduleName = requiredModules[i];
            const moduleRef = window[moduleName];
            if (!moduleRef || typeof moduleRef.applyTo !== 'function') {
                throw new Error(`[智聊] 子架构模块缺失或无效: ${moduleName}`);
            }
            moduleRef.applyTo(appModule);
        }

        return appModule;
    }
};

window.ZhiLiaoZjgAppModule = ZhiLiaoZjgAppModule;
