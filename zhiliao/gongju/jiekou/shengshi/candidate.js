const ShengshiToolCandidateModule = {
    text(value) {
        return typeof value === 'string' ? value.trim() : (value == null ? '' : String(value).trim());
    },

    normalizeBaseUrl(rawUrl) {
        const text = this.text(rawUrl);
        if (!text) return '';
        try {
            const parsed = new URL(text);
            parsed.search = '';
            parsed.hash = '';
            return parsed.toString().replace(/\/+$/, '');
        } catch {
            return text.replace(/\/+$/, '');
        }
    },

    async getPrimaryVideoConfig() {
        const option = await window.ZhiLiaoMoxingYewuModule?.getCapabilityOption?.('video_generation');
        if (!option?.url || !option?.key || !option?.model) {
            throw new Error('没有可用的视频生成模型配置（需包含 url、key、model）');
        }

        return {
            configId: this.text(option.configId),
            configName: this.text(option.configName) || this.text(option.configId),
            provider: this.text(option.provider) || 'agnes',
            capability: 'video_generation',
            url: this.normalizeBaseUrl(option.url),
            key: this.text(option.key),
            model: this.text(option.model)
        };
    }
};

window.ShengshiToolCandidateModule = ShengshiToolCandidateModule;
