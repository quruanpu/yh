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

    isImageUrl(value) {
        const text = this.text(value);
        return /^https?:\/\//i.test(text) || /^data:image\/[a-z0-9.+-]+;base64,/i.test(text);
    },

    appendImageUrl(out, seen, value) {
        const url = this.text(value);
        if (!url || !this.isImageUrl(url) || seen.has(url)) return;
        seen.add(url);
        out.push(url);
    },

    appendImageItem(out, seen, value) {
        if (!value) return;
        if (typeof value === 'string') {
            this.appendImageUrl(out, seen, value);
            return;
        }
        if (typeof value !== 'object' || Array.isArray(value)) return;
        this.appendImageUrl(out, seen, value.url);
        this.appendImageUrl(out, seen, value.image_url);
        if (value.image_url && typeof value.image_url === 'object') {
            this.appendImageUrl(out, seen, value.image_url.url);
        }
    },

    appendImageList(out, seen, value) {
        if (Array.isArray(value)) {
            value.forEach((item) => this.appendImageItem(out, seen, item));
            return;
        }
        this.appendImageItem(out, seen, value);
    },

    normalizeImageResponse(json = {}) {
        const payload = json && typeof json === 'object' ? json : {};
        const urls = [];
        const seen = new Set();

        this.appendImageUrl(urls, seen, payload.image_url);
        this.appendImageList(urls, seen, payload.image_urls);
        this.appendImageList(urls, seen, payload.images);

        return {
            image_url: urls[0] || '',
            image_urls: urls
        };
    },

    normalizeImageTask(payload = {}) {
        const row = payload && typeof payload === 'object' ? payload : {};
        return {
            task_id: this.text(row.task_id),
            image_id: this.text(row.image_id),
            status_url: this.text(row.status_url),
            status: this.text(row.status)
        };
    },

    describeResponseShape(value, depth = 0) {
        if (depth > 2 || value === undefined || value === null) return '';
        if (Array.isArray(value)) {
            const first = value.length > 0 ? this.describeResponseShape(value[0], depth + 1) : '';
            return `array(${value.length})${first ? `<${first}>` : ''}`;
        }
        if (typeof value !== 'object') return typeof value;
        const keys = Object.keys(value).slice(0, 24);
        const child = {};
        keys.slice(0, 8).forEach((key) => {
            const item = value[key];
            if (item && typeof item === 'object') child[key] = this.describeResponseShape(item, depth + 1);
        });
        const childText = Object.keys(child).length > 0 ? ` ${JSON.stringify(child)}` : '';
        return `object{${keys.join(',')}}${childText}`;
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
