// 深度思考模块 - 让AI可以自主调用研究能力

const DEEPSEEK_API_KEY = 'sk-526f960845aa4a44ac905d150df1b422';
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// AI工具定义
export const tools = [
  { 
    name: 'deep_think', 
    description: '【深度思考】调用深度推理模型进行复杂分析。使用场景：(1)需要多步骤推理的复杂问题；(2)需要深入分析的技术/学术问题；(3)需要权衡多个因素的决策问题；(4)用户明确要求"仔细想想"、"深入分析"。注意：简单问题不需要调用此工具。',
    parameters: { 
      question: { type: 'string', description: '需要深度思考的问题，应包含完整上下文' },
      context: { type: 'string', description: '相关背景信息（可选）' }
    }, 
    required: ['question'] 
  }
];

// 执行深度思考
export async function execute(name, args, context) {
  if (name !== 'deep_think') {
    return { success: false, error: '未知操作' };
  }

  const { question, context: bgContext } = args;
  const { onThinkingUpdate } = context;

  try {
    const messages = [
      { 
        role: 'system', 
        content: '你是一个深度分析助手。请对问题进行全面、深入的分析，考虑多个角度和可能性。' 
      },
      { 
        role: 'user', 
        content: bgContext ? `背景信息：${bgContext}\n\n问题：${question}` : question 
      }
    ];

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-reasoner',
        messages,
        max_tokens: 4000,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`API错误：${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullThinking = '';
    let finalContent = '';

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
          const delta = JSON.parse(data).choices?.[0]?.delta;
          
          // 收集思考过程
          if (delta?.reasoning_content) {
            fullThinking += delta.reasoning_content;
            onThinkingUpdate?.(fullThinking);
          }
          
          // 收集最终结论
          if (delta?.content) {
            finalContent += delta.content;
          }
        } catch (e) { /* 忽略解析错误 */ }
      }
    }

    return {
      success: true,
      thinking_process: fullThinking,
      conclusion: finalContent || '分析完成，请查看思考过程。',
      summary: (finalContent || fullThinking).substring(0, 500) + '...'
    };

  } catch (e) {
    return { success: false, error: e.message };
  }
}