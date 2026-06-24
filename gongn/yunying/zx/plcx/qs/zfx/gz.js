// Value trend analysis rules: stage loader and aggregate entry.
const YejiPlcxQsZfxGuize = {
    stageFiles: {
        jd1: 'gongn/yunying/zx/plcx/qs/zfx/jd/jd1.js',
        jd2: 'gongn/yunying/zx/plcx/qs/zfx/jd/jd2.js',
        jd3Gj: 'gongn/yunying/zx/plcx/qs/zfx/jd/jd3/gj.js',
        jd3Yccl: 'gongn/yunying/zx/plcx/qs/zfx/jd/jd3/yccl.js',
        jd3Jzr: 'gongn/yunying/zx/plcx/qs/zfx/jd/jd3/jizhunri.js',
        jd3Tz: 'gongn/yunying/zx/plcx/qs/zfx/jd/jd3/tz.js',
        jd3Jz: 'gongn/yunying/zx/plcx/qs/zfx/jd/jd3/jz.js',
        jd3Ls: 'gongn/yunying/zx/plcx/qs/zfx/jd/jd3/lishi.js',
        jd3Yc: 'gongn/yunying/zx/plcx/qs/zfx/jd/jd3/yuce.js',
        jd3: 'gongn/yunying/zx/plcx/qs/zfx/jd/jd3.js',
        jd4: 'gongn/yunying/zx/plcx/qs/zfx/jd/jd4.js'
    },

    stageGlobals: {
        jd1: 'YejiPlcxQsZfxJd1',
        jd2: 'YejiPlcxQsZfxJd2',
        jd3Gj: 'YejiPlcxQsZfxJd3Gongju',
        jd3Yccl: 'YejiPlcxQsZfxJd3Yuchuli',
        jd3Jzr: 'YejiPlcxQsZfxJd3Jizhunri',
        jd3Tz: 'YejiPlcxQsZfxJd3Tezheng',
        jd3Jz: 'YejiPlcxQsZfxJd3Jizhun',
        jd3Ls: 'YejiPlcxQsZfxJd3Lishi',
        jd3Yc: 'YejiPlcxQsZfxJd3Yuce',
        jd3: 'YejiPlcxQsZfxJd3',
        jd4: 'YejiPlcxQsZfxJd4'
    },

    enabledStages: ['jd1', 'jd2', 'jd3Gj', 'jd3Yccl', 'jd3Jzr', 'jd3Tz', 'jd3Jz', 'jd3Ls', 'jd3Yc', 'jd3', 'jd4'],
    loadedStages: new Set(),
    loadingStages: {},
    ready: null,

    ensureReady(stages = this.enabledStages) {
        const stageList = Array.isArray(stages) && stages.length ? stages : this.enabledStages;
        if (
            this.ready &&
            stageList.every(stage => this.loadedStages.has(stage))
        ) {
            return this.ready;
        }
        this.ready = stageList.reduce((chain, stage) => {
            return chain.then(() => this.ensureStage(stage));
        }, Promise.resolve()).then(() => this);
        return this.ready;
    },

    ensureStage(stage) {
        const name = String(stage || '').trim();
        if (!name) return Promise.resolve(this);
        if (this.loadedStages.has(name)) return Promise.resolve(this);
        if (this.loadingStages[name]) return this.loadingStages[name];

        const src = this.stageFiles[name];
        if (!src) return Promise.reject(new Error(`值模型阶段未配置：${name}`));

        this.loadingStages[name] = this.loadScript(src, this.stageGlobals[name])
            .then(() => this.applyStage(name))
            .then(() => {
                this.loadedStages.add(name);
                delete this.loadingStages[name];
                return this;
            })
            .catch(error => {
                delete this.loadingStages[name];
                throw error;
            });
        return this.loadingStages[name];
    },

    loadScript(src, expectedGlobal) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                if (existing.dataset.loaded === '1' || (expectedGlobal && window[expectedGlobal])) {
                    resolve();
                    return;
                }
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', () => reject(new Error(`值模型阶段脚本加载失败：${src}`)), { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                script.dataset.loaded = '1';
                resolve();
            };
            script.onerror = () => reject(new Error(`值模型阶段脚本加载失败：${src}`));
            document.head.appendChild(script);
        });
    },

    applyStage(stage) {
        const globalName = this.stageGlobals[stage];
        const module = globalName ? window[globalName] : null;
        if (!module || typeof module !== 'object') {
            throw new Error(`值模型阶段未注册：${stage}`);
        }
        Object.assign(this, module);
        return this;
    },

    registerStage(name, src, globalName) {
        if (!name || !src || !globalName) return;
        this.stageFiles[name] = src;
        this.stageGlobals[name] = globalName;
        if (!this.enabledStages.includes(name)) this.enabledStages.push(name);
    }
};

window.YejiPlcxQsZfxGuize = YejiPlcxQsZfxGuize;
