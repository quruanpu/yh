const ZhiLiaoZjgQidongModule = (() => {
    const methods = {
        async init() {
            await this.bootstrapLayout();
            await this.bootstrapStorage();
            await this.bootstrapTools();
            await this.bootstrapInteractive();
            return this.state;
        },

        async bootstrapLayout() {
            this.loadSubModules();
            this.render();
            window.ZhiLiaoBujuModule?.bindScrollDetection?.();
            this.bindEvents();
        },

        async bootstrapStorage() {
            if (window.ZhiLiaoMoxingJiemianModule?.init) {
                await window.ZhiLiaoMoxingJiemianModule.init();
            }
            await window.DBModule?.init?.();

            try {
                await window.SessionDB?.init?.();
                const savedMeta = await window.SessionDB?.getSessionMeta?.();
                if (savedMeta?.sessionId) {
                    this.state.sessionId = savedMeta.sessionId;
                    await this.restoreSession();
                } else {
                    this.state.sessionId = `session-${Date.now()}`;
                    await window.SessionDB?.saveSessionMeta?.({
                        sessionId: this.state.sessionId,
                        createdAt: Date.now()
                    });
                }
            } catch (error) {
                this.logWarn('SessionDB 初始化失败，使用新会话', error);
                this.state.sessionId = `session-${Date.now()}`;
            }
        },

        async bootstrapTools() {
            if (window.ToolRegistry && window.ToolDefinitions) {
                ToolRegistry.init();
                this.logDebug('Tool registry initialized');
            }
        },

        async bootstrapInteractive() {
            if (window.ZhiLiaoCaidanModule?.init) {
                await window.ZhiLiaoCaidanModule.init();
            }
        },

        loadSubModules() {
            const ensureStylesheet = (href) => {
                if (document.querySelector(`link[href="${href}"]`)) return;
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                document.head.appendChild(link);
            };

            ensureStylesheet('zhiliao/gongju/zhiling/zhiling.css');
            ensureStylesheet('gongn/chaxun/kuangjia/yangshi.css');
        },

        render() {
            const container = document.getElementById('module-container');
            window.ZhiLiaoBujuModule?.render?.(container);
            this.state.container = container;
        },

        async restoreSession() {
            const apiHistory = await window.SessionDB?.getApiHistory?.() || [];
            const displayMessages = await window.SessionDB?.getAllMessages?.() || [];

            if (displayMessages.length === 0 && apiHistory.length === 0) return;

            this.activateChatView();

            if (apiHistory.length > 0) {
                this.state.messageHistory = apiHistory;
            }

            if (displayMessages.length > 0) {
                window.ZhiLiaoBujuModule?.restoreMessages?.(displayMessages);
            }

            const imagePool = await window.SessionDB?.getImagePool?.() || [];
            if (imagePool.length > 0 && window.ShengtuToolModule) {
                ShengtuToolModule.initImagePoolState();
                ShengtuToolModule.state.imagePool = imagePool;
                const maxRef = imagePool.reduce((max, item) => {
                    const match = String(item.ref || '').match(/^img_(\d+)$/);
                    return match ? Math.max(max, Number(match[1])) : max;
                }, 0);
                if (maxRef > 0) ShengtuToolModule.state.nextImageRefIndex = maxRef + 1;
            }

            const files = await window.SessionDB?.getAllFiles?.() || [];
            if (files.length > 0 && window.DBModule) {
                DBModule.state.files = files;
                const maxId = files.reduce((max, f) => Math.max(max, Number(f.id) || 0), 0);
                if (maxId >= DBModule.state.nextId) DBModule.state.nextId = maxId + 1;
            }
        },

        bindEvents() {
            window.ZhiLiaoJiaohuModule?.bindEvents?.(this.state, () => this.sendMessage());
        },

        removeFile(index) {
            window.ZhiLiaoJiaohuModule?.removeFile?.(index, this.state);
        },

        resetMessageInput(textarea) {
            if (!textarea) return;
            textarea.value = '';
            textarea.style.height = 'auto';
        },

        activateChatView() {
            const welcomeScreen = document.getElementById('welcome-screen');
            const messageContainer = document.getElementById('message-container');
            if (welcomeScreen?.style.display !== 'none') {
                welcomeScreen.style.display = 'none';
                messageContainer?.classList.add('active');
            }
        },

        async startNewSession() {
            const nextSessionId = `session-${Date.now()}`;
            if (this.state.currentAbortController) {
                this.state.currentAbortController.abort();
                this.state.currentAbortController = null;
            }
            this.setWaitingState?.(false);
            this.state.sessionId = nextSessionId;
            this.nextSnapshotGeneration?.();
            this.resetMediaTaskState?.('媒体任务所属会话已切换');
            await Promise.resolve(this.state.snapshotPersistChain).catch(() => {});
            await window.SessionDB?.clearAll?.();
            this.state.messageHistory = [];
            await window.SessionDB?.saveSessionMeta?.({
                sessionId: nextSessionId,
                createdAt: Date.now()
            });
            if (window.DBModule) DBModule.state.files = [];
            if (window.ShengtuToolModule) {
                ShengtuToolModule.state.imagePool = [];
                ShengtuToolModule.state.nextImageRefIndex = 1;
            }
            this.state.mediaArtifacts = {
                items: {},
                nextSeq: 1,
                maxItems: 40
            };
            this.state.mediaResources = {
                images: [],
                videos: [],
                nextImageIndex: 1,
                nextVideoIndex: 1,
                maxItems: 24
            };
            const messageContainer = document.getElementById('message-container');
            if (messageContainer) messageContainer.innerHTML = '';
            const welcomeScreen = document.getElementById('welcome-screen');
            if (welcomeScreen) welcomeScreen.style.display = '';
            messageContainer?.classList.remove('active');
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

window.ZhiLiaoZjgQidongModule = ZhiLiaoZjgQidongModule;
