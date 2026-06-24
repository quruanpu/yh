// 工具中心模块 - 数据与工具
const GongjuzxGongju = {
    get dbPath() {
        return window.GongjuzxConfig?.dbPath || 'gongju_zx/items';
    },

    get limits() {
        return window.GongjuzxConfig?.limits || {};
    },

    get defaultProvider() {
        return {
            provider_id: '3364',
            provider_name: '央拓医药'
        };
    },

    toText(value) {
        return String(value ?? '').trim();
    },

    toSafeLengthText(value, maxLength) {
        const text = this.toText(value);
        if (!Number.isFinite(maxLength) || maxLength <= 0) return text;
        return text.slice(0, maxLength);
    },

    escapeHtml(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    normalizeUrl(rawUrl) {
        const source = this.toText(rawUrl);
        if (!source) {
            return { valid: false, value: '', error: '请输入网站URL' };
        }

        const candidates = /^https?:\/\//i.test(source) ? [source] : [`https://${source}`];
        for (let i = 0; i < candidates.length; i += 1) {
            try {
                const parsed = new URL(candidates[i]);
                if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
                return { valid: true, value: parsed.toString() };
            } catch (_error) {
                // 继续尝试下一个候选地址
            }
        }

        return { valid: false, value: '', error: '网站URL格式不正确' };
    },

    normalizeShared(value) {
        return value === true || value === 'true' || value === 'shared' || value === '共享';
    },

    validatePayload(raw = {}) {
        const errors = [];
        const nameMax = Number(this.limits.nameMaxLength || 80);
        const urlMax = Number(this.limits.urlMaxLength || 2048);
        const descriptionMax = Number(this.limits.descriptionMaxLength || 200);

        const name = this.toSafeLengthText(raw.name, nameMax);
        const description = this.toSafeLengthText(raw.description, descriptionMax);
        const urlRaw = this.toSafeLengthText(raw.url, urlMax);

        if (!name) {
            errors.push('请输入网站名称');
        }

        const urlResult = this.normalizeUrl(urlRaw);
        if (!urlResult.valid) {
            errors.push(urlResult.error || '网站URL格式不正确');
        }

        return {
            valid: errors.length === 0,
            errors,
            data: {
                name,
                url: urlResult.value,
                description,
                is_shared: this.normalizeShared(raw.is_shared)
            }
        };
    },

    getActor() {
        const username = String(window.AppFramework?.loginUsername || window.LoginModule?.getDisplayUsername?.() || '').trim();
        if (username) return username;
        const sessionUsername = String(window.LoginModule?.session?.username || '').trim();
        if (sessionUsername) return sessionUsername;
        const deviceId = String(window.FirebaseModule?.state?.deviceId || '').trim();
        if (deviceId) return deviceId;
        return 'anonymous';
    },

    async getProviderInfo() {
        let credentials = null;
        try {
            const result = await window.LoginModule?.requireCredentials?.('scm', { silent: true });
            credentials = result?.ok ? result.credentials : null;
        } catch (_error) {
            credentials = null;
        }

        const session = window.LoginModule?.session || {};
        const providerInfo = session.providerInfo || {};
        const providerId = this.toText(
            credentials?.provider_id
            || credentials?.providerId
            || session.credentials?.provider_id
            || session.credentials?.providerId
        );
        const providerName = this.toText(
            providerInfo?.provider_name
            || credentials?.provider_name
            || credentials?.providerName
        );

        return {
            provider_id: providerId,
            provider_name: providerName
        };
    },

    async requireProviderInfo() {
        const provider = await this.getProviderInfo();
        if (!provider.provider_id) {
            throw new Error('无法获取当前供应商ID，请重新登录');
        }
        return provider;
    },

    canViewItem(item, currentProviderId) {
        if (item?.is_shared) return true;
        const ownerProviderId = this.toText(item?.provider_id) || this.defaultProvider.provider_id;
        return !!currentProviderId && ownerProviderId === String(currentProviderId);
    },

    canManageItem(item, currentProviderId) {
        const ownerProviderId = this.toText(item?.provider_id) || this.defaultProvider.provider_id;
        if (!currentProviderId) return false;
        return ownerProviderId === String(currentProviderId);
    },

    async ensureDatabase() {
        if (!window.FirebaseModule) {
            throw new Error('Firebase模块未加载');
        }
        await FirebaseModule.init();
        const db = FirebaseModule.state.database;
        if (!db) {
            throw new Error('Firebase数据库不可用');
        }
        return db;
    },

    normalizeList(rawData = {}, currentProviderId = '') {
        const list = Object.entries(rawData || {}).map(([id, item]) => {
            const hasSharedField = Object.prototype.hasOwnProperty.call(item || {}, 'is_shared');
            const normalized = {
                id,
                name: this.toText(item?.name),
                url: this.toText(item?.url),
                description: this.toText(item?.description),
                is_shared: hasSharedField ? this.normalizeShared(item?.is_shared) : false,
                provider_id: this.toText(item?.provider_id) || this.defaultProvider.provider_id,
                provider_name: this.toText(item?.provider_name) || this.defaultProvider.provider_name,
                created_at: Number(item?.created_at || 0),
                updated_at: Number(item?.updated_at || 0),
                created_by: this.toText(item?.created_by),
                updated_by: this.toText(item?.updated_by)
            };
            normalized.can_manage = this.canManageItem(normalized, currentProviderId);
            return normalized;
        }).filter((item) => this.canViewItem(item, currentProviderId));

        list.sort((a, b) => {
            const ua = Number(a.updated_at || 0);
            const ub = Number(b.updated_at || 0);
            if (ua !== ub) return ub - ua;
            return String(a.id || '').localeCompare(String(b.id || ''));
        });
        return list;
    },

    async listItems() {
        const db = await this.ensureDatabase();
        const provider = await this.getProviderInfo();
        const snapshot = await db.ref(this.dbPath).once('value');
        return this.normalizeList(snapshot.val() || {}, provider.provider_id);
    },

    async subscribeItems(onChange, onError) {
        const db = await this.ensureDatabase();
        const provider = await this.getProviderInfo();
        const ref = db.ref(this.dbPath);

        const handleValue = (snapshot) => {
            const list = this.normalizeList(snapshot.val() || {}, provider.provider_id);
            if (typeof onChange === 'function') onChange(list);
        };

        ref.on('value', handleValue, (error) => {
            if (typeof onError === 'function') onError(error);
        });

        return () => ref.off('value', handleValue);
    },

    async createItem(raw = {}) {
        const validated = this.validatePayload(raw);
        if (!validated.valid) {
            throw new Error(validated.errors[0] || '参数无效');
        }

        const db = await this.ensureDatabase();
        const provider = await this.requireProviderInfo();
        const now = Date.now();
        const actor = this.getActor();
        const payload = {
            ...validated.data,
            provider_id: provider.provider_id,
            provider_name: provider.provider_name,
            created_at: now,
            updated_at: now,
            created_by: actor,
            updated_by: actor
        };

        const ref = await db.ref(this.dbPath).push(payload);
        return ref.key;
    },

    async updateItem(itemId, raw = {}) {
        const id = this.toText(itemId);
        if (!id) {
            throw new Error('缺少资源ID');
        }

        const validated = this.validatePayload(raw);
        if (!validated.valid) {
            throw new Error(validated.errors[0] || '参数无效');
        }

        const db = await this.ensureDatabase();
        const provider = await this.requireProviderInfo();
        const itemRef = db.ref(`${this.dbPath}/${id}`);
        const snapshot = await itemRef.once('value');
        const existing = snapshot.val();
        if (!existing || !this.canManageItem(existing, provider.provider_id)) {
            throw new Error('无权编辑该工具');
        }

        const payload = {
            ...validated.data,
            provider_id: this.toText(existing.provider_id) || this.defaultProvider.provider_id,
            provider_name: this.toText(existing.provider_name) || this.defaultProvider.provider_name,
            updated_at: Date.now(),
            updated_by: this.getActor()
        };

        await itemRef.update(payload);
    },

    async deleteItem(itemId) {
        const id = this.toText(itemId);
        if (!id) {
            throw new Error('缺少资源ID');
        }
        const db = await this.ensureDatabase();
        const provider = await this.requireProviderInfo();
        const itemRef = db.ref(`${this.dbPath}/${id}`);
        const snapshot = await itemRef.once('value');
        const existing = snapshot.val();
        if (!existing || !this.canManageItem(existing, provider.provider_id)) {
            throw new Error('无权删除该工具');
        }
        await itemRef.remove();
    }
};

window.GongjuzxGongju = GongjuzxGongju;
