// =====================================================================
// denglu/zhanghu.js —— 登录账户库仓储（ZhanghuModule）
// 全新实现：数据层走 zhongxin/shujuku/SjkModule（CF Worker + D1），业务归一逻辑与旧版逐行对齐。
// 契约见《数据库优化/02-数据契约.md》。
// =====================================================================
const ZhanghuModule = {
    // 状态（deviceId / deviceInfo 供调用方读取，来自 DeviceModule）
    state: {
        deviceId: null,
        deviceInfo: null
    },

    // ---------- 键与文本工具（与旧版一致） ----------

    _normalizeKey(value) {
        const text = String(value ?? '').trim();
        return text.replace(/[.#$/[\]]/g, '_') || 'unknown';
    },

    _text(value) {
        return String(value ?? '').trim();
    },

    // ---------- 初始化 ----------

    async init() {
        await SjkModule.init();
        if (this.state.deviceId) return;

        const device = await window.DeviceModule.ready();
        if (!device?.deviceId) {
            throw new Error('设备码为空，无法初始化账户库。');
        }
        this.state.deviceId = device.deviceId;
        this.state.deviceInfo = device.deviceInfo;
    },

    _requireDeviceId() {
        if (!this.state.deviceId) {
            throw new Error('账户库未初始化（缺少设备码）。');
        }
        return this.state.deviceId;
    },

    // ---------- 账户文档 ID ----------

    _accountDocId(system, providerId, account) {
        return `${system}::${this._normalizeKey(providerId)}::${this._normalizeKey(account)}`;
    },

    _deviceIndexDocId(system, deviceId, indexKey) {
        return `${system}::${this._normalizeKey(deviceId)}::${this._normalizeKey(indexKey)}`;
    },

    // ---------- provider 归一（与旧版逐行对齐） ----------

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

    // ---------- 写入 ----------

    // 旧版为 RTDB 多路径原子写（账户字段逐项 + 当前设备痕迹 + 设备索引）；
    // 新版读改写账户文档（保留其他设备的 devices 痕迹），再写设备索引文档。
    async saveSystemLogin(system, provider, account, payload = {}) {
        await this.init();
        const timestamp = Date.now();
        const providerKey = this._normalizeKey(provider.provider_id);
        const indexKey = this._normalizeKey(`${provider.provider_id}_${account}`);
        const accountData = this._normalizeAccount(system, provider, account, payload, timestamp);
        const accountDocId = this._accountDocId(system, provider.provider_id, account);
        const deviceIndexDocId = this._deviceIndexDocId(system, this.state.deviceId, indexKey);

        const deviceIndex = {
            device_id: this.state.deviceId,
            index_key: indexKey,
            system,
            provider_id: accountData.provider_id,
            provider_name: accountData.provider_name,
            account: accountData.account,
            username: accountData.username || accountData.account,
            login_time: timestamp,
            invalid: false
        };

        try {
            // 原版为 RTDB update（逐字段覆盖，未提供的旧字段保留）；
            // 新版整写前必须合并旧文档：account_secret / provider_info 等历史字段不得丢失。
            const existing = await SjkModule.get('login_accounts', accountDocId);
            const merged = { ...(existing || {}), ...accountData };
            merged.devices = { ...(existing?.devices || {}), ...accountData.devices };
            await SjkModule.set('login_accounts', accountDocId, merged);
            await SjkModule.set('device_logins', deviceIndexDocId, deviceIndex);
            console.log(`${system.toUpperCase()}登录信息存储成功:`, accountData.account);
            return true;
        } catch (error) {
            this._logError(`${system.toUpperCase()}登录信息存储`, error);
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

    // ---------- 读取 ----------

    async _getAccountByProvider(system, providerId, account) {
        await this.init();
        if (!this._text(providerId) || !this._text(account)) return null;
        try {
            return await SjkModule.get('login_accounts', this._accountDocId(system, providerId, account));
        } catch (error) {
            this._logError(`获取${system.toUpperCase()}登录信息`, error);
            return null;
        }
    },

    async _findAllByProvider(system, providerId) {
        if (!this._text(providerId)) return [];
        await this.init();
        try {
            const docs = await SjkModule.getWhere('login_accounts', 'provider_id', '==', this._text(providerId));
            return docs
                .filter((data) => (data?.credentials || data?.account_secret) && !data.invalid)
                .sort((a, b) => (b.login_time || 0) - (a.login_time || 0));
        } catch (error) {
            this._logError(`按供应商ID查找${system.toUpperCase()}`, error);
            return [];
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

    // ---------- 失效标记 ----------

    // 旧版：账户节点 + 当前设备的索引标记。新实现语义一致（只动当前设备索引，索引不存在则跳过）。
    async _setAccountInvalid(system, providerId, account, invalid = true) {
        if (!this._text(providerId) || !this._text(account)) return false;
        await this.init();
        const timestamp = Date.now();
        const indexKey = this._normalizeKey(`${providerId}_${account}`);
        const accountDocId = this._accountDocId(system, providerId, account);
        const deviceIndexDocId = this._deviceIndexDocId(system, this.state.deviceId, indexKey);

        try {
            await SjkModule.update('login_accounts', accountDocId, {
                invalid,
                invalid_time: invalid ? timestamp : null,
                last_update: timestamp
            });
            const indexDoc = await SjkModule.get('device_logins', deviceIndexDocId);
            if (indexDoc) {
                await SjkModule.update('device_logins', deviceIndexDocId, { invalid });
            }
            console.log(`${invalid ? '标记' : '清除'}${system}账户失效:`, account);
            return true;
        } catch (error) {
            this._logError(`${invalid ? '标记' : '清除'}${system}账户失效`, error);
            return false;
        }
    },

    async markAccountInvalid(system, providerId, account) {
        return this._setAccountInvalid(system, providerId, account, true);
    },

    async clearAccountInvalid(system, providerId, account) {
        return this._setAccountInvalid(system, providerId, account, false);
    },

    // ---------- 取消共享 ----------

    // 行为对齐旧版：关掉一种后若另一种仍在，仅清字段；两者皆空则删账户 + 删其 devices 中所有设备的索引。
    async unshareLogin(system, providerId, account, mode = 'credentials') {
        if (!this._text(providerId) || !this._text(account)) return false;
        await this.init();
        const accountDocId = this._accountDocId(system, providerId, account);
        const indexKey = this._normalizeKey(`${providerId}_${account}`);

        try {
            const current = await SjkModule.get('login_accounts', accountDocId);
            if (!current) return true;

            const hasSecretAfter = mode === 'secret'
                ? false
                : !!current.account_secret;
            const hasCredentialsAfter = mode === 'credentials'
                ? false
                : !!current.credentials;

            if (!hasSecretAfter && !hasCredentialsAfter) {
                const deviceIds = Object.keys(current.devices || {});
                for (const deviceId of deviceIds) {
                    await SjkModule.remove(
                        'device_logins',
                        this._deviceIndexDocId(system, deviceId, indexKey)
                    );
                }
                await SjkModule.remove('login_accounts', accountDocId);
            } else if (mode === 'secret') {
                await SjkModule.update('login_accounts', accountDocId, {
                    last_update: Date.now(),
                    account_secret: null
                });
            } else {
                await SjkModule.update('login_accounts', accountDocId, {
                    last_update: Date.now(),
                    credentials: null
                });
            }
            return true;
        } catch (error) {
            this._logError('取消共享凭证', error);
            return false;
        }
    },

    // ---------- 设备登录信息 ----------

    // 返回结构对齐旧版：{ scm:[...], pms:[...], bi:[...] }
    async getDeviceLogins(systemFilter = null) {
        await this.init();
        const deviceId = this._requireDeviceId();

        try {
            const result = { scm: [], pms: [], bi: [] };
            const systems = systemFilter ? [systemFilter] : ['scm', 'pms', 'bi'];

            for (const system of systems) {
                const indexDocs = await SjkModule.getWhere('device_logins', 'device_id', '==', deviceId);
                const systemIndexes = indexDocs
                    .filter((index) => index && index.system === system && !index.invalid);

                const tasks = systemIndexes.map((index) =>
                    this._getAccountByProvider(system, index.provider_id, index.account)
                );
                const accounts = (await Promise.all(tasks))
                    .filter((item) => (item?.credentials || item?.account_secret) && !item.invalid)
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
            this._logError('获取设备登录信息', error);
            return { scm: [], pms: [], bi: [] };
        }
    }
};

ZhanghuModule._logError = function (label, error) {
    console.warn(`[zhanghu] ${label} 失败:`, error?.message || error);
};

// 导出模块
window.ZhanghuModule = ZhanghuModule;
