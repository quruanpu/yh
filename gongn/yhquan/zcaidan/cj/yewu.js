/**
 * 优惠券模块 - 创建优惠券业务逻辑
 */
const CjYewu = {
    config: {
        apiUrl: 'https://1317825751-g6mwvpruev.ap-guangzhou.tencentscf.com'
    },

    // 当前选中的券类型
    currentType: 13,

    // 券类型配置
    typeConfig: {
        13: { name: '商家打折券', icon: 'fa-percent' },
        11: { name: '商家满减券', icon: 'fa-tag' },
        25: { name: '商家免邮券', icon: 'fa-truck' }
    },

    // 使用说明是否被用户手动修改
    noteManualEdited: false,
    lastAutoNote: '',

    show() {
        this.currentType = 13;
        this.noteManualEdited = false;
        this.lastAutoNote = '';
        this.render();
        this.bindEvents();
    },

    hide() {
        const modal = document.getElementById('yhquan-cj-modal');
        if (modal) modal.remove();
    },

    render() {
        const old = document.getElementById('yhquan-cj-modal');
        if (old) old.remove();

        const html = `
            <div id="yhquan-cj-modal" class="yhquan-cj-modal">
                <div class="yhquan-cj-overlay"></div>
                <div class="yhquan-cj-content">
                    <div class="yhquan-cj-header">
                        <span class="yhquan-cj-title">
                            <i class="fa-solid fa-plus-circle"></i> 创建优惠券
                        </span>
                        <button class="yhquan-cj-close"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="yhquan-cj-body">
                        ${this.renderTypeSelect()}
                        <div id="yhquan-cj-form-area">
                            ${this.renderForm()}
                        </div>
                    </div>
                    <div class="yhquan-cj-footer">
                        <button class="yhquan-cj-btn yhquan-cj-btn-cancel" id="yhquan-cj-cancel">取消</button>
                        <button class="yhquan-cj-btn yhquan-cj-btn-primary" id="yhquan-cj-submit">创建</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    renderTypeSelect() {
        const tabs = Object.entries(this.typeConfig).map(([type, cfg]) => {
            const active = Number(type) === this.currentType ? 'active' : '';
            return `<button class="yhquan-cj-type-tab ${active}" data-type="${type}">
                <i class="fa-solid ${cfg.icon}"></i> ${cfg.name}
            </button>`;
        }).join('');

        return `
            <div class="yhquan-cj-section">
                <div class="yhquan-cj-section-title">1. 选择券类型</div>
                <div class="yhquan-cj-type-tabs">${tabs}</div>
            </div>
        `;
    },

    renderForm() {
        switch (this.currentType) {
            case 13: return this.renderDiscountForm();
            case 11: return this.renderCashForm();
            case 25: return this.renderFreeShipForm();
            default: return '';
        }
    },

    // ========== 打折券表单 ==========
    renderDiscountForm() {
        let n = 2;
        return `
            ${this.section(n++, '名称', this.field('name', 'text', '如：2000/98'))}
            ${this.section(n++, '折扣', this.field('discount', 'number', '如：9.8 或 98 或 0.98 均表示98折'))}
            ${this.section(n++, '使用条件（元）', this.field('minPay', 'number', '满多少元可用'))}
            ${this.section(n++, '最高优惠金额（元）', this.field('maxCash', 'number', '选填，留空表示不限制'), false)}
            ${this.section(n++, '使用说明', this.field('note', 'textarea', '选填，留空自动生成：满 xxx 元后任意金额享 xx 折，仅可购买当前店铺内产品'), false)}
            ${this.renderValiditySection(false, n++)}
            ${this.renderBfrSection(n++)}
            ${this.renderExtNoteSection(n++)}
        `;
    },

    // ========== 满减券表单 ==========
    renderCashForm() {
        let n = 2;
        return `
            ${this.section(n++, '名称', this.field('name', 'text', '如：1000-10'))}
            ${this.section(n++, '使用条件（元）', this.field('minPay', 'number', '满多少元可用'))}
            ${this.sectionWithHint(n++, '优惠金额（元）', 'yhquan-cj-discount-hint', this.field('price', 'number', '减多少元'))}
            ${this.section(n++, '使用说明', this.field('note', 'textarea', '选填，留空自动生成：满 xxx 元减xxx元，仅可购买当前店铺内产品'), false)}
            ${this.renderValiditySection(false, n++)}
            ${this.renderBfrSection(n++)}
            ${this.renderExtNoteSection(n++)}
        `;
    },

    // ========== 免邮券表单 ==========
    renderFreeShipForm() {
        let n = 2;
        return `
            ${this.section(n++, '名称', this.field('name', 'text', '如：央拓医药免邮券'))}
            ${this.section(n++, '使用条件（元）', this.field('minPay', 'number', '满多少元可用'))}
            ${this.section(n++, '使用说明', this.field('note', 'textarea', '选填，留空自动生成：仅当前店铺内商品可用，可直接抵扣邮费'), false)}
            ${this.renderValiditySection(true, n++)}
            ${this.renderBfrSection(n++)}
            ${this.renderExtNoteSection(n++)}
        `;
    },

    // ========== 通用区块渲染 ==========
    section(num, title, content, required = true) {
        const reqMark = required ? '<span class="required">*</span>' : '';
        return `
            <div class="yhquan-cj-section">
                <div class="yhquan-cj-section-title">${num}. ${title}${reqMark}</div>
                ${content}
            </div>`;
    },

    sectionWithHint(num, title, hintId, content, required = true) {
        const reqMark = required ? '<span class="required">*</span>' : '';
        return `
            <div class="yhquan-cj-section">
                <div class="yhquan-cj-section-title">${num}. ${title}${reqMark} <span id="${hintId}" class="yhquan-cj-discount-hint"></span></div>
                ${content}
            </div>`;
    },

    // ========== 折扣智能解析 ==========
    parseDiscount(val) {
        const num = Number(val);
        if (!num || num <= 0) return 0;
        if (num > 10) return num / 10;   // 98 → 9.8
        if (num <= 1) return num * 10;    // 0.98 → 9.8
        return num;                        // 9.8 → 9.8
    },

    // ========== 通用字段渲染 ==========
    field(name, type, placeholder) {
        if (type === 'textarea') {
            return `<textarea class="yhquan-cj-textarea" id="yhquan-cj-${name}" placeholder="${placeholder}"></textarea>`;
        }
        return `<input class="yhquan-cj-input" type="${type}" id="yhquan-cj-${name}" placeholder="${placeholder}" />`;
    },

    // ========== 有效期区块 ==========
    renderValiditySection(showHours = false, num = 3) {
        const hoursOption = showHours
            ? '<option value="1">小时</option>'
            : '';

        // 默认日期：今天 ~ 本月最后一天
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

        return `
            <div class="yhquan-cj-section">
                <div class="yhquan-cj-section-title">${num}. 有效期<span class="required">*</span></div>
                <div class="yhquan-cj-validity-tabs">
                    <button class="yhquan-cj-validity-tab active" data-panel="range">时间段</button>
                    <button class="yhquan-cj-validity-tab" data-panel="days">天数${showHours ? '/小时' : ''}</button>
                </div>
                <div class="yhquan-cj-validity-panel active" id="yhquan-cj-panel-range">
                    <div class="yhquan-cj-date-row">
                        <input type="date" class="yhquan-cj-input" id="yhquan-cj-beginDate" value="${today}" />
                        <span class="yhquan-cj-date-sep">至</span>
                        <input type="date" class="yhquan-cj-input" id="yhquan-cj-endDate" value="${lastDay}" />
                    </div>
                </div>
                <div class="yhquan-cj-validity-panel" id="yhquan-cj-panel-days">
                    <div class="yhquan-cj-days-row">
                        <input type="number" class="yhquan-cj-input" id="yhquan-cj-validDays"
                               placeholder="输入数值" min="1" />
                        <select class="yhquan-cj-select" id="yhquan-cj-validType">
                            <option value="0">天</option>
                            ${hoursOption}
                        </select>
                    </div>
                </div>
            </div>
        `;
    },

    // ========== 首推反哺券 ==========
    renderBfrSection(num = 4) {
        return `
            <div class="yhquan-cj-section">
                <div class="yhquan-cj-section-title">${num}. 首推反哺券<span class="required">*</span></div>
                <div class="yhquan-cj-radio-group">
                    <label class="yhquan-cj-radio-item">
                        <input type="radio" name="yhquan-cj-bfr" value="0" checked /> 否
                    </label>
                    <label class="yhquan-cj-radio-item">
                        <input type="radio" name="yhquan-cj-bfr" value="3" /> 自营商家首推补贴
                    </label>
                    <label class="yhquan-cj-radio-item">
                        <input type="radio" name="yhquan-cj-bfr" value="4" /> 省钱卡
                    </label>
                </div>
            </div>
        `;
    },

    // ========== 备注 ==========
    renderExtNoteSection(num = 5) {
        return `
            <div class="yhquan-cj-section">
                <div class="yhquan-cj-section-title">${num}. 备注</div>
                <div class="yhquan-cj-form-group">
                    <textarea class="yhquan-cj-textarea" id="yhquan-cj-extNote" placeholder="选填，内部备注"></textarea>
                </div>
            </div>
        `;
    },

    // ========== 事件绑定 ==========
    bindEvents() {
        // 关闭（仅关闭按钮和取消按钮，遮罩不关闭）
        document.querySelector('.yhquan-cj-close')?.addEventListener('click', () => this.hide());
        document.getElementById('yhquan-cj-cancel')?.addEventListener('click', () => this.hide());

        // 提交
        document.getElementById('yhquan-cj-submit')?.addEventListener('click', () => this.handleSubmit());

        // 券类型切换
        document.querySelectorAll('.yhquan-cj-type-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.currentType = Number(tab.dataset.type);
                this.noteManualEdited = false;
                this.lastAutoNote = '';
                // 更新tab样式
                document.querySelectorAll('.yhquan-cj-type-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                // 重新渲染表单
                document.getElementById('yhquan-cj-form-area').innerHTML = this.renderForm();
                this.bindFormEvents();
            });
        });

        this.bindFormEvents();
    },

    bindFormEvents() {
        // 有效期tab切换
        document.querySelectorAll('.yhquan-cj-validity-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.yhquan-cj-validity-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.yhquan-cj-validity-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const panel = document.getElementById(`yhquan-cj-panel-${tab.dataset.panel}`);
                if (panel) panel.classList.add('active');
            });
        });

        // 使用说明自动生成：监听相关字段输入
        const noteFields = ['minPay', 'discount', 'price', 'maxCash'];
        noteFields.forEach(name => {
            const el = document.getElementById(`yhquan-cj-${name}`);
            if (el) el.addEventListener('input', () => this.updateAutoNote());
        });

        // 监听note手动编辑
        const noteEl = document.getElementById('yhquan-cj-note');
        if (noteEl) {
            noteEl.addEventListener('input', () => {
                if (noteEl.value !== this.lastAutoNote) {
                    this.noteManualEdited = true;
                }
            });
        }

        // 初始触发一次自动生成
        this.updateAutoNote();
    },

    // ========== 使用说明自动生成 + 折扣率提示 ==========
    updateAutoNote() {
        this.updateDiscountHint();

        if (this.noteManualEdited) return;

        const noteEl = document.getElementById('yhquan-cj-note');
        if (!noteEl) return;

        const minPay = this.val('minPay');
        let autoNote = '';

        if (this.currentType === 13) {
            const discount = this.parseDiscount(this.val('discount'));
            if (minPay && discount) {
                autoNote = `满 ${minPay} 元后任意金额享 ${discount} 折，仅可购买当前店铺内产品`;
            }
        } else if (this.currentType === 11) {
            const price = this.val('price');
            if (minPay && price) {
                autoNote = `满 ${minPay} 元减${price}元，仅可购买当前店铺内产品`;
            }
        } else if (this.currentType === 25) {
            autoNote = '仅当前店铺内商品可用，可直接抵扣邮费';
        }

        if (autoNote) {
            noteEl.value = autoNote;
            this.lastAutoNote = autoNote;
        }
    },

    // ========== 满减券折扣率提示 ==========
    updateDiscountHint() {
        const hintEl = document.getElementById('yhquan-cj-discount-hint');
        if (!hintEl) return;

        if (this.currentType !== 11) {
            hintEl.textContent = '';
            return;
        }

        const minPay = Number(this.val('minPay'));
        const price = Number(this.val('price'));

        if (minPay > 0 && price > 0 && price < minPay) {
            const rate = ((minPay - price) / minPay * 10).toFixed(2).replace(/\.?0+$/, '');
            hintEl.textContent = `当前${rate}折扣`;
        } else {
            hintEl.textContent = '';
        }
    },

    // ========== 收集表单数据 ==========
    collectFormData() {
        const data = {
            type: this.currentType,
            name: this.val('name'),
            minPay: Number(this.val('minPay')) || 0,
            note: this.val('note'),
            toCondition: 5,
            extNote: this.val('extNote'),
            bfrFlag: Number(document.querySelector('input[name="yhquan-cj-bfr"]:checked')?.value || 0)
        };

        // 有效期
        const activePanel = document.querySelector('.yhquan-cj-validity-tab.active')?.dataset.panel;
        if (activePanel === 'range') {
            data.selectDateType = 0;
            const begin = this.val('beginDate');
            const end = this.val('endDate');
            data.beginTimeDate = begin ? `${begin} 00:00:00` : '';
            data.endTimeDate = end ? `${end} 23:59:59` : '';
        } else {
            data.selectDateType = 1;
            data.validDays = Number(this.val('validDays')) || 1;
            if (this.currentType === 25) {
                data.validType = Number(document.getElementById('yhquan-cj-validType')?.value || 0);
            }
        }

        // 按券类型补充字段
        if (this.currentType === 13) {
            data.discount = this.parseDiscount(this.val('discount'));
            data.maxCash = Number(this.val('maxCash')) || 0;
        } else if (this.currentType === 11) {
            data.price = Number(this.val('price')) || 0;
        }

        // 使用说明为空时自动生成
        if (!data.note) {
            if (this.currentType === 13) {
                data.note = `满 ${data.minPay} 元后任意金额享 ${data.discount} 折，仅可购买当前店铺内产品`;
            } else if (this.currentType === 11) {
                data.note = `满 ${data.minPay} 元减${data.price}元，仅可购买当前店铺内产品`;
            } else if (this.currentType === 25) {
                data.note = '仅当前店铺内商品可用，可直接抵扣邮费';
            }
        }

        return data;
    },

    val(id) {
        return (document.getElementById(`yhquan-cj-${id}`)?.value || '').trim();
    },

    // ========== 表单校验 ==========
    validate(data) {
        if (!data.name) return '请输入券名称';
        if (!data.minPay) return '请输入使用条件';

        if (data.type === 13 && !data.discount) return '请输入折扣';
        if (data.type === 11 && !data.price) return '请输入优惠金额';

        if (data.selectDateType === 0) {
            if (!data.beginTimeDate || !data.endTimeDate) return '请选择有效期时间段';
        } else {
            if (!data.validDays || data.validDays < 1) return '请输入有效天数/小时';
        }

        return null;
    },

    // ========== 提交 ==========
    async handleSubmit() {
        const data = this.collectFormData();
        const error = this.validate(data);
        if (error) {
            this.notify(error, 'warning');
            return;
        }

        const btn = document.getElementById('yhquan-cj-submit');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 创建中...';

        try {
            const credentials = await YhquanGongju.getCredentials();
            if (!credentials) {
                this.notify('请先登录', 'error');
                return;
            }

            const response = await fetch(this.config.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'addCoupon',
                    credentials: credentials,
                    couponData: data
                })
            });

            const result = await response.json();

            if (result.success) {
                this.notify(result.message || '创建成功', 'success');
                this.hide();
                // 刷新优惠券列表
                if (window.YhquanModule) {
                    YhquanModule.handleSearch();
                }
            } else {
                this.notify(result.message || '创建失败', 'error');
            }

        } catch (err) {
            console.error('创建优惠券失败:', err);
            this.notify('创建失败: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '创建';
        }
    },

    notify(message, type = 'info') {
        if (window.Tongzhi) {
            Tongzhi.show(message, type);
        } else {
            alert(message);
        }
    }
};

window.CjYewu = CjYewu;
