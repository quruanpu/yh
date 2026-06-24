const ZhiLiaoZjgZhilingModule = (() => {
    const methods = {
        trySelectVisibleCommandMenuItem() {
            if (!window.ZhiLiaoCaidanModule?.state?.isMenuVisible) return false;
            const { filteredCommands, selectedIndex } = ZhiLiaoCaidanModule.state;
            if (filteredCommands.length <= 0) return false;
            ZhiLiaoCaidanModule.selectCommand(filteredCommands[selectedIndex]);
            return true;
        },

        resolveSlashCommandMessage(message) {
            const rawInput = String(message || '').trim();
            if (!rawInput.startsWith('/')) return '';

            const raw = rawInput.slice(1).trim();
            if (!raw) return '';

            const commands = window.ZhiLiaoCaidanModule?.state?.commands || [];
            if (!Array.isArray(commands) || commands.length === 0) return '';

            const sortedCommands = [...commands].sort((a, b) => {
                const aLen = Math.max(String(a?.name || '').length, String(a?.id || '').length);
                const bLen = Math.max(String(b?.name || '').length, String(b?.id || '').length);
                return bLen - aLen;
            });

            const tryMatch = (token, command) => {
                const t = String(token || '').trim();
                if (!t) return '';
                const match = raw.match(new RegExp(`^${t.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}(?:\\s+|$)`, 'i'));
                if (!match) return '';
                const extra = raw.slice(match[0].length).trim();
                const name = String(command?.name || '').trim();
                if (!name) return '';
                return `@${name}${extra ? ` ${extra}` : ''}`;
            };

            for (let i = 0; i < sortedCommands.length; i += 1) {
                const cmd = sortedCommands[i];
                const byName = tryMatch(cmd?.name, cmd);
                if (byName) return byName;
                const byId = tryMatch(cmd?.id, cmd);
                if (byId) return byId;
            }

            return '';
        },

        async executeCommandAndShowResult(message) {
            const normalizedMessage = this.resolveSlashCommandMessage(message) || String(message || '').trim();
            const commands = window.ZhiLiaoCaidanModule?.state?.commands || [];
            const matchedCommand = commands.find((cmd) => normalizedMessage.startsWith(`@${cmd.name}`)) || null;

            if (!matchedCommand) {
                this.addSystemMessage('未找到匹配的命令');
                return;
            }

            const extraContent = normalizedMessage.slice((`@${matchedCommand.name}`).length).trim();

            try {
                const result = await matchedCommand.handler(extraContent);

                if (result && result.error) {
                    this.addSystemMessage(`执行失败：${this.extractReadableError(result.error, '未知错误')}`);
                } else if (result && result.message) {
                    this.addSystemMessage(result.message);
                }
                await this.persistDisplaySnapshot();
            } catch (error) {
                this.logError('命令执行失败', error);
                this.addSystemMessage(this.createErrorNotice(error, '执行失败：'));
                await this.persistDisplaySnapshot();
            }
        }
    };

    return {
        methods,
        applyTo(appModule) {
            if (!appModule || typeof appModule !== 'object') return appModule;
            Object.assign(appModule, methods);
            return appModule;
        }
    };
})();

window.ZhiLiaoZjgZhilingModule = ZhiLiaoZjgZhilingModule;
