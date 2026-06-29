(function setupZhiLiaoLoader() {
    const ZhiLiaoLoader = {
        state: {
            bootstrapped: false,
            shellRegistered: false,
            shellInteractionGuardBound: false,
            coreLoading: false,
            coreLoadScheduled: false,
            coreInteractive: false,
            scmAuthenticated: false,
            promise: null,
            pendingFiles: []
        },

        styles: [
            { href: 'zhiliao/jiemian/yangshi/gg.css' },
            { href: 'zhiliao/jiemian/yangshi/moxing.css' },
            { href: 'zhiliao/jiemian/yangshi/sj.css', media: '(max-width: 768px)' },
            { href: 'zhiliao/jiemian/yangshi/zm.css', media: '(min-width: 769px)' }
        ],

        scripts: [
            'zhiliao/config.js',
            'zhiliao/gongju/app_ts.js',
            'zhiliao/gongju/app_zc.js',
            'zhiliao/huihua/indexddb.js',
            'zhiliao/huihua/wenjian.js',
            'zhiliao/huihua/huancun.js',
            'zhiliao/huihua/tisici.js',
            'zhiliao/yewu/jiexi.js',
            'zhiliao/yewu/moxing.js',
            'zhiliao/yewu/shendu.js',
            'zhiliao/yewu/tubiao.js',
            'zhiliao/jiemian/message_renderer.js',
            'zhiliao/jiemian/buju.js',
            'zhiliao/jiemian/tuopan.js',
            'zhiliao/jiemian/moxing.js',
            'zhiliao/jiemian/jiaohu.js',
            'zhiliao/gongju/moxing/hexin/changliang.js',
            'zhiliao/gongju/moxing/hexin/xiaoyan.js',
            'zhiliao/gongju/moxing/hexin/cangku.js',
            'zhiliao/gongju/moxing/hexin/luyou.js',
            'zhiliao/gongju/moxing/hexin/liushi.js',
            'zhiliao/gongju/moxing/hexin/wangguan.js',
            'zhiliao/gongju/moxing/hexin/gongju_yingshe.js',
            'zhiliao/gongju/zhiling/zhiling.js',
            'zhiliao/gongju/yulan/yangshi.js',
            'zhiliao/gongju/yulan/app.js',
            'zhiliao/gongju/jiekou/a_skill/app.js',
            'zhiliao/gongju/jiekou/a_skill/yhq.js',
            'zhiliao/gongju/jiekou/a_skill/spcx.js',
            'zhiliao/gongju/jiekou/a_skill/tbsc.js',
            'zhiliao/gongju/jiekou/a_skill/tpsc.js',
            'zhiliao/gongju/jiekou/a_skill/spsc.js',
            'zhiliao/gongju/jiekou/a_skill/mtlj.js',
            'zhiliao/gongju/jiekou/a_skill/tplj.js',
            'zhiliao/gongju/jiekou/a_skill/wl.js',
            'zhiliao/gongju/jiekou/a_skill/dq.js',
            'zhiliao/gongju/jiekou/a_skill/jsb.js',
            'zhiliao/gongju/jiekou/a_skill/gzx.js',
            'zhiliao/gongju/jiekou/chaxun/ys.js',
            'zhiliao/gongju/jiekou/chaxun/app.js',
            'zhiliao/gongju/jiekou/tplj/app.js',
            'zhiliao/gongju/jiekou/meitilj/app.js',
            'zhiliao/gongju/jiekou/yhquan/ys.js',
            'zhiliao/gongju/jiekou/yhquan/jx.js',
            'zhiliao/gongju/jiekou/yhquan/app.js',
            'zhiliao/gongju/jiekou/duqu/service.js',
            'zhiliao/gongju/jiekou/duqu/definitions.js',
            'zhiliao/gongju/jiekou/duqu/app.js',
            'zhiliao/gongju/jiekou/jishiben/service.js',
            'zhiliao/gongju/jiekou/jishiben/definitions.js',
            'zhiliao/gongju/jiekou/jishiben/app.js',
            'zhiliao/gongju/jiekou/gongjuzx/service.js',
            'zhiliao/gongju/jiekou/gongjuzx/definitions.js',
            'zhiliao/gongju/jiekou/gongjuzx/app.js',
            'zhiliao/gongju/jiekou/network/app.js',
            'zhiliao/gongju/jiekou/shengtu/core.js',
            'zhiliao/gongju/jiekou/shengtu/candidate.js',
            'zhiliao/gongju/jiekou/shengtu/http.js',
            'zhiliao/gongju/jiekou/shengtu/app.js',
            'zhiliao/gongju/jiekou/shengshi/core.js',
            'zhiliao/gongju/jiekou/shengshi/candidate.js',
            'zhiliao/gongju/jiekou/shengshi/app.js',
            'zhiliao/zjg/yewu/yitu.js',
            'zhiliao/zjg/yewu/moxing.js',
            'zhiliao/zjg/yewu/meiti_celue.js',
            'zhiliao/zjg/yewu/meiti_chengguo.js',
            'zhiliao/zjg/yewu/meiti_ziyuan.js',
            'zhiliao/zjg/yewu/wenjian.js',
            'zhiliao/zjg/yewu/yasuo.js',
            'zhiliao/zjg/yewu/wangguan.js',
            'zhiliao/zjg/jiemian/xianshi.js',
            'zhiliao/zjg/jiemian/jiaohu.js',
            'zhiliao/zjg/yewu/meiti_renwu.js',
            'zhiliao/zjg/yewu/liushi.js',
            'zhiliao/zjg/yewu/zhiling.js',
            'zhiliao/zjg/yewu/liaocheng.js',
            'zhiliao/zjg/huihua/kuaizhao.js',
            'zhiliao/zjg/huihua/qidong.js',
            'zhiliao/zjg/app.js',
            'zhiliao/app.js'
        ],

        requiredGlobals: [
            'ZhiLiaoConfig',
            'ToolDefinitions',
            'ToolRegistry',
            'SessionDB',
            'DBModule',
            'HistoryModule',
            'SystemPromptModule',
            'FileParserModule',
            'ZhiLiaoMoxingYewuModule',
            'ShendModule',
            'ChartGeneratorModule',
            'ZhiLiaoMessageRendererModule',
            'ZhiLiaoBujuModule',
            'ZhiLiaoTuopanModule',
            'ZhiLiaoMoxingJiemianModule',
            'ZhiLiaoJiaohuModule',
            'ZhiLiaoMoxingHexinWangguanModule',
            'ZhiLiaoMoxingGongjuYingsheModule',
            'ZhiLiaoCaidanModule',
            'YulanModule',
            'ToolSkillCenterModule',
            'ChaxunToolModule',
            'TpljToolModule',
            'MediaUnderstandingToolModule',
            'YhquanToolModule',
            'FileReadToolModule',
            'NotebookToolModule',
            'ToolCenterAiToolModule',
            'NetworkToolModule',
            'ShengtuToolModule',
            'ShengshiToolModule',
            'ZhiLiaoZjgAppModule',
            'ZhiLiaoModule'
        ],

        shell: {
            state: {
                isVisible: false
            },

            async show() {
                this.state.isVisible = true;
                window.ZhiLiaoLoader?.renderShellLayout?.();
                document.getElementById('page-chat')?.style.setProperty('display', 'flex');
                document.getElementById('chat-footer')?.style.setProperty('display', 'flex');
                if (window.ZhiLiaoModule?.show) {
                    await window.ZhiLiaoLoader?.showCoreIfCurrent?.();
                    return;
                }
                window.ZhiLiaoLoader?.scheduleCoreLoad?.('shell-show');
            },

            hide() {
                this.state.isVisible = false;
                if (window.ZhiLiaoModule?.hide) {
                    window.ZhiLiaoModule.hide();
                    return;
                }
                document.getElementById('page-chat')?.style.setProperty('display', 'none');
                document.getElementById('chat-footer')?.style.setProperty('display', 'none');
            }
        },

        addStyle(item) {
            if (!item?.href || document.querySelector(`link[href="${item.href}"]`)) return;
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = item.href;
            if (item.media) link.media = item.media;
            document.head.appendChild(link);
        },

        loadScript(src) {
            return window.AppFramework?.loadScript
                ? window.AppFramework.loadScript(src)
                : new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = src;
                    script.async = false;
                    script.onload = resolve;
                    script.onerror = () => reject(new Error(`智聊脚本加载失败：${src}`));
                    document.body.appendChild(script);
                });
        },

        assertReady() {
            const missing = this.requiredGlobals.filter((name) => !window[name]);
            if (missing.length > 0) {
                throw new Error(`智聊模块装载不完整：${missing.join(', ')}`);
            }
        },

        renderShellLayout() {
            const container = document.getElementById('module-container');
            if (!container) return;

            const existingChatPage = document.getElementById('page-chat');
            const existingChatFooter = document.getElementById('chat-footer');
            if (existingChatPage && existingChatFooter) {
                return;
            }

            if ((existingChatPage && !existingChatFooter) || (!existingChatPage && existingChatFooter)) {
                existingChatPage?.remove();
                existingChatFooter?.remove();
            }

            container.insertAdjacentHTML('beforeend', `
                <main id="page-chat" class="zhiliao-page flex-grow flex flex-col pl-3 pr-0 overflow-hidden min-h-0">
                    <div id="welcome-screen" class="flex-grow flex flex-col items-center justify-center text-center">
                        <h2 class="text-xl font-bold mb-4">嗨！我是 运小助</h2>
                        <p class="text-gray-500 leading-relaxed max-w-xs">
                            我可以帮你搜索、答疑、写作，请把你的任务交给我吧~
                        </p>
                    </div>
                    <div id="message-container" class="message-container custom-scrollbar flex-col gap-3 py-4 overflow-y-auto"></div>
                </main>
                <footer id="chat-footer" class="relative gradient-divider-top flex-shrink-0">
                    <div id="chat-attachment-tray" class="chat-attachment-tray custom-scrollbar" style="display: none;"></div>
                    <div id="chat-input-panel" class="chat-input-panel relative bg-gray-100 rounded-2xl py-2 px-3 flex items-center shadow-sm">
                        <textarea id="message-input" rows="1" placeholder="输入 / 查看命令，或询问小助..."
                            class="custom-scrollbar bg-transparent flex-grow outline-none text-sm text-gray-700 placeholder-gray-400 resize-none overflow-y-auto"
                            style="max-height: 144px; line-height: 1.5;"></textarea>
                    </div>
                    <input type="file" id="file-input" class="hidden" multiple accept="image/*,video/*,.pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md,.js,.jsx,.ts,.tsx,.css,.scss,.html,.vue,.py,.java,.cpp,.c,.php,.rb,.go,.rs,.json,.xml,.yaml,.yml,.sql,.sh">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1">
                            <button id="model-button" class="footer-btn flex items-center justify-center rounded-full">
                                <i class="fa-solid fa-layer-group"></i>
                                <span>无模型</span>
                            </button>
                            <button id="think-button" class="footer-btn flex items-center justify-center rounded-full">
                                <i class="fa-solid fa-microchip"></i>
                                <span>思考</span>
                            </button>
                            <button id="upload-button" class="footer-btn rounded-full flex items-center justify-center">
                                <i class="fa-solid fa-plus"></i>
                            </button>
                        </div>
                        <div class="flex items-center gap-1">
                            <button id="new-session-button" class="footer-btn rounded-full flex items-center justify-center" title="新会话" aria-label="新会话">
                                <i class="fa-solid fa-rotate-right"></i>
                            </button>
                            <button id="model-settings-button" class="footer-btn rounded-full flex items-center justify-center" title="模型配置" aria-label="模型配置">
                                <i class="fa-solid fa-gear"></i>
                            </button>
                            <button id="send-button" class="ds-bg-blue text-white rounded-full flex items-center justify-center">
                                <i class="fa-solid fa-arrow-up"></i>
                            </button>
                        </div>
                    </div>
                </footer>
            `);
        },

        bindShellInteractionGuard() {
            if (this.state.shellInteractionGuardBound) return;

            document.addEventListener('click', (event) => {
                if (this.state.coreInteractive) return;
                const button = event.target?.closest?.('#chat-footer button');
                if (!button) return;
                const actionId = button.id || '';
                if (!actionId) return;
                event.preventDefault();
                event.stopPropagation();

                if (actionId === 'upload-button') {
                    document.getElementById('file-input')?.click();
                    this.scheduleCoreLoad('upload-click');
                    return;
                }

                this.replayAfterCore(actionId);
            }, true);

            document.addEventListener('keydown', (event) => {
                if (this.state.coreInteractive) return;
                const textarea = event.target?.closest?.('#message-input');
                if (!textarea) return;
                const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                if (event.key !== 'Enter' || event.shiftKey || isMobileDevice) return;
                event.preventDefault();
                event.stopPropagation();
                this.replayAfterCore('send-button');
            }, true);

            document.addEventListener('change', (event) => {
                if (this.state.coreInteractive) return;
                const fileInput = event.target?.closest?.('#file-input');
                if (!fileInput || !fileInput.files?.length) return;
                this.queuePendingFiles(fileInput.files);
                fileInput.value = '';
                this.replayAfterCore('pending-files');
            }, true);

            document.addEventListener('paste', (event) => {
                if (this.state.coreInteractive) return;
                const textarea = event.target?.closest?.('#message-input');
                if (!textarea) return;
                const files = Array.from(event.clipboardData?.items || [])
                    .filter(item => item.kind === 'file')
                    .map(item => this.normalizePastedFile(item.getAsFile()))
                    .filter(Boolean);
                if (files.length === 0) return;
                event.preventDefault();
                event.stopPropagation();
                this.queuePendingFiles(files);
                this.replayAfterCore('pending-files');
            }, true);

            document.addEventListener('dragover', (event) => {
                if (this.state.coreInteractive) return;
                const footer = event.target?.closest?.('#chat-footer');
                const hasFiles = Array.from(event.dataTransfer?.types || []).includes('Files');
                if (!footer || !hasFiles) return;
                event.preventDefault();
                event.stopPropagation();
                footer.classList.add('drag-over');
            }, true);

            document.addEventListener('dragleave', (event) => {
                if (this.state.coreInteractive) return;
                const footer = event.target?.closest?.('#chat-footer');
                if (!footer) return;
                const next = event.relatedTarget;
                if (next && footer.contains(next)) return;
                event.preventDefault();
                event.stopPropagation();
                footer.classList.remove('drag-over');
            }, true);

            document.addEventListener('drop', (event) => {
                if (this.state.coreInteractive) return;
                const footer = event.target?.closest?.('#chat-footer');
                const files = event.dataTransfer?.files;
                if (!footer || !files?.length) return;
                event.preventDefault();
                event.stopPropagation();
                footer.classList.remove('drag-over');
                this.queuePendingFiles(files);
                this.replayAfterCore('pending-files');
            }, true);

            this.state.shellInteractionGuardBound = true;
        },

        queuePendingFiles(files) {
            const list = Array.from(files || []).filter(Boolean);
            if (list.length === 0) return;
            this.state.pendingFiles.push(...list);
        },

        normalizePastedFile(file) {
            if (!file) return null;
            if (!String(file.type || '').startsWith('image/')) return file;
            const ext = file.type.split('/')[1] || 'png';
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
            return new File([file], `粘贴图片_${timestamp}.${ext}`, { type: file.type });
        },

        isZhiLiaoCurrent() {
            const framework = window.AppFramework || null;
            return this.shell.state.isVisible && (!framework?.currentModule || framework.currentModule === 'zhiliao');
        },

        async showCoreIfCurrent() {
            if (!this.isZhiLiaoCurrent() || !window.ZhiLiaoModule?.show) return false;
            const authenticated = await this.waitForScmAuthenticated();
            if (!authenticated) return false;
            if (!this.isZhiLiaoCurrent() || !window.ZhiLiaoModule?.show) return false;
            await window.ZhiLiaoModule.show();
            if (!this.isZhiLiaoCurrent()) {
                window.ZhiLiaoModule.hide?.();
                return false;
            }
            this.state.coreInteractive = true;
            this.flushPendingFiles();
            return true;
        },

        async replayAfterCore(actionId) {
            try {
                this.setShellBusy(true);
                const authenticated = await this.waitForScmAuthenticated();
                if (!authenticated) return;
                await this.load();
                if (!this.shell.state.isVisible || !window.ZhiLiaoModule) return;
                if (!this.state.coreInteractive) await this.showCoreIfCurrent();
                if (!this.state.coreInteractive) return;
                this.replayShellAction(actionId);
            } catch (error) {
                console.error('[智聊] 交互前置装载失败', error);
            } finally {
                this.setShellBusy(false);
            }
        },

        scheduleCoreLoad(reason = 'auto') {
            if (this.state.promise || this.state.coreLoadScheduled || window.ZhiLiaoModule) return;
            this.state.coreLoadScheduled = true;
            setTimeout(async () => {
                try {
                    const authenticated = await this.waitForScmAuthenticated();
                    if (!authenticated) return;
                    if (!this.isZhiLiaoCurrent() || this.state.promise || window.ZhiLiaoModule) return;
                    await this.load();
                } catch (error) {
                    console.error('[智聊] 后台装载失败', error, reason);
                } finally {
                    this.state.coreLoadScheduled = false;
                }
            }, 0);
        },

        replayShellAction(actionId) {
            if (actionId === 'pending-files') {
                this.flushPendingFiles();
                return;
            }

            if (actionId === 'send-button') {
                window.ZhiLiaoModule?.sendMessage?.();
                return;
            }

            const target = document.getElementById(actionId);
            if (!target) return;
            target.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            }));
        },

        setShellBusy(isBusy) {
            this.state.coreLoading = !!isBusy;
            const footer = document.getElementById('chat-footer');
            footer?.toggleAttribute('aria-busy', !!isBusy);
        },

        flushPendingFiles() {
            const pendingFiles = this.state.pendingFiles.splice(0);
            if (pendingFiles.length === 0) return;
            if (window.ZhiLiaoJiaohuModule?.handleFileUpload && window.ZhiLiaoModule?.state) {
                window.ZhiLiaoJiaohuModule.handleFileUpload(pendingFiles, window.ZhiLiaoModule.state);
                return;
            }
            this.state.pendingFiles.unshift(...pendingFiles);
        },

        bindScmAuthenticated() {
            if (window.LoginModule?.state?.scmAuthenticated) {
                this.state.scmAuthenticated = true;
                return;
            }
            document.addEventListener('scmAuthenticated', () => {
                this.state.scmAuthenticated = true;
                if (!this.shell.state.isVisible) return;
                if (window.ZhiLiaoModule?.show && !this.state.coreInteractive) {
                    this.showCoreIfCurrent().catch(error => console.error('[智聊] SCM认证后接管失败', error));
                    return;
                }
                this.scheduleCoreLoad('scm-authenticated');
            }, { once: true });
        },

        waitForScmAuthenticated(timeout = 300000) {
            if (this.state.scmAuthenticated || window.LoginModule?.state?.scmAuthenticated) {
                this.state.scmAuthenticated = true;
                return Promise.resolve(true);
            }
            return new Promise((resolve) => {
                const onReady = () => {
                    clearTimeout(timer);
                    this.state.scmAuthenticated = true;
                    resolve(true);
                };
                const timer = setTimeout(() => {
                    document.removeEventListener('scmAuthenticated', onReady);
                    resolve(false);
                }, timeout);
                document.addEventListener('scmAuthenticated', onReady, { once: true });
            });
        },

        registerShell() {
            if (this.state.shellRegistered) return;
            this.styles.forEach((item) => this.addStyle(item));
            this.bindScmAuthenticated();
            const framework = window.AppFramework || null;
            if (!framework?.register) return;

            if (!framework.modules?.zhiliao) {
                framework.register({
                    id: 'zhiliao',
                    name: '智聊',
                    icon: 'fa-solid fa-comments',
                    path: 'zhiliao',
                    order: 1,
                    waitForInstance: false
                });
            }
            framework.setModuleInstance('zhiliao', this.shell);
            this.renderShellLayout();
            this.bindShellInteractionGuard();
            this.state.shellRegistered = true;
        },

        async bootstrap() {
            if (this.state.bootstrapped) return;
            if (!window.ZhiLiaoModule || typeof window.ZhiLiaoModule.bootstrap !== 'function') {
                throw new Error('智聊启动入口不存在：ZhiLiaoModule.bootstrap');
            }
            await window.ZhiLiaoModule.bootstrap();
            this.state.bootstrapped = true;
        },

        async load() {
            if (this.state.promise) return this.state.promise;
            this.state.promise = (async () => {
                this.setShellBusy(true);
                const authenticated = await this.waitForScmAuthenticated();
                if (!authenticated) return false;
                this.styles.forEach((item) => this.addStyle(item));
                for (let i = 0; i < this.scripts.length; i += 1) {
                    await this.loadScript(this.scripts[i]);
                }
                this.assertReady();
                await this.bootstrap();
                if (this.state.scmAuthenticated) {
                    await this.showCoreIfCurrent();
                }
                return true;
            })().catch((error) => {
                this.state.promise = null;
                console.error('[智聊] 模块装载失败', error);
                throw error;
            }).finally(() => {
                this.setShellBusy(false);
            });
            return this.state.promise;
        }
    };

    window.ZhiLiaoLoader = ZhiLiaoLoader;
    ZhiLiaoLoader.registerShell();
})();
