const ZhiLiaoMoxingHexinLuyouModule = {
    constants() {
        return window.ZhiLiaoMoxingChangliangModule;
    },

    repo() {
        return window.ZhiLiaoMoxingHexinCangkuModule || window.ZhiLiaoMoxingCangkuModule;
    },

    async listCapabilityOptions(capability = 'text') {
        const target = this.constants().normalizeCapability(capability) || 'text';
        const repo = this.repo();
        if (!repo?.getEnabledModelOptions) return [];
        return repo.getEnabledModelOptions(target);
    },

    async resolveManualOption(capability = 'text', options = {}) {
        if (options.preferManual === false) return null;
        const repo = this.repo();
        if (!repo?.getManualOptionForCapability) return null;
        return repo.getManualOptionForCapability(capability);
    },

    matchPreferredOption(candidates = [], options = {}) {
        const preferredConfigId = String(options.configId || '').trim();
        const preferredModelId = String(options.modelId || '').trim();
        const preferredModel = String(options.model || '').trim();
        if (!preferredConfigId && !preferredModelId && !preferredModel) return null;

        return candidates.find((item) => {
            if (preferredConfigId && item.configId !== preferredConfigId) return false;
            if (preferredModelId && item.modelId !== preferredModelId) return false;
            if (preferredModel && item.model !== preferredModel) return false;
            return true;
        }) || null;
    },

    async resolveTextOption(options = {}) {
        const manual = await this.resolveManualOption('text', options);
        if (manual) return manual;

        const candidates = await this.listCapabilityOptions('text');
        const preferred = this.matchPreferredOption(candidates, options);
        if (preferred) return preferred;
        return candidates[0] || null;
    },

    async resolveCapability(capability = 'text', options = {}) {
        const target = this.constants().normalizeCapability(capability) || 'text';

        if (target === 'text') {
            return this.resolveTextOption(options);
        }

        const manual = await this.resolveManualOption(target, options);
        if (manual) return manual;

        const candidates = await this.listCapabilityOptions(target);
        if (!candidates.length) return null;

        const preferred = this.matchPreferredOption(candidates, options);
        if (preferred) return preferred;

        return candidates[0] || null;
    },

    async requireCapability(capability = 'text', options = {}) {
        const option = await this.resolveCapability(capability, options);
        if (option) return option;
        const label = this.constants().getCapabilityLabel(capability);
        throw new Error(`当前未启用支持「${label}」的模型配置。`);
    }
};

window.ZhiLiaoMoxingHexinLuyouModule = ZhiLiaoMoxingHexinLuyouModule;
