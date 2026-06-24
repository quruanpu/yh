// 工具中心模块入口
const GongjuzxModule = {
    async init() {
        await this.loadSubModules();
        this.initSubModules();
        AppFramework.setModuleInstance('gongjuzx', this);
    },

    async loadSubModules() {
        const basePath = 'gongn/gongjuzx/';
        await this.loadScript(basePath + 'config.js');
        this.loadCss(basePath + 'kuangjia/yangshi.css');

        const modules = [
            'gongju.js',
            'kapian/yewu.js',
            'tanchuang/yangshi.js',
            'tanchuang/yewu.js',
            'kuangjia/yewu.js'
        ];

        for (let i = 0; i < modules.length; i += 1) {
            await this.loadScript(basePath + modules[i]);
        }
    },

    initSubModules() {
        if (window.GongjuzxTanchuangYewu?.init) {
            GongjuzxTanchuangYewu.init();
        }
        if (window.GongjuzxKuangjiaYewu?.init) {
            GongjuzxKuangjiaYewu.init();
        }
    },

    loadCss(href) {
        if (document.querySelector(`link[href="${href}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    },

    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    show() {
        if (window.GongjuzxKuangjiaYewu?.show) {
            GongjuzxKuangjiaYewu.show();
        }
    },

    hide() {
        if (window.GongjuzxKuangjiaYewu?.hide) {
            GongjuzxKuangjiaYewu.hide();
        }
    }
};

AppFramework.register({
    id: 'gongjuzx',
    name: '工具中心',
    icon: 'fa-solid fa-toolbox',
    path: 'gongn/gongjuzx',
    order: 4
});

GongjuzxModule.init();
window.GongjuzxModule = GongjuzxModule;

