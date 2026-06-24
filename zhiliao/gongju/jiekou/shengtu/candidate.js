const ShengtuToolCandidateModule = {
    normalizeBaseUrl(rawUrl) {
        const text = this.text(rawUrl);
        if (!text) return '';
        try {
            const parsed = new URL(text);
            const pathname = String(parsed.pathname || '/').replace(/\/+$/, '');
            const stripped = pathname.replace(/\/images\/(generations|edits)$/i, '') || '/';
            parsed.pathname = stripped;
            parsed.search = '';
            parsed.hash = '';
            return parsed.toString();
        } catch {
            return text.replace(/\/+$/, '');
        }
    },

    async getPrimaryImageConfig() {
        const option = await window.ZhiLiaoMoxingYewuModule?.getCapabilityOption?.('image_generation');
        if (!option?.url || !option?.key || !option?.model) {
            throw new Error('没有可用的图片生成模型配置（需包含 url、key、model）');
        }

        return {
            configId: this.text(option.configId),
            configName: this.text(option.configName) || this.text(option.configId),
            provider: this.text(option.provider) || 'openai',
            capability: 'image_generation',
            url: this.normalizeBaseUrl(option.url),
            key: this.text(option.key),
            model: this.text(option.model)
        };
    }
};

window.ShengtuToolCandidateModule = ShengtuToolCandidateModule;
