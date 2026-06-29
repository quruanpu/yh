/**
 * 智聊指令系统 - 命令菜单核心模块
 */

const ZhiLiaoCaidanModule = {
    config: {
        triggerChar: '/',
        menuMaxHeight: 200,
        menuWidth: 280
    },

    state: {
        isMenuVisible: false,
        commands: [],
        selectedIndex: 0,
        filteredCommands: [],
        inputPrefix: ''
    },

    init() {
        this.createMenuElement();
        this.bindEvents();
        window.ZhiLiaoLog?.debug?.('指令系统已初始化');
    },

    registerCommand(command) {
        if (!command?.id || !command?.name || typeof command?.handler !== 'function') {
            console.error('指令注册失败：缺少必要字段', command);
            return false;
        }

        const exists = this.state.commands.find((c) => c.id === command.id);
        if (exists) {
            console.warn(`指令已存在，将覆盖: ${command.id}`);
            this.state.commands = this.state.commands.filter((c) => c.id !== command.id);
        }

        this.state.commands.push(command);
        return true;
    },

    createMenuElement() {
        const existing = document.getElementById('zhiliao-command-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.id = 'zhiliao-command-menu';
        menu.className = 'zhiliao-command-menu';
        menu.style.display = 'none';
        menu.innerHTML = '<div class="zhiliao-command-menu-list"></div>';
        document.body.appendChild(menu);
    },

    bindEvents() {
        const textarea = document.getElementById('message-input');
        if (!textarea) {
            setTimeout(() => this.bindEvents(), 500);
            return;
        }

        textarea.addEventListener('input', (e) => this.handleInput(e));
        textarea.addEventListener('keydown', (e) => this.handleKeydown(e));

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#zhiliao-command-menu') && !e.target.closest('#message-input')) {
                this.hideMenu();
            }
        });
    },

    handleInput(e) {
        const value = String(e?.target?.value || '');
        if (value.startsWith(this.config.triggerChar)) {
            const afterSlash = value.slice(1);
            if (afterSlash.includes(' ')) {
                this.hideMenu();
                return;
            }
            const prefix = afterSlash.toLowerCase();
            this.state.inputPrefix = prefix;
            this.filterCommands(prefix);
            this.showMenu();
            return;
        }
        this.hideMenu();
    },

    handleKeydown(e) {
        if (!this.state.isMenuVisible) return;

        const { filteredCommands, selectedIndex } = this.state;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.state.selectedIndex = Math.max(0, selectedIndex - 1);
            this.updateMenuSelection();
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.state.selectedIndex = Math.min(filteredCommands.length - 1, selectedIndex + 1);
            this.updateMenuSelection();
            return;
        }

        if (e.key === 'Enter') {
            if (filteredCommands.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                this.selectCommand(filteredCommands[selectedIndex]);
            }
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            this.hideMenu();
            return;
        }

        if (e.key === 'Tab' && filteredCommands.length > 0) {
            e.preventDefault();
            this.selectCommand(filteredCommands[selectedIndex]);
        }
    },

    filterCommands(prefix) {
        if (!prefix) {
            this.state.filteredCommands = [...this.state.commands];
        } else {
            this.state.filteredCommands = this.state.commands.filter((cmd) =>
                cmd.name.toLowerCase().includes(prefix) ||
                cmd.id.toLowerCase().includes(prefix) ||
                String(cmd.description || '').toLowerCase().includes(prefix)
            );
        }
        this.state.selectedIndex = 0;
    },

    showMenu() {
        const menu = document.getElementById('zhiliao-command-menu');
        const textarea = document.getElementById('message-input');
        if (!menu || !textarea) return;

        this.renderCommandList();

        const rect = textarea.getBoundingClientRect();
        menu.style.left = `${rect.left}px`;
        menu.style.bottom = `${window.innerHeight - rect.top + 8}px`;
        menu.style.width = 'auto';
        menu.style.minWidth = '80px';
        menu.style.maxWidth = `${Math.max(rect.width, this.config.menuWidth)}px`;
        menu.style.maxHeight = `${this.config.menuMaxHeight}px`;
        menu.style.display = 'block';

        this.state.isMenuVisible = true;
    },

    hideMenu() {
        const menu = document.getElementById('zhiliao-command-menu');
        if (menu) menu.style.display = 'none';
        this.state.isMenuVisible = false;
        this.state.selectedIndex = 0;
        this.state.inputPrefix = '';
    },

    renderCommandList() {
        const listContainer = document.querySelector('.zhiliao-command-menu-list');
        if (!listContainer) return;

        const { filteredCommands, selectedIndex } = this.state;
        if (filteredCommands.length === 0) {
            listContainer.innerHTML = '<div class="zhiliao-command-empty">无匹配指令</div>';
            return;
        }

        listContainer.innerHTML = filteredCommands
            .map((cmd, index) => `
                <div class="zhiliao-command-item ${index === selectedIndex ? 'selected' : ''}"
                     data-id="${cmd.id}"
                     onclick="ZhiLiaoCaidanModule.selectCommandById('${cmd.id}')">
                    @${cmd.name}
                </div>
            `)
            .join('');
    },

    updateMenuSelection() {
        const items = document.querySelectorAll('.zhiliao-command-item');
        items.forEach((item, index) => {
            item.classList.toggle('selected', index === this.state.selectedIndex);
        });

        const selectedItem = items[this.state.selectedIndex];
        if (selectedItem) {
            selectedItem.scrollIntoView({ block: 'nearest' });
        }
    },

    selectCommandById(id) {
        const command = this.state.commands.find((c) => c.id === id);
        if (command) this.selectCommand(command);
    },

    selectCommand(command) {
        const textarea = document.getElementById('message-input');
        if (!textarea) return;

        this.hideMenu();
        textarea.value = `@${command.name} `;
        textarea.focus();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
};

window.ZhiLiaoCaidanModule = ZhiLiaoCaidanModule;
