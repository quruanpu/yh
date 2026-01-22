// 发券模块
import { extractIds } from '../gongyong/gongju.js';
import * as shujuku from './shujuku.js';

// AI工具定义
export const tools = [
  { name: 'show_activities', description: '显示活动列表卡片供用户选择', parameters: {} },
  { name: 'send_coupons', description: '发券，传入关键字和用户原始内容，系统自动提取ID并匹配活动', parameters: {
    keywords: { type: 'array', items: { type: 'string' }, description: '优惠券关键字列表，如["2000/98", "5000/98"]，也支持模糊描述如["3000档98折"]' },
    content: { type: 'string', description: '用户的原始消息内容，系统会从中自动提取药店ID' }
  }, required: ['keywords', 'content'] }
];

/**
 * 核心发券执行函数（AI发券和传统发券共用）
 * @param {Array} activities - 活动列表 [{cid, name, keyword}]
 * @param {Array} ids - 药店ID列表
 * @param {Object} context - 上下文 {deviceId, notify, showReport, showPending, removePending, sessionPendingTasks}
 */
export async function executeSend(activities, ids, context) {
  const { deviceId, notify, showReport, showPending, removePending } = context;

  if (!activities?.length || !ids?.length) {
    notify('⚠️ 缺少活动或ID');
    return { success: false, error: '缺少活动或ID' };
  }

  const batchState = { total: activities.length, done: 0 };

  // 显示初始提示
  notify(`🚀 已提交：${activities.map(a => a.name).join('、')} → ${ids.length}个ID`);
  showPending(batchState.total, batchState.done);

  for (let i = 0; i < activities.length; i++) {
    const { cid, name: actName, keyword } = activities[i];
    try {
      const kw = keyword.split(/[,，]/)[0].trim();
      const { mid, path } = await shujuku.createTask(cid, ids, kw, deviceId);
      context.sessionPendingTasks++;

      shujuku.listenMessage(path, async data => {
        batchState.done++;
        const isLast = batchState.done >= batchState.total;

        // 先移除等待提示，显示结果
        removePending();
        await showReport(cid, actName, data, isLast);
        await shujuku.markAsRead(cid, mid);

        // 如果还有更多结果，继续显示等待提示
        if (!isLast) {
          showPending(batchState.total, batchState.done);
        }

        if (--context.sessionPendingTasks < 0) context.sessionPendingTasks = 0;
      });

    } catch (e) {
      removePending();
      notify(`❌ 发券失败：${e.message}`);
      return { success: false, error: e.message };
    }
  }

  return { success: true, activities: activities.map(a => a.name), ids_count: ids.length };
}

/**
 * 中文数字转阿拉伯数字
 */
const CN_NUM_MAP = {
  '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
  '十': 10, '百': 100, '千': 1000, '万': 10000
};

function chineseToNumber(cn) {
  if (!cn || /^\d+$/.test(cn)) return parseInt(cn) || 0;
  
  let result = 0;
  let temp = 0;
  let prevUnit = 1;
  
  for (const char of cn) {
    const num = CN_NUM_MAP[char];
    if (num === undefined) continue;
    
    if (num >= 10) {
      // 单位：十百千万
      if (temp === 0) temp = 1;  // "十" = 10, "千" = 1000
      temp *= num;
      if (num === 10000) {
        result += temp;
        temp = 0;
      }
      prevUnit = num;
    } else {
      // 数字：零一二三...
      temp = num;
    }
  }
  result += temp;
  return result || 0;
}

/**
 * 预处理用户输入，提取所有可能的优惠券关键字
 * 支持格式：
 * - 标准：5000/98, 5000-98
 * - 口语：5000档98折, 满5000减98, 5000元98折
 * - 中文：五千98, 三千99
 * 
 * 注意：必须有明确的分隔符或关键词，避免误识别药店ID
 */
export function extractCouponKeywords(text) {
  const keywords = new Set();
  let match;
  
  // 1. 标准格式：必须有明确分隔符 / 或 -
  // 匹配：5000/98, 5000-98, 2000/99
  const standardPattern = /(\d{3,5})\s*[\/\-]\s*(\d{2})(?!\d)/g;
  while ((match = standardPattern.exec(text)) !== null) {
    const amount = parseInt(match[1]);
    const discount = parseInt(match[2]);
    // 验证：金额500-50000，折扣90-99
    if (amount >= 500 && amount <= 50000 && discount >= 90 && discount <= 99) {
      keywords.add(`${match[1]}/${match[2]}`);
    }
  }
  
  // 2. 口语化格式：必须有关键词（档、折、减、元、块、满）
  // 匹配：5000档98折, 5000档98, 满5000减98, 5000元98折
  const oralPatterns = [
    /(\d{3,5})\s*档\s*(\d{2})\s*折?/g,           // 5000档98折
    /满?\s*(\d{3,5})\s*[减送返]\s*(\d{2})/g,     // 满5000减98
    /(\d{3,5})\s*[元块]\s*(\d{2})\s*折/g,        // 5000元98折
  ];
  
  for (const pattern of oralPatterns) {
    pattern.lastIndex = 0;  // 重置正则状态
    while ((match = pattern.exec(text)) !== null) {
      const amount = parseInt(match[1]);
      const discount = parseInt(match[2]);
      if (amount >= 500 && amount <= 50000 && discount >= 90 && discount <= 99) {
        keywords.add(`${amount}/${discount}`);
      }
    }
  }
  
  // 3. 中文数字格式：必须有"千"或"百"等单位词
  // 匹配：五千98, 三千99, 两千98折, 一千98
  const cnPattern = /([一二两三四五六七八九十]+)\s*千\s*[档元]?\s*(\d{2})\s*折?/g;
  while ((match = cnPattern.exec(text)) !== null) {
    const amount = chineseToNumber(match[1] + '千');
    const discount = parseInt(match[2]);
    if (amount >= 500 && amount <= 50000 && discount >= 90 && discount <= 99) {
      keywords.add(`${amount}/${discount}`);
    }
  }
  
  // 4. 最低档/最高档 等模糊描述 → 返回特殊标记让AI处理
  if (/最低档|最小档|最便宜/i.test(text)) {
    keywords.add('__LOWEST__');
  }
  if (/最高档|最大档|最贵/i.test(text)) {
    keywords.add('__HIGHEST__');
  }
  if (/全套|所有|全部|都[发送]/i.test(text)) {
    keywords.add('__ALL__');
  }
  
  return [...keywords];
}

/**
 * 提取字符串中的数字（用于模糊匹配）
 * "3000档98折" → [3000, 98]
 * "3000/98" → [3000, 98]
 * "满2000减99" → [2000, 99]
 */
function extractNumbers(str) {
  const matches = str.match(/\d+/g);
  return matches ? matches.map(Number).sort((a, b) => b - a) : []; // 降序排列
}

/**
 * 检查两个数字数组是否匹配（核心数字相同）
 * [3000, 98] vs [3000, 98] → true
 * [3000, 98, 2] vs [3000, 98] → true（包含关系）
 */
function numbersMatch(nums1, nums2) {
  if (nums1.length === 0 || nums2.length === 0) return false;
  
  // 取较短的数组作为基准，检查是否被包含
  const shorter = nums1.length <= nums2.length ? nums1 : nums2;
  const longer = nums1.length <= nums2.length ? nums2 : nums1;
  
  // 检查shorter中的所有数字是否都在longer中
  return shorter.every(n => longer.includes(n));
}

/**
 * 标准化关键字（用于精确匹配）
 * "3000 / 98" → "3000/98"
 * "3000／98" → "3000/98"（全角斜杠）
 */
function normalizeKeyword(str) {
  return str
    .replace(/\s+/g, '')           // 去空格
    .replace(/／/g, '/')           // 全角转半角
    .replace(/，/g, ',')           // 全角逗号转半角
    .toLowerCase();
}

/**
 * 根据关键字匹配活动（增强版模糊匹配）
 * @param {Array} keywords - 关键字列表
 * @returns {Object} {matched: [], notFound: [], all: []}
 */
export async function matchActivitiesByKeywords(keywords) {
  // 使用统一接口获取活动
  const allActivities = await shujuku.getActivities();

  const matched = [];
  const notFound = [];

  for (const kw of keywords) {
    const kwNorm = normalizeKeyword(kw);
    const kwNumbers = extractNumbers(kw);
    
    let found = null;
    
    // 遍历所有活动寻找匹配
    for (const activity of allActivities) {
      const actKeywords = activity.keyword.split(/[,，]/).map(k => normalizeKeyword(k));
      
      // 1. 精确匹配（标准化后）
      if (actKeywords.some(ak => ak === kwNorm || ak.includes(kwNorm) || kwNorm.includes(ak))) {
        found = activity;
        break;
      }
      
      // 2. 数字模糊匹配（核心逻辑）
      // 例如：用户说"3000档98折"，活动关键字是"3000/98"
      if (kwNumbers.length >= 2) {
        const actNumbers = extractNumbers(activity.keyword);
        if (numbersMatch(kwNumbers, actNumbers)) {
          found = activity;
          break;
        }
      }
      
      // 3. 活动名称匹配
      const actNameNorm = normalizeKeyword(activity.name);
      if (actNameNorm.includes(kwNorm) || kwNorm.includes(actNameNorm)) {
        found = activity;
        break;
      }
    }
    
    if (found && !matched.some(m => m.cid === found.cid)) {
      matched.push(found);
    } else if (!found) {
      notFound.push(kw);
    }
  }

  return { matched, notFound, all: allActivities };
}

// AI工具执行
export async function execute(name, args, context) {
  const { notify, showActivityCards } = context;

  switch (name) {
    case 'show_activities':
      return await showActivityCards();

    case 'send_coupons': {
      const { keywords, content } = args;

      // 从内容中提取ID
      const ids = extractIds(content || '');
      if (ids.length === 0) {
        notify('⚠️ 未识别到药店ID');
        return { success: false, error: '未找到药店ID（7位数字/11位手机号/K码）' };
      }

      // 检查是否有关键字
      if (!keywords?.length) {
        return { success: false, error: '未识别到优惠券关键字', needAI: true };
      }
      
      // 检查是否有特殊标记（需要AI处理）
      const specialMarkers = ['__LOWEST__', '__HIGHEST__', '__ALL__'];
      const hasSpecialMarker = keywords.some(k => specialMarkers.includes(k));
      if (hasSpecialMarker) {
        return { success: false, error: '需要AI处理特殊请求', needAI: true, markers: keywords.filter(k => specialMarkers.includes(k)) };
      }
      
      // 过滤掉特殊标记，只保留正常关键字
      const normalKeywords = keywords.filter(k => !specialMarkers.includes(k));
      if (normalKeywords.length === 0) {
        return { success: false, error: '未识别到有效的优惠券关键字', needAI: true };
      }

      // 匹配活动（使用增强版模糊匹配）
      let { matched, notFound, all } = await matchActivitiesByKeywords(normalKeywords);

      // 如果没有匹配到任何活动
      if (matched.length === 0) {
        const availableKeywords = all.map(a => a.keyword).join('、');
        notify(`⚠️ 未找到匹配的活动：${normalKeywords.join('、')}\n可用：${availableKeywords}`);
        return { 
          success: false, 
          error: '未找到匹配的活动', 
          keywords: normalKeywords, 
          available: all.map(a => ({ name: a.name, keyword: a.keyword }))
        };
      }

      if (notFound.length > 0) {
        notify(`⚠️ 部分关键字未匹配：${notFound.join('、')}`);
      }

      // 调用核心发券函数
      return await executeSend(matched, ids, context);
    }
  }
  return { success: false, error: '未知操作' };
}