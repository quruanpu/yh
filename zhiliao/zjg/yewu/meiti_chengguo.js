const ZhiLiaoZjgMeitiChengguoModule = (() => {
    const methods = {
        ensureMediaArtifactState() {
            if (!this.state.mediaArtifacts || typeof this.state.mediaArtifacts !== 'object') {
                this.state.mediaArtifacts = {
                    items: {},
                    nextSeq: 1,
                    maxItems: 40
                };
            }
            const state = this.state.mediaArtifacts;
            if (!state.items || typeof state.items !== 'object') state.items = {};
            if (!Number.isInteger(state.nextSeq) || state.nextSeq < 1) state.nextSeq = 1;
            if (!Number.isInteger(state.maxItems) || state.maxItems < 8) state.maxItems = 40;
            return state;
        },

        createMediaArtifactId(kind = 'media') {
            const state = this.ensureMediaArtifactState();
            const safeKind = String(kind || 'media').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'media';
            const id = `${safeKind}_${state.nextSeq}`;
            state.nextSeq += 1;
            return id;
        },

        getMediaArtifactUrl(kind, result = {}) {
            if (kind === 'video') return String(result?.video_url || '').trim();
            return String(result?.image_url || '').trim();
        },

        registerMediaArtifact(kind, result = {}, meta = {}) {
            const url = this.getMediaArtifactUrl(kind, result);
            if (!url) return null;

            const state = this.ensureMediaArtifactState();
            const id = this.createMediaArtifactId(kind);
            const artifact = {
                id,
                kind,
                toolName: String(meta.toolName || '').trim(),
                title: String(meta.title || this.getMediaArtifactTitle(kind)).trim(),
                description: String(result?.description || meta.description || '').trim(),
                image_url: kind === 'video' ? '' : url,
                video_url: kind === 'video' ? url : '',
                width: Number(result?.width || 0),
                height: Number(result?.height || 0),
                chart_type: String(result?.chart_type || '').trim(),
                createdAt: Date.now()
            };

            state.items[id] = artifact;
            this.trimMediaArtifacts();
            return artifact;
        },

        trimMediaArtifacts() {
            const state = this.ensureMediaArtifactState();
            const items = Object.values(state.items);
            if (items.length <= state.maxItems) return;
            items
                .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))
                .slice(0, items.length - state.maxItems)
                .forEach(item => {
                    delete state.items[item.id];
                });
        },

        getMediaArtifact(id = '') {
            const key = String(id || '').trim();
            if (!key) return null;
            const state = this.ensureMediaArtifactState();
            return state.items[key] || null;
        },

        getMediaArtifactTitle(kind = '') {
            if (kind === 'video') return '视频';
            if (kind === 'chart') return '图表';
            return '图片';
        },

        getMediaArtifactPlaceholder(id = '') {
            const key = String(id || '').trim();
            return key ? `[[media:${key}]]` : '';
        },

        buildMediaArtifactSummary(artifact = {}, deliveryMode = 'card_only') {
            const id = String(artifact?.id || '').trim();
            const kind = String(artifact?.kind || '').trim();
            return {
                success: true,
                media_ready: true,
                media_kind: kind,
                artifact_id: id,
                placeholder: this.getMediaArtifactPlaceholder(id),
                delivery_mode: deliveryMode,
                description: artifact?.description || artifact?.title || this.getMediaArtifactTitle(kind),
                display: '媒体结果已由前端卡片负责展示。需要在回复中插入结果时，只输出 placeholder 字段，不要输出链接、data URL 或 base64。'
            };
        },

        renderMediaArtifactCard(anchor, artifact = {}) {
            if (!anchor || !artifact) return false;
            const kind = String(artifact.kind || '').trim();
            if (kind === 'video') {
                this.renderVideoResultCard?.(anchor, {
                    video_url: artifact.video_url
                }, '视频');
                return true;
            }

            this.renderImageResultCard?.(anchor, {
                image_url: artifact.image_url,
                description: artifact.description
            }, this.getMediaArtifactTitle(kind));
            return true;
        },

        renderMediaArtifactPlaceholders(textContainer) {
            if (!textContainer || typeof textContainer.innerHTML !== 'string') return;

            const html = textContainer.innerHTML;
            const pattern = /\[\[media:([a-z0-9_-]+)\]\]/gi;
            const ids = [];
            let nextHtml = html.replace(pattern, (_, id) => {
                const key = String(id || '').trim();
                if (!key || !this.getMediaArtifact(key)) return '';
                ids.push(key);
                return `<span data-media-artifact-anchor="${this.escapeAttr(key)}"></span>`;
            });

            if (nextHtml === html) return;
            textContainer.innerHTML = nextHtml;

            const hasContent = (node) => Boolean(
                node &&
                (
                    String(node.textContent || '').trim() ||
                    Array.from(node.children || []).some(child => String(child.tagName || '').toLowerCase() !== 'br')
                )
            );

            ids.forEach((id) => {
                const marker = textContainer.querySelector(`[data-media-artifact-anchor="${id}"]`);
                const artifact = this.getMediaArtifact(id);
                if (!marker || !artifact) return;
                const paragraph = marker.closest?.('p') || null;
                const anchor = document.createElement('div');
                if (paragraph && paragraph.parentNode) {
                    const parent = paragraph.parentNode;
                    const afterRange = document.createRange();
                    afterRange.setStartAfter(marker);
                    afterRange.setEndAfter(paragraph.lastChild || marker);
                    const afterFragment = afterRange.extractContents();
                    marker.remove();

                    const afterParagraph = paragraph.cloneNode(false);
                    afterParagraph.appendChild(afterFragment);
                    const beforeHasContent = hasContent(paragraph);
                    const afterHasContent = hasContent(afterParagraph);

                    if (beforeHasContent) {
                        parent.insertBefore(anchor, paragraph.nextSibling);
                    } else {
                        parent.insertBefore(anchor, paragraph);
                        paragraph.remove();
                    }
                    if (afterHasContent) {
                        parent.insertBefore(afterParagraph, anchor.nextSibling);
                    }
                } else {
                    marker.parentNode?.insertBefore(anchor, marker);
                    marker.remove();
                }
                this.renderMediaArtifactCard(anchor, artifact);
                anchor.remove();
            });
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

window.ZhiLiaoZjgMeitiChengguoModule = ZhiLiaoZjgMeitiChengguoModule;
