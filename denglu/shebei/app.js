/**
 * Login-domain device module.
 *
 * This module owns device code generation and exposes a small stable API.
 */
const DeviceModule = {
    state: {
        initialized: false,
        initializing: null,
        deviceId: '',
        shortCode: '',
        deviceInfo: null
    },

    async init(options = {}) {
        if (this.state.initialized && !options.force) return this.getSnapshot();
        if (this.state.initializing && !options.force) return this.state.initializing;

        this.state.initializing = (async () => {
            const cached = !options.force ? window.ShebeiHuancunModule?.read?.() : null;
            if (cached) {
                this.applySnapshot(cached);
                return this.getSnapshot();
            }

            if (!window.ShebeiZhiwenModule?.getFingerprint) {
                throw new Error('Device fingerprint module is not ready.');
            }

            const shortCode = await window.ShebeiZhiwenModule.getFingerprint();
            const deviceId = `device_${shortCode}`;
            const deviceInfo = window.ShebeiXinxiModule?.collect?.() || null;
            const snapshot = {
                deviceId,
                shortCode,
                deviceInfo,
                createdAt: Date.now()
            };

            window.ShebeiHuancunModule?.write?.(snapshot);
            this.applySnapshot(snapshot);
            return this.getSnapshot();
        })();

        try {
            return await this.state.initializing;
        } finally {
            this.state.initializing = null;
        }
    },

    applySnapshot(snapshot) {
        this.state.deviceId = String(snapshot.deviceId || '');
        this.state.shortCode = String(snapshot.shortCode || this.state.deviceId.slice(-6)).toUpperCase();
        this.state.deviceInfo = snapshot.deviceInfo || null;
        this.state.initialized = !!this.state.deviceId;
    },

    async ready() {
        return this.init();
    },

    getSnapshot() {
        return {
            deviceId: this.state.deviceId,
            shortCode: this.state.shortCode,
            deviceInfo: this.state.deviceInfo
        };
    },

    async getDeviceId() {
        await this.init();
        return this.state.deviceId;
    },

    async getShortCode() {
        await this.init();
        return this.state.shortCode;
    },

    async getDeviceInfo() {
        await this.init();
        return this.state.deviceInfo;
    }
};

window.DeviceModule = DeviceModule;
