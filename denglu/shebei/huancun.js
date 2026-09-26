/**
 * Device code local cache.
 */
const ShebeiHuancunModule = {
    key: 'yxz_device_code_v1',

    read() {
        try {
            const raw = localStorage.getItem(this.key);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || typeof data !== 'object') return null;
            if (!/^device_[A-F0-9]{6}$/.test(String(data.deviceId || ''))) return null;
            return data;
        } catch (e) {
            return null;
        }
    },

    write(data) {
        try {
            localStorage.setItem(this.key, JSON.stringify({
                deviceId: data.deviceId,
                shortCode: data.shortCode,
                deviceInfo: data.deviceInfo || null,
                createdAt: data.createdAt || Date.now()
            }));
        } catch (e) {
            console.warn('Device cache write failed:', e);
        }
    },

    clear() {
        try {
            localStorage.removeItem(this.key);
        } catch (e) {}
    }
};

window.ShebeiHuancunModule = ShebeiHuancunModule;
