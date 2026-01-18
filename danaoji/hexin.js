/**
 * AI核心模块 - DeepSeek对话 v3.0
 * 
 * 核心理念：
 * 1. DeepSeek普通模型作为统一决策中心
 * 2. 所有能力通过工具调用实现（包括深度思考）
 * 3. 启用标签 = 在提示词中强制要求
 * 4. 未启用 = AI自主判断
 */

import * as lishi from './lishi.js';
import * as gongju from './gongju.js';
import { 
  SYSTEM_PROMPT,
  buildContextPrompt, 
  getToolMessage 
} from './tishici.js';
import { getCurrentImage, setCurrentImage, analyzeImage } from '../yewu/tupian.js';

// API配置
const DEEPSEEK_API_KEY = 'sk-526f960845aa4a44ac905d150df1b422';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

const MODEL = 'deepseek-chat';  // 统一使用普通模型

// 状态管理
let abortController = null;

// ============================================
// 公共API
// ============================================

export async function init() {
  lishi.load();
}

export { getToolMessage };

export function abort() {
  abortController?.abort();
}

/**
 * 主对话函数 - 统一入口
 */
export async function chat(userMessage, options) {
  const {
    featureTags = {},
    getContextInfo,
    attachments,
    onThinking,
    onContent,
    onToolCall,
    onDone,
    updateImageStatus
  } = options;

  // 1. 处理附件
  const { processedContent, imageNames, hasImage, hasFiles, imageBase64 } = processAttachments(
    userMessage, 
    attachments
  );

  // 2. 如果有图片，先进行视觉分析（让AI知道图片内容）
  let finalContent = processedContent;
  let imageDescription = null;
  
  if (hasImage && imageBase64) {
    try {
      onContent?.('🔍 正在识别图片内容...');
      imageDescription = await analyzeImage(imageBase64, '请详细描述这张图片的内容，包括主要元素、文字、颜色、布局等所有细节。');
      finalContent = `[用户上传了图片]\n[图片内容：${imageDescription}]\n\n用户消息：${processedContent}`;
      onContent?.('');
    } catch (e) {
      console.error('图片分析失败：', e);
      finalContent = `[用户上传了图片：${imageNames.join('、')}，图片分析暂时不可用]\n\n用户消息：${processedContent}`;
    }
  }

  // 3. 记录用户消息
  lishi.add('user', finalContent);
  
  // 4. 初始化请求控制器
  abortController = new AbortController();

  try {
    // 5. 构建上下文（告知AI当前状态和可用能力）
    const contextInfo = getContextInfo();
    const contextPrompt = buildContextPrompt({
      hasImage,
      hasFiles,
      featureTags,
      imageNames,
      contextInfo,
      imageDescription
    });

    // 6. 统一执行（普通模型 + 工具调用循环）
    const fullSystemPrompt = SYSTEM_PROMPT + contextPrompt;
    
    await doChat(fullSystemPrompt, {
      onThinking,
      onContent,
      onToolCall,
      onDone
    });

    // 7. 更新图片状态
    updateImageStatus?.();

  } catch (error) {
    handleError(error, onDone);
  }
}

// ============================================
// 附件处理
// ============================================

function processAttachments(userMessage, attachments) {
  let processedContent = userMessage;
  let imageNames = [];
  let hasImage = false;
  let hasFiles = false;
  let imageBase64 = null;

  if (attachments?.length) {
    const imageAtts = attachments.filter(a => a.type === 'image');
    const fileAtts = attachments.filter(a => a.type === 'file');

    if (imageAtts.length > 0) {
      imageBase64 = imageAtts[0].data;
      setCurrentImage(imageBase64);
      imageNames = imageAtts.map(a => a.name);
      hasImage = true;
    }

    for (const att of fileAtts) {
      processedContent += `\n\n[文件：${att.name}]\n${att.content}`;
      hasFiles = true;
    }
  }

  if (!hasImage && getCurrentImage()) {
    hasImage = true;
    imageBase64 = getCurrentImage();
  }

  return { processedContent, imageNames, hasImage, hasFiles, imageBase64 };
}

// ============================================
// 核心对话执行（统一的工具调用循环）
// ============================================

async function doChat(systemPrompt, callbacks) {
  const { onThinking, onContent, onToolCall, onDone } = callbacks;

  // 构建消息（限制历史数量，减少对发券场景的干扰）
  let messages = [
    { role: 'system', content: systemPrompt },
    ...lishi.getRecent(8)
  ];

  let continueLoop = true;
  let fullContent = '';
  let maxIterations = 15;  // 增加迭代次数，支持更复杂的工具链

  // 工具调用循环
  while (continueLoop && maxIterations-- > 0) {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 2000,
        temperature: 0.7,
        stream: true,
        tools: gongju.getTools()
      }),
      signal: abortController.signal
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API错误：${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let toolCalls = [];
    let currentContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta;
          const finish = json.choices?.[0]?.finish_reason;

          // 处理内容
          if (delta?.content) {
            currentContent += delta.content;
            fullContent = currentContent;
            onContent(fullContent);
          }

          // 处理工具调用
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCalls[tc.index]) {
                  toolCalls[tc.index] = {
                    id: '',
                    type: 'function',
                    function: { name: '', arguments: '' }
                  };
                }
                if (tc.id) toolCalls[tc.index].id = tc.id;
                if (tc.function?.name) toolCalls[tc.index].function.name = tc.function.name;
                if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
              }
            }
          }

          if (finish === 'tool_calls') continueLoop = true;
          else if (finish === 'stop') continueLoop = false;

        } catch (e) { /* 忽略解析错误 */ }
      }
    }

    // 执行工具调用
    if (toolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: currentContent || null,
        tool_calls: toolCalls
      });

      for (const tc of toolCalls) {
        const name = tc.function.name;
        let args = {};
        
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch (e) { /* 参数解析失败使用空对象 */ }

        // 显示工具调用状态
        onToolCall(name);

        // 【修复】正确获取并更新上下文，传递深度思考回调
        const isDeepThink = name === 'deep_think';
        if (isDeepThink) {
          gongju.updateContext({ onThinkingUpdate: onThinking });
        }

        const result = await gongju.execute(name, args);

        // 【修复】执行完毕后清除回调，避免污染其他工具
        if (isDeepThink) {
          gongju.updateContext({ onThinkingUpdate: null });
          
          // 如果有思考过程，确保显示
          if (result.success && result.thinking_process) {
            onThinking?.(result.thinking_process);
          }
        }

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result)
        });
      }

      toolCalls = [];
      currentContent = '';  // 清空当前内容，准备接收新回复
    } else {
      continueLoop = false;
    }
  }

  // 记录最终回复
  if (fullContent) {
    lishi.add('assistant', fullContent);
  }

  abortController = null;
  onDone(fullContent);
}

// ============================================
// 错误处理
// ============================================

function handleError(error, onDone) {
  abortController = null;
  
  if (error.name === 'AbortError') {
    onDone(null);
    return;
  }
  
  lishi.removeLast();
  onDone(`❌ 请求失败：${error.message}`);
}