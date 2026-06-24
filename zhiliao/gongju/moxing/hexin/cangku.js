const ZhiLiaoMoxingHexinCangkuModule = {
    config: {
        dbPath: 'zhiliao/model_configs',
        localSelectionKey: 'zhiliao_model_capability_selection',
        legacyTextSelectionKey: 'zhiliao_active_text_model_selection'
    },

    state: {
        migrationPromise: null
    },

    validator() {
        return window.ZhiLiaoMoxingHexinXiaoyanModule;
    },

    constants() {
        return window.ZhiLiaoMoxingChangliangModule;
    },

    getMenuGroups() {
        return [
            { id: 'text', label: '文本', capability: 'text' },
            { id: 'image', label: '图像', capability: 'image_generation' },
            { id: 'video', label: '视频', capability: 'video_generation' },
            { id: 'universal', label: '通用', capability: 'universal' }
        ];
    },

    normalizeGroupId(value = '') {
        const text = String(value || '').trim().toLowerCase();
        if (text === 'image' || text === 'image_generation' || text === 'image_understanding') return 'image';
        if (text === 'video' || text === 'video_generation' || text === 'video_understanding') return 'video';
        if (text === 'universal' || text === 'general') return 'universal';
        return 'text';
    },

    getCapabilityGroupId(capability = 'text') {
        const target = this.constants().normalizeCapability(capability) || 'text';
        if (target === 'image_generation' || target === 'image_understanding') return 'image';
        if (target === 'video_generation' || target === 'video_understanding') return 'video';
        if (target === 'universal') return 'universal';
        return 'text';
    },

    getGroupCapability(groupId = 'text') {
        const group = this.getMenuGroups().find(item => item.id === this.normalizeGroupId(groupId));
        return group?.capability || 'text';
    },

    toFiniteNumberOrNull(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return null;
        return Math.floor(num);
    },

    async ensureFirebase() {
        if (!window.FirebaseModule && window.LoginModule?.ensureDependencies) {
            await window.LoginModule.ensureDependencies();
        }
        if (!window.FirebaseModule) throw new Error('Firebase 模块未加载。');
        await window.FirebaseModule.init();
        if (!window.FirebaseModule.state.database) throw new Error('Firebase 数据库不可用。');
        return window.FirebaseModule.state.database;
    },

    sortModelItems(models = {}) {
        return Object.entries(models || {})
            .map(([id, item]) => ({
                id,
                name: String(item?.name || '').trim(),
                capabilities: this.constants().normalizeCapabilities(item?.capabilities || ['text']),
                enabled: item?.enabled !== false,
                sortOrder: this.toFiniteNumberOrNull(item?.sortOrder) || 0
            }))
            .filter(item => item.id && item.name)
            .sort((a, b) => {
                const aOrder = Number(a.sortOrder || 0);
                const bOrder = Number(b.sortOrder || 0);
                if (aOrder > 0 && bOrder > 0 && aOrder !== bOrder) return aOrder - bOrder;
                if (aOrder > 0 && bOrder <= 0) return -1;
                if (aOrder <= 0 && bOrder > 0) return 1;
                return a.name.localeCompare(b.name);
            })
            .map((item, index) => ({
                ...item,
                sortOrder: item.sortOrder > 0 ? item.sortOrder : index + 1
            }));
    },

    normalizeStoredConfig(id, item = {}) {
        const validator = this.validator();
        const constants = this.constants();
        const normalized = validator.normalizeConfig({
            name: item.name,
            provider: item.provider,
            url: item.url,
            key: item.key,
            models: item.models,
            enabled: item.enabled
        });
        const modelItems = this.sortModelItems(normalized.models);

        return {
            id,
            name: normalized.name,
            provider: constants.normalizeProvider(normalized.provider),
            url: normalized.url,
            key: normalized.key,
            models: normalized.models,
            modelItems,
            enabled: normalized.enabled,
            sortOrder: this.toFiniteNumberOrNull(item.sortOrder),
            created_at: item.created_at || 0,
            updated_at: item.updated_at || 0,
            created_by: item.created_by || ''
        };
    },

    needsMigration(item = {}) {
        if (!item || typeof item !== 'object') return false;
        if (Array.isArray(item.models)) return true;
        if (Object.prototype.hasOwnProperty.call(item, 'capabilities')) return true;
        return false;
    },

    buildMigratedNode(item = {}) {
        const validator = this.validator();
        const models = {};
        if (item.models && typeof item.models === 'object' && !Array.isArray(item.models)) {
            Object.assign(models, validator.normalizeModels(item.models));
        } else {
            const modelNames = Array.isArray(item.models)
                ? item.models
                : (typeof item.models === 'string' ? item.models : []);
            const seen = new Set();
            const names = Array.isArray(modelNames)
                ? modelNames
                : String(modelNames || '').split(/[\n,，；;]/g);

            names.forEach((name, index) => {
                const text = String(name || '').trim();
                if (!text || seen.has(text.toLowerCase())) return;
                seen.add(text.toLowerCase());
                const id = validator.buildModelId(text, `model_${index + 1}`);
                models[id] = {
                    name: text,
                    capabilities: ['text'],
                    enabled: true,
                    sortOrder: index + 1
                };
            });
        }

        return {
            name: String(item.name || '').trim(),
            provider: this.constants().normalizeProvider(item.provider),
            url: validator.normalizeUrl(item.url),
            key: String(item.key || '').trim(),
            models,
            enabled: !!item.enabled,
            sortOrder: this.toFiniteNumberOrNull(item.sortOrder),
            created_at: item.created_at || 0,
            updated_at: Date.now(),
            created_by: item.created_by || ''
        };
    },

    async migrateModelConfigSchema() {
        if (this.state.migrationPromise) return this.state.migrationPromise;
        this.state.migrationPromise = (async () => {
            const database = await this.ensureFirebase();
            const ref = database.ref(this.config.dbPath);
            const snapshot = await ref.once('value');
            const data = snapshot.val() || {};
            const updates = {};
            Object.entries(data).forEach(([id, item]) => {
                if (!this.needsMigration(item || {})) return;
                updates[id] = this.buildMigratedNode(item || {});
            });
            if (Object.keys(updates).length) {
                await ref.update(updates);
            }
        })().finally(() => {
            this.state.migrationPromise = null;
        });
        return this.state.migrationPromise;
    },

    sortConfigList(list = []) {
        const copied = [...list];
        copied.sort((a, b) => {
            const aOrder = this.toFiniteNumberOrNull(a.sortOrder);
            const bOrder = this.toFiniteNumberOrNull(b.sortOrder);
            const aHas = aOrder !== null && aOrder > 0;
            const bHas = bOrder !== null && bOrder > 0;
            if (aHas && bHas && aOrder !== bOrder) return aOrder - bOrder;
            if (aHas && !bHas) return -1;
            if (!aHas && bHas) return 1;
            return Number(b.updated_at || 0) - Number(a.updated_at || 0);
        });
        copied.forEach((item, index) => {
            if (!this.toFiniteNumberOrNull(item.sortOrder)) item.sortOrder = index + 1;
        });
        return copied;
    },

    toConfigList(data = {}) {
        const list = Object.entries(data || {}).map(([id, item]) => this.normalizeStoredConfig(id, item || {}));
        return this.sortConfigList(list);
    },

    async listConfigs() {
        await this.migrateModelConfigSchema();
        const database = await this.ensureFirebase();
        const snapshot = await database.ref(this.config.dbPath).once('value');
        return this.toConfigList(snapshot.val() || {});
    },

    async subscribeConfigs(onChange, onError) {
        await this.migrateModelConfigSchema();
        const database = await this.ensureFirebase();
        const ref = database.ref(this.config.dbPath);
        const handle = (snapshot) => {
            const list = this.toConfigList(snapshot.val() || {});
            if (typeof onChange === 'function') onChange(list);
        };
        ref.on('value', handle, (error) => {
            if (typeof onError === 'function') onError(error);
        });
        return () => ref.off('value', handle);
    },

    async saveConfig(configId, rawConfig) {
        const validator = this.validator();
        const validation = validator.validateAndNormalize(rawConfig);
        if (!validation.valid) throw new Error(validation.errors.join('；'));

        const database = await this.ensureFirebase();
        const now = Date.now();
        if (configId) {
            await database.ref(`${this.config.dbPath}/${configId}`).set({
                ...validation.data,
                sortOrder: this.toFiniteNumberOrNull(rawConfig.sortOrder) || null,
                created_at: rawConfig.created_at || 0,
                updated_at: now,
                created_by: rawConfig.created_by || ''
            });
            return configId;
        }

        const current = await this.listConfigs();
        const maxOrder = current.reduce((max, item) => Math.max(max, Number(item.sortOrder || 0)), 0);
        const ref = await database.ref(this.config.dbPath).push({
            ...validation.data,
            sortOrder: maxOrder + 1,
            created_at: now,
            updated_at: now,
            created_by: window.FirebaseModule?.state?.deviceId || 'unknown'
        });
        return ref.key;
    },

    async createConfig(rawConfig) {
        return this.saveConfig('', rawConfig);
    },

    async updateConfig(configId, rawConfig) {
        if (!configId) throw new Error('Config ID is required.');
        const current = (await this.listConfigs()).find(item => item.id === configId) || {};
        return this.saveConfig(configId, { ...current, ...rawConfig });
    },

    async deleteConfig(configId) {
        if (!configId) throw new Error('Config ID is required.');
        const database = await this.ensureFirebase();
        await database.ref(`${this.config.dbPath}/${configId}`).remove();
    },

    async setConfigEnabled(configId, enabled) {
        if (!configId) throw new Error('Config ID is required.');
        const database = await this.ensureFirebase();
        await database.ref(`${this.config.dbPath}/${configId}`).update({ enabled: !!enabled });
    },

    async reorderConfigs(configIds = []) {
        if (!Array.isArray(configIds) || !configIds.length) return;
        const updates = {};
        configIds.forEach((id, index) => {
            const key = String(id || '').trim();
            if (key) updates[`${key}/sortOrder`] = index + 1;
        });
        if (!Object.keys(updates).length) return;
        const database = await this.ensureFirebase();
        await database.ref(this.config.dbPath).update(updates);
    },

    createAutoSelection() {
        return {
            mode: 'auto',
            selections: {},
            updated_at: Date.now()
        };
    },

    normalizeStoredSelection(rawSelection = {}) {
        const source = rawSelection && typeof rawSelection === 'object' ? rawSelection : {};
        const selections = {};
        const rawSelections = source.selections && typeof source.selections === 'object'
            ? source.selections
            : {};

        Object.entries(rawSelections).forEach(([groupId, item]) => {
            if (!item || typeof item !== 'object') return;
            const configId = String(item.configId || '').trim();
            const modelId = String(item.modelId || '').trim();
            const model = String(item.model || '').trim();
            if (!configId || (!modelId && !model)) return;
            selections[this.normalizeGroupId(groupId)] = {
                configId,
                modelId,
                model,
                updated_at: Number(item.updated_at || source.updated_at || Date.now())
            };
        });

        if (source.mode === 'manual' && source.configId) {
            selections.text = {
                configId: String(source.configId || '').trim(),
                modelId: String(source.modelId || '').trim(),
                model: String(source.model || '').trim(),
                updated_at: Number(source.updated_at || Date.now())
            };
        }

        const hasManual = Object.keys(selections).length > 0;
        return {
            mode: hasManual ? 'manual' : 'auto',
            selections,
            updated_at: Number(source.updated_at || Date.now())
        };
    },

    getLocalSelection() {
        try {
            const raw = localStorage.getItem(this.config.localSelectionKey);
            if (raw) return this.normalizeStoredSelection(JSON.parse(raw));

            const legacyRaw = localStorage.getItem(this.config.legacyTextSelectionKey);
            if (legacyRaw) return this.normalizeStoredSelection(JSON.parse(legacyRaw));
        } catch (error) {
            console.warn('读取模型选择失败:', error);
        }
        return this.createAutoSelection();
    },

    getSelectionMode() {
        return this.getLocalSelection().mode === 'manual' ? 'manual' : 'auto';
    },

    saveLocalSelection(selection = {}) {
        const normalized = this.normalizeStoredSelection(selection);
        localStorage.setItem(this.config.localSelectionKey, JSON.stringify({
            mode: normalized.mode,
            selections: normalized.selections,
            updated_at: Date.now()
        }));
        localStorage.removeItem(this.config.legacyTextSelectionKey);
        return normalized;
    },

    setLocalSelection(groupId, option) {
        const current = this.getLocalSelection();
        const selections = { ...(current.selections || {}) };
        selections[this.normalizeGroupId(groupId)] = {
            configId: String(option?.configId || '').trim(),
            modelId: String(option?.modelId || '').trim(),
            model: String(option?.model || '').trim(),
            updated_at: Date.now()
        };
        return this.saveLocalSelection({
            mode: 'manual',
            selections,
            updated_at: Date.now()
        });
    },

    setAutoSelection() {
        return this.saveLocalSelection(this.createAutoSelection());
    },

    clearLocalSelection() {
        localStorage.removeItem(this.config.localSelectionKey);
        localStorage.removeItem(this.config.legacyTextSelectionKey);
    },

    getManualSelections() {
        return { ...(this.getLocalSelection().selections || {}) };
    },

    getManualSelection(groupId = 'text') {
        return this.getManualSelections()[this.normalizeGroupId(groupId)] || null;
    },

    buildOptionsForCapability(configs = [], capability = 'text') {
        const targetCapability = this.constants().normalizeCapability(capability) || 'text';
        const options = [];
        configs
            .filter(item => item.enabled)
            .forEach((item) => {
                this.sortModelItems(item.models).forEach((modelItem) => {
                    if (!modelItem.enabled) return;
                    if (!this.constants().hasCapability(modelItem.capabilities, targetCapability)) return;
                    options.push({
                        source: 'db',
                        configId: item.id,
                        configName: item.name,
                        provider: item.provider,
                        modelId: modelItem.id,
                        model: modelItem.name,
                        capabilities: [...modelItem.capabilities],
                        capability: targetCapability,
                        url: item.url,
                        key: item.key,
                        sortOrder: Number(item.sortOrder || 0),
                        modelSortOrder: Number(modelItem.sortOrder || 0),
                        enabled: true
                    });
                });
            });
        options.sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
            return a.modelSortOrder - b.modelSortOrder;
        });
        return options;
    },

    async getEnabledModelOptions(capability = 'text') {
        const configs = await this.listConfigs();
        return this.buildOptionsForCapability(configs, capability);
    },

    async getMenuModelOptions(groupId = 'text') {
        return this.getEnabledModelOptions(this.getGroupCapability(groupId));
    },

    async getFirstEnabledOption(capability = 'text') {
        const options = await this.getEnabledModelOptions(capability);
        return options[0] || null;
    },

    matchOption(options = [], selection = null) {
        if (!selection) return null;
        return options.find(item => {
            if (item.configId !== selection.configId) return false;
            if (selection.modelId) return item.modelId === selection.modelId;
            return item.model === selection.model;
        }) || null;
    },

    async getManualOptionForGroup(groupId = 'text') {
        const normalizedGroupId = this.normalizeGroupId(groupId);
        const selection = this.getManualSelection(normalizedGroupId);
        if (!selection) return null;

        const options = await this.getMenuModelOptions(normalizedGroupId);
        const matched = this.matchOption(options, selection);
        if (matched) return matched;

        const current = this.getLocalSelection();
        const selections = { ...(current.selections || {}) };
        delete selections[normalizedGroupId];
        this.saveLocalSelection({
            mode: Object.keys(selections).length ? 'manual' : 'auto',
            selections,
            updated_at: Date.now()
        });
        return null;
    },

    async getManualOptionForCapability(capability = 'text') {
        const target = this.constants().normalizeCapability(capability) || 'text';
        const primary = await this.getManualOptionForGroup(this.getCapabilityGroupId(target));
        if (primary && this.constants().hasCapability(primary.capabilities || [], target)) {
            return {
                ...primary,
                capability: target
            };
        }

        if (target !== 'text') {
            const universal = await this.getManualOptionForGroup('universal');
            if (universal && this.constants().hasCapability(universal.capabilities || [], target)) {
                return {
                    ...universal,
                    capability: target
                };
            }
        }
        return null;
    },

    async getActiveModelOption() {
        const manual = await this.getManualOptionForCapability('text');
        if (manual) return manual;
        const options = await this.getEnabledModelOptions('text');
        return options[0] || null;
    },

    async setCapabilityModel(groupId, configId, model, modelId = '') {
        const normalizedGroupId = this.normalizeGroupId(groupId);
        const options = await this.getMenuModelOptions(normalizedGroupId);
        const matched = options.find(item => {
            if (item.configId !== configId) return false;
            if (modelId) return item.modelId === modelId;
            return item.model === model;
        });
        if (!matched) throw new Error('该模型未启用或不支持当前能力。');
        this.setLocalSelection(normalizedGroupId, matched);
        return matched;
    },

    async setActiveModel(configId, model, modelId = '') {
        return this.setCapabilityModel('text', configId, model, modelId);
    },

    async setAutoModel() {
        this.setAutoSelection();
        const options = await this.getEnabledModelOptions('text');
        return options[0] || null;
    }
};

window.ZhiLiaoMoxingHexinCangkuModule = ZhiLiaoMoxingHexinCangkuModule;
window.ZhiLiaoMoxingCangkuModule = ZhiLiaoMoxingHexinCangkuModule;
