// 数据库模块 - Firebase操作
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, child, set, update, onValue, off, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { TimeUtil } from '../gongyong/gongju.js';

const app = initializeApp({
  apiKey: "AIzaSyATJfmSt2R8iCaLo__ITbbWAsMIxYIk4qE",
  authDomain: "youhuiquan-3def0.firebaseapp.com",
  projectId: "youhuiquan-3def0",
  databaseURL: "https://youhuiquan-3def0-default-rtdb.asia-southeast1.firebasedatabase.app",
  appId: "1:164990883052:web:43fb6754889e71ad1e81c9"
});

const db = getDatabase(app);
const dbRef = ref(db);
const TIME_LIMIT = 24 * 60 * 60 * 1000;

// ============================================
// 一、底层数据访问（原始Firebase操作）
// ============================================

/** 获取所有活动原始快照 */
export const fetchAllActivities = () => get(child(dbRef, 'youhuiquan'));

/** 获取单个活动原始数据 */
export async function fetchActivityById(cid) {
  const snap = await get(child(dbRef, `youhuiquan/${cid}`));
  return snap.exists() ? snap.val() : null;
}

/** 获取单条消息原始数据 */
export async function fetchMessageById(activityId, msgId) {
  const snap = await get(child(dbRef, `youhuiquan/${activityId}/xiaoxi/${msgId}`));
  return snap.exists() ? snap.val() : null;
}

/** 删除失效活动 */
export const deleteInactive = cid => remove(ref(db, `youhuiquan/${cid}`));

/** 标记已读 */
export const markAsRead = (activityId, msgId) =>
  update(ref(db, `youhuiquan/${activityId}/xiaoxi/${msgId}`), { start_read: true });

/** 创建任务 */
export async function createTask(cid, ids, keyword, deviceId) {
  const mid = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const path = `youhuiquan/${cid}/xiaoxi/${mid}`;
  await set(ref(db, path), {
    zengsong_id: ids.join(','),
    guanjianzi: keyword,
    time_start: TimeUtil.getNow(),
    start_sbid: deviceId,
    status: '待处理'
  });
  return { mid, path };
}

/** 监听消息状态变化 */
export function listenMessage(path, onComplete) {
  const msgRef = ref(db, path);
  const handler = s => {
    const data = s.val();
    if (data && ['成功', '失败', '部分成功'].includes(data.status)) {
      off(msgRef);
      onComplete(data);
    }
  };
  onValue(msgRef, handler);
  return () => off(msgRef);
}

// ============================================
// 二、统一数据格式化工具
// ============================================

/**
 * 格式化消息结果统计（成功/失败计算）
 * @param {Object} msgData - 消息原始数据
 * @returns {Object} { successIds, failedGroups, successCount, failCount }
 */
export function formatResultStats(msgData) {
  const result = msgData?.result || {};
  const successIds = result.success || [];
  const failedGroups = result.failed || {};
  const failCount = Object.values(failedGroups).reduce((sum, ids) => sum + ids.length, 0);
  
  return {
    successIds,
    failedGroups,
    successCount: successIds.length,
    failCount
  };
}

// ============================================
// 三、业务数据获取（统一出口，各模块共用）
// ============================================

/**
 * 获取活动列表（统一出口）
 * @param {Object} options - { onInactive: 发现失效活动的回调 }
 * @returns {Array} 活动列表，每项包含完整信息
 */
export async function getActivities(options = {}) {
  const { onInactive } = options;
  const snap = await fetchAllActivities();
  const activities = [];
  
  snap.forEach(node => {
    const cfg = node.val().peizhi;
    if (!cfg) return;
    
    // 处理失效活动
    if (cfg.qiyong === false) {
      onInactive?.(node.key);
      return;
    }
    
    if (cfg.qiyong === true) {
      const tongji = node.val().tongji || {};
      activities.push({
        cid: node.key,
        name: cfg.mingcheng,
        keyword: cfg.guanjianzi,
        zongshu: cfg.zongshu,
        yizengsong: tongji.yizengsong || 0,
        dandian: cfg.dandian
      });
    }
  });
  
  return activities;
}

/**
 * 获取活动详情（包含药店统计）
 * @param {string} cid - 活动ID
 */
export async function getActivityDetail(cid) {
  const data = await fetchActivityById(cid);
  if (!data) return null;
  return {
    peizhi: data.peizhi || {},
    tongji: data.tongji || {},
    yaodian_tongji: data.yaodian_tongji || {}
  };
}

/**
 * 查询历史消息（内部函数）
 */
async function queryMessages(deviceId, filter) {
  const snap = await fetchAllActivities();
  const list = [];
  
  snap.forEach(node => {
    const peizhi = node.val().peizhi;
    if (!peizhi || peizhi.qiyong === false) return;
    
    const xiaoxi = node.val().xiaoxi || {};
    Object.entries(xiaoxi).forEach(([msgId, msgData]) => {
      if (msgData.start_sbid !== deviceId || !filter(msgData)) return;
      list.push({
        activityId: node.key,
        activityName: peizhi.mingcheng || '未知活动',
        msgId,
        msgData
      });
    });
  });
  
  return list;
}

/** 获取未读结果 */
export const fetchUnreadResults = deviceId => queryMessages(deviceId, msg =>
  ['成功', '失败', '部分成功'].includes(msg.status) && !msg.start_read && TimeUtil.isValid(msg.time_finish, TIME_LIMIT)
).then(list => list.sort((a, b) => TimeUtil.parse(a.msgData.time_finish) - TimeUtil.parse(b.msgData.time_finish)));

/** 获取待处理消息 */
export const fetchPendingMessages = deviceId => queryMessages(deviceId, msg =>
  msg.status === '待处理' && TimeUtil.isValid(msg.time_start, TIME_LIMIT)
);

/** 获取历史记录列表 */
export const fetchHistoryRecords = deviceId => queryMessages(deviceId, msg =>
  TimeUtil.isValid(msg.time_start || msg.time_finish, TIME_LIMIT)
).then(list => list.sort((a, b) => (TimeUtil.parse(b.msgData.time_start) || 0) - (TimeUtil.parse(a.msgData.time_start) || 0)));

/**
 * 获取单条记录（直接查询，不遍历所有）
 * @param {string} activityId - 活动ID
 * @param {string} msgId - 消息ID
 * @param {string} deviceId - 设备ID（用于验证权限）
 */
export async function getRecordById(activityId, msgId, deviceId) {
  const activityData = await fetchActivityById(activityId);
  if (!activityData) return null;
  
  const msgData = await fetchMessageById(activityId, msgId);
  if (!msgData || msgData.start_sbid !== deviceId) return null;
  
  return {
    activityId,
    activityName: activityData.peizhi?.mingcheng || '未知活动',
    msgId,
    msgData
  };
}

// ============================================
// 四、AI工具定义与执行
// ============================================

export const tools = [
  { name: 'get_activities', description: '获取活动列表', parameters: {} },
  { name: 'get_activity_detail', description: '获取活动配置详情', parameters: { activity_id: { type: 'string' } }, required: ['activity_id'] },
  { name: 'get_history_records', description: '获取历史发券记录列表', parameters: {} },
  { name: 'get_record_detail', description: '获取某条发券记录的详细结果', parameters: { 
    activity_id: { type: 'string', description: '活动ID' },
    msg_id: { type: 'string', description: '消息ID' }
  }, required: ['activity_id', 'msg_id'] }
];

export async function execute(name, args, context) {
  const { deviceId } = context;
  
  switch (name) {
    case 'get_activities': {
      const activities = await getActivities();
      // AI需要的字段格式
      return {
        success: true,
        count: activities.length,
        activities: activities.map(a => ({
          cid: a.cid,
          name: a.name,
          keyword: a.keyword,
          total: a.zongshu,
          sent: a.yizengsong,
          remaining: Math.max(0, a.zongshu - a.yizengsong),
          limit_per_store: a.dandian
        }))
      };
    }
    
    case 'get_activity_detail': {
      const detail = await getActivityDetail(args.activity_id);
      if (!detail) return { success: false, error: '活动不存在' };
      return {
        success: true,
        data: {
          name: detail.peizhi.mingcheng,
          total: detail.peizhi.zongshu,
          sent: detail.tongji.yizengsong || 0,
          limit_per_store: detail.peizhi.dandian
        }
      };
    }
    
    case 'get_history_records': {
      const records = await fetchHistoryRecords(deviceId);
      return {
        success: true,
        count: records.length,
        records: records.map(r => {
          const { successCount, failCount } = formatResultStats(r.msgData);
          return {
            activity_id: r.activityId,
            activity_name: r.activityName,
            msg_id: r.msgId,
            status: r.msgData.status,
            time_start: r.msgData.time_start,
            time_finish: r.msgData.time_finish || null,
            original_ids: r.msgData.zengsong_id,
            success_count: successCount,
            fail_count: failCount,
            summary: r.msgData.status === '待处理' ? '处理中' : `成功${successCount}个，失败${failCount}个`
          };
        })
      };
    }
    
    case 'get_record_detail': {
      const record = await getRecordById(args.activity_id, args.msg_id, deviceId);
      if (!record) return { success: false, error: '记录不存在' };
      
      const { successIds, failedGroups, successCount, failCount } = formatResultStats(record.msgData);
      const failDetails = Object.entries(failedGroups).map(([reason, ids]) => ({ reason, count: ids.length, ids }));
      
      return {
        success: true,
        data: {
          activity_id: record.activityId,
          activity_name: record.activityName,
          msg_id: record.msgId,
          status: record.msgData.status,
          time_start: record.msgData.time_start,
          time_finish: record.msgData.time_finish || null,
          start_device: record.msgData.start_sbid,
          finish_device: record.msgData.finish_sbid || null,
          original_ids: record.msgData.zengsong_id,
          success: { count: successCount, ids: successIds },
          failed: { count: failCount, groups: failDetails }
        }
      };
    }
  }
  
  return { success: false, error: '未知操作' };
}

// ============================================
// 五、账户凭证获取
// ============================================

/**
 * 获取最新的账户登录信息
 * 从zhanghu节点获取time_update最新的账户
 * @returns {Object|null} { token, cookies, providerIdM }
 */
export async function getLatestAuth() {
  try {
    const snap = await get(child(dbRef, 'zhanghu'));
    if (!snap.exists()) return null;
    
    let latestAuth = null;
    let latestTime = null;
    
    snap.forEach(node => {
      const data = node.val();
      const updateTime = data.time_update;
      
      // 比较时间，获取最新的
      if (!latestTime || updateTime > latestTime) {
        latestTime = updateTime;
        
        // 将cookies对象转换为字符串格式
        let cookiesStr = '';
        if (data.cookies && typeof data.cookies === 'object') {
          cookiesStr = Object.entries(data.cookies)
            .map(([key, value]) => `${key}=${value}`)
            .join('; ');
        } else if (typeof data.cookies === 'string') {
          cookiesStr = data.cookies;
        }
        
        latestAuth = {
          token: data.token,
          cookies: cookiesStr,
          providerIdM: data.provider_id_m || ''
        };
      }
    });
    
    return latestAuth;
  } catch (e) {
    console.error('获取账户凭证失败：', e);
    return null;
  }
}