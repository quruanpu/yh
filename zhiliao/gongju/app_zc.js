/**
 * 统一工具注册中心 - 核心模块
 *
 * 职责：
 * 1. 统一管理所有工具（命令触发 + AI调用）
 * 2. 提供工具注册接口
 * 3. 桥接指令系统（ZhiLiaoCaidanModule）和AI工具系统（AIToolsModule）
 * 4. 实现双触发机制（命令触发 + AI自动调用）
 * 5. 提供通用工具函数（Timer等）
 *
 * 设计理念：
 * - 一个工具，两种触发方式
 * - 统一的工具定义格式
 * - 参数自动标准化（字符串 → 对象）
 *
 * 注册类型（registerType）：
 * - 'ai': 仅AI可调用，不显示在命令菜单
 * - 'command': 仅用户命令触发，不提供给AI
 * - 'both': AI可调用 + 用户命令触发（默认）
 */

const ToolRegistry = {
    // 状态
    state: {
        tools: [],              // 已注册的工具列表
        initialized: false      // 是否已初始化
    },

    // 计时器工具（从app_gj.js合并）
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
        },

        clear(timerId) {
            this.timers.delete(timerId);
        }
    },

    /**
     * 初始化工具注册中心
     */
    init() {
        if (this.state.initialized) {
            console.warn('工具注册中心已初始化');
            return;
        }

        console.log('🔧 工具注册中心初始化...');
        this.state.initialized = true;

        // 注册内置工具
        this.registerBuiltinTools();

        console.log(`✅ 工具注册中心初始化完成，已注册 ${this.state.tools.length} 个工具`);
    },

    /**
     * 注册工具
     * @param {Object} tool - 工具定义
     * @param {string} tool.id - 工具唯一标识
     * @param {string} tool.name - 工具显示名称
     * @param {string} tool.command - 命令触发关键字（如：@查询）
     * @param {string} tool.description - 工具功能描述
     * @param {string} [tool.icon] - 工具图标
     * @param {string} [tool.registerType='both'] - 注册类型：'ai' | 'command' | 'both'
     * @param {Object} tool.parameters - AI调用参数定义（JSON Schema格式）
     * @param {Function} tool.handler - 执行函数
     * @returns {boolean} 是否注册成功
     */
    register(tool) {
        // 验证必要字段
        if (!tool.id || !tool.name || !tool.handler) {
            console.error('❌ 工具注册失败：缺少必要字段', tool);
            return false;
        }

        // 设置默认注册类型
        if (!tool.registerType) {
            tool.registerType = 'both';
        }

        // 检查是否已存在
        const existingIndex = this.state.tools.findIndex(t => t.id === tool.id);
        if (existingIndex !== -1) {
            console.warn(`⚠️ 工具已存在，将覆盖: ${tool.id}`);
            this.state.tools[existingIndex] = tool;
        } else {
            this.state.tools.push(tool);
        }

        console.log(`✅ 工具已注册: ${tool.name} (${tool.id}) [${tool.registerType}]`);

        // 根据注册类型同步到指令系统
        if (tool.registerType === 'command' || tool.registerType === 'both') {
            this.syncToCommandSystem(tool);
        }

        return true;
    },

    /**
     * 批量注册工具
     * @param {Array} tools - 工具列表
     */
    registerBatch(tools) {
        if (!Array.isArray(tools)) {
            console.error('❌ 批量注册失败：参数必须是数组');
            return;
        }

        let successCount = 0;
        tools.forEach(tool => {
            if (this.register(tool)) {
                successCount++;
            }
        });

        console.log(`✅ 批量注册完成: ${successCount}/${tools.length} 个工具`);
    },

    /**
     * 同步工具到指令系统（ZhiLiaoCaidanModule）
     * @param {Object} tool - 工具定义
     */
    syncToCommandSystem(tool) {
        if (!window.ZhiLiaoCaidanModule) {
            return; // 指令系统未加载
        }

        // 转换为指令系统格式
        const command = {
            id: tool.id,
            name: tool.name,
            icon: tool.icon || '🔧',
            description: tool.description,
            handler: async (extraContent) => {
                // 参数标准化：字符串 → 对象
                const params = this.normalizeParams(tool, extraContent);
                return await tool.handler(params);
            }
        };

        // 注册到指令系统
        ZhiLiaoCaidanModule.registerCommand(command);
    },

    /**
     * 参数标准化
     * 将命令触发的字符串参数转换为对象格式（供handler使用）
     * @param {Object} tool - 工具定义
     * @param {string} extraContent - 命令附加内容
     * @returns {Object} 标准化后的参数对象
     */
    normalizeParams(tool, extraContent) {
        // 如果没有参数定义，直接返回字符串
        if (!tool.parameters || !tool.parameters.properties) {
            return extraContent;
        }

        // 解析参数
        const params = {};
        const properties = tool.parameters.properties;
        const propKeys = Object.keys(properties);

        if (propKeys.length === 1) {
            // 单参数：直接赋值
            params[propKeys[0]] = extraContent.trim();
        } else {
            // 多参数：按空格分割
            const values = extraContent.trim().split(/\s+/);
            propKeys.forEach((key, index) => {
                params[key] = values[index] || '';
            });
        }

        return params;
    },

    /**
     * 获取工具列表（供AI调用，OpenAI格式）
     * 只返回 registerType 为 'ai' 或 'both' 的工具
     * @returns {Array} OpenAI Function Calling 格式的工具列表
     */
    getTools() {
        return this.state.tools
            .filter(tool => tool.registerType === 'ai' || tool.registerType === 'both')
            .map(tool => ({
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

    /**
     * 获取命令列表（供指令系统使用）
     * @returns {Array} 命令列表
     */
    getCommands() {
        return this.state.tools.map(tool => ({
            id: tool.id,
            name: tool.name,
            command: tool.command,
            icon: tool.icon,
            description: tool.description
        }));
    },

    /**
     * 根据ID获取工具
     * @param {string} toolId - 工具ID
     * @returns {Object|null} 工具定义
     */
    getTool(toolId) {
        return this.state.tools.find(t => t.id === toolId) || null;
    },

    /**
     * 执行工具（统一入口）
     * @param {string} toolId - 工具ID
     * @param {Object|string} params - 参数（对象或字符串）
     * @returns {Promise<any>} 执行结果
     */
    async executeTool(toolId, params) {
        const tool = this.getTool(toolId);
        if (!tool) {
            console.error(`❌ 工具不存在: ${toolId}`);
            return { error: `工具不存在: ${toolId}` };
        }

        try {
            console.log(`🔧 执行工具: ${tool.name}`, params);
            const result = await tool.handler(params);
            console.log(`✅ 工具执行成功: ${tool.name}`);
            return result;
        } catch (error) {
            console.error(`❌ 工具执行失败: ${tool.name}`, error);
            return { error: error.message };
        }
    },

    /**
     * 注册内置工具
     * 从ToolDefinitions读取并注册所有工具
     */
    registerBuiltinTools() {
        console.log('📦 注册内置工具...');

        // 从ToolDefinitions获取所有工具定义
        if (window.ToolDefinitions) {
            const allTools = ToolDefinitions.getAllTools();
            this.registerBatch(allTools);
        } else {
            console.warn('⚠️ ToolDefinitions未加载');
        }

        console.log('✅ 内置工具注册完成');
    }
};

// 兼容旧的UtilsModule引用
window.UtilsModule = {
    Timer: ToolRegistry.Timer
};

// 导出模块
window.ToolRegistry = ToolRegistry;
