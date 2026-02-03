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
        deviceId: null
    },

    // 初始化Firebase
    async init() {
        if (this.state.app) return;

        try {
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

            // 生成设备ID（异步）
            this.state.deviceId = await this.generateDeviceId();

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

    // 加载FingerprintJS库
    async loadFingerprintJS() {
        return new Promise((resolve, reject) => {
            if (window.FingerprintJS) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@3/dist/fp.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    // 生成浏览器指纹
    async generateFingerprint() {
        try {
            await this.loadFingerprintJS();
            const fp = await FingerprintJS.load();
            const result = await fp.get();
            return result.visitorId;
        } catch (error) {
            console.error('生成浏览器指纹失败:', error);
            // 降级方案：使用简单的浏览器特征组合
            return this.generateSimpleFingerprint();
        }
    },

    // 简单指纹生成（降级方案）
    generateSimpleFingerprint() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('fingerprint', 2, 2);
        const canvasData = canvas.toDataURL();

        const features = [
            navigator.userAgent,
            navigator.language,
            screen.colorDepth,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            canvasData.slice(0, 100)
        ].join('|');

        // 简单hash
        let hash = 0;
        for (let i = 0; i < features.length; i++) {
            const char = features.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'fp_' + Math.abs(hash).toString(36);
    },

    // 生成设备ID（增强版：指纹 + 设备信息）
    async generateDeviceId() {
        console.log('生成设备ID（基于浏览器指纹 + 设备信息）...');

        // 1. 生成浏览器指纹
        const fingerprint = await this.generateFingerprint();

        // 2. 收集设备信息（用于显示，不用于ID生成）
        const deviceInfo = this.collectDeviceInfo();

        // 3. 组合设备ID
        const deviceId = 'device_' + fingerprint;

        // 4. 存储设备信息到状态（用于显示）
        this.state.deviceInfo = deviceInfo;

        console.log('设备ID已生成:', deviceId);
        console.log('设备信息:', deviceInfo);

        return deviceId;
    },

    // 收集设备信息（用于显示和识别）
    collectDeviceInfo() {
        const ua = navigator.userAgent;

        // 解析浏览器类型
        let browser = 'Unknown';
        if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
        else if (ua.includes('Firefox')) browser = 'Firefox';
        else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
        else if (ua.includes('Edg')) browser = 'Edge';

        // 解析操作系统
        let os = 'Unknown';
        if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11';
        else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1';
        else if (ua.includes('Windows NT 6.2')) os = 'Windows 8';
        else if (ua.includes('Windows NT 6.1')) os = 'Windows 7';
        else if (ua.includes('Mac OS X')) os = 'macOS';
        else if (ua.includes('Linux')) os = 'Linux';
        else if (ua.includes('Android')) os = 'Android';
        else if (ua.includes('iOS')) os = 'iOS';

        // 屏幕分辨率
        const screen_resolution = `${screen.width}x${screen.height}`;

        // 生成设备名称
        const device_name = `${os} - ${browser}`;

        return {
            browser,
            os,
            screen_resolution,
            device_name,
            user_agent: ua,
            platform: navigator.platform,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            created_at: new Date().toISOString()
        };
    },

    // 存储SCM登录信息（简化版：只用sb_id管理设备）
    async saveScmLogin(username, credentials, providerInfo) {
        await this.init();

        const timestamp = Date.now();

        try {
            const accountRef = this.state.database.ref(`zhanghu/scm/${username}`);
            const snapshot = await accountRef.once('value');
            const existingData = snapshot.val() || {};

            // 更新设备ID列表（追加当前设备）
            let deviceIds = existingData.sb_id || [];
            if (!deviceIds.includes(this.state.deviceId)) {
                deviceIds.push(this.state.deviceId);
            }

            // 更新账户数据
            await accountRef.update({
                username: username,
                credentials: credentials,
                provider_info: providerInfo,
                login_time: timestamp,
                sb_id: deviceIds,
                last_update: timestamp
            });

            console.log('SCM登录信息存储成功:', username);
            return true;
        } catch (error) {
            console.error('存储SCM登录信息失败:', error);
            return false;
        }
    },

    // 存储PMS登录信息（简化版：只用sb_id管理设备）
    async savePmsLogin(account, credentials, userInfo, permissions = null) {
        await this.init();

        const timestamp = Date.now();

        try {
            const accountRef = this.state.database.ref(`zhanghu/pms/${account}`);
            const snapshot = await accountRef.once('value');
            const existingData = snapshot.val() || {};

            // 更新设备ID列表（追加当前设备）
            let deviceIds = existingData.sb_id || [];
            if (!deviceIds.includes(this.state.deviceId)) {
                deviceIds.push(this.state.deviceId);
            }

            // 更新账户数据
            const updateData = {
                account: account,
                credentials: credentials,
                user_info: userInfo,
                login_time: timestamp,
                sb_id: deviceIds,
                pms_token: credentials.pms_token || credentials.token,
                last_update: timestamp
            };

            // 保存权限信息（包含 providers）
            if (permissions) {
                updateData.permissions = permissions;
            }

            await accountRef.update(updateData);

            console.log('PMS登录信息存储成功:', account);
            return true;
        } catch (error) {
            console.error('存储PMS登录信息失败:', error);
            return false;
        }
    },

    // 获取SCM登录信息
    async getScmLogin(username) {
        await this.init();

        try {
            const snapshot = await this.state.database.ref(`zhanghu/scm/${username}`).once('value');
            return snapshot.val();
        } catch (error) {
            console.error('获取SCM登录信息失败:', error);
            return null;
        }
    },

    // 获取PMS登录信息
    async getPmsLogin(account) {
        await this.init();

        try {
            const snapshot = await this.state.database.ref(`zhanghu/pms/${account}`).once('value');
            return snapshot.val();
        } catch (error) {
            console.error('获取PMS登录信息失败:', error);
            return null;
        }
    },

    // 检查账户是否在当前设备登录过
    async checkDeviceLogin(system, accountId) {
        await this.init();

        try {
            const path = `zhanghu/${system}/${accountId}`;
            const snapshot = await this.state.database.ref(path).once('value');
            const data = snapshot.val();

            if (data && data.sb_id && Array.isArray(data.sb_id)) {
                return data.sb_id.includes(this.state.deviceId);
            }
            return false;
        } catch (error) {
            console.error('检查设备登录状态失败:', error);
            return false;
        }
    },

    // 获取当前设备的所有登录账户
    async getDeviceLogins() {
        await this.init();

        try {
            const result = {
                scm: [],
                pms: []
            };

            // 获取SCM账户
            const scmSnapshot = await this.state.database.ref('zhanghu/scm').once('value');
            scmSnapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                if (data.sb_id && data.sb_id.includes(this.state.deviceId)) {
                    result.scm.push({
                        username: data.username,
                        login_time: data.login_time,
                        provider_name: data.provider_info?.provider_name || '未知'
                    });
                }
            });

            // 获取PMS账户
            const pmsSnapshot = await this.state.database.ref('zhanghu/pms').once('value');
            pmsSnapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                if (data.sb_id && data.sb_id.includes(this.state.deviceId)) {
                    result.pms.push({
                        account: data.account,
                        login_time: data.login_time,
                        user_name: data.user_info?.user_name || '未知'
                    });
                }
            });

            return result;
        } catch (error) {
            console.error('获取设备登录信息失败:', error);
            return { scm: [], pms: [] };
        }
    },

    // 删除登录信息
    async deleteLogin(system, accountId) {
        await this.init();

        try {
            const path = `zhanghu/${system}/${accountId}`;
            const snapshot = await this.state.database.ref(path).once('value');
            const data = snapshot.val();

            if (data && data.sb_id && Array.isArray(data.sb_id)) {
                // 从设备ID列表中移除当前设备
                const updatedDeviceIds = data.sb_id.filter(id => id !== this.state.deviceId);

                if (updatedDeviceIds.length > 0) {
                    // 还有其他设备登录，只更新设备ID列表
                    await this.state.database.ref(path).update({
                        sb_id: updatedDeviceIds,
                        last_update: Date.now()
                    });
                } else {
                    // 没有其他设备登录，删除整个节点
                    await this.state.database.ref(path).remove();
                }

                return true;
            }
            return false;
        } catch (error) {
            console.error('删除登录信息失败:', error);
            return false;
        }
    },

    // 清理过期的登录信息（可选功能）
    async cleanupExpiredLogins() {
        await this.init();

        try {
            const now = Date.now();
            const expiryTime = 7 * 24 * 60 * 60 * 1000; // 7天过期

            // 清理SCM
            const scmSnapshot = await this.state.database.ref('zhanghu/scm').once('value');
            const scmUpdates = {};
            scmSnapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                if (data.login_time && (now - data.login_time) > expiryTime) {
                    scmUpdates[`zhanghu/scm/${childSnapshot.key}`] = null;
                }
            });

            // 清理PMS
            const pmsSnapshot = await this.state.database.ref('zhanghu/pms').once('value');
            const pmsUpdates = {};
            pmsSnapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                if (data.login_time && (now - data.login_time) > expiryTime) {
                    pmsUpdates[`zhanghu/pms/${childSnapshot.key}`] = null;
                }
            });

            // 批量更新
            const updates = { ...scmUpdates, ...pmsUpdates };
            if (Object.keys(updates).length > 0) {
                await this.state.database.ref().update(updates);
                console.log(`清理了 ${Object.keys(updates).length} 个过期登录`);
            }

            return true;
        } catch (error) {
            console.error('清理过期登录信息失败:', error);
            return false;
        }
    }
};

// 导出模块
window.FirebaseModule = FirebaseModule;