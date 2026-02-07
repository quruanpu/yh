/**
 * 商品查询模块 - 入口文件
 *
 * 职责：
 * 1. 注册到系统导航
 * 2. 加载子模块
 * 3. 提供对外接口
 */
const ChaxunModule = {
    async init() {
        console.log('商品查询模块初始化');
        await this.loadSubModules();
        this.initModules();
        AppFramework.setModuleInstance('chaxun', this);
    },

    async loadSubModules() {
        const basePath = 'gongn/chaxun/';

        // 加载配置文件
        await this.loadScript(basePath + 'config.js');

        // 加载主框架样式
        this.loadCSS(basePath + 'kuangjia/yangshi.css');

        // 加载JS模块（按依赖顺序）
        const modules = [
            'gongju.js',
            'kapian/yangshi.js',
            'kapian/yewu.js',
            'tanchuang/yangshi.js',
            'tanchuang/yewu.js',
            'kuangjia/yewu.js'
        ];

        for (const mod of modules) {
            await this.loadScript(basePath + mod);
        }
    },

    loadCSS(href) {
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

    initModules() {
        if (window.ChaxunKapianYewu) ChaxunKapianYewu.init();
        if (window.TanchuangYewu) TanchuangYewu.init();
        if (window.KuangjiaYewu) KuangjiaYewu.init();
    },

    show() {
        if (window.KuangjiaYewu) {
            KuangjiaYewu.show();
        }
    },

    hide() {
        if (window.KuangjiaYewu) {
            KuangjiaYewu.hide();
        }
    }
};

// 注册模块到主框架
AppFramework.register({
    id: 'chaxun',
    name: '商品查询',
    icon: 'fa-solid fa-box',
    path: 'gongn/chaxun',
    order: 3
});

ChaxunModule.init();
