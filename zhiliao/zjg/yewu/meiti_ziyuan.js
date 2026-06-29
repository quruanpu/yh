const ZhiLiaoZjgMeitiZiyuanModule = (() => {
    const IMAGE_TYPES = new Set(['image']);
    const VIDEO_TYPES = new Set(['video']);

    function now() {
        return Date.now();
    }

    const methods = {
        ensureMediaResourceState() {
            if (!this.state.mediaResources || typeof this.state.mediaResources !== 'object') {
                this.state.mediaResources = {
                    images: [],
                    videos: [],
                    nextImageIndex: 1,
                    nextVideoIndex: 1,
                    maxItems: 24
                };
            }
            const state = this.state.mediaResources;
            if (!Array.isArray(state.images)) state.images = [];
            if (!Array.isArray(state.videos)) state.videos = [];
            if (!Number.isInteger(state.nextImageIndex) || state.nextImageIndex < 1) state.nextImageIndex = 1;
            if (!Number.isInteger(state.nextVideoIndex) || state.nextVideoIndex < 1) state.nextVideoIndex = 1;
            if (!Number.isInteger(state.maxItems) || state.maxItems < 4) state.maxItems = 24;
            return state;
        },

        text(value) {
            return typeof value === 'string' ? value.trim() : (value == null ? '' : String(value).trim());
        },

        isDataUrl(value, type = '') {
            const prefix = type ? `${type}/` : '';
            return new RegExp(`^data:${prefix}[a-z0-9.+-]+;base64,`, 'i').test(this.text(value));
        },

        isHttpUrl(value) {
            return /^https?:\/\//i.test(this.text(value));
        },

        isUsableMediaUrl(value, type = '') {
            const url = this.text(value);
            if (!url) return false;
            if (this.isHttpUrl(url)) return true;
            return this.isDataUrl(url, type);
        },

        normalizeMediaKind(kind = '') {
            const text = this.text(kind).toLowerCase();
            if (IMAGE_TYPES.has(text)) return 'image';
            if (VIDEO_TYPES.has(text)) return 'video';
            return '';
        },

        buildMediaRef(kind) {
            const state = this.ensureMediaResourceState();
            if (kind === 'video') {
                const ref = `vid_${state.nextVideoIndex}`;
                state.nextVideoIndex += 1;
                return ref;
            }
            const ref = `img_${state.nextImageIndex}`;
            state.nextImageIndex += 1;
            return ref;
        },

        getMediaList(kind) {
            const state = this.ensureMediaResourceState();
            return kind === 'video' ? state.videos : state.images;
        },

        trimMediaList(kind) {
            const state = this.ensureMediaResourceState();
            const list = this.getMediaList(kind);
            if (list.length <= state.maxItems) return;
            const trimmed = list.slice(list.length - state.maxItems);
            if (kind === 'video') state.videos = trimmed;
            else state.images = trimmed;
        },

        syncImagePool() {
            const state = this.ensureMediaResourceState();
            const images = state.images
                .filter(item => this.isUsableMediaUrl(item?.url, 'image'))
                .map(item => ({
                    ref: item.ref,
                    image_url: item.url,
                    created_at: item.created_at,
                    touched_at: item.touched_at,
                    last_action: item.source || '',
                    last_route: 'chat_media_resource',
                    last_model: 'user_upload'
                }));
            const currentPool = Array.isArray(window.ShengtuToolModule?.state?.imagePool)
                ? window.ShengtuToolModule.state.imagePool
                : [];
            const merged = [];
            const seen = new Set();
            const append = (item) => {
                const url = this.text(item?.image_url);
                const ref = this.text(item?.ref);
                const key = url ? `url:${url}` : `ref:${ref}`;
                if (!key || seen.has(key)) return;
                seen.add(key);
                merged.push(item);
            };
            currentPool.forEach(append);
            images.forEach(append);
            if (window.ShengtuToolModule?.state) {
                window.ShengtuToolModule.state.imagePool = merged;
                const maxIndex = merged.reduce((max, item) => {
                    const match = String(item.ref || '').match(/^img_(\d+)$/);
                    return match ? Math.max(max, Number(match[1]) + 1) : max;
                }, state.nextImageIndex);
                window.ShengtuToolModule.state.nextImageRefIndex = maxIndex;
            }
            window.SessionDB?.saveImagePool?.(merged);
        },

        registerMediaResource(kind, url, meta = {}) {
            const mediaKind = this.normalizeMediaKind(kind);
            if (!mediaKind || !this.isUsableMediaUrl(url, mediaKind)) return null;

            const list = this.getMediaList(mediaKind);
            const mediaUrl = this.text(url);
            const existing = list.find(item => this.text(item?.url) === mediaUrl);
            if (existing) {
                existing.touched_at = now();
                existing.source = this.text(meta.source || existing.source);
                existing.file_id = meta.fileId || existing.file_id || null;
                return existing;
            }

            const item = {
                ref: this.buildMediaRef(mediaKind),
                kind: mediaKind,
                url: mediaUrl,
                file_id: meta.fileId || null,
                name: this.text(meta.name),
                source: this.text(meta.source || 'upload'),
                created_at: now(),
                touched_at: now()
            };
            list.push(item);
            this.trimMediaList(mediaKind);
            if (mediaKind === 'image') this.syncImagePool();
            return item;
        },

        registerMediaContentItem(item = {}, meta = {}) {
            if (!item || typeof item !== 'object') return null;
            if (item.type === 'image_url') {
                return this.registerMediaResource('image', item.image_url?.url || item.image_url, meta);
            }
            if (item.type === 'video_url') {
                return this.registerMediaResource('video', item.video_url?.url || item.video_url, meta);
            }
            return null;
        },

        registerMediaContentItems(content, meta = {}) {
            if (!Array.isArray(content)) return [];
            return content
                .map(item => this.registerMediaContentItem(item, meta))
                .filter(Boolean);
        },

        resolveMediaRef(kind, ref = '') {
            const mediaKind = this.normalizeMediaKind(kind);
            if (!mediaKind) return null;
            const token = this.text(ref);
            if (!token) return null;
            if (this.isUsableMediaUrl(token, mediaKind)) {
                return { ref: '', kind: mediaKind, url: token };
            }
            const list = this.getMediaList(mediaKind);
            const lower = token.toLowerCase();
            if (lower === 'last' || lower === 'latest') {
                return list[list.length - 1] || null;
            }
            return list.find(item => this.text(item?.ref) === token) || null;
        },

        getLatestMediaResource(kind) {
            const mediaKind = this.normalizeMediaKind(kind);
            if (!mediaKind) return null;
            const list = this.getMediaList(mediaKind);
            return list[list.length - 1] || null;
        },

        buildMediaReferenceHint(kind = 'image', refs = []) {
            const mediaKind = this.normalizeMediaKind(kind);
            const list = refs.length ? refs : this.getMediaList(mediaKind);
            if (!mediaKind || !list.length) return '';
            const label = mediaKind === 'video' ? '视频' : '图片';
            const tokens = list.map(item => this.text(item?.ref)).filter(Boolean);
            if (!tokens.length) return '';
            const latest = tokens[tokens.length - 1];
            const paramName = mediaKind === 'video' ? 'video_ref' : 'image_ref';
            const pluralName = mediaKind === 'video' ? 'video_refs' : 'image_refs';
            const toolName = mediaKind === 'video' ? 'understand_video' : 'understand_image / generate_or_edit_image / generate_video';
            return `[${label}参考] 已上传 ${tokens.length} 个${label}资源，可在工具参数中使用 ${paramName}: "last" 或 ${pluralName}: ${JSON.stringify(tokens)}；最近一个为 ${latest}。如需理解或生成相关内容，请调用 ${toolName}，不要把媒体内容直接发送给文本模型。`;
        },

        extractTextBlocks(content) {
            if (typeof content === 'string') return this.text(content);
            if (!Array.isArray(content)) return '';
            return content
                .filter(item => item?.type === 'text')
                .map(item => this.text(item?.text))
                .filter(Boolean)
                .join('\n');
        },

        hasMediaBlocks(content) {
            if (!Array.isArray(content)) return false;
            return content.some(item => item?.type === 'image_url' || item?.type === 'video_url');
        },

        buildToolReferenceContent(content) {
            const registered = this.registerMediaContentItems(content, { source: 'chat_input' });
            const text = this.extractTextBlocks(content);
            const images = registered.filter(item => item.kind === 'image');
            const videos = registered.filter(item => item.kind === 'video');
            const hints = [
                images.length ? this.buildMediaReferenceHint('image', images) : '',
                videos.length ? this.buildMediaReferenceHint('video', videos) : ''
            ].filter(Boolean);
            return [text, ...hints].filter(Boolean).join('\n\n');
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

window.ZhiLiaoZjgMeitiZiyuanModule = ZhiLiaoZjgMeitiZiyuanModule;
