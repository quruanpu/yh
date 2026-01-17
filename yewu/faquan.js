// 发券模块
import { extractIds } from '../gongyong/gongju.js';
import * as shujuku from './shujuku.js';

// AI工具定义
export const tools = [
  { name: 'show_activities', description: '显示活动列表卡片供用户选择', parameters: {} },
  { name: 'send_coupons', description: '发券，传入关键字和用户原始内容，系统自动提取ID并匹配活动', parameters: {
    keywords: { type: 'array', items: { type: 'string' }, description: '优惠券关键字列表，如["2000/99", "5000/98"]' },
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
 * 根据关键字匹配活动
 * @param {Array} keywords - 关键字列表
 * @returns {Object} {matched: [], notFound: [], all: []}
 */
export async function matchActivitiesByKeywords(keywords) {
  // 使用统一接口获取活动
  const allActivities = await shujuku.getActivities();

  const matched = [];
  const notFound = [];

  for (const kw of keywords) {
    const kwNorm = kw.trim().toLowerCase();
    const found = allActivities.find(a => {
      const actKeywords = a.keyword.split(/[,，]/).map(k => k.trim().toLowerCase());
      return actKeywords.some(ak => ak.includes(kwNorm) || kwNorm.includes(ak));
    });
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
      if (!keywords?.length) {
        notify('⚠️ 未识别到优惠券关键字');
        return { success: false, error: '缺少优惠券关键字' };
      }

      // 从内容中提取ID
      const ids = extractIds(content || '');
      if (ids.length === 0) {
        notify('⚠️ 未识别到药店ID');
        return { success: false, error: '未找到药店ID（7位数字/11位手机号/K码）' };
      }

      // 匹配活动
      const { matched, notFound, all } = await matchActivitiesByKeywords(keywords);

      if (matched.length === 0) {
        notify(`⚠️ 未找到匹配的活动：${keywords.join('、')}`);
        return { success: false, error: '未找到匹配的活动', keywords, available: all.map(a => a.keyword) };
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
