// 搜索模块 - 秘塔AI Search API

const API_KEY = 'mk-DAF38D8862C6EB9C6338017611DE491B';
const API_BASE = 'https://metaso.cn/api/v1';

// 通用请求函数
async function request(endpoint, body, accept = 'application/json') {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Accept': accept,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    throw new Error(`API错误: ${response.status}`);
  }
  
  return accept === 'text/plain' ? response.text() : response.json();
}

// AI工具定义
export const tools = [
  { 
    name: 'web_search', 
    description: '联网搜索，获取实时信息、新闻、知识等', 
    parameters: { 
      query: { type: 'string', description: '搜索关键词' },
      scope: { type: 'string', description: '搜索范围：webpage/paper/image/video，默认webpage' }
    }, 
    required: ['query'] 
  },
  { 
    name: 'read_webpage', 
    description: '读取指定网页的完整内容', 
    parameters: { 
      url: { type: 'string', description: '网页URL' }
    }, 
    required: ['url'] 
  },
  { 
    name: 'smart_search', 
    description: '智能问答搜索，直接返回问题的答案（带引用来源）', 
    parameters: { 
      question: { type: 'string', description: '要询问的问题' }
    }, 
    required: ['question'] 
  }
];

// AI工具执行
export async function execute(name, args) {
  try {
    switch (name) {
      case 'web_search': {
        const data = await request('/search', {
          q: args.query,
          scope: args.scope || 'webpage',
          includeSummary: true,
          size: 5
        });
        
        return {
          success: true,
          summary: data.summary || null,
          results: (data.data || []).slice(0, 5).map(r => ({
            title: r.title,
            snippet: r.snippet || r.content,
            url: r.url,
            source: r.source || r.siteName
          }))
        };
      }
      
      case 'read_webpage': {
        const content = await request('/reader', { url: args.url }, 'text/plain');
        return {
          success: true,
          content: content.length > 3000 ? content.substring(0, 3000) + '...(已截断)' : content
        };
      }
      
      case 'smart_search': {
        const data = await request('/chat/completions', {
          model: 'fast',
          stream: false,
          messages: [{ role: 'user', content: args.question }]
        });
        
        const answer = data.choices?.[0]?.message?.content || '';
        return {
          success: true,
          answer,
          references: (data.references || []).map(r => ({
            title: r.title,
            url: r.url
          }))
        };
      }
    }
    
    return { success: false, error: '未知操作' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}