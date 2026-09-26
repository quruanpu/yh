const ShengtuToolCoreModule = {
    config: {
        defaultEndpoint: 'https://api.cfdaili.top/api',
        defaultTimeoutMs: 300000,
        sizeConstraints: {
            divisibleBy: 16,
            minPixels: 655360,
            maxPixels: 8294400,
            minEdge: 256,
            maxEdge: 4096,
            maxAspectRatio: 3
        },
        defaults: {
            size: 'auto',
            quality: 'auto',
            output_format: 'png',
            response_format: 'url',
            background: 'auto',
            moderation: 'auto',
            output_compression: 90,
            input_fidelity: 'high'
        }
    },

    state: {
        registered: false
    },

    text(v) {
        return typeof v === 'string' ? v.trim() : (v == null ? '' : String(v).trim());
    },

    isPlainObject(v) {
        return !!v && typeof v === 'object' && !Array.isArray(v);
    },

    clampInt(v, min, max, fallback) {
        const n = Number(v);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, Math.floor(n)));
    },

    clampNumber(v, min, max, fallback) {
        const n = Number(v);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
    },

    normalizeSize(rawSize, fallback = 'auto') {
        const fallbackSize = this.text(fallback) || 'auto';
        const raw = this.text(rawSize);
        if (!raw) return fallbackSize;

        const lowered = raw.toLowerCase();
        if (lowered === 'auto') return 'auto';

        const compact = raw.replace(/\s+/g, '');
        const direct = compact.match(/^([1-9]\d{1,4})(?:x|X|×|✕|✖|\*|＊|by|BY)([1-9]\d{1,4})$/);
        if (direct) {
            return `${String(Number(direct[1]))}x${String(Number(direct[2]))}`;
        }

        const normalized = compact
            .replace(/[×✕✖＊*]/g, 'x')
            .replace(/by/gi, 'x');
        const strict = normalized.match(/^([1-9]\d{1,4})x([1-9]\d{1,4})$/);
        if (strict) {
            return `${String(Number(strict[1]))}x${String(Number(strict[2]))}`;
        }

        return raw;
    },

    parseSizeDimensions(sizeValue) {
        const size = this.text(sizeValue).toLowerCase();
        const match = size.match(/^([1-9]\d{1,4})x([1-9]\d{1,4})$/);
        if (!match) return null;
        return {
            width: Number(match[1]),
            height: Number(match[2])
        };
    },

    formatSize(width, height) {
        return `${String(Number(width || 0))}x${String(Number(height || 0))}`;
    },

    snapEdge(value, step, mode = 'nearest') {
        const safeStep = Math.max(1, Number(step || 1));
        const raw = Number(value || 0);
        if (!Number.isFinite(raw) || raw <= 0) return safeStep;

        if (mode === 'up') {
            return Math.max(safeStep, Math.ceil(raw / safeStep) * safeStep);
        }
        if (mode === 'down') {
            return Math.max(safeStep, Math.floor(raw / safeStep) * safeStep);
        }
        return Math.max(safeStep, Math.round(raw / safeStep) * safeStep);
    },

    getSizeConstraints() {
        const local = this.config?.sizeConstraints || {};
        const external = window.ZhiLiaoConfig?.imageTool?.sizeConstraints || {};
        const merged = { ...local, ...external };

        const divisibleBy = this.clampInt(merged.divisibleBy, 1, 512, 16);
        const minEdge = this.clampInt(merged.minEdge, divisibleBy, 8192, 256);
        const maxEdge = this.clampInt(merged.maxEdge, minEdge, 16384, 4096);
        const minPixels = this.clampInt(merged.minPixels, 1, 100000000, 655360);
        const maxPixels = this.clampInt(merged.maxPixels, minPixels, 100000000, 8294400);
        const maxAspectRatio = this.clampNumber(merged.maxAspectRatio, 1, 10, 3);

        return {
            divisibleBy,
            minEdge,
            maxEdge,
            minPixels,
            maxPixels,
            maxAspectRatio
        };
    },

    normalizeSizeForRequest(rawSize, fallback = 'auto') {
        const normalizedRaw = this.normalizeSize(rawSize, fallback);
        const inputSize = this.text(normalizedRaw).toLowerCase();
        const fallbackSize = this.text(fallback) || 'auto';

        if (!inputSize) {
            return {
                input: '',
                size: fallbackSize,
                adjusted: fallbackSize !== this.text(rawSize),
                reason: 'fallback_default'
            };
        }

        if (inputSize === 'auto') {
            return {
                input: 'auto',
                size: 'auto',
                adjusted: false,
                reason: ''
            };
        }

        return {
            input: inputSize,
            size: inputSize,
            adjusted: inputSize !== this.text(rawSize),
            reason: inputSize !== this.text(rawSize) ? 'normalized_format' : ''
        };
    },

    resolveEndpoint() {
        const cloud = window.ZhiLiaoConfig?.cloudFunction || {};
        const configured = this.text(cloud.modelGatewayUrl || cloud.gatewayUrl || cloud.imageToolUrl);
        return (configured || this.config.defaultEndpoint).replace(/\/+$/, '');
    },

    normalizeAction(action) {
        const t = this.text(action).toLowerCase();
        if (t === 'generate') return 'generate';
        if (t === 'edit') return 'edit';
        return '';
    },

    normalizeRoute(action) {
        return action === 'edit' ? 'images_edits' : 'images_generations';
    },

    parseModels(input) {
        if (window.ZhiLiaoMoxingXiaoyanModule?.parseModels) {
            return ZhiLiaoMoxingXiaoyanModule.parseModels(input);
        }
        if (Array.isArray(input)) {
            return input.map((item) => this.text(item)).filter(Boolean);
        }
        return this.text(input)
            .split(/[\n,;]/g)
            .map((item) => this.text(item))
            .filter(Boolean);
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

    normalizeImageItem(item, index = 0) {
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

    normalizeImages(images) {
        if (!Array.isArray(images)) return [];
        const out = [];
        for (let i = 0; i < images.length; i += 1) {
            const normalized = this.normalizeImageItem(images[i], i);
            if (normalized) out.push(normalized);
        }
        return out;
    },

    normalizeMask(mask) {
        if (typeof mask === 'string') {
            const textMask = this.text(mask);
            if (this.isHttpUrl(textMask)) return { image_url: textMask };
            return this.parseDataImageUrl(textMask, 'mask.png') || null;
        }
        if (this.isPlainObject(mask)) {
            const fileId = this.text(mask.file_id);
            if (fileId) return { file_id: fileId };

            const imageUrl = this.text(mask.image_url || mask.url);
            if (this.isHttpUrl(imageUrl)) return { image_url: imageUrl };
            const uploadedFromUrl = this.parseDataImageUrl(imageUrl, this.text(mask.name) || 'mask.png');
            if (uploadedFromUrl) {
                return {
                    ...uploadedFromUrl,
                    name: this.text(mask.name) || uploadedFromUrl.name,
                    mime: this.text(mask.mime) || uploadedFromUrl.mime
                };
            }

            const dataB64 = this.text(mask.data_b64 || mask.b64_json || mask.image_base64);
            if (dataB64) {
                return {
                    name: this.text(mask.name) || 'mask.png',
                    mime: this.text(mask.mime) || 'image/png',
                    data_b64: dataB64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s+/g, '')
                };
            }
        }
        return null;
    },

    sanitizeBusinessParams(action, params = {}) {
        const defaults = this.config.defaults || {};
        const sizeMeta = this.normalizeSizeForRequest(params.size, defaults.size);
        const payload = {
            prompt: this.text(params.prompt),
            size: sizeMeta.size,
            quality: this.text(params.quality) || defaults.quality,
            output_format: this.text(params.output_format) || defaults.output_format,
            response_format: this.text(params.response_format) || defaults.response_format,
            background: this.text(params.background) || defaults.background,
            moderation: this.text(params.moderation) || defaults.moderation
        };

        const outputCompression = this.clampInt(
            params.output_compression,
            0,
            100,
            Number(defaults.output_compression || 90)
        );
        const format = this.text(payload.output_format).toLowerCase();
        if (format === 'jpeg' || format === 'jpg' || format === 'webp') {
            payload.output_compression = outputCompression;
        } else {
            delete payload.output_compression;
        }

        const uploadImages = [];
        let uploadMask = null;
        if (action === 'edit') {
            payload.input_fidelity = this.text(params.input_fidelity) || defaults.input_fidelity;
            const normalizedImages = this.normalizeImages(params.images);
            payload.images = normalizedImages.filter((item) => item.image_url || item.file_id);
            if (payload.images.length === 0) delete payload.images;
            uploadImages.push(...normalizedImages.filter((item) => item.data_b64));
            const mask = this.normalizeMask(params.mask);
            if (mask?.data_b64) {
                uploadMask = mask;
            } else if (mask?.image_url || mask?.file_id) {
                payload.mask = mask;
            }
        }

        return {
            payload,
            uploadImages,
            uploadMask,
            sizeMeta
        };
    },

    validateBusinessParams(action, payload = {}, uploadImages = [], uploadMask = null) {
        if (!this.text(payload.prompt)) return '缺少 prompt';
        if (!this.text(payload.size)) return '缺少 size';
        const size = this.text(payload.size).toLowerCase();
        if (size !== 'auto' && !/^[1-9]\d{1,4}x[1-9]\d{1,4}$/.test(size)) {
            return 'size 格式无效，应为 auto 或 WIDTHxHEIGHT（如 1024x1536）';
        }
        if (!this.text(payload.quality)) return '缺少 quality';
        if (!this.text(payload.output_format)) return '缺少 output_format';
        if (!this.text(payload.response_format)) return '缺少 response_format';
        if (!this.text(payload.background)) return '缺少 background';
        if (!this.text(payload.moderation)) return '缺少 moderation';

        if (action === 'edit') {
            if (!this.text(payload.input_fidelity)) return '缺少 input_fidelity';
            const jsonImages = Array.isArray(payload.images) ? payload.images : [];
            const uploaded = Array.isArray(uploadImages) ? uploadImages : [];
            if (jsonImages.length > 0 && uploaded.length > 0) {
                return '编辑图片不能同时混用 URL/file_id 引用图和 base64 上传图';
            }
            if (uploadMask && uploaded.length === 0) {
                return 'base64 蒙版需要与 base64 上传图一起使用';
            }
            if (jsonImages.length === 0 && uploaded.length === 0) {
                return '编辑图片需要 images（至少 1 张参考图）';
            }
            for (let i = 0; i < jsonImages.length; i += 1) {
                const imageUrl = this.text(jsonImages[i]?.image_url);
                const fileId = this.text(jsonImages[i]?.file_id);
                if (!imageUrl && !fileId) return 'images 中存在无效项，必须包含 image_url 或 file_id';
            }
            for (let i = 0; i < uploaded.length; i += 1) {
                if (!this.text(uploaded[i]?.data_b64)) return '上传图片存在无效项，必须包含 data_b64';
            }
        }

        return '';
    },

    resolveTimeoutMs(params = {}) {
        return this.clampInt(params?.timeout_ms, 1, 300000, this.config.defaultTimeoutMs);
    }
};

window.ShengtuToolCoreModule = ShengtuToolCoreModule;
