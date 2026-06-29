const ZhiLiaoMoxingChangliangModule = {
    providers: ['openai', 'claude', 'deepseek', 'zhipu', 'agnes'],
    capabilities: [
        'text',
        'image_understanding',
        'image_generation',
        'video_understanding',
        'video_generation',
        'universal'
    ],
    routableCapabilities: [
        'text',
        'image_understanding',
        'image_generation',
        'video_understanding',
        'video_generation'
    ],
    capabilityLabels: {
        text: '文本',
        image_understanding: '图像理解',
        image_generation: '图像生成',
        video_understanding: '视频理解',
        video_generation: '视频生成',
        universal: '通用'
    },
    providerLabels: {
        openai: 'open',
        claude: 'claude',
        deepseek: 'deepseek',
        zhipu: '智谱ai',
        agnes: 'AgnesAi'
    },
    defaultGatewayUrl: 'https://ai.cfdaili.top/api',
    actions: {
        text: 'chat',
        image_understanding: 'image_understanding',
        image_generation: 'image_generation',
        video_understanding: 'video_understanding',
        video_generation: 'video_generation'
    },

    normalizeProvider(value) {
        const text = String(value || '').trim().toLowerCase();
        if (text === 'open' || text === 'gpt' || text === 'openai') return 'openai';
        if (text === 'anthropic' || text === 'claude') return 'claude';
        if (text === 'ds' || text === 'deepseek') return 'deepseek';
        if (text === 'zhipuai' || text === 'zhipu' || text === 'bigmodel' || text === 'glm') return 'zhipu';
        if (text === 'agnesai' || text === 'agnes-ai' || text === 'agnes') return 'agnes';
        return this.providers.includes(text) ? text : '';
    },

    normalizeCapability(value) {
        const text = String(value || '').trim().toLowerCase();
        if (text === 'chat' || text === 'wenben' || text === 'text') return 'text';
        if (text === 'image' || text === 'vision' || text === 'image_understanding') return 'image_understanding';
        if (text === 'image_generation' || text === 'generate_image') return 'image_generation';
        if (text === 'video' || text === 'video_understanding') return 'video_understanding';
        if (text === 'video_generation' || text === 'generate_video') return 'video_generation';
        if (text === 'universal' || text === 'general' || text === 'all' || text === '通用') return 'universal';
        return this.capabilities.includes(text) ? text : '';
    },

    normalizeCapabilities(value) {
        const raw = Array.isArray(value)
            ? value
            : String(value || '').split(/[\n,，；;]/g);
        const out = [];
        raw.forEach((item) => {
            const capability = this.normalizeCapability(item);
            if (capability && !out.includes(capability)) out.push(capability);
        });
        if (out.includes('universal')) return ['universal'];
        return out;
    },

    expandCapabilities(value) {
        const normalized = this.normalizeCapabilities(value);
        if (normalized.includes('universal')) return [...this.routableCapabilities];
        return normalized.filter(item => this.routableCapabilities.includes(item));
    },

    hasCapability(value, capability) {
        const target = this.normalizeCapability(capability) || 'text';
        if (target === 'universal') return this.normalizeCapabilities(value).includes('universal');
        return this.expandCapabilities(value).includes(target);
    },

    inferCapabilitiesFromModelName(modelName = '') {
        const name = String(modelName || '').trim().toLowerCase();
        if (!name) return [];
        if (name.includes('video')) return ['video_generation'];
        if (name.includes('image')) return ['image_generation'];
        return [];
    },

    getCapabilityLabel(capability) {
        const key = this.normalizeCapability(capability);
        return this.capabilityLabels[key] || key || '未知能力';
    },

    getProviderLabel(provider) {
        const key = this.normalizeProvider(provider);
        return this.providerLabels[key] || key || '未知厂商';
    },

    getActionForCapability(capability) {
        const key = this.normalizeCapability(capability) || 'text';
        return this.actions[key] || 'chat';
    }
};

window.ZhiLiaoMoxingChangliangModule = ZhiLiaoMoxingChangliangModule;
