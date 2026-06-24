const ShengshiToolCoreModule = {
    config: {
        defaultTimeoutMs: 300000,
        defaults: {
            duration: '',
            quality: '',
            size: '',
            resolution: '',
            fps: '',
            seed: ''
        }
    },

    state: {
        registered: false
    },

    text(value) {
        return typeof value === 'string' ? value.trim() : (value == null ? '' : String(value).trim());
    },

    isPlainObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    },

    clampInt(value, min, max, fallback) {
        const number = Number(value);
        if (!Number.isFinite(number)) return fallback;
        return Math.max(min, Math.min(max, Math.floor(number)));
    },

    resolveEndpoint() {
        const cloud = window.ZhiLiaoConfig?.cloudFunction || {};
        const configured = this.text(cloud.modelGatewayUrl || cloud.gatewayUrl || cloud.videoToolUrl);
        const fallback = window.ZhiLiaoMoxingChangliangModule?.defaultGatewayUrl || 'https://ai.cfdaili.top/api';
        return (configured || fallback).replace(/\/+$/, '');
    },

    resolveTimeoutMs(params = {}) {
        return this.clampInt(params?.timeout_ms, 1, 300000, this.config.defaultTimeoutMs);
    },

    normalizeVideoSource(value) {
        if (typeof value === 'string') {
            const text = this.text(value);
            return text ? text : '';
        }
        if (this.isPlainObject(value)) {
            return this.text(value.video_url || value.url || value.file_id || value.data_b64);
        }
        return '';
    },

    parseDataImageUrl(value, fallbackName = 'image.png') {
        const raw = this.text(value);
        const match = raw.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
        if (!match) return null;
        const mime = this.text(match[1]).toLowerCase() || 'image/png';
        const ext = mime.split('/')[1] || 'png';
        return {
            name: fallbackName || `image.${ext}`,
            mime,
            data_b64: match[2].replace(/\s+/g, '')
        };
    },

    isHttpUrl(value) {
        return /^https?:\/\//i.test(this.text(value));
    },

    isDataImageUrl(value) {
        return !!this.parseDataImageUrl(value);
    },

    normalizeVideoImageItem(item, index = 0) {
        const defaultName = `img_${index + 1}.png`;

        if (typeof item === 'string') {
            const imageUrl = this.text(item);
            if (this.isHttpUrl(imageUrl)) return { image_url: imageUrl };
            return this.parseDataImageUrl(imageUrl, defaultName);
        }

        if (!this.isPlainObject(item)) return null;

        const fileId = this.text(item.file_id);
        if (fileId) return { file_id: fileId };

        const imageUrl = this.text(item.image_url || item.url);
        if (this.isHttpUrl(imageUrl)) return { image_url: imageUrl };

        const uploadedFromUrl = this.parseDataImageUrl(imageUrl, this.text(item.name) || defaultName);
        if (uploadedFromUrl) {
            return {
                ...uploadedFromUrl,
                name: this.text(item.name) || uploadedFromUrl.name,
                mime: this.text(item.mime) || uploadedFromUrl.mime
            };
        }

        const dataB64 = this.text(item.data_b64 || item.b64_json || item.image_base64);
        if (dataB64) {
            return {
                name: this.text(item.name) || defaultName,
                mime: this.text(item.mime) || 'image/png',
                data_b64: dataB64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s+/g, '')
            };
        }

        return null;
    },

    normalizeVideoImages(images) {
        if (!Array.isArray(images)) return [];
        const out = [];
        for (let i = 0; i < images.length; i += 1) {
            const normalized = this.normalizeVideoImageItem(images[i], i);
            if (normalized) out.push(normalized);
        }
        return out;
    },

    getVideoImageItemKey(item = {}) {
        const imageUrl = this.text(item?.image_url);
        if (imageUrl) return `url:${imageUrl}`;
        const fileId = this.text(item?.file_id);
        if (fileId) return `file:${fileId}`;
        const dataB64 = this.text(item?.data_b64);
        if (dataB64) return `b64:${dataB64.slice(0, 64)}:${dataB64.length}`;
        return '';
    },

    mergeVideoImages(primary = [], secondary = []) {
        const merged = [];
        const seen = new Set();
        const append = (list) => {
            if (!Array.isArray(list)) return;
            for (let i = 0; i < list.length; i += 1) {
                const item = this.normalizeVideoImageItem(list[i], merged.length);
                if (!item) continue;
                const key = this.getVideoImageItemKey(item);
                if (!key || seen.has(key)) continue;
                seen.add(key);
                merged.push(item);
            }
        };

        append(primary);
        append(secondary);
        return merged;
    },

    normalizeRefTokens(rawValue) {
        if (Array.isArray(rawValue)) {
            return rawValue.map((item) => this.text(item)).filter(Boolean);
        }
        const single = this.text(rawValue);
        if (!single) return [];
        return single
            .split(/[,\n;]/g)
            .map((item) => this.text(item))
            .filter(Boolean);
    },

    getSessionVideoImagePool() {
        const pool = window.ShengtuToolModule?.state?.imagePool;
        return Array.isArray(pool) ? pool : [];
    },

    resolveVideoImageRefToken(token, pool = []) {
        const t = this.text(token);
        if (!t) return null;
        if (this.isHttpUrl(t) || this.isDataImageUrl(t)) return { image_url: t, ref: '' };

        if (!Array.isArray(pool) || pool.length === 0) return null;

        const lowerToken = t.toLowerCase();
        if (lowerToken === 'last' || lowerToken === 'latest') {
            const last = pool[pool.length - 1];
            if (last?.image_url) return { image_url: last.image_url, ref: last.ref || '' };
            return null;
        }

        const byRef = pool.find((item) => this.text(item?.ref) === t);
        if (byRef?.image_url) return { image_url: byRef.image_url, ref: byRef.ref || '' };
        return null;
    },

    async resolveVideoReferenceImages(params = {}) {
        const tokens = [
            ...this.normalizeRefTokens(params?.image_ref),
            ...this.normalizeRefTokens(params?.image_refs)
        ];
        if (tokens.length === 0) {
            return { tokens: [], unresolved: [], images: [], refs: [] };
        }

        let pool = this.getSessionVideoImagePool();
        if (pool.length === 0 && typeof window.SessionDB?.getImagePool === 'function') {
            try {
                const savedPool = await window.SessionDB.getImagePool();
                if (Array.isArray(savedPool) && savedPool.length > 0) {
                    pool = savedPool;
                    if (window.ShengtuToolModule?.state) {
                        window.ShengtuToolModule.state.imagePool = savedPool;
                    }
                }
            } catch {}
        }

        const unresolved = [];
        const refs = [];
        const images = [];
        for (let i = 0; i < tokens.length; i += 1) {
            const hit = this.resolveVideoImageRefToken(tokens[i], pool);
            if (!hit || (!this.isHttpUrl(hit.image_url) && !this.isDataImageUrl(hit.image_url))) {
                unresolved.push(tokens[i]);
                continue;
            }
            images.push({ image_url: hit.image_url });
            if (hit.ref) refs.push(hit.ref);
        }

        return {
            tokens,
            unresolved,
            images: this.mergeVideoImages(images),
            refs: [...new Set(refs.map((ref) => this.text(ref)).filter(Boolean))]
        };
    },

    sanitizeBusinessParams(params = {}) {
        const payload = {
            prompt: this.text(params.prompt)
        };

        [
            'image_url',
            'image_urls',
            'image',
            'images',
            'image_ref',
            'image_refs',
            'first_frame',
            'last_frame',
            'duration',
            'quality',
            'mode',
            'video_mode',
            'size',
            'resolution',
            'width',
            'height',
            'num_frames',
            'frame_rate',
            'fps',
            'seed',
            'num_inference_steps',
            'negative_prompt'
        ].forEach((key) => {
            const value = params[key];
            if (value === undefined || value === null || value === '') return;
            payload[key] = value;
        });

        if (this.isPlainObject(params.extra_body)) {
            payload.extra_body = { ...params.extra_body };
        }

        return payload;
    },

    validateBusinessParams(payload = {}) {
        if (!this.text(payload.prompt)) return '缺少 prompt';
        return '';
    },

    tryParseJson(raw) {
        const text = this.text(raw);
        if (!text) return null;
        try {
            const parsed = JSON.parse(text);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    },

    decodeBase64Utf8(base64Text) {
        const raw = this.text(base64Text);
        if (!raw) return '';

        try {
            if (typeof atob === 'function' && typeof TextDecoder !== 'undefined') {
                const binary = atob(raw);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
                return new TextDecoder('utf-8').decode(bytes);
            }
        } catch {}

        try {
            if (typeof Buffer !== 'undefined') {
                return Buffer.from(raw, 'base64').toString('utf8');
            }
        } catch {}

        return '';
    },

    unwrapResponsePayload(json, text) {
        let payload = (json && typeof json === 'object') ? json : (this.tryParseJson(text) || {});
        for (let depth = 0; depth < 4; depth += 1) {
            if (!payload || typeof payload !== 'object' || !Object.prototype.hasOwnProperty.call(payload, 'body')) break;

            let bodyValue = payload.body;
            if (payload.isBase64Encoded === true && typeof bodyValue === 'string') {
                bodyValue = this.decodeBase64Utf8(bodyValue);
            }

            if (typeof bodyValue === 'string') {
                const parsed = this.tryParseJson(bodyValue);
                if (!parsed) break;
                payload = parsed;
                continue;
            }

            if (bodyValue && typeof bodyValue === 'object') {
                payload = bodyValue;
                continue;
            }

            break;
        }
        return payload && typeof payload === 'object' ? payload : {};
    },

    toReadableError(value) {
        if (value === undefined || value === null) return '';
        if (typeof value === 'string') {
            const text = value.trim();
            if (!text || text === '[object Object]') return '';
            return text;
        }
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (typeof value === 'object') {
            const inner = this.toReadableError(value.message || value.error || value.detail || value.error_message);
            if (inner) return inner;
            try {
                const json = JSON.stringify(value);
                return json && json !== '{}' ? json : '';
            } catch {
                return '';
            }
        }
        return '';
    },

    parseResponseMessage(status, json, text) {
        const message = this.toReadableError(json?.message || json?.error || json?.error_message || json?.detail || '');
        if (message) return message;
        if (text) return text.length > 240 ? `${text.slice(0, 240)}...` : text;
        return Number(status || 0) > 0 ? `HTTP ${status}` : '未知错误';
    },

    extractVideoUrls(payload = {}) {
        const urls = [];
        const push = (value) => {
            const text = this.normalizeVideoSource(value);
            if (!text) return;
            if (!/^https?:\/\//i.test(text) && !/^data:video\//i.test(text)) return;
            urls.push(text);
        };

        push(payload.video_url);
        push(payload.url);

        if (Array.isArray(payload.videos)) {
            payload.videos.forEach((item) => {
                if (typeof item === 'string') {
                    push(item);
                } else if (this.isPlainObject(item)) {
                    push(item.url || item.video_url);
                }
            });
        }

        if (Array.isArray(payload.data)) {
            payload.data.forEach((item) => {
                if (typeof item === 'string') {
                    push(item);
                } else if (this.isPlainObject(item)) {
                    push(item.url || item.video_url);
                }
            });
        }

        const raw = payload.raw;
        if (raw && raw !== payload) {
            this.extractVideoUrls(raw).forEach(push);
        }

        const deduped = [];
        const seen = new Set();
        urls.forEach((url) => {
            if (seen.has(url)) return;
            seen.add(url);
            deduped.push(url);
        });
        return deduped;
    },

    normalizeVideoResponse(payload = {}) {
        const urls = this.extractVideoUrls(payload);
        return {
            video_url: urls[0] || '',
            videos: urls.map((url) => ({ url })),
            video_id: this.text(payload.video_id || payload.videoId || payload.data?.video_id || payload.data?.videoId || payload.result?.video_id || payload.result?.videoId),
            task_id: this.text(payload.task_id || payload.taskId || payload.id),
            status_url: this.text(payload.status_url || payload.statusUrl),
            status: this.text(payload.status || payload.state)
        };
    },

    async postJson(endpoint, payload, timeoutMs) {
        const useTimeout = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0;
        const controller = new AbortController();
        const timer = useTimeout ? setTimeout(() => controller.abort(), Number(timeoutMs)) : null;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            const text = await response.text().catch(() => '');
            let json = null;
            try {
                json = text ? JSON.parse(text) : null;
            } catch {}

            return {
                ok: response.ok,
                status: Number(response.status || 0),
                text,
                json,
                finalUrl: response.url || ''
            };
        } catch (error) {
            if (error?.name === 'AbortError') {
                return { ok: false, status: 408, text: '', json: null, networkError: '请求超时' };
            }
            return {
                ok: false,
                status: 0,
                text: '',
                json: null,
                networkError: this.text(error?.message || error) || '网络请求失败'
            };
        } finally {
            if (timer) clearTimeout(timer);
        }
    }
};

window.ShengshiToolCoreModule = ShengshiToolCoreModule;
