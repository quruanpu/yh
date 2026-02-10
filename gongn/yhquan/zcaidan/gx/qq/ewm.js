/**
 * 优惠券抢券活动管理模块（二维码弹窗版）
 *
 * 功能：
 * 1. start(coupon)        - 点击二维码图标，弹出二维码弹窗
 * 2. getActivityDetail(id) - 根据活动ID获取抢券活动详情
 * 3. editActivity(id, params) - 修改抢券活动
 * 4. queryByCouponId(couponId) - 根据优惠券ID查找抢券活动
 */
const EwmYewu = {
    // ========== 配置 ==========
    config: {
        apiUrl: 'https://1317825751-21j36twzqr.ap-guangzhou.tencentscf.com',
        couponPageBase: 'https://dian.ysbang.cn/#/grabCoupon?id=',
        qrLibUrl: 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
        d2iLibUrl: 'https://cdnjs.cloudflare.com/ajax/libs/dom-to-image/2.6.0/dom-to-image.min.js'
    },

    // ========== 随机暖句 ==========
    async fetchQuote() {
        try {
            const res = await fetch('https://v1.hitokoto.cn/?encode=json&c=d&c=e&c=k', {
                signal: AbortSignal.timeout(3000)
            });
            if (res.ok) {
                const data = await res.json();
                if (data.hitokoto) return data.hitokoto;
            }
        } catch {}

        return '愿你每一天都被温柔以待 ❤';
    },

    // ========== 状态 ==========
    state: {
        isRunning: false,
        currentCoupon: null,
        currentUrls: []  // [{activityId, url, name}]
    },

    // ========== 加载二维码库 ==========
    async loadQrLib() {
        if (window.QRCode) return;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = this.config.qrLibUrl;
            script.onload = resolve;
            script.onerror = () => reject(new Error('二维码库加载失败'));
            document.head.appendChild(script);
        });
    },

    // ========== 加载截图库（dom-to-image） ==========
    async loadD2iLib() {
        if (window.domtoimage) return;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = this.config.d2iLibUrl;
            script.onload = resolve;
            script.onerror = () => reject(new Error('截图库加载失败'));
            document.head.appendChild(script);
        });
    },

    // ========== 入口方法 ==========
    async start(coupon) {
        if (this.state.isRunning) {
            this.notify('正在处理中，请稍候', 'warning');
            return;
        }

        this.state.currentCoupon = coupon;
        this.state.currentUrls = [];
        if (window.EwmYangshi) EwmYangshi.inject();

        this.state.isRunning = true;
        this.showPopup();

        try {
            // 并行加载二维码库和截图库
            const qrLibPromise = this.loadQrLib();
            const d2iLibPromise = this.loadD2iLib();

            // 获取登录凭证
            const credentials = await this.getCredentials();
            if (!credentials) {
                this.updateStatus('无有效登录信息，请先登录', 'error');
                return;
            }

            // 查询所有抢券活动，筛选启用的
            this.updateStatus('获取活动信息...', 'loading');
            const allActivities = await this.apiPost(credentials, 'queryAllActivities', { couponTypeId: coupon.id });

            const enabledList = Array.isArray(allActivities)
                ? allActivities.filter(a => a.isClose === 0)
                : [];

            if (enabledList.length === 0) {
                this.updateStatus('未找到启用的抢券活动，请检查共享状态', 'error');
                return;
            }

            // 等待库加载完成
            this.updateStatus('生成二维码...', 'loading');
            await qrLibPromise;
            await d2iLibPromise;

            // 构建所有启用活动的URL列表
            this.state.currentUrls = enabledList.map(a => ({
                activityId: a.id,
                url: this.config.couponPageBase + a.id,
                name: a.eventName || '未命名活动'
            }));

            // 渲染多个二维码并启用按钮
            this.renderQrCodes(this.state.currentUrls);
            this.enableCopyBtn();

        } catch (err) {
            console.error('二维码生成失败:', err);
            this.updateStatus('失败: ' + err.message, 'error');
        } finally {
            this.state.isRunning = false;
        }
    },

    // ========== API调用 ==========
    async getCredentials() {
        if (!window.LoginModule) return null;
        return await window.LoginModule.getScmCredentials();
    },

    async apiPost(credentials, action, params = {}) {
        const response = await fetch(this.config.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify({ credentials, action, ...params })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (!result.success) throw new Error(result.message || '操作失败');
        return result.data;
    },

    // ========== 独立API方法（供外部调用） ==========
    async queryByCouponId(couponTypeId) {
        const credentials = await this.getCredentials();
        if (!credentials) throw new Error('无有效登录信息，请先登录');
        return await this.apiPost(credentials, 'queryActivity', { couponTypeId });
    },

    async queryAllByCouponId(couponTypeId) {
        const credentials = await this.getCredentials();
        if (!credentials) throw new Error('无有效登录信息，请先登录');
        return await this.apiPost(credentials, 'queryAllActivities', { couponTypeId });
    },

    async getActivityDetail(activityId) {
        const credentials = await this.getCredentials();
        if (!credentials) throw new Error('无有效登录信息，请先登录');
        return await this.apiPost(credentials, 'getActivity', { id: activityId });
    },

    async editActivity(activityId, params) {
        const credentials = await this.getCredentials();
        if (!credentials) throw new Error('无有效登录信息，请先登录');
        return await this.apiPost(credentials, 'editActivity', {
            id: activityId,
            ...params
        });
    },

    async createNewActivity(params) {
        const credentials = await this.getCredentials();
        if (!credentials) throw new Error('无有效登录信息，请先登录');
        return await this.apiPost(credentials, 'createActivity', params);
    },

    async disableActivity(activityId, storeSubTypes) {
        const credentials = await this.getCredentials();
        if (!credentials) throw new Error('无有效登录信息，请先登录');
        return await this.apiPost(credentials, 'disableActivity', {
            id: activityId,
            isClose: 1,
            storeSubTypes: storeSubTypes || [-1]
        });
    },

    async enableActivity(activityId, storeSubTypes) {
        const credentials = await this.getCredentials();
        if (!credentials) throw new Error('无有效登录信息，请先登录');
        return await this.apiPost(credentials, 'disableActivity', {
            id: activityId,
            isClose: 0,
            storeSubTypes: storeSubTypes || [-1]
        });
    },

    async getAreaTree(parent, activityId, includeAreaIds) {
        const credentials = await this.getCredentials();
        if (!credentials) throw new Error('无有效登录信息，请先登录');
        return await this.apiPost(credentials, 'getAreaTree', {
            parent: parent || '#',
            id: activityId || undefined,
            includeAreaIds: includeAreaIds || []
        });
    },

    async deleteActivity(activityId) {
        const credentials = await this.getCredentials();
        if (!credentials) throw new Error('无有效登录信息，请先登录');
        return await this.apiPost(credentials, 'deleteActivity', {
            id: activityId
        });
    },
    // ========== UI：二维码弹窗 ==========
    showPopup() {
        const old = document.getElementById('ewm-progress');
        if (old) old.remove();

        const html = `
            <div class="ewm-overlay" id="ewm-progress">
                <div class="ewm-popup" id="ewm-popup">
                    <div class="ewm-popup-toolbar">
                        <button class="ewm-popup-icon-btn ewm-copy-btn" id="ewm-copy-link" disabled title="复制链接">
                            <i class="fa-solid fa-link"></i>
                        </button>
                        <button class="ewm-popup-icon-btn ewm-copy-btn" id="ewm-copy-img" disabled title="复制图片">
                            <i class="fa-regular fa-image"></i>
                        </button>
                        <button class="ewm-popup-icon-btn ewm-close-btn" id="ewm-close" title="关闭">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div class="ewm-qr-grid" id="ewm-qr-grid">
                        <div class="ewm-popup-qr" id="ewm-qr">
                            <div class="ewm-popup-status ewm-status-loading" id="ewm-status">
                                <span class="ewm-status-text">准备中...</span>
                            </div>
                        </div>
                    </div>
                    <div class="ewm-popup-quote" id="ewm-quote"></div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', html);

        // 异步加载随机名言
        this.fetchQuote().then(quote => {
            const el = document.getElementById('ewm-quote');
            if (el) el.textContent = quote;
        });

        // 关闭按钮（运行中不可关闭）
        document.getElementById('ewm-close').onclick = () => {
            if (!this.state.isRunning) {
                document.getElementById('ewm-progress')?.remove();
            }
        };
    },

    updateStatus(text, type = 'loading') {
        const statusEl = document.getElementById('ewm-status');
        if (!statusEl) return;
        statusEl.className = `ewm-popup-status ewm-status-${type}`;
        const textEl = statusEl.querySelector('.ewm-status-text');
        if (textEl) textEl.textContent = text;
    },

    renderQrCodes(urlList) {
        const grid = document.getElementById('ewm-qr-grid');
        if (!grid) return;

        const escape = window.YhquanGongju ? YhquanGongju.escapeHtml : (s) => s;

        // 清空加载状态，替换为多个二维码项
        grid.innerHTML = urlList.map((item, i) => `
            <div class="ewm-qr-item">
                <div class="ewm-qr-label">🎁${escape(item.name)}👇</div>
                <div class="ewm-popup-qr" id="ewm-qr-${i}"></div>
            </div>
        `).join('');

        // 根据数量动态调整弹窗宽度
        const popup = document.getElementById('ewm-popup');
        if (popup && urlList.length > 1) {
            popup.classList.add('ewm-popup-multi');
        }

        // 逐个生成二维码
        urlList.forEach((item, i) => {
            const container = document.getElementById(`ewm-qr-${i}`);
            if (!container) return;
            new QRCode(container, {
                text: item.url,
                width: 210,
                height: 210,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        });
    },

    enableCopyBtn() {
        const linkBtn = document.getElementById('ewm-copy-link');
        if (linkBtn) {
            linkBtn.disabled = false;
            linkBtn.onclick = () => this.handleCopyLink();
        }

        const imgBtn = document.getElementById('ewm-copy-img');
        if (imgBtn) {
            imgBtn.disabled = false;
            imgBtn.onclick = () => this.handleCopyImage();
        }

        // 允许关闭
        const closeBtn = document.getElementById('ewm-close');
        if (closeBtn) {
            closeBtn.onclick = () => document.getElementById('ewm-progress')?.remove();
        }
    },
    // ========== 复制链接 ==========
    async handleCopyLink() {
        const btn = document.getElementById('ewm-copy-link');
        if (!this.state.currentUrls.length) return;

        if (btn) { btn.disabled = true; btn.classList.add('ewm-copy-active'); }

        try {
            const urls = this.state.currentUrls;
            const text = urls.length === 1
                ? `${urls[0].name}：${urls[0].url}`
                : urls.map((item, i) => `${i + 1}.${item.name}：${item.url}`).join('\n');
            await this.copyText(text);
            this.notify('已复制链接', 'success');
        } catch (err) {
            console.error('复制链接失败:', err);
            this.notify('复制链接失败: ' + err.message, 'error');
        }

        setTimeout(() => {
            if (btn) { btn.disabled = false; btn.classList.remove('ewm-copy-active'); }
        }, 1000);
    },

    // ========== 复制图片 ==========
    async handleCopyImage() {
        const btn = document.getElementById('ewm-copy-img');
        if (!this.state.currentUrls.length) return;

        if (btn) { btn.disabled = true; btn.classList.add('ewm-copy-active'); }

        try {
            await this.copyOrDownloadImage();
        } catch (err) {
            console.error('复制图片失败:', err);
            this.notify('复制图片失败: ' + err.message, 'error');
        }

        setTimeout(() => {
            if (btn) { btn.disabled = false; btn.classList.remove('ewm-copy-active'); }
        }, 1000);
    },

    async copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
        }
    },

    // ========== 截图（dom-to-image，直接截取弹窗，视觉完全一致） ==========
    async copyOrDownloadImage() {
        if (!window.domtoimage) {
            this.notify('截图库未加载', 'error');
            return;
        }

        const popup = document.getElementById('ewm-popup');
        if (!popup) return;

        // 截图前隐藏工具栏
        const toolbar = popup.querySelector('.ewm-popup-toolbar');
        if (toolbar) toolbar.style.display = 'none';

        // 截图前展开：移除滚动限制，确保所有二维码完整显示（垂直长图）
        const savedPopupStyle = popup.style.cssText;
        popup.style.maxHeight = 'none';
        popup.style.overflow = 'visible';

        try {
            const scale = 2;
            const blob = await domtoimage.toBlob(popup, {
                bgcolor: '#ffffff',
                width: popup.offsetWidth * scale,
                height: popup.offsetHeight * scale,
                style: { transform: `scale(${scale})`, transformOrigin: 'top left' }
            });

            if (!blob) {
                this.notify('图片生成失败', 'error');
                return;
            }

            // 移动端：下载图片
            if (window.innerWidth <= 768) {
                this.downloadBlobFallback(blob);
                return;
            }

            // 桌面端：写入剪贴板
            try {
                const item = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                this.notify('已复制图片', 'success');
            } catch {
                this.downloadBlobFallback(blob);
            }
        } catch (err) {
            console.error('截图失败:', err);
            this.notify('截图失败: ' + err.message, 'error');
        } finally {
            // 恢复截图前的样式
            popup.style.cssText = savedPopupStyle;
            if (toolbar) toolbar.style.display = '';
        }
    },

    downloadBlobFallback(blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = '优惠券二维码.png';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        this.notify('图片已保存', 'success');
    },

    // ========== 通知 ==========
    notify(message, type = 'info') {
        if (window.Tongzhi) {
            Tongzhi.show(message, type);
        } else {
            alert(message);
        }
    }
};

window.EwmYewu = EwmYewu;
