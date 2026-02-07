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
        h2cLibUrl: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
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
        currentUrl: null
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

    // ========== 加载截图库 ==========
    async loadH2cLib() {
        if (window.html2canvas) return;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = this.config.h2cLibUrl;
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
        this.state.currentUrl = null;
        if (window.EwmYangshi) EwmYangshi.inject();

        this.state.isRunning = true;
        const title = coupon.name || '未命名优惠券';
        this.showPopup(title);

        try {
            // 并行加载二维码库和截图库
            const qrLibPromise = this.loadQrLib();
            const h2cLibPromise = this.loadH2cLib();

            // 获取登录凭证
            const credentials = await this.getCredentials();
            if (!credentials) {
                this.updateStatus('无有效登录信息，请先登录', 'error');
                return;
            }

            // 检测优惠券活动
            this.updateStatus('检测优惠券活动...', 'loading');
            const existing = await this.apiPost(credentials, 'queryActivity', {
                couponTypeId: coupon.id
            });

            // 公共时间参数：显示时间=开始时间=今天，结束时间=今天+2（不超过优惠券结束时间）
            const now = new Date();
            const todayStr = now.toISOString().slice(0, 10);
            const desiredEnd = new Date(now);
            desiredEnd.setDate(desiredEnd.getDate() + 2);
            let endStr = desiredEnd.toISOString().slice(0, 10);

            // 结束时间不能超过优惠券本身的结束时间
            if (coupon.endTime) {
                const couponEndStr = coupon.endTime.split(' ')[0];
                if (couponEndStr < endStr) {
                    endStr = couponEndStr;
                }
            }

            let activityId;

            if (existing && existing.activityId) {
                this.updateStatus('更新活动时间...', 'loading');
                const detail = await this.apiPost(credentials, 'getActivity', {
                    id: existing.activityId
                });
                await this.apiPost(credentials, 'editActivity', {
                    id: existing.activityId,
                    eventName: detail.eventName,
                    couponTypeId: detail.couponTypeId,
                    couponNum: detail.couponNum,
                    couponAmount: detail.couponAmount,
                    tagBeginTimeDate: todayStr,
                    tagBeginTimeHms: '00:00:00',
                    beginTimeDate: todayStr,
                    beginTimeHms: '00:00:00',
                    endTimeDate: endStr,
                    endTimeHms: '23:59:59',
                    isLimitArea: detail.isLimitArea || 0,
                    storeSubTypes: detail.storeSubtypes ? String(detail.storeSubtypes).split(',').map(Number) : [-1],
                    selectedAreaIds: [],
                    deselectedAreaIds: []
                });
                activityId = existing.activityId;
            } else {
                this.updateStatus('创建优惠券活动...', 'loading');
                const getMax = parseInt(coupon.getMax) || 0;
                const couponNum = getMax > 0 ? Math.min(5, getMax) : 5;
                activityId = await this.apiPost(credentials, 'createActivity', {
                    eventName: coupon.name,
                    couponTypeId: coupon.id,
                    couponNum: couponNum,
                    couponAmount: 10000,
                    tagBeginTimeDate: todayStr,
                    tagBeginTimeHms: '00:00:00',
                    beginTimeDate: todayStr,
                    beginTimeHms: '00:00:00',
                    endTimeDate: endStr,
                    endTimeHms: '23:59:59',
                    isLimitArea: 0,
                    storeSubTypes: [-1],
                    selectedAreaIds: []
                });
            }

            // 等待库加载完成
            this.updateStatus('生成二维码...', 'loading');
            await qrLibPromise;
            await h2cLibPromise;

            const couponUrl = this.config.couponPageBase + activityId;
            this.state.currentUrl = couponUrl;

            // 生成二维码并启用按钮
            this.renderQrCode(couponUrl);
            this.enableButtons();

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
    // ========== UI：二维码弹窗 ==========
    showPopup(title) {
        const old = document.getElementById('ewm-progress');
        if (old) old.remove();

        const escape = window.YhquanGongju ? YhquanGongju.escapeHtml : (s) => s;
        const html = `
            <div class="ewm-overlay" id="ewm-progress">
                <div class="ewm-popup" id="ewm-popup">
                    <button class="ewm-popup-close" id="ewm-close">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                    <div class="ewm-popup-title">🎁${escape(title)}👇</div>
                    <div class="ewm-popup-qr" id="ewm-qr">
                        <div class="ewm-popup-status ewm-status-loading" id="ewm-status">
                            <span class="ewm-status-text">准备中...</span>
                        </div>
                    </div>
                    <div class="ewm-popup-quote" id="ewm-quote"></div>
                    <div class="ewm-popup-actions">
                        <button class="ewm-popup-btn ewm-btn-link" id="ewm-btn-link" disabled>链接</button>
                        <button class="ewm-popup-btn ewm-btn-image" id="ewm-btn-image" disabled>图片</button>
                    </div>
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

    renderQrCode(url) {
        const qrContainer = document.getElementById('ewm-qr');
        if (!qrContainer) return;

        // 清除状态文字
        qrContainer.innerHTML = '';

        // 生成二维码
        new QRCode(qrContainer, {
            text: url,
            width: 210,
            height: 210,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    },

    enableButtons() {
        const linkBtn = document.getElementById('ewm-btn-link');
        const imageBtn = document.getElementById('ewm-btn-image');

        if (linkBtn) {
            linkBtn.disabled = false;
            linkBtn.onclick = () => this.copyLink();
        }
        if (imageBtn) {
            imageBtn.disabled = false;
            imageBtn.onclick = () => this.copyImage();
        }

        // 允许关闭
        const closeBtn = document.getElementById('ewm-close');
        if (closeBtn) {
            closeBtn.onclick = () => document.getElementById('ewm-progress')?.remove();
        }
    },
    // ========== 复制功能 ==========
    copyLink() {
        if (!this.state.currentUrl) return;
        const url = this.state.currentUrl;
        const btn = document.getElementById('ewm-btn-link');

        this.setBtnLoading(btn);

        navigator.clipboard.writeText(url).then(() => {
            this.restoreBtn(btn, 'link');
            this.notify('链接复制成功！', 'success');
        }).catch(() => {
            const input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            input.remove();
            this.restoreBtn(btn, 'link');
            this.notify('链接复制成功！', 'success');
        });
    },

    async copyImage() {
        const popup = document.getElementById('ewm-popup');
        if (!popup) return;

        if (!window.html2canvas) {
            this.notify('截图库未加载', 'error');
            return;
        }

        const btn = document.getElementById('ewm-btn-image');
        this.setBtnLoading(btn);

        // 克隆弹窗到屏幕外，在克隆体上隐藏按钮再截图
        const clone = popup.cloneNode(true);
        clone.style.position = 'fixed';
        clone.style.left = '-9999px';
        clone.style.top = '0';
        const cloneClose = clone.querySelector('.ewm-popup-close');
        const cloneActions = clone.querySelector('.ewm-popup-actions');
        const cloneTitle = clone.querySelector('.ewm-popup-title');
        if (cloneClose) cloneClose.style.display = 'none';
        if (cloneActions) cloneActions.style.display = 'none';
        // 截图时标题不截断，完整显示
        if (cloneTitle) {
            cloneTitle.style.whiteSpace = 'normal';
            cloneTitle.style.overflow = 'visible';
            cloneTitle.style.textOverflow = 'unset';
        }
        // 按钮隐藏后调整底部留白；补偿html2canvas渲染差异
        const cloneQr = clone.querySelector('.ewm-popup-qr');
        if (cloneQr) cloneQr.style.marginBottom = '2px';
        clone.style.paddingBottom = '4px';
        document.body.appendChild(clone);

        try {
            const canvas = await html2canvas(clone, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true
            });
            clone.remove();

            canvas.toBlob((blob) => {
                if (!blob) {
                    this.restoreBtn(btn, 'image');
                    this.notify('图片生成失败', 'error');
                    return;
                }
                // 移动端剪贴板写入图片不可靠，直接下载
                const isMobile = window.innerWidth <= 768;
                if (isMobile) {
                    this.restoreBtn(btn, 'image');
                    this.downloadFallback(canvas);
                    return;
                }
                try {
                    const item = new ClipboardItem({ 'image/png': blob });
                    navigator.clipboard.write([item]).then(() => {
                        this.restoreBtn(btn, 'image');
                        this.notify('二维码复制成功！', 'success');
                    }).catch(() => {
                        this.restoreBtn(btn, 'image');
                        this.downloadFallback(canvas);
                    });
                } catch (e) {
                    this.restoreBtn(btn, 'image');
                    this.downloadFallback(canvas);
                }
            }, 'image/png');
        } catch (err) {
            clone.remove();
            this.restoreBtn(btn, 'image');
            this.notify('截图失败: ' + err.message, 'error');
        }
    },

    // 不支持复制图片时，降级为下载
    downloadFallback(canvas) {
        const link = document.createElement('a');
        link.download = '优惠券二维码.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        this.notify('已保存二维码图片', 'success');
    },

    // 按钮设为加载中
    setBtnLoading(btn) {
        if (!btn) return;
        btn.disabled = true;
        btn.classList.add('ewm-btn-loading');
        btn.innerHTML = '处理中...';
    },

    // 恢复按钮原始状态
    restoreBtn(btn, type) {
        if (!btn) return;
        btn.disabled = false;
        btn.classList.remove('ewm-btn-loading');
        if (type === 'link') {
            btn.innerHTML = '链接';
        } else {
            btn.innerHTML = '图片';
        }
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
