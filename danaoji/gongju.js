// AI工具注册表
import { getAllToolDefinitions, executeToolCall } from '../yewu/zhuce.js';

let toolDefinitions = [];
let toolContext = null;

// 初始化工具
export function init(context) {
  toolContext = context;
  toolDefinitions = getAllToolDefinitions();
}

// 获取工具定义（供AI调用）
export function getTools() {
  return toolDefinitions;
}

// 执行工具
export async function execute(name, args) {
  return await executeToolCall(name, args, toolContext);
}

// 更新上下文（支持动态更新，如传递回调）
export function updateContext(updates) {
  toolContext = { ...toolContext, ...updates };
}

// 获取当前上下文（供外部读取）
export function getContext() {
  return toolContext;
}