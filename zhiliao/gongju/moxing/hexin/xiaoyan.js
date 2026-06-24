const ZhiLiaoMoxingHexinXiaoyanModule = {
    constants() {
        return window.ZhiLiaoMoxingChangliangModule;
    },

    normalizeUrl(value) {
        const raw = String(value || '').trim().replace(/\s+/g, '');
        if (!raw) return '';
        try {
            const url = new URL(raw);
            if (url.pathname !== '/') url.pathname = String(url.pathname || '').replace(/\/+$/, '');
            return url.toString();
        } catch {
            return raw;
        }
    },

    buildModelId(name = '', fallback = '') {
        const base = String(name || fallback || 'model')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 80);
        return base || `model_${Date.now()}`;
    },

    normalizeModelItem(raw = {}, fallbackId = '', fallbackOrder = 0) {
        const constants = this.constants();
        const source = raw && typeof raw === 'object' ? raw : { name: raw };
        const name = String(source.name || source.model || source.id || '').trim();
        if (!name) return null;

        let capabilities = constants.normalizeCapabilities(source.capabilities || source.capability || source.modelAbility);
        if (!capabilities.length) capabilities = ['text'];

        const id = String(source.id || source.modelId || fallbackId || this.buildModelId(name)).trim();
        return {
            id: id || this.buildModelId(name),
            name,
            capabilities,
            enabled: source.enabled !== false,
            sortOrder: Number.isFinite(Number(source.sortOrder)) ? Math.floor(Number(source.sortOrder)) : fallbackOrder
        };
    },

    normalizeModels(input) {
        const rawItems = [];
        if (Array.isArray(input)) {
            input.forEach((item, index) => {
                rawItems.push({ id: '', value: item, order: index + 1 });
            });
        } else if (input && typeof input === 'object') {
            Object.entries(input).forEach(([id, item], index) => {
                rawItems.push({ id, value: item, order: index + 1 });
            });
        } else {
            String(input || '')
                .split(/[\n,，；;]/g)
                .forEach((name, index) => rawItems.push({ id: '', value: { name }, order: index + 1 }));
        }

        const byName = new Set();
        const byId = new Set();
        const models = {};
        rawItems.forEach(({ id, value, order }) => {
            const item = this.normalizeModelItem(value, id, order);
            if (!item) return;
            const nameKey = item.name.toLowerCase();
            if (byName.has(nameKey)) return;
            byName.add(nameKey);

            let modelId = item.id || this.buildModelId(item.name);
            let cursor = 2;
            while (byId.has(modelId)) {
                modelId = `${item.id || this.buildModelId(item.name)}_${cursor}`;
                cursor += 1;
            }
            byId.add(modelId);
            models[modelId] = {
                name: item.name,
                capabilities: item.capabilities,
                enabled: item.enabled,
                sortOrder: item.sortOrder || Object.keys(models).length + 1
            };
        });
        return models;
    },

    normalizeConfig(raw = {}) {
        const constants = this.constants();
        return {
            name: String(raw.name || '').trim(),
            provider: constants.normalizeProvider(raw.provider),
            url: this.normalizeUrl(raw.url),
            key: String(raw.key || '').trim(),
            models: this.normalizeModels(raw.models || raw.modelItems || raw.model),
            enabled: !!raw.enabled
        };
    },

    validateAndNormalize(raw = {}) {
        const data = this.normalizeConfig(raw);
        const errors = [];

        if (!data.name) errors.push('配置名称不能为空');
        if (!data.provider) errors.push('服务厂商不能为空');
        if (!data.url) errors.push('请求 URL 不能为空');
        if (data.url && !/^https?:\/\//i.test(data.url)) errors.push('请求 URL 必须以 http:// 或 https:// 开头');
        if (!data.key) errors.push('请求 Key 不能为空');
        if (!Object.keys(data.models).length) errors.push('模型名称不能为空');

        Object.values(data.models).forEach((model) => {
            if (!Array.isArray(model.capabilities) || !model.capabilities.length) {
                errors.push(`模型「${model.name}」至少选择一个能力`);
            }
        });

        return {
            valid: errors.length === 0,
            errors,
            data
        };
    }
};

window.ZhiLiaoMoxingHexinXiaoyanModule = ZhiLiaoMoxingHexinXiaoyanModule;
window.ZhiLiaoMoxingXiaoyanModule = ZhiLiaoMoxingHexinXiaoyanModule;
