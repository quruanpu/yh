// Firebase数据库模块 - 账户登录信息存储
const FirebaseModule = {
    // Firebase配置
    config: {
        apiKey: "AIzaSyAbBSiwBNgBsVfwt5bHORpNTvSthMIaeM0",
        authDomain: "ai-moxing.firebaseapp.com",
        databaseURL: "https://ai-moxing-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "ai-moxing",
        storageBucket: "ai-moxing.firebasestorage.app",
        messagingSenderId: "295148076780",
        appId: "1:295148076780:web:c777bca192d4ea54cbefc9",
        measurementId: "G-S7NF2KTEBF"
    },

    // 状态
    state: {
        app: null,
        database: null,
        deviceId: null,
        deviceInfo: null
    },

    // 初始化Firebase
    async init() {
        if (this.state.app) return;

        try {
            const device = await this.getDeviceSnapshot();

            // 动态加载Firebase SDK
            await this.loadFirebaseSDK();

            // 检查是否已经有Firebase应用被初始化
            if (firebase.apps.length > 0) {
                // 使用已存在的应用
                this.state.app = firebase.app();
                console.log('使用已存在的Firebase应用');
            } else {
                // 初始化新的Firebase应用
                this.state.app = firebase.initializeApp(this.config);
                console.log('初始化新的Firebase应用');
            }

            this.state.database = firebase.database();
            this.state.deviceId = device.deviceId;
            this.state.deviceInfo = device.deviceInfo;

            console.log('Firebase模块初始化成功');
        } catch (error) {
            console.error('Firebase初始化失败:', error);
            throw error;
        }
    },

    // 加载Firebase SDK
    async loadFirebaseSDK() {
        return new Promise((resolve, reject) => {
            // 检查 firebase 和 database 模块是否都已加载
            if (window.firebase && window.firebase.database) {
                resolve();
                return;
            }

            // 检查是否已有加载中的脚本
            if (document.querySelector('script[src*="firebase-app.js"]')) {
                // 等待已有脚本加载完成
                const checkLoaded = setInterval(() => {
                    if (window.firebase && window.firebase.database) {
                        clearInterval(checkLoaded);
                        resolve();
                    }
                }, 50);
                return;
            }

            // 如果 firebase 存在但 database 不存在，只加载 database 模块
            if (window.firebase && !window.firebase.database) {
                const script = document.createElement('script');
                script.src = 'https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
                return;
            }

            // 都不存在，依次加载
            const script = document.createElement('script');
            script.src = 'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js';
            script.onload = () => {
                const script2 = document.createElement('script');
                script2.src = 'https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js';
                script2.onload = resolve;
                script2.onerror = reject;
                document.head.appendChild(script2);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    async getDeviceSnapshot() {
        if (!window.DeviceModule?.ready) {
            throw new Error('设备模块未就绪，无法初始化Firebase。');
        }

        const device = await window.DeviceModule.ready();
        if (!device?.deviceId) {
            throw new Error('设备码为空，无法初始化Firebase。');
        }
        return device;
    },

    _normalizeKey(value) {
        const text = String(value ?? '').trim();
        return text.replace(/[.#$/\[\]]/g, '_') || 'unknown';
    },

    _text(value) {
        return String(value ?? '').trim();
    },

    _providerFromScm(credentials = {}, providerInfo = {}) {
        credentials = credentials || {};
        providerInfo = providerInfo || {};
        return {
            provider_id: this._text(credentials.provider_id || providerInfo.provider_id),
            provider_name: this._text(providerInfo.provider_name || credentials.provider_name)
        };
    },

    _providerFromPms(credentials = {}, permissions = {}, userInfo = {}) {
        credentials = credentials || {};
        permissions = permissions || {};
        userInfo = userInfo || {};
        const providers = [
            ...(Array.isArray(permissions?.sub_providers) ? permissions.sub_providers : []),
            ...(Array.isArray(permissions?.providers) ? permissions.providers : [])
        ];
        const providerId = this._text(
            credentials.providerId
            || credentials.provider_id
            || userInfo.providerId
            || userInfo.provider_id
            || userInfo.supplierId
            || userInfo.supplier_id
            || providers[0]?.id
            || providers[0]?.provider_id
            || providers[0]?.providerId
        );
        const matched = providerId
            ? providers.find(item => this._text(item?.id || item?.provider_id || item?.providerId || item?.supplierId || item?.supplier_id) === providerId)
            : null;
        const first = matched || providers[0] || {};
        return {
            provider_id: providerId,
            provider_name: this._text(
                credentials.providerName
                || credentials.provider_name
                || userInfo.providerName
                || userInfo.provider_name
                || userInfo.supplierName
                || userInfo.supplier_name
                || userInfo.companyName
                || userInfo.company_name
                || userInfo.orgName
                || userInfo.org_name
                || first.name
                || first.provider_name
                || first.providerName
                || first.supplierName
                || first.supplier_name
                || first.companyName
                || first.company_name
            )
        };
    },

    _normalizeAccount(system, provider, account, payload = {}, timestamp = Date.now()) {
        const providerId = this._text(provider.provider_id);
        const providerName = this._text(provider.provider_name);
        const accountId = this._text(account);
        const base = {
            system,
            account: accountId,
            provider_id: providerId,
            provider_name: providerName,
            credentials: payload.credentials || null,
            user_info: payload.user_info || null,
            login_time: timestamp,
            last_update: timestamp,
            invalid: false,
            devices: {
                [this.state.deviceId]: {
                    login_time: timestamp,
                    device_info: this.state.deviceInfo || null
                }
            }
        };

        if (system === 'scm') {
            base.username = accountId;
            base.provider_info = payload.provider_info || {
                provider_id: providerId,
                provider_name: providerName
            };
            if (payload.account_secret) base.account_secret = payload.account_secret;
        }
        if (system === 'pms') {
            base.permissions = payload.permissions || null;
        }
        return base;
    },

    async saveSystemLogin(system, provider, account, payload = {}) {
        await this.init();
        const timestamp = Date.now();
        const providerId = this._normalizeKey(provider.provider_id);
        const accountId = this._normalizeKey(account);
        const accountData = this._normalizeAccount(system, provider, account, payload, timestamp);
        const indexKey = this._normalizeKey(`${provider.provider_id}_${account}`);
        const root = `zhanghu/${system}`;

        const providerInfo = {
            provider_id: accountData.provider_id,
            provider_name: accountData.provider_name,
            last_update: timestamp
        };
        const deviceIndex = {
            system,
            provider_id: accountData.provider_id,
            provider_name: accountData.provider_name,
            account: accountData.account,
            username: accountData.username || accountData.account,
            login_time: timestamp,
            invalid: false
        };

        const updates = {};
        const accountRef = `${root}/providers/${providerId}/accounts/${accountId}`;
        updates[`${root}/providers/${providerId}/provider_info`] = providerInfo;
        Object.entries(accountData).forEach(([key, value]) => {
            if (key !== 'devices') updates[`${accountRef}/${key}`] = value;
        });
        updates[`${accountRef}/devices/${this.state.deviceId}`] = accountData.devices[this.state.deviceId];
        updates[`${root}/devices/${this.state.deviceId}/${indexKey}`] = deviceIndex;

        try {
            await this.state.database.ref().update(updates);
            console.log(`${system.toUpperCase()}登录信息存储成功:`, accountData.account);
            return true;
        } catch (error) {
            console.error(`${system.toUpperCase()}登录信息存储失败:`, error);
            return false;
        }
    },

    async saveScmLogin(username, credentials, providerInfo, accountPassword = null) {
        const provider = this._providerFromScm(credentials, providerInfo);
        return this.saveSystemLogin('scm', provider, username, {
            credentials: credentials || null,
            provider_info: providerInfo || null,
            user_info: { account: username, username },
            account_secret: accountPassword
        });
    },

    async savePmsLogin(account, credentials, userInfo, permissions = null) {
        const provider = this._providerFromPms(credentials, permissions, userInfo);
        const normalizedCredentials = { ...(credentials || {}) };
        if (provider.provider_id && !normalizedCredentials.providerId) {
            normalizedCredentials.providerId = provider.provider_id;
        }
        if (provider.provider_name && !normalizedCredentials.providerName) {
            normalizedCredentials.providerName = provider.provider_name;
        }
        return this.saveSystemLogin('pms', provider, account, {
            credentials: normalizedCredentials,
            user_info: userInfo || null,
            permissions: permissions || null
        });
    },

    async saveBiLogin(account, credentials, userInfo, providerId, providerName) {
        return this.saveSystemLogin('bi', {
            provider_id: providerId,
            provider_name: providerName
        }, account, {
            credentials,
            user_info: userInfo || null
        });
    },

    async _getAccountByProvider(system, providerId, account) {
        await this.init();
        try {
            const providerKey = this._normalizeKey(providerId);
            const accountKey = this._normalizeKey(account);
            const snapshot = await this.state.database
                .ref(`zhanghu/${system}/providers/${providerKey}/accounts/${accountKey}`)
                .once('value');
            return snapshot.val();
        } catch (error) {
            console.error(`获取${system.toUpperCase()}登录信息失败:`, error);
            return null;
        }
    },

    async _findAllByProvider(system, providerId) {
        if (!this._text(providerId)) return [];
        await this.init();
        try {
            const providerKey = this._normalizeKey(providerId);
            const snapshot = await this.state.database
                .ref(`zhanghu/${system}/providers/${providerKey}/accounts`)
                .once('value');
            const accounts = [];
            snapshot.forEach((child) => {
                const data = child.val();
                if ((data?.credentials || data?.account_secret) && !data.invalid) accounts.push(data);
            });
            return accounts.sort((a, b) => (b.login_time || 0) - (a.login_time || 0));
        } catch (error) {
            console.error(`按供应商ID查找${system.toUpperCase()}失败:`, error);
            return [];
        }
    },

    async _setAccountInvalid(system, providerId, account, invalid = true) {
        if (!this._text(providerId) || !this._text(account)) return false;
        await this.init();
        try {
            const timestamp = Date.now();
            const providerKey = this._normalizeKey(providerId);
            const accountKey = this._normalizeKey(account);
            const accountRef = `zhanghu/${system}/providers/${providerKey}/accounts/${accountKey}`;
            const updates = {
                [`${accountRef}/invalid`]: invalid,
                [`${accountRef}/invalid_time`]: invalid ? timestamp : null,
                [`${accountRef}/last_update`]: timestamp
            };

            const indexKey = this._normalizeKey(`${providerId}_${account}`);
            updates[`zhanghu/${system}/devices/${this.state.deviceId}/${indexKey}/invalid`] = invalid;

            await this.state.database.ref().update(updates);
            console.log(`${invalid ? '标记' : '清除'}${system}账户失效:`, account);
            return true;
        } catch (error) {
            console.error(`更新${system}账户失效状态失败:`, error);
            return false;
        }
    },

    async markAccountInvalid(system, providerId, account) {
        return this._setAccountInvalid(system, providerId, account, true);
    },

    async clearAccountInvalid(system, providerId, account) {
        return this._setAccountInvalid(system, providerId, account, false);
    },

    async unshareLogin(system, providerId, account, mode = 'credentials') {
        if (!this._text(providerId) || !this._text(account)) return false;
        await this.init();
        try {
            const providerKey = this._normalizeKey(providerId);
            const accountKey = this._normalizeKey(account);
            const root = `zhanghu/${system}`;
            const accountRef = `${root}/providers/${providerKey}/accounts/${accountKey}`;
            const snapshot = await this.state.database.ref(accountRef).once('value');
            const current = snapshot.val();
            if (!current) return true;

            const hasSecretAfter = mode === 'secret'
                ? false
                : !!current.account_secret;
            const hasCredentialsAfter = mode === 'credentials'
                ? false
                : !!current.credentials;
            const updates = {};

            if (!hasSecretAfter && !hasCredentialsAfter) {
                const indexKey = this._normalizeKey(`${providerId}_${account}`);
                Object.keys(current.devices || {}).forEach((deviceId) => {
                    updates[`${root}/devices/${deviceId}/${indexKey}`] = null;
                });
                updates[accountRef] = null;
            } else if (mode === 'secret') {
                updates[`${accountRef}/last_update`] = Date.now();
                updates[`${accountRef}/account_secret`] = null;
            } else {
                updates[`${accountRef}/last_update`] = Date.now();
                updates[`${accountRef}/credentials`] = null;
            }
            await this.state.database.ref().update(updates);
            return true;
        } catch (error) {
            console.error('取消共享凭证失败:', error);
            return false;
        }
    },

    async getScmLogin(username, providerId) {
        if (!this._text(providerId) || !this._text(username)) return null;
        return this._getAccountByProvider('scm', providerId, username);
    },

    async getPmsLogin(account, providerId) {
        if (!this._text(providerId) || !this._text(account)) return null;
        return this._getAccountByProvider('pms', providerId, account);
    },

    async findBiByAccount(account, providerId) {
        if (!this._text(providerId) || !this._text(account)) return null;
        return this._getAccountByProvider('bi', providerId, account);
    },

    async findScmByUsername(username, providerId) {
        return this.getScmLogin(username, providerId);
    },

    async findPmsByAccount(account, providerId) {
        return this.getPmsLogin(account, providerId);
    },

    async findAllScmByProviderId(providerId) {
        return this._findAllByProvider('scm', providerId);
    },

    async findAllPmsByProviderId(providerId) {
        return this._findAllByProvider('pms', providerId);
    },

    async findAllBiByProviderId(providerId) {
        return this._findAllByProvider('bi', providerId);
    },

    // 获取所有 VPN 节点（按 last_seen 降序，最新的在前）
    async getVpnNodes() {
        await this.init();
        try {
            const snapshot = await this.state.database.ref('vpn').once('value');
            return this._parseVpnNodes(snapshot);
        } catch (error) {
            console.error('获取VPN节点失败:', error);
            return [];
        }
    },

    // 实时监听所有 VPN 节点变化（任何节点增删改都回调）
    async watchVpnNodes(callback) {
        await this.init();
        if (this._vpnRef) return;
        try {
            this._vpnRef = this.state.database.ref('vpn');
            this._vpnRef.on('value', (snapshot) => {
                const nodes = this._parseVpnNodes(snapshot);
                console.log('Firebase vpn 节点变化:', nodes.length, '个在线');
                if (callback) callback(nodes);
            });
        } catch (error) {
            console.error('监听VPN节点失败:', error);
        }
    },

    // 停止监听 VPN 节点
    stopWatchVpnNodes() {
        if (this._vpnRef) {
            this._vpnRef.off('value');
            this._vpnRef = null;
        }
    },

    // 删除指定的 VPN 节点
    async deleteVpnNode(nodeId) {
        await this.init();
        try {
            await this.state.database.ref(`vpn/${nodeId}`).remove();
            console.log('VPN节点已删除:', nodeId);
            return true;
        } catch (error) {
            console.error('删除VPN节点失败:', error);
            return false;
        }
    },

    // 增加节点失败计数，连续3次失败标记为失效
    async incrementVpnNodeFailCount(nodeId) {
        await this.init();
        try {
            const nodeRef = this.state.database.ref(`vpn/${nodeId}`);
            const snapshot = await nodeRef.once('value');
            const node = snapshot.val();
            if (!node) return 0;

            const failCount = (node.fail_count || 0) + 1;
            const updateData = { fail_count: failCount };

            if (failCount >= 3) {
                updateData.invalid = true;
                console.log('[Firebase] 节点标记为失效:', nodeId, '失败次数:', failCount);
            }

            await nodeRef.update(updateData);
            return failCount;
        } catch (error) {
            console.error('[Firebase] 更新节点失败计数失败:', error);
            return 0;
        }
    },

    // 清除节点失败计数和失效标记
    async clearVpnNodeFailCount(nodeId) {
        await this.init();
        try {
            await this.state.database.ref(`vpn/${nodeId}`).update({
                fail_count: 0,
                invalid: false
            });
            console.log('[Firebase] 节点失败计数已清除:', nodeId);
        } catch (error) {
            console.error('[Firebase] 清除节点失败计数失败:', error);
        }
    },

    // 解析 vpn/ 快照为节点数组（每台电脑一个子节点）
    _parseVpnNodes(snapshot) {
        const nodes = [];
        const data = snapshot.val();
        if (!data) return nodes;
        for (const [id, node] of Object.entries(data)) {
            if (node && node.url) {
                nodes.push({ id, ...node });
            }
        }
        return nodes.sort((a, b) => (b.last_seen || 0) - (a.last_seen || 0));
    },

    // 获取当前设备的所有登录账户
    async getDeviceLogins(systemFilter = null) {
        await this.init();

        try {
            const result = {
                scm: [],
                pms: [],
                bi: []
            };

            const systems = systemFilter ? [systemFilter] : ['scm', 'pms', 'bi'];
            for (const system of systems) {
                const snapshot = await this.state.database
                    .ref(`zhanghu/${system}/devices/${this.state.deviceId}`)
                    .once('value');
                const tasks = [];
                snapshot.forEach((childSnapshot) => {
                    const index = childSnapshot.val();
                    if (!index || index.invalid) return;
                    tasks.push(this._getAccountByProvider(system, index.provider_id, index.account));
                });

                const accounts = (await Promise.all(tasks))
                    .filter(item => (item?.credentials || item?.account_secret) && !item.invalid)
                    .sort((a, b) => (b.login_time || 0) - (a.login_time || 0));

                for (const data of accounts) {
                    if (system === 'scm') {
                        result.scm.push({
                            ...data,
                            username: data.username || data.account,
                            provider_name: data.provider_name || data.provider_info?.provider_name || '未知'
                        });
                    } else if (system === 'pms') {
                        const provider = this._providerFromPms(data.credentials || {}, data.permissions || {}, data.user_info || {});
                        result.pms.push({
                            ...data,
                            account: data.account,
                            provider_id: data.provider_id || provider.provider_id,
                            provider_name: data.provider_name || provider.provider_name,
                            user_name: data.user_info?.user_name || data.user_info?.userName || '未知'
                        });
                    } else if (system === 'bi') {
                        result.bi.push({
                            ...data,
                            account: data.account,
                            user_info: data.user_info || null
                        });
                    }
                }
            }

            return result;
        } catch (error) {
            console.error('获取设备登录信息失败:', error);
            return { scm: [], pms: [], bi: [] };
        }
    },

    // ========== 模板存储 ==========

    async getTpls(pid) {
        await this.init();
        const snap = await this.state.database.ref(`moban/yeji/${pid}`).once('value');
        const data = snap.val();
        if (!data) return [];
        return Object.entries(data).map(([key, val]) => ({ ...val, _key: key }))
            .sort((a, b) => (b.time || 0) - (a.time || 0));
    },

    async saveTpl(pid, tpl) {
        await this.init();
        const ref = await this.state.database.ref(`moban/yeji/${pid}`).push(tpl);
        return ref.key;
    },

    // 原地覆盖已有模板（同key，不删不建）
    async updateTpl(pid, key, tpl) {
        await this.init();
        await this.state.database.ref(`moban/yeji/${pid}/${key}`).set(tpl);
    },

    async deleteTpl(pid, key) {
        await this.init();
        try {
            await this.state.database.ref(`moban/yeji/${pid}/${key}`).remove();
            return true;
        } catch (e) {
            console.error('删除模板失败:', e);
            return false;
        }
    },

    // ========== BI汇总查询目标存储 ==========

    async getYejiTargets(pid) {
        await this.init();
        const snap = await this.state.database.ref(`moban/yeji_mubiao/${pid}/ultra_v2`).once('value');
        return snap.val() || { version: 1, module: 'ultra', ranges: {} };
    },

    async saveYejiTargetRange(pid, rangeKey, payload) {
        await this.init();
        const rootRef = this.state.database.ref(`moban/yeji_mubiao/${pid}/ultra_v2`);
        await rootRef.update({
            version: 1,
            module: 'ultra',
            updatedAt: Date.now()
        });
        await rootRef.child(`ranges/${rangeKey}`).set(payload);
    },

    async deleteYejiTargetRange(pid, rangeKey) {
        await this.init();
        await this.state.database.ref(`moban/yeji_mubiao/${pid}/ultra_v2/ranges/${rangeKey}`).remove();
    }
};

// 导出模块
window.FirebaseModule = FirebaseModule;
