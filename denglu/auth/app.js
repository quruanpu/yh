// Unified login credential recovery for SCM, PMS and BI.
const LoginAuthModule = {
    systems: ['scm', 'pms', 'bi'],

    localKey(system) {
        return `${system}_login`;
    },

    getLocal(host, system) {
        return host?._getLocal?.(this.localKey(system)) || null;
    },

    clearLocal(host, system) {
        const key = this.localKey(system);
        const local = host?._getLocal?.(key);

        if (system === 'scm' && local?.account_secret) {
            const retained = {
                system: 'scm',
                username: local.username || local.account || local.account_secret.account || '',
                provider_info: local.provider_info || null,
                provider_id: local.provider_id || local.credentials?.provider_id || local.credentials?.providerId || '',
                provider_name: local.provider_name || local.provider_info?.provider_name || local.credentials?.provider_name || local.credentials?.providerName || '',
                account_secret: local.account_secret,
                share_allowed: local.share_allowed,
                credential_source: local.credential_source,
                displayName: local.displayName || local.username || local.account || local.account_secret.account || '',
                login_time: local.login_time || Date.now()
            };
            host?._saveLocal?.(key, retained);
            return;
        }

        host?._clearLocal?.(key);
    },

    hasCredential(system, info) {
        if (!info) return false;
        if (system === 'bi') return !!(info.credentials?.token || info.token);
        return !!info.credentials;
    },

    verifier() {
        return window.LoginCredentialVerifier || null;
    },

    async verify(host, system, acc, options = {}) {
        const verifier = this.verifier();
        if (!verifier?.verify) {
            return {
                ok: false,
                status: 'temporary',
                reason: 'VERIFIER_UNAVAILABLE',
                message: '凭证认证模块未加载。',
                canMarkInvalid: false,
                canClearLocal: false,
                canRetry: true,
                detail: {}
            };
        }
        return verifier.verify(system, acc, { host, ...options });
    },

    accountId(system, info = {}) {
        info = info || {};
        if (system === 'scm') return info.username || info.account || info.provider_info?.username || '';
        if (system === 'pms') return info.account || info.user_info?.account || '';
        return info.account || info.user_info?.account || info.userInfo?.account || '';
    },

    providerId(info = {}) {
        info = info || {};
        return String(
            info.provider_id
            || info.credentials?.provider_id
            || info.credentials?.providerId
            || ''
        ).trim();
    },

    providerName(info = {}) {
        info = info || {};
        const permissions = info.permissions || {};
        const userInfo = info.user_info || info.userInfo || {};
        const providers = [
            ...(Array.isArray(permissions.sub_providers) ? permissions.sub_providers : []),
            ...(Array.isArray(permissions.providers) ? permissions.providers : [])
        ];
        const first = providers[0] || {};
        return String(
            info.provider_name
            || info.provider_info?.provider_name
            || info.credentials?.provider_name
            || info.credentials?.providerName
            || userInfo.provider_name
            || userInfo.providerName
            || userInfo.supplier_name
            || userInfo.supplierName
            || userInfo.company_name
            || userInfo.companyName
            || first.provider_name
            || first.providerName
            || first.name
            || first.supplier_name
            || first.supplierName
            || first.company_name
            || first.companyName
            || ''
        ).trim();
    },

    sourceOf(local = {}) {
        local = local || {};
        if (local.credential_source) return local.credential_source;
        return local.share_allowed === false ? 'shared' : 'local';
    },

    canShare(source) {
        return source === 'local' || source === 'device';
    },

    createRecoveryContext(provider = null) {
        return {
            provider: provider ? {
                provider_id: this.providerId(provider),
                provider_name: this.providerName(provider)
            } : null,
            results: {}
        };
    },

    rememberProvider(context, info) {
        if (!context || !info) return context?.provider || null;
        const providerId = this.providerId(info);
        if (!providerId) return context.provider || null;

        const provider = {
            provider_id: providerId,
            provider_name: this.providerName(info)
        };

        if (!context.provider?.provider_id) {
            context.provider = provider;
        } else if (
            context.provider.provider_id === providerId
            && !context.provider.provider_name
            && provider.provider_name
        ) {
            context.provider.provider_name = provider.provider_name;
        }

        return context.provider;
    },

    async recoverSystems(host, systems = this.systems, options = {}) {
        const list = (systems || this.systems).filter(system => this.systems.includes(system));
        const context = options.context || this.createRecoveryContext(options.provider);
        const results = { ...context.results };

        if (!host || list.length === 0) {
            return { context, results };
        }

        this.rememberProvider(context, this.resolveProviderFromLocal(host));

        for (const system of list) {
            if (results[system]) continue;
            const localResult = await this.tryLocal(host, system);
            if (localResult) {
                results[system] = localResult;
                context.results[system] = localResult;
                this.rememberProvider(context, localResult);
            }
        }

        if (!window.FirebaseModule) return { context, results };
        await FirebaseModule.init();

        for (const system of list) {
            if (results[system]) continue;
            const deviceResult = await this.tryDevice(host, system);
            if (deviceResult) {
                results[system] = deviceResult;
                context.results[system] = deviceResult;
                this.rememberProvider(context, deviceResult);
            }
        }

        if (options.allowShared === false) return { context, results };
        if (!context.provider?.provider_id) {
            this.rememberProvider(context, await this.resolveProvider(host));
        }
        if (!context.provider?.provider_id) return { context, results };

        for (const system of list) {
            if (results[system]) continue;
            const sharedResult = await this.trySharedProvider(host, system, context.provider.provider_id);
            if (sharedResult) {
                results[system] = sharedResult;
                context.results[system] = sharedResult;
                this.rememberProvider(context, sharedResult);
            }
        }

        return { context, results };
    },

    async tryLocal(host, system) {
        const local = this.getLocal(host, system);
        if (!this.hasCredential(system, local)) return null;

        const acc = this.normalizeForValidation(system, local);
        const verification = await this.verify(host, system, acc, { source: 'local' });
        if (verification.ok) {
            const source = this.sourceOf(local);
            const normalized = this.buildLocal(host, system, acc, source);
            this.applyLogin(host, system, normalized, acc, source);
            return this.result(system, acc, normalized, source);
        }

        await this.handleVerificationFailure(host, system, acc, verification, { source: 'local', clearLocal: true });
        return null;
    },

    async tryDevice(host, system) {
        const deviceLogins = await FirebaseModule.getDeviceLogins(system);
        const accounts = this.sortAccounts(deviceLogins?.[system] || []);
        return this.tryAccounts(host, system, accounts, 'device');
    },

    async trySharedProvider(host, system, providerId) {
        const accounts = await this.findByProvider(system, providerId);
        return this.tryAccounts(host, system, accounts, 'shared');
    },

    async tryAccounts(host, system, accounts, source) {
        for (const item of accounts || []) {
            if (!this.hasCredential(system, item) || item.invalid) continue;
            const acc = this.normalizeForValidation(system, item);
            const verification = await this.verify(host, system, acc, { source });
            if (verification.ok) {
                const normalized = this.buildLocal(host, system, acc, source);
                this.applyLogin(host, system, normalized, acc, source);
                return this.result(system, acc, normalized, source);
            }
            await this.handleVerificationFailure(host, system, item, verification, { source });
        }
        return null;
    },

    async handleVerificationFailure(host, system, info, verification = {}, options = {}) {
        const reason = verification.reason || verification.status || 'UNKNOWN';
        console.warn(`${system.toUpperCase()}凭证未恢复:`, reason, verification.message || '');

        if (options.clearLocal && verification.canClearLocal) {
            this.clearLocal(host, system);
        }

        if (verification.canMarkInvalid) {
            await this.markInvalid(system, info);
        }
    },

    normalizeForValidation(system, info = {}) {
        info = info || {};
        if (system === 'bi' && !info.credentials && info.token) {
            return {
                ...info,
                credentials: {
                    token: info.token,
                    tokenSig: info.tokenSig || '',
                    exp: info.exp || 0
                }
            };
        }
        return info;
    },

    buildLocal(host, system, acc, source) {
        const canShare = this.canShare(source);
        if (system === 'scm') {
            const username = acc.username || acc.account || '';
            const displayName = acc.provider_info?.username || acc.credentials?.username || username;
            return {
                system: 'scm',
                username,
                credentials: acc.credentials,
                provider_info: acc.provider_info || null,
                provider_id: this.providerId(acc),
                provider_name: this.providerName(acc),
                account_secret: acc.account_secret || null,
                share_allowed: canShare,
                credential_source: source,
                displayName,
                login_time: acc.login_time || Date.now()
            };
        }

        if (system === 'pms') {
            return {
                ...host._buildPmsLocal(acc),
                share_allowed: canShare,
                credential_source: source
            };
        }

        return {
            ...host._buildBiLocal(acc),
            share_allowed: canShare,
            credential_source: source
        };
    },

    applyLogin(host, system, local, acc, source) {
        host._saveLocal(this.localKey(system), local);
        if (system === 'scm') {
            host.session.logged_in = true;
            host.session.username = local.username;
            host.session.credentials = local.credentials;
            host.session.providerInfo = local.provider_info || null;
            if (!local.provider_info) host._supplementProviderInfo?.(local.username);
        }
        console.log(`${system.toUpperCase()}凭证恢复成功:`, this.accountId(system, acc), source);
    },

    result(system, acc, local, source) {
        return {
            system,
            account: this.accountId(system, acc),
            provider_id: this.providerId(acc),
            provider_name: this.providerName(acc),
            source,
            local,
            displayName: local.displayName || this.accountId(system, acc)
        };
    },

    async resolveProvider(host) {
        const localProvider = this.resolveProviderFromLocal(host);
        if (localProvider?.provider_id) return localProvider;

        if (!window.FirebaseModule) return null;
        await FirebaseModule.init();
        const deviceLogins = await FirebaseModule.getDeviceLogins();
        for (const system of this.systems) {
            const account = this.sortAccounts(deviceLogins?.[system] || [])
                .find(item => this.providerId(item));
            if (account) {
                return {
                    provider_id: this.providerId(account),
                    provider_name: this.providerName(account)
                };
            }
        }
        return null;
    },

    resolveProviderFromLocal(host) {
        for (const system of this.systems) {
            const local = this.getLocal(host, system);
            const providerId = this.providerId(local);
            if (providerId) {
                return {
                    provider_id: providerId,
                    provider_name: this.providerName(local)
                };
            }
        }
        return null;
    },

    sortAccounts(accounts) {
        return [...(accounts || [])].sort((a, b) => (b.login_time || 0) - (a.login_time || 0));
    },

    async findByProvider(system, providerId) {
        if (!providerId || !window.FirebaseModule) return [];
        if (system === 'scm') return FirebaseModule.findAllScmByProviderId(providerId);
        if (system === 'pms') return FirebaseModule.findAllPmsByProviderId(providerId);
        return FirebaseModule.findAllBiByProviderId(providerId);
    },

    async markInvalid(system, info) {
        if (!window.FirebaseModule) return;
        const providerId = this.providerId(info);
        const account = this.accountId(system, info);
        if (providerId && account) await FirebaseModule.markAccountInvalid(system, providerId, account);
    }
};

window.LoginAuthModule = LoginAuthModule;
