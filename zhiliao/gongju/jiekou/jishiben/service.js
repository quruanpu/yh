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

    // ---------- 树存储助手（sjk 中控：notebooks 集合，整树内嵌） ----------

    async ensureDb() {
        if (!window.SjkModule) throw new Error('记事本数据库未初始化');
        await window.SjkModule.init();
        return window.SjkModule;
    },

    async _loadTree(providerId) {
        return window.SjkModule.get('notebooks', providerId);
    },

    async _saveTree(providerId, tree) {
        await window.SjkModule.set('notebooks', providerId, tree);
    },

    _getNodeAt(tree, nodePath) {
        if (!nodePath) return tree || null;
        let node = tree;
        for (const segment of nodePath.split('/')) {
            if (!node || typeof node !== 'object') return null;
            node = node[segment];
        }
        return node === undefined ? null : node;
    },

    _setNodeAt(tree, nodePath, value) {
        if (!nodePath) return value;
        const segments = nodePath.split('/');
        let node = tree;
        for (let i = 0; i < segments.length - 1; i++) {
            const segment = segments[i];
            if (!node[segment] || typeof node[segment] !== 'object') node[segment] = {};
            node = node[segment];
        }
        node[segments[segments.length - 1]] = value;
        return tree;
    },

    _deleteNodeAt(tree, nodePath) {
        if (!nodePath) return tree;
        const segments = nodePath.split('/');
        let node = tree;
        for (let i = 0; i < segments.length - 1; i++) {
            const segment = segments[i];
            if (!node[segment] || typeof node[segment] !== 'object') return tree;
            node = node[segment];
        }
        delete node[segments[segments.length - 1]];
        return tree;
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

    async ensureProviderRoot(providerId) {
        const tree = await this._loadTree(providerId);

        if (tree === null || tree === undefined) {
            const now = this.now();
            await this._saveTree(providerId, {
                __meta: {
                    provider_id: providerId,
                    created_at: now,
                    updated_at: now
                }
            });
            return { created: true };
        }

        if (!this.isPlainObject(tree)) {
            throw new Error('记事本节点结构异常，无法操作');
        }

        if (!this.isPlainObject(tree.__meta)) {
            const now = this.now();
            tree.__meta = {
                provider_id: providerId,
                created_at: now,
                updated_at: now
            };
            await this._saveTree(providerId, tree);
            return { created: false };
        }

        return { created: false };
    },

    async touchUpdatedAt(providerId) {
        const tree = await this._loadTree(providerId);
        if (!tree || !this.isPlainObject(tree)) return;
        tree.__meta = this.isPlainObject(tree.__meta) ? tree.__meta : {};
        tree.__meta.updated_at = this.now();
        await this._saveTree(providerId, tree);
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

    async readNode(providerId, nodePath) {
        const scopedPath = this.getScopedPath(providerId, nodePath);
        const value = this._getNodeAt(await this._loadTree(providerId), nodePath);
        const exists = value !== null && value !== undefined;
        return {
            action: 'read_node',
            scoped_path: scopedPath,
            exists,
            value: exists ? value : null
        };
    },

    async listNodes(providerId, nodePath, includeValues, maxChildren) {
        const scopedPath = this.getScopedPath(providerId, nodePath);
        const value = this._getNodeAt(await this._loadTree(providerId), nodePath);

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

    async createNode(providerId, nodePath, value) {
        const scopedPath = this.getScopedPath(providerId, nodePath);
        const tree = await this._loadTree(providerId);
        const existing = this._getNodeAt(tree, nodePath);
        if (existing !== null && existing !== undefined) {
            return {
                action: 'create_node',
                scoped_path: scopedPath,
                created: false,
                existed: true
            };
        }

        const nextValue = value === undefined ? {} : value;
        const nextTree = tree && this.isPlainObject(tree) ? tree : {};
        this._setNodeAt(nextTree, nodePath, nextValue);
        await this._saveTree(providerId, nextTree);
        await this.touchUpdatedAt(providerId);
        return {
            action: 'create_node',
            scoped_path: scopedPath,
            created: true,
            existed: false
        };
    },

    async writeNode(providerId, nodePath, value) {
        const scopedPath = this.getScopedPath(providerId, nodePath);
        const tree = await this._loadTree(providerId);
        const existing = this._getNodeAt(tree, nodePath);
        const nextTree = tree && this.isPlainObject(tree) ? tree : {};
        this._setNodeAt(nextTree, nodePath, value);
        await this._saveTree(providerId, nextTree);
        await this.touchUpdatedAt(providerId);
        return {
            action: 'write_node',
            scoped_path: scopedPath,
            overwritten: existing !== null && existing !== undefined
        };
    },

    async updateNode(providerId, nodePath, value) {
        const scopedPath = this.getScopedPath(providerId, nodePath);
        const tree = await this._loadTree(providerId);
        const existing = this._getNodeAt(tree, nodePath);
        const merged = (existing && typeof existing === 'object' && !Array.isArray(existing))
            ? { ...existing, ...value }
            : { ...value };
        const nextTree = tree && this.isPlainObject(tree) ? tree : {};
        this._setNodeAt(nextTree, nodePath, merged);
        await this._saveTree(providerId, nextTree);
        await this.touchUpdatedAt(providerId);
        return {
            action: 'update_node',
            scoped_path: scopedPath,
            updated_keys: Object.keys(value)
        };
    },

    async deleteNode(providerId, nodePath) {
        const scopedPath = this.getScopedPath(providerId, nodePath);
        const tree = await this._loadTree(providerId);
        const existing = this._getNodeAt(tree, nodePath);
        if (existing === null || existing === undefined) {
            return {
                action: 'delete_node',
                scoped_path: scopedPath,
                deleted: false,
                existed: false
            };
        }

        this._deleteNodeAt(tree, nodePath);
        await this._saveTree(providerId, tree);
        await this.touchUpdatedAt(providerId);
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

            await this.ensureDb();
            const providerId = await this.resolveProviderId();
            this.validateScopedNodePath(input.node_path, providerId);
            await this.ensureProviderRoot(providerId);

            let result = null;
            switch (input.action) {
                case 'create_node':
                    result = await this.createNode(providerId, input.node_path, input.value);
                    break;
                case 'read_node':
                    result = await this.readNode(providerId, input.node_path);
                    break;
                case 'write_node':
                    result = await this.writeNode(providerId, input.node_path, input.value);
                    break;
                case 'update_node':
                    result = await this.updateNode(providerId, input.node_path, input.value);
                    break;
                case 'delete_node':
                    result = await this.deleteNode(providerId, input.node_path);
                    break;
                case 'list_nodes':
                    result = await this.listNodes(
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
