// 业务注册中心 - 统一管理所有业务模块的AI工具
import * as shujuku from './shujuku.js';
import * as faquan from './faquan.js';
import * as tupian from './tupian.js';
import * as sousu from './sousu.js';
import * as shendu from './shendu.js';
import * as shenghuo from './shenghuo.js';  // 生活工具模块（天气、金价、汇率、油价等）

// 业务模块列表
const modules = { shujuku, faquan, tupian, sousu, shendu, shenghuo };

// 汇总所有工具定义（转换为OpenAI格式）
export function getAllToolDefinitions() {
  const tools = [];
  for (const mod of Object.values(modules)) {
    if (!mod.tools) continue;
    for (const t of mod.tools) {
      const properties = {};
      const required = t.required || [];
      if (t.parameters) {
        for (const [key, val] of Object.entries(t.parameters)) {
          properties[key] = val;
        }
      }
      tools.push({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: { type: 'object', properties, required }
        }
      });
    }
  }
  return tools;
}

// 执行工具调用
export async function executeToolCall(name, args, context) {
  console.log(`[工具] ${name}`, args);
  for (const mod of Object.values(modules)) {
    if (!mod.tools) continue;
    if (mod.tools.some(t => t.name === name)) {
      return await mod.execute(name, args, context);
    }
  }
  return { success: false, error: `未知工具：${name}` };
}