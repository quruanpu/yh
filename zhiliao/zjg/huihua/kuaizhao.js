const ZhiLiaoZjgKuaizhaoModule = (() => {
    const methods = {
        initSnapshotState() {
            if (!Number.isInteger(this.state.snapshotGeneration)) {
                this.state.snapshotGeneration = 1;
            }
            if (!this.state.snapshotPersistChain || typeof this.state.snapshotPersistChain.then !== 'function') {
                this.state.snapshotPersistChain = Promise.resolve();
            }
        },

        nextSnapshotGeneration() {
            this.initSnapshotState();
            this.state.snapshotGeneration += 1;
        },

        isActiveSnapshot(sessionId, generation) {
            this.initSnapshotState();
            const expectedSessionId = String(sessionId || '');
            const currentSessionId = String(this.state.sessionId || '');
            if (expectedSessionId && currentSessionId && expectedSessionId !== currentSessionId) return false;
            return Number(this.state.snapshotGeneration || 0) === Number(generation || 0);
        },

        persistDisplaySnapshot() {
            const container = document.getElementById('message-container');
            if (!container || !window.SessionDB?.state?.ready) return;
            this.initSnapshotState();
            const snapshotSessionId = this.state.sessionId;
            const snapshotGeneration = this.state.snapshotGeneration;

            const runPersist = async () => {
                if (!this.isActiveSnapshot(snapshotSessionId, snapshotGeneration)) return;
                const nodes = Array.from(container.children || []);
                const records = [];

                for (let i = 0; i < nodes.length; i += 1) {
                    if (!this.isActiveSnapshot(snapshotSessionId, snapshotGeneration)) return;
                    const node = nodes[i];
                    if (!(node instanceof HTMLElement)) continue;

                    const cls = String(node.className || '');
                    if (!cls) continue;
                    if (cls.includes('message-actions')) continue;

                    if (cls.includes('user-message')) {
                        const html = await this.toPersistableInnerHtml(node, snapshotSessionId, snapshotGeneration);
                        if (!this.isActiveSnapshot(snapshotSessionId, snapshotGeneration)) return;
                        if (!html) continue;
                        records.push({ role: 'user', displayContent: html, isHtml: true });
                        continue;
                    }

                    if (cls.includes('system-message')) {
                        const textEl = node.querySelector('.system-text');
                        if (!textEl) continue;
                        const textClone = textEl.cloneNode(true);
                        const thinkingDiv = textClone.querySelector('[id^="thinking-"]');
                        if (thinkingDiv) thinkingDiv.remove();
                        const html = await this.toPersistableInnerHtml(textClone, snapshotSessionId, snapshotGeneration);
                        if (!this.isActiveSnapshot(snapshotSessionId, snapshotGeneration)) return;
                        if (!html) continue;
                        records.push({ role: 'assistant', displayContent: html, isHtml: true });
                        continue;
                    }

                    const outerHtml = await this.toPersistableOuterHtml(node, snapshotSessionId, snapshotGeneration);
                    if (!this.isActiveSnapshot(snapshotSessionId, snapshotGeneration)) return;
                    if (!outerHtml) continue;
                    records.push({ role: 'custom', displayContent: outerHtml, isHtml: true });
                }

                await this.saveDisplayRecords(records, snapshotSessionId, snapshotGeneration);
            };

            this.state.snapshotPersistChain = Promise.resolve(this.state.snapshotPersistChain)
                .catch(() => {})
                .then(runPersist)
                .catch((error) => {
                    this.logWarn('会话快照保存失败', error);
                });
            return this.state.snapshotPersistChain;
        },

        async blobUrlToDataUrl(blobUrl) {
            const url = String(blobUrl || '').trim();
            if (!url || !url.startsWith('blob:')) return url;
            try {
                const response = await fetch(url);
                const blob = await response.blob();
                return await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ''));
                    reader.onerror = () => reject(new Error('blob convert failed'));
                    reader.readAsDataURL(blob);
                });
            } catch {
                return url;
            }
        },

        async normalizeBlobImagesForPersist(rootElement, sessionId = '', generation = 0) {
            if (!rootElement || typeof rootElement.querySelectorAll !== 'function') return true;
            const imageNodes = Array.from(rootElement.querySelectorAll('img[src^="blob:"]'));
            for (let i = 0; i < imageNodes.length; i += 1) {
                if (!this.isActiveSnapshot(sessionId, generation)) return false;
                const imageNode = imageNodes[i];
                const oldSrc = String(imageNode.getAttribute('src') || '').trim();
                if (!oldSrc) continue;
                const nextSrc = await this.blobUrlToDataUrl(oldSrc);
                if (!this.isActiveSnapshot(sessionId, generation)) return false;
                if (!nextSrc || nextSrc === oldSrc) continue;
                imageNode.setAttribute('src', nextSrc);

                const onclickText = String(imageNode.getAttribute('onclick') || '');
                if (onclickText && onclickText.includes(oldSrc)) {
                    imageNode.setAttribute('onclick', onclickText.split(oldSrc).join(nextSrc));
                }
            }
            return true;
        },

        async toPersistableInnerHtml(element, sessionId = '', generation = 0) {
            if (!element) return '';
            const clone = element.cloneNode(true);
            const active = await this.normalizeBlobImagesForPersist(clone, sessionId, generation);
            if (!active || !this.isActiveSnapshot(sessionId, generation)) return '';
            window.ZhiLiaoMessageRendererModule?.sanitizeDisplayElement?.(clone);
            if (!this.isActiveSnapshot(sessionId, generation)) return '';
            return String(clone.innerHTML || '').trim();
        },

        async toPersistableOuterHtml(element, sessionId = '', generation = 0) {
            if (!element) return '';
            const clone = element.cloneNode(true);
            const active = await this.normalizeBlobImagesForPersist(clone, sessionId, generation);
            if (!active || !this.isActiveSnapshot(sessionId, generation)) return '';
            window.ZhiLiaoMessageRendererModule?.sanitizeDisplayElement?.(clone);
            if (!this.isActiveSnapshot(sessionId, generation)) return '';
            return String(clone.outerHTML || '').trim();
        },

        async saveDisplayRecords(records = [], sessionId = '', generation = 0) {
            if (!window.SessionDB?.state?.ready) return;
            if (!this.isActiveSnapshot(sessionId, generation)) return;
            await SessionDB.replaceSnapshot(records, this.state.messageHistory);
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

window.ZhiLiaoZjgKuaizhaoModule = ZhiLiaoZjgKuaizhaoModule;
