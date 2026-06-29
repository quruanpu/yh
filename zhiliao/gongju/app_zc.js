/**
 * Tool Registry
 * - Unified registration for command tools + AI function tools
 * - Optional skill middleware hooks (before/after execute)
 */

const ToolRegistry = {
    state: {
        tools: [],
        initialized: false
    },

    Timer: {
        timers: new Map(),

        start(timerId) {
            this.timers.set(timerId, Date.now());
        },

        getDuration(timerId) {
            const startTime = this.timers.get(timerId);
            if (!startTime) return 0;
            return Math.round((Date.now() - startTime) / 1000);
        },

        stop(timerId) {
            const duration = this.getDuration(timerId);
            this.timers.delete(timerId);
            return duration;
        }
    },

    init() {
        if (this.state.initialized) {
            console.warn('ToolRegistry already initialized');
            return;
        }

        this.state.initialized = true;
        window.ZhiLiaoLog?.debug?.('Initializing ToolRegistry...');
        this.registerBuiltinTools();
        window.ZhiLiaoLog?.debug?.(`ToolRegistry initialized, total tools: ${this.state.tools.length}`);
    },

    register(tool) {
        if (!tool || !tool.id || !tool.name || typeof tool.handler !== 'function') {
            console.error('Tool registration failed: missing required fields', tool);
            return false;
        }

        if (!tool.registerType) tool.registerType = 'both';

        const existingIndex = this.state.tools.findIndex((t) => t.id === tool.id);
        if (existingIndex >= 0) {
            this.state.tools[existingIndex] = tool;
            console.warn(`Tool replaced: ${tool.id}`);
        } else {
            this.state.tools.push(tool);
        }

        if (tool.registerType === 'command' || tool.registerType === 'both') {
            this.syncToCommandSystem(tool);
        }

        window.ZhiLiaoLog?.debug?.(`Tool registered: ${tool.name} (${tool.id}) [${tool.registerType}]`);
        return true;
    },

    syncToCommandSystem(tool) {
        if (!window.ZhiLiaoCaidanModule) return;

        const command = {
            id: tool.id,
            name: tool.name,
            icon: tool.icon || 'fa-solid fa-screwdriver-wrench',
            description: tool.description,
            handler: async (extraContent) => {
                let params = extraContent;
                if (tool.parameters && tool.parameters.properties) {
                    params = {};
                    const properties = tool.parameters.properties;
                    const propKeys = Object.keys(properties);
                    const content = String(extraContent || '').trim();

                    if (propKeys.length === 1) {
                        params[propKeys[0]] = content;
                    } else {
                        const hasKeyword = Object.prototype.hasOwnProperty.call(properties, 'keyword');
                        if (hasKeyword) {
                            params.keyword = content;

                            if (Object.prototype.hasOwnProperty.call(properties, 'include_image')) {
                                const includeImageFlag =
                                    /\binclude_image\s*[:=]\s*(1|true|yes)\b/i.test(content) ||
                                    /\bwith[_\s-]?image\b/i.test(content) ||
                                    /带图|要图|图片|主图|包装图/.test(content);
                                const excludeImageFlag =
                                    /\binclude_image\s*[:=]\s*(0|false|no)\b/i.test(content) ||
                                    /不带图|不要图|无图/.test(content);

                                if (includeImageFlag && !excludeImageFlag) {
                                    params.include_image = true;
                                } else if (excludeImageFlag) {
                                    params.include_image = false;
                                }
                            }
                        } else {
                            const values = content.split(/\s+/);
                            propKeys.forEach((key, index) => {
                                params[key] = values[index] || '';
                            });
                        }
                    }
                }
                return this.executeTool(tool.id, params, { source: 'command' });
            }
        };

        ZhiLiaoCaidanModule.registerCommand(command);
    },

    getTools() {
        return this.state.tools
            .filter((tool) => tool.registerType === 'ai' || tool.registerType === 'both')
            .map((tool) => ({
                type: 'function',
                function: {
                    name: tool.id,
                    description: tool.description,
                    parameters: tool.parameters || {
                        type: 'object',
                        properties: {},
                        required: []
                    }
                }
            }));
    },

    async executeTool(toolId, params, context = null) {
        const tool = this.state.tools.find((t) => t.id === toolId) || null;
        if (!tool) {
            return { error: `工具不存在: ${toolId}` };
        }

        try {
            const runtimeContext = typeof context === 'string'
                ? { sessionId: context }
                : (context && typeof context === 'object' ? { ...context } : {});

            const inputParams = params && typeof params === 'object' ? { ...params } : params;
            const skipSkill = !!(inputParams && typeof inputParams === 'object' && inputParams._skipSkill === true);
            let finalParams = inputParams;

            if (!skipSkill && window.ToolSkillCenterModule && typeof window.ToolSkillCenterModule.beforeExecute === 'function') {
                const skillResult = await window.ToolSkillCenterModule.beforeExecute(toolId, finalParams, runtimeContext);
                if (skillResult && skillResult.blocked) {
                    return {
                        success: false,
                        error: skillResult.error || '工具调用被 skill 策略阻止',
                        route_blocked: true,
                        suggested_tool: skillResult.suggestedTool || ''
                    };
                }
                if (skillResult && Object.prototype.hasOwnProperty.call(skillResult, 'params')) {
                    finalParams = skillResult.params;
                }
            }

            if (finalParams && typeof finalParams === 'object' && Object.prototype.hasOwnProperty.call(finalParams, '_skipSkill')) {
                delete finalParams._skipSkill;
            }

            window.ZhiLiaoLog?.debug?.(`Executing tool: ${tool.name}`, finalParams);
            let result = await tool.handler(finalParams);

            if (!skipSkill && window.ToolSkillCenterModule && typeof window.ToolSkillCenterModule.afterExecute === 'function') {
                const postSkillResult = await window.ToolSkillCenterModule.afterExecute(toolId, finalParams, result, runtimeContext);
                if (postSkillResult && Object.prototype.hasOwnProperty.call(postSkillResult, 'result')) {
                    result = postSkillResult.result;
                }
            }

            return result;
        } catch (error) {
            console.error(`Tool execution failed: ${tool.id}`, error);
            return { error: error?.message || '工具执行失败' };
        }
    },

    registerBuiltinTools() {
        if (!window.ToolDefinitions || typeof ToolDefinitions.getAllTools !== 'function') {
            console.warn('ToolDefinitions not loaded');
            return;
        }
        const tools = ToolDefinitions.getAllTools();
        if (!Array.isArray(tools)) {
            console.error('registerBuiltinTools expects an array');
            return;
        }

        let successCount = 0;
        tools.forEach((tool) => {
            if (this.register(tool)) successCount += 1;
        });
        window.ZhiLiaoLog?.debug?.(`Builtin tools register completed: ${successCount}/${tools.length}`);
    }
};

window.UtilsModule = {
    Timer: ToolRegistry.Timer
};

window.ToolRegistry = ToolRegistry;


