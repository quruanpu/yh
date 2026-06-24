// Dialog interaction entry: render controls and wire independent modules.
const YejiHudongModule = {
    scripts: {
        fullscreen: {
            src: 'gongn/yunying/zx/hd/fs.js',
            global: 'YejiHudongFullscreen',
            promise: null
        },
        image: {
            src: 'gongn/yunying/zx/hd/tp.js',
            global: 'YejiHudongTupian',
            promise: null
        }
    },

    renderActions(type = '') {
        return `
            <div class="yeji-modal-actions" data-modal-actions="${type}">
                <button type="button" class="yeji-modal-action-btn" data-modal-copy-image title="复制为图片" aria-label="复制为图片">
                    <i class="fa-regular fa-images"></i>
                </button>
                <button type="button" class="yeji-modal-action-btn" data-modal-fullscreen title="全屏" aria-label="全屏">
                    <i class="fa-solid fa-expand"></i>
                </button>
            </div>
        `;
    },

    bind(root, options = {}) {
        const container = typeof root === 'string' ? document.querySelector(root) : root;
        if (!container) return;
        const dialogSelector = options.dialogSelector || '.yeji-batch-dialog, .yeji-trend-dialog';
        const dialog = container.matches(dialogSelector) ? container : container.querySelector(dialogSelector);
        if (!dialog) return;

        container.querySelectorAll('[data-modal-copy-image]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const module = await this.ensureModule('image');
                module.copy(dialog, btn);
            });
        });
        container.querySelectorAll('[data-modal-fullscreen]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const module = await this.ensureModule('fullscreen');
                module.toggle(dialog, btn);
            });
            this.ensureModule('fullscreen')
                .then(module => module.syncButton(dialog, btn))
                .catch(error => console.warn('[yeji] 全屏模块加载失败', error));
        });
    },

    ensureModule(name) {
        const item = this.scripts[name];
        if (!item) return Promise.reject(new Error(`未知弹窗交互模块：${name}`));
        if (window[item.global]) return Promise.resolve(window[item.global]);
        if (item.promise) return item.promise;
        item.promise = new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${item.src}"]`);
            if (existing) {
                existing.addEventListener('load', () => window[item.global] ? resolve(window[item.global]) : reject(new Error(`${name}模块未初始化`)), { once: true });
                existing.addEventListener('error', () => reject(new Error(`${name}模块加载失败`)), { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = item.src;
            script.onload = () => window[item.global] ? resolve(window[item.global]) : reject(new Error(`${name}模块未初始化`));
            script.onerror = () => reject(new Error(`${name}模块加载失败`));
            document.head.appendChild(script);
        }).catch(error => {
            item.promise = null;
            throw error;
        });
        return item.promise;
    }
};

window.YejiHudongModule = YejiHudongModule;
