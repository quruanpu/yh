const ZhiLiaoMoxingYewuModule = {
    state: {
        activeOption: null,
        listeners: []
    },

    repo() {
        return window.ZhiLiaoMoxingHexinCangkuModule || window.ZhiLiaoMoxingCangkuModule || null;
    },

    router() {
        return window.ZhiLiaoMoxingHexinLuyouModule || null;
    },

    requireRepo() {
        const repo = this.repo();
        if (!repo) throw new Error('模型仓库模块未加载。');
        return repo;
    },

    requireRouter() {
        const router = this.router();
        if (!router) throw new Error('模型能力路由模块未加载。');
        return router;
    },

    async init() {
        await this.syncActiveOption();
    },

    getSelectionMode() {
        const repo = this.repo();
        return repo?.getSelectionMode?.() || 'auto';
    },

    getMenuGroups() {
        return this.repo()?.getMenuGroups?.() || [
            { id: 'text', label: '文本', capability: 'text' },
            { id: 'image', label: '图像', capability: 'image_generation' },
            { id: 'video', label: '视频', capability: 'video_generation' },
            { id: 'universal', label: '通用', capability: 'universal' }
        ];
    },

    getManualSelections() {
        return this.repo()?.getManualSelections?.() || {};
    },

    async syncActiveOption() {
        const repo = this.repo();
        if (!repo) {
            this.state.activeOption = null;
            this.notifyChange();
            return null;
        }
        try {
            this.state.activeOption = await repo.getActiveModelOption();
        } catch (error) {
            console.warn('模型仓库不可用，已清空当前模型:', error?.message || error);
            this.state.activeOption = null;
        }
        this.notifyChange();
        return this.state.activeOption;
    },

    async listConfigs() {
        return this.repo()?.listConfigs?.() || [];
    },

    async getModelOptions(capability = 'text') {
        try {
            return await this.requireRepo().getEnabledModelOptions(capability);
        } catch (error) {
            console.warn('读取模型列表失败:', error?.message || error);
            return [];
        }
    },

    async getMenuModelOptions(groupId = 'text') {
        try {
            return await this.requireRepo().getMenuModelOptions(groupId);
        } catch (error) {
            console.warn('读取分组模型列表失败:', error?.message || error);
            return [];
        }
    },

    async getGroupedModelOptions() {
        const groups = this.getMenuGroups();
        const entries = await Promise.all(groups.map(async (group) => ({
            group,
            options: await this.getMenuModelOptions(group.id)
        })));
        return entries;
    },

    async getCapabilityOption(capability, options = {}) {
        return this.requireRouter().requireCapability(capability, options);
    },

    async selectCapabilityModel(groupId, configId, model, modelId = '') {
        const option = await this.requireRepo().setCapabilityModel(groupId, configId, model, modelId);
        this.state.activeOption = await this.requireRepo().getActiveModelOption();
        this.notifyChange();
        return option;
    },

    async selectModel(configId, model, modelId = '') {
        return this.selectCapabilityModel('text', configId, model, modelId);
    },

    async selectAutoModel() {
        const option = await this.requireRepo().setAutoModel();
        this.state.activeOption = option;
        this.notifyChange();
        return option;
    },

    getActiveOption() {
        return this.state.activeOption;
    },

    getSelectionLabel(groupId = '', selection = null) {
        const groups = this.getMenuGroups();
        const group = groups.find(item => item.id === groupId);
        const model = String(selection?.model || '').trim();
        if (!group || !model) return '';
        const displayModel = model.length > 8 ? `${model.slice(0, 8)}...` : model;
        return `${group.label}:${displayModel}`;
    },

    getButtonText() {
        const selections = this.getManualSelections();
        const groups = this.getMenuGroups();
        const selectedCount = groups.filter(group => {
            const selection = selections[group.id];
            return String(selection?.model || '').trim();
        }).length;
        if (!selectedCount) return 'auto';
        return `已选${selectedCount}模型`;
    },

    onChange(listener) {
        if (typeof listener !== 'function') return () => {};
        this.state.listeners.push(listener);
        return () => {
            this.state.listeners = this.state.listeners.filter(item => item !== listener);
        };
    },

    notifyChange() {
        this.state.listeners.forEach((listener) => {
            try {
                listener(this.state.activeOption);
            } catch (error) {
                console.error('模型变更监听失败:', error);
            }
        });
    },

    async withRepoMutation(handler) {
        const result = await handler(this.requireRepo());
        await this.ensureActiveModelValid();
        return result;
    },

    async createConfig(rawConfig) {
        return this.withRepoMutation(repo => repo.createConfig(rawConfig));
    },

    async updateConfig(configId, rawConfig) {
        return this.withRepoMutation(repo => repo.updateConfig(configId, rawConfig));
    },

    async reorderConfigs(configIds = []) {
        return this.withRepoMutation(repo => repo.reorderConfigs(configIds));
    },

    async deleteConfig(configId) {
        return this.withRepoMutation(repo => repo.deleteConfig(configId));
    },

    async setConfigEnabled(configId, enabled) {
        return this.withRepoMutation(repo => repo.setConfigEnabled(configId, enabled));
    },

    async refreshRouteForConfig(configId) {
        return { configId, refreshed: true };
    },

    async refreshRouteForActiveOption() {
        const active = this.state.activeOption || await this.syncActiveOption();
        return { configId: active?.configId || '', refreshed: true };
    },

    async ensureActiveModelValid() {
        await this.syncActiveOption();
    }
};

window.ZhiLiaoMoxingYewuModule = ZhiLiaoMoxingYewuModule;
