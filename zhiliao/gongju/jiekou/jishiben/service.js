/**
 * Notebook Service
 * Scope lock: jishiben/{providerId}
 */
const notebookConfig = globalThis.ZhiLiaoConfig?.notebook || {};

const NotebookService = {
    config: {
        rootNode: 'jishiben',
        defaultMaxChildren: Number(notebookConfig.defaultMaxChildren) || 100,
        maxChildrenLimit: Number(notebookConfig.maxChildrenLimit) || 500
    },

    text(value) {
        if (value === undefined || value === null) return '';
        return String(value).trim();
    },

    toInt(value, fallback) {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.floor(n);
    },

    clampInt(value, min, max, fallback) {
        const n = this.toInt(value, fallback);
        return Math.max(min, Math.min(max, n));
    },

    toBoolean(value, fallback = false) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') {
            const v = value.trim().toLowerCase();
            if (['1', 'true', 'yes', 'on'].includes(v)) return true;
            if (['0', 'false', 'no', 'off'].includes(v)) return false;
        }
        return fallback;
    },

    isPlainObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    },

    now() {
        return Date.now();
    },

    ensureDb() {
        const db = window.FirebaseModule?.state?.database || null;
        if (!db) throw new Error('记事本数据库未初始化');
        return db;
    },

    normalizeAction(action) {
        const raw = this.text(action).toLowerCase();
        const map = {
            create: 'create_node',
            create_node: 'create_node',
            add: 'create_node',
            read: 'read_node',
            read_node: 'read_node',
            get: 'read_node',
            query: 'read_node',
            write: 'write_node',
            write_node: 'write_node',
            save: 'write_node',
            set: 'write_node',
            update: 'update_node',
            update_node: 'update_node',
            patch: 'update_node',
            delete: 'delete_node',
            delete_node: 'delete_node',
            remove: 'delete_node',
            del: 'delete_node',
            list: 'list_nodes',
            list_nodes: 'list_nodes',
            ls: 'list_nodes'
        };
        return map[raw] || '';
    },

    sanitizeSegment(segment) {
        const value = this.text(segment);
        if (!value) throw new Error('node_path 包含空节点');
        if (value === '.' || value === '..') throw new Error('node_path 非法');
        if (/[.#$\[\]\/]/.test(value)) throw new Error('node_path 含非法字符');
        return value;
    },

    normalizeNodePath(nodePath, allowEmpty = true) {
        const raw = this.text(nodePath);
        if (!raw) {
            if (allowEmpty) return '';
            throw new Error('node_path 不能为空');
        }

        const normalized = raw
            .replace(/\\/g, '/')
            .replace(/^\/+/, '')
            .replace(/\/+$/, '');
        if (!normalized) {
            if (allowEmpty) return '';
            throw new Error('node_path 不能为空');
        }

        const segments = normalized
            .split('/')
            .map((part) => this.sanitizeSegment(part));

        return segments.join('/');
    },

    isMetaPath(path) {
        if (!path) return false;
        return path === '__meta' || path.startsWith('__meta/');
    },

    async resolveProviderId() {
        const result = await window.LoginModule?.requireCredentials?.('scm', { silent: true });
        const creds = result?.ok ? result.credentials : null;
        const providerId = this.text(creds?.provider_id);
        if (!providerId) {
            throw new Error('NOT_LOGGED_IN');
        }
        return this.sanitizeSegment(providerId);
    },

    getProviderRoot(providerId) {
        return `${this.config.rootNode}/${providerId}`;
    },

    getScopedPath(providerId, nodePath = '') {
        const root = this.getProviderRoot(providerId);
        return nodePath ? `${root}/${nodePath}` : root;
    },

    async ensureProviderRoot(db, providerId) {
        const rootPath = this.getProviderRoot(providerId);
        const rootRef = db.ref(rootPath);
        const snapshot = await rootRef.once('value');
        const value = snapshot.val();

        if (value === null || value === undefined) {
            const now = this.now();
            await rootRef.set({
                __meta: {
                    provider_id: providerId,
                    created_at: now,
                    updated_at: now
                }
            });
            return { created: true };
        }

        if (!this.isPlainObject(value)) {
            throw new Error('记事本节点结构异常，无法操作');
        }

        if (!this.isPlainObject(value.__meta)) {
            const now = this.now();
            await rootRef.child('__meta').set({
                provider_id: providerId,
                created_at: now,
                updated_at: now
            });
            return { created: false };
        }

        return { created: false };
    },

    async touchUpdatedAt(db, providerId) {
        const updatedAtRef = db.ref(`${this.getProviderRoot(providerId)}/__meta/updated_at`);
        await updatedAtRef.set(this.now());
    },

    normalizeParams(params = {}) {
        const base = this.isPlainObject(params) ? { ...params } : { action: params };
        const hasOwnValue = Object.prototype.hasOwnProperty.call(base, 'value');
        const hasOwnData = Object.prototype.hasOwnProperty.call(base, 'data');
        const hasValue = hasOwnValue || hasOwnData;

        const action = this.normalizeAction(base.action || base.op || base.mode || base.type);
        const nodePath = this.normalizeNodePath(
            base.node_path ?? base.path ?? base.key ?? base.node ?? '',
            true
        );

        return {
            action,
            node_path: nodePath,
            value: hasOwnValue ? base.value : base.data,
            has_value: hasValue,
            include_values: this.toBoolean(base.include_values, false),
            max_children: this.clampInt(
                base.max_children,
                1,
                this.config.maxChildrenLimit,
                this.config.defaultMaxChildren
            )
        };
    },

    validateInput(input) {
        if (!input.action) {
            throw new Error('缺少 action 参数');
        }

        const action = input.action;
        const nodePath = input.node_path;
        const rootNode = this.config.rootNode;

        if (nodePath && (nodePath === rootNode || nodePath.startsWith(`${rootNode}/`))) {
            throw new Error('node_path 必须为相对路径，不能包含根节点');
        }

        if (['create_node', 'write_node', 'update_node', 'delete_node'].includes(action) && !nodePath) {
            throw new Error(`${action} 需要 node_path`);
        }

        if (['create_node', 'write_node', 'update_node', 'delete_node'].includes(action) && this.isMetaPath(nodePath)) {
            throw new Error('禁止操作系统保留节点');
        }

        if (action === 'update_node' && !this.isPlainObject(input.value)) {
            throw new Error('update_node 的 value 必须是对象');
        }

        if (action === 'write_node' && input.has_value !== true) {
            throw new Error('write_node 缺少 value');
        }
    },

    validateScopedNodePath(nodePath, providerId) {
        if (!nodePath) return;
        if (nodePath === providerId || nodePath.startsWith(`${providerId}/`)) {
            throw new Error('node_path 必须为相对路径，不能包含供应商节点');
        }
    },

    async readNode(db, providerId, nodePath) {
        const scopedPath = this.getScopedPath(providerId, nodePath);
        const snapshot = await db.ref(scopedPath).once('value');
        return {
            action: 'read_node',
            scoped_path: scopedPath,
            exists: snapshot.exists(),
            value: snapshot.val()
        };
    },

    async listNodes(db, providerId, nodePath, includeValues, maxChildren) {
        const scopedPath = this.getScopedPath(providerId, nodePath);
        const snapshot = await db.ref(scopedPath).once('value');
        const value = snapshot.val();

        if (value === null || value === undefined) {
            return {
                action: 'list_nodes',
                scoped_path: scopedPath,
                exists: false,
                node_type: 'null',
                children_count: 0,
                children: []
            };
        }

        if (!this.isPlainObject(value) && !Array.isArray(value)) {
            return {
                action: 'list_nodes',
                scoped_path: scopedPath,
                exists: true,
                node_type: typeof value,
                children_count: 0,
                children: [],
                value
            };
        }

        const keys = Object.keys(value)
            .filter((key) => !(nodePath === '' && key === '__meta'))
            .slice(0, maxChildren);

        const out = {
            action: 'list_nodes',
            scoped_path: scopedPath,
            exists: true,
            node_type: Array.isArray(value) ? 'array' : 'object',
            children_count: keys.length,
            children: keys
        };

        if (includeValues) {
            const values = {};
            keys.forEach((key) => {
                values[key] = value[key];
            });
            out.values = values;
        }

        return out;
    },

    async createNode(db, providerId, nodePath, value) {
        const scopedPath = this.getScopedPath(providerId, nodePath);
        const ref = db.ref(scopedPath);
        const existing = await ref.once('value');
        if (existing.exists()) {
            return {
                action: 'create_node',
                scoped_path: scopedPath,
                created: false,
                existed: true
            };
        }

        const nextValue = value === undefined ? {} : value;
        await ref.set(nextValue);
        await this.touchUpdatedAt(db, providerId);
        return {
            action: 'create_node',
            scoped_path: scopedPath,
            created: true,
            existed: false
        };
    },

    async writeNode(db, providerId, nodePath, value) {
        const scopedPath = this.getScopedPath(providerId, nodePath);
        const ref = db.ref(scopedPath);
        const existing = await ref.once('value');
        await ref.set(value);
        await this.touchUpdatedAt(db, providerId);
        return {
            action: 'write_node',
            scoped_path: scopedPath,
            overwritten: existing.exists()
        };
    },

    async updateNode(db, providerId, nodePath, value) {
        const scopedPath = this.getScopedPath(providerId, nodePath);
        const ref = db.ref(scopedPath);
        await ref.update(value);
        await this.touchUpdatedAt(db, providerId);
        return {
            action: 'update_node',
            scoped_path: scopedPath,
            updated_keys: Object.keys(value)
        };
    },

    async deleteNode(db, providerId, nodePath) {
        const scopedPath = this.getScopedPath(providerId, nodePath);
        const ref = db.ref(scopedPath);
        const existing = await ref.once('value');
        if (!existing.exists()) {
            return {
                action: 'delete_node',
                scoped_path: scopedPath,
                deleted: false,
                existed: false
            };
        }

        await ref.remove();
        await this.touchUpdatedAt(db, providerId);
        return {
            action: 'delete_node',
            scoped_path: scopedPath,
            deleted: true,
            existed: true
        };
    },

    async execute(params = {}) {
        try {
            const input = this.normalizeParams(params);
            this.validateInput(input);

            const db = this.ensureDb();
            const providerId = await this.resolveProviderId();
            this.validateScopedNodePath(input.node_path, providerId);
            await this.ensureProviderRoot(db, providerId);

            let result = null;
            switch (input.action) {
                case 'create_node':
                    result = await this.createNode(db, providerId, input.node_path, input.value);
                    break;
                case 'read_node':
                    result = await this.readNode(db, providerId, input.node_path);
                    break;
                case 'write_node':
                    result = await this.writeNode(db, providerId, input.node_path, input.value);
                    break;
                case 'update_node':
                    result = await this.updateNode(db, providerId, input.node_path, input.value);
                    break;
                case 'delete_node':
                    result = await this.deleteNode(db, providerId, input.node_path);
                    break;
                case 'list_nodes':
                    result = await this.listNodes(
                        db,
                        providerId,
                        input.node_path,
                        input.include_values,
                        input.max_children
                    );
                    break;
                default:
                    throw new Error(`不支持的 action: ${input.action}`);
            }

            return {
                success: true,
                provider_id: providerId,
                provider_root: this.getProviderRoot(providerId),
                ...result
            };
        } catch (error) {
            if (error?.message === 'NOT_LOGGED_IN') {
                return { success: false, error: '未登录！或登录失效。' };
            }
            return {
                success: false,
                error: this.text(error?.message || error) || '记事本工具执行失败'
            };
        }
    }
};

window.NotebookService = NotebookService;
