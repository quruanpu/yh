const ShengtuToolHttpModule = {
    toReadableError(value) {
        if (value === undefined || value === null) return '';

        if (typeof value === 'string') {
            const text = value.trim();
            if (!text || text === '[object Object]') return '';
            return text;
        }

        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }

        if (typeof value === 'object') {
            const inner = this.toReadableError(
                value.message ||
                value.error ||
                value.detail ||
                value.error_message
            );
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
        const message = this.toReadableError(
            json?.message ||
            json?.error ||
            json?.error_message ||
            json?.detail ||
            ''
        );
        if (message) return message;
        if (text) return text.length > 240 ? `${text.slice(0, 240)}...` : text;
        return Number(status || 0) > 0 ? `HTTP ${status}` : '未知错误';
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

    toDataUrl(base64Text, outputFormat) {
        const raw = this.text(base64Text);
        if (!raw) return '';
        if (/^data:/i.test(raw) || /^https?:\/\//i.test(raw)) return raw;

        let mime = 'image/png';
        const fmt = this.text(outputFormat).toLowerCase();
        if (fmt === 'jpg' || fmt === 'jpeg') mime = 'image/jpeg';
        if (fmt === 'webp') mime = 'image/webp';

        return `data:${mime};base64,${raw}`;
    },

    normalizeImageResponse(json = {}, requestPayload = {}) {
        const urls = [];
        const outputFormat = this.text(requestPayload?.payload?.output_format || requestPayload.output_format).toLowerCase() || 'png';

        if (Array.isArray(json?.data)) {
            for (let i = 0; i < json.data.length; i += 1) {
                const item = json.data[i] || {};
                const url = this.text(item.url || item.image_url);
                const b64 = this.text(item.b64_json || item.image_base64);
                if (url) urls.push(url);
                if (b64) urls.push(this.toDataUrl(b64, outputFormat));
            }
        }

        if (Array.isArray(json?.images)) {
            for (let i = 0; i < json.images.length; i += 1) {
                const item = json.images[i] || {};
                const url = this.text(item.image_url || item.url);
                if (url) urls.push(url);
            }
        }

        const topUrl = this.text(json?.image_url || json?.url);
        if (topUrl) urls.push(topUrl);

        const topB64 = this.text(json?.b64_json || json?.image_base64);
        if (topB64) urls.push(this.toDataUrl(topB64, outputFormat));

        const deduped = [];
        const seen = new Set();
        for (let i = 0; i < urls.length; i += 1) {
            const v = this.text(urls[i]);
            if (!v || seen.has(v)) continue;
            seen.add(v);
            deduped.push(v);
        }

        return {
            image_url: deduped[0] || '',
            image_urls: deduped
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

window.ShengtuToolHttpModule = ShengtuToolHttpModule;
