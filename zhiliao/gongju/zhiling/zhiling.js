/**
 * 智聊指令系统 - 命令菜单核心模块
 *
 * 职责：
 * 1. 提供命令菜单UI（输入/触发，显示命令列表）
 * 2. 命令注册和管理
 * 3. 键盘导航（上下箭头、回车、ESC）
 * 4. 命令过滤和搜索
 * 5. 命令执行
 *
 * 从 zhiliao/gongj/caidan/app.js 迁移
 * 与 ToolRegistry 协同工作，支持双触发机制（命令触发 + AI调用）
 */

const ZhiLiaoCaidanModule = {
    // 配置
    config: {
        triggerChar: '/',           // 触发字符
        menuMaxHeight: 200,         // 菜单最大高度
        menuWidth: 280              // 菜单宽度
    },

    // 状态
    state: {
        isMenuVisible: false,       // 菜单是否可见
        commands: [],               // 已注册的指令
        selectedIndex: 0,           // 当前选中的指令索引
        filteredCommands: [],       // 过滤后的指令列表
        inputPrefix: ''             // 用户输入的前缀（用于过滤）
    },

    /**
     * 初始化指令系统
     */
    init() {
        this.createMenuElement();
        this.bindEvents();
        console.log('✅ 指令系统已初始化');
    },

    /**
     * 注册指令
     * @param {Object} command - 指令定义
     * @param {string} command.id - 指令唯一标识
     * @param {string} command.name - 指令显示名称
     * @param {string} [command.icon] - 指令图标
     * @param {string} command.description - 指令功能描述
     * @param {Function} command.handler - 执行函数
     * @returns {boolean} 是否注册成功
     */
    registerCommand(command) {
        // command: { id, name, icon, description, handler }
        if (!command.id || !command.name || !command.handler) {
            console.error('❌ 指令注册失败：缺少必要字段', command);
            return false;
        }

        // 检查是否已存在
        const exists = this.state.commands.find(c => c.id === command.id);
        if (exists) {
            console.warn(`⚠️ 指令已存在，将覆盖: ${command.id}`);
            this.state.commands = this.state.commands.filter(c => c.id !== command.id);
        }

        this.state.commands.push(command);
        console.log(`✅ 指令已注册: ${command.name}`);
        return true;
    },

    /**
     * 创建菜单DOM元素
     */
    createMenuElement() {
        // 移除已存在的菜单
        const existing = document.getElementById('zhiliao-command-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.id = 'zhiliao-command-menu';
        menu.className = 'zhiliao-command-menu';
        menu.style.display = 'none';
        menu.innerHTML = `<div class="zhiliao-command-menu-list"></div>`;

        document.body.appendChild(menu);
    },

    /**
     * 绑定事件
     */
    bindEvents() {
        // 监听输入框
        const textarea = document.getElementById('message-input');
        if (!textarea) {
            // 延迟绑定（等待DOM加载）
            setTimeout(() => this.bindEvents(), 500);
            return;
        }

        // 输入事件
        textarea.addEventListener('input', (e) => this.handleInput(e));

        // 键盘事件（上下选择、回车确认、ESC关闭）
        textarea.addEventListener('keydown', (e) => this.handleKeydown(e));

        // 点击其他地方关闭菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#zhiliao-command-menu') &&
                !e.target.closest('#message-input')) {
                this.hideMenu();
            }
        });
    },

    /**
     * 处理输入
     * @param {Event} e - 输入事件
     */
    handleInput(e) {
        const textarea = e.target;
        const value = textarea.value;

        // 检查是否以 / 开头（触发指令菜单）
        if (value.startsWith('/')) {
            const prefix = value.slice(1).toLowerCase();
            this.state.inputPrefix = prefix;
            this.filterCommands(prefix);
            this.showMenu();
        } else {
            this.hideMenu();
        }
    },

    /**
     * 检查消息是否为指令（供发送时调用）
     * @param {string} message - 消息内容
     * @returns {boolean} 是否为指令
     */
    checkAndExecuteCommand(message) {
        // 检查是否以 @指令名 开头
        for (const cmd of this.state.commands) {
            const prefix = `@${cmd.name}`;
            if (message.startsWith(prefix)) {
                const extraContent = message.slice(prefix.length).trim();
                this.executeCommand(cmd, extraContent);
                return true;
            }
        }
        return false;
    },

    /**
     * 处理键盘事件
     * @param {KeyboardEvent} e - 键盘事件
     */
    handleKeydown(e) {
        if (!this.state.isMenuVisible) return;

        const { filteredCommands, selectedIndex } = this.state;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                this.state.selectedIndex = Math.max(0, selectedIndex - 1);
                this.updateMenuSelection();
                break;

            case 'ArrowDown':
                e.preventDefault();
                this.state.selectedIndex = Math.min(filteredCommands.length - 1, selectedIndex + 1);
                this.updateMenuSelection();
                break;

            case 'Enter':
                if (filteredCommands.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectCommand(filteredCommands[selectedIndex]);
                }
                break;

            case 'Escape':
                e.preventDefault();
                this.hideMenu();
                break;

            case 'Tab':
                if (filteredCommands.length > 0) {
                    e.preventDefault();
                    this.selectCommand(filteredCommands[selectedIndex]);
                }
                break;
        }
    },

    /**
     * 过滤指令
     * @param {string} prefix - 过滤前缀
     */
    filterCommands(prefix) {
        if (!prefix) {
            this.state.filteredCommands = [...this.state.commands];
        } else {
            this.state.filteredCommands = this.state.commands.filter(cmd =>
                cmd.name.toLowerCase().includes(prefix) ||
                cmd.id.toLowerCase().includes(prefix) ||
                (cmd.description && cmd.description.toLowerCase().includes(prefix))
            );
        }
        this.state.selectedIndex = 0;
    },

    /**
     * 显示菜单
     */
    showMenu() {
        const menu = document.getElementById('zhiliao-command-menu');
        const textarea = document.getElementById('message-input');
        if (!menu || !textarea) return;

        // 渲染指令列表
        this.renderCommandList();

        // 定位菜单（在输入框上方，宽度自适应）
        const rect = textarea.getBoundingClientRect();

        menu.style.left = `${rect.left}px`;
        menu.style.bottom = `${window.innerHeight - rect.top + 8}px`;
        menu.style.width = 'auto';
        menu.style.minWidth = '80px';
        menu.style.maxWidth = `${rect.width}px`;
        menu.style.display = 'block';

        this.state.isMenuVisible = true;
    },

    /**
     * 隐藏菜单
     */
    hideMenu() {
        const menu = document.getElementById('zhiliao-command-menu');
        if (menu) menu.style.display = 'none';
        this.state.isMenuVisible = false;
        this.state.selectedIndex = 0;
        this.state.inputPrefix = '';
    },

    /**
     * 渲染指令列表
     */
    renderCommandList() {
        const listContainer = document.querySelector('.zhiliao-command-menu-list');
        if (!listContainer) return;

        const { filteredCommands, selectedIndex } = this.state;

        if (filteredCommands.length === 0) {
            listContainer.innerHTML = `<div class="zhiliao-command-empty">无匹配指令</div>`;
            return;
        }

        listContainer.innerHTML = filteredCommands.map((cmd, index) => `
            <div class="zhiliao-command-item ${index === selectedIndex ? 'selected' : ''}"
                 data-id="${cmd.id}"
                 onclick="ZhiLiaoCaidanModule.selectCommandById('${cmd.id}')">
                @${cmd.name}
            </div>
        `).join('');
    },

    /**
     * 更新菜单选中状态
     */
    updateMenuSelection() {
        const items = document.querySelectorAll('.zhiliao-command-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.state.selectedIndex);
        });

        // 滚动到可见区域
        const selectedItem = items[this.state.selectedIndex];
        if (selectedItem) {
            selectedItem.scrollIntoView({ block: 'nearest' });
        }
    },

    /**
     * 通过ID选择指令
     * @param {string} id - 指令ID
     */
    selectCommandById(id) {
        const command = this.state.commands.find(c => c.id === id);
        if (command) {
            this.selectCommand(command);
        }
    },

    /**
     * 选择指令（填充到输入框）
     * @param {Object} command - 指令对象
     */
    selectCommand(command) {
        const textarea = document.getElementById('message-input');
        if (!textarea) return;

        // 隐藏菜单
        this.hideMenu();

        // 在输入框填充 @指令名 前缀，等待用户输入参数
        textarea.value = `@${command.name} `;
        textarea.focus();

        // 触发input事件以调整高度
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    },

    /**
     * 执行指令
     * @param {Object} command - 指令对象
     * @param {string} extraContent - 额外内容
     */
    async executeCommand(command, extraContent = '') {
        console.log('执行指令:', command.name, '额外内容:', extraContent);

        try {
            await command.handler(extraContent);
        } catch (error) {
            console.error('指令执行失败:', error);
            if (window.ZhiLiaoModule?.showToast) {
                ZhiLiaoModule.showToast('指令执行失败: ' + error.message, 'error');
            }
        }
    }
};

// 导出模块
window.ZhiLiaoCaidanModule = ZhiLiaoCaidanModule;
