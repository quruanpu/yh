// 应用启动器
import { initFingerprint, getDeviceId, getIPLocation, extractIds } from './gongyong/gongju.js';
import * as ai from './danaoji/hexin.js';
import * as gongju from './danaoji/gongju.js';
import * as shujuku from './yewu/shujuku.js';
import { getCurrentImage, clearCurrentImage } from './yewu/tupian.js';
import * as jiemian from './jiemian/jiaohui.js';
import { renderReport, renderActivityList } from './jiemian/xuanran.js';
import { extractCouponKeywords } from './yewu/faquan.js';

// 状态
let sessionPendingTasks = 0;
let aiRunning = false;

// 通知消息
function notify(html, type = 'sys', options = {}) {
  jiemian.addMessage(html, type, options);
}

// 显示活动卡片
async function showActivityCards() {
  try {
    // 使用统一接口获取活动，失效活动自动删除
    const activities = await shujuku.getActivities({
      onInactive: cid => shujuku.deleteInactive(cid)
    });
    notify(renderActivityList(activities, jiemian.getSelectedActivities().map(a => a.cid)));
    return { success: true, activities, count: activities.length };
  } catch (e) {
    notify(`❌ 获取失败：${e.message}`);
    return { success: false, error: e.message };
  }
}

// 显示报告
async function showReport(activityId, activityName, msgData, autoRefresh = true) {
  const detail = await shujuku.getActivityDetail(activityId);
  const activityInfo = detail ? {
    zongshu: detail.peizhi.zongshu,
    yizengsong: detail.tongji.yizengsong || 0,
    dandian: detail.peizhi.dandian,
    yaodian_tongji: detail.yaodian_tongji
  } : {};
  notify(renderReport(activityName, msgData, activityInfo));
  if (autoRefresh) await showActivityCards();
}

// 获取上下文信息
function getContextInfo() {
  const now = new Date();
  return `[时间：${now.toLocaleString('zh-CN')}]\n[设备：${getDeviceId()}]\n[已选活动：${jiemian.getSelectedActivities().length}]`;
}

// 获取发券上下文（AI和传统发券共用）
function getSendContext() {
  return {
    deviceId: getDeviceId(),
    notify,
    showReport,
    showActivityCards,
    showPending: jiemian.showPendingResult,
    removePending: jiemian.removePendingResult,
    get sessionPendingTasks() { return sessionPendingTasks; },
    set sessionPendingTasks(v) { sessionPendingTasks = v; }
  };
}

// 传统发券（走统一的发券逻辑）
async function handleTraditionalDispatch(activities, content) {
  // 提取选中活动的关键字
  const keywords = activities.map(a => a.keyword.split(/[,，]/)[0].trim());
  
  // 调用统一的发券执行器
  const result = await gongju.execute('send_coupons', {
    keywords,
    content
  });
  
  return result;
}

// 设置运行状态
function setRunning(running) {
  aiRunning = running;
  jiemian.setButtonState(running);
}

// 主分发
async function handleDispatch() {
  if (aiRunning) {
    ai.abort();
    setRunning(false);
    jiemian.showToast('已停止');
    return;
  }

  const content = jiemian.getInputText();
  const selectedActivities = jiemian.getSelectedActivities();

  // 先检查是否有内容
  const hasAttachments = document.getElementById('attachmentTags').children.length > 0;
  if (!content && !hasAttachments) return;

  jiemian.clearInput();

  // 获取附件
  const attachments = jiemian.getAndClearAttachments();
  const userImages = attachments.filter(a => a.type === 'image').map(a => a.data);
  const userFiles = attachments.filter(a => a.type === 'file').map(a => a.name);

  // ========================================
  // 流程1：有活动标签 → 传统发券
  // ========================================
  if (selectedActivities.length > 0) {
    notify(content.replace(/\n/g, '<br>') || '[附件]', 'user', { tags: selectedActivities, images: userImages, files: userFiles });
    jiemian.clearSelectedActivities();
    await handleTraditionalDispatch(selectedActivities, content);
    return;
  }

  // ========================================
  // 流程2：无活动标签 → 系统优先解析
  // ========================================
  
  // "活动"关键字 → 显示活动列表
  if (content === '活动') {
    notify(content, 'user');
    await showActivityCards();
    return;
  }

  // 系统解析：提取ID和优惠券关键字
  const ids = extractIds(content);
  const keywords = extractCouponKeywords(content);
  
  // 特殊标记（最低档、全套等）→ 交给AI
  const specialMarkers = ['__LOWEST__', '__HIGHEST__', '__ALL__'];
  const hasSpecialMarker = keywords.some(k => specialMarkers.includes(k));
  
  // 正常关键字（过滤掉特殊标记）
  const normalKeywords = keywords.filter(k => !specialMarkers.includes(k));

  // 有ID + 有正常关键字 + 无特殊标记 → 系统直接发券
  if (ids.length > 0 && normalKeywords.length > 0 && !hasSpecialMarker) {
    notify(content.replace(/\n/g, '<br>') || '[附件]', 'user', { images: userImages, files: userFiles });
    
    await gongju.execute('send_coupons', {
      keywords: normalKeywords,
      content: content
    });
    return;
  }

  // ========================================
  // 流程3：其他情况 → 交给AI处理
  // - 无ID
  // - 有ID但无关键字
  // - 有ID但有特殊标记（最低档、全套等）
  // ========================================
  notify(content.replace(/\n/g, '<br>') || '[附件]', 'user', { images: userImages, files: userFiles });

  setRunning(true);
  await handleAIChatWithAttachments(content, attachments);
}

// AI对话（带附件）
async function handleAIChatWithAttachments(content, attachments) {
  const featureTags = jiemian.getFeatureTags();
  const reply = jiemian.createReplyRow(featureTags.research);

  await ai.chat(content, {
    featureTags,
    getContextInfo,
    attachments,
    onThinking: reply.updateThinking,
    onContent: reply.updateContent,
    onToolCall: name => reply.updateToolCall(ai.getToolMessage(name)),
    onDone: text => {
      setRunning(false);
      jiemian.updateSelectedTags(!!getCurrentImage());
      reply.finish(text);
    },
    updateImageStatus: () => jiemian.updateSelectedTags(!!getCurrentImage())
  });
}

// 初始化
async function init() {
  try {
    // 初始化界面（最先，确保DOM元素可用）
    jiemian.init({
      onSend: handleDispatch,
      onClearImage: clearCurrentImage
    });

    // 初始化设备
    const deviceId = await initFingerprint();
    jiemian.setDeviceId(deviceId);

    // 获取IP位置（异步，不阻塞主流程）
    getIPLocation().then(location => {
      jiemian.setLocation(location);
    });

    // 初始化AI
    await ai.init();

    // 初始化工具上下文（使用统一的发券上下文）
    gongju.init({
      ...getSendContext(),
      updatePending: jiemian.updatePendingResult
    });

    // 处理离线消息
    const unreadList = await shujuku.fetchUnreadResults(deviceId);
    const pendingList = await shujuku.fetchPendingMessages(deviceId);

    jiemian.hideOverlay();

    if (unreadList.length > 0) {
      notify(`📬 ${unreadList.length}条离线结果：`);
      for (const { activityId, activityName, msgId, msgData } of unreadList) {
        await showReport(activityId, activityName, msgData, false);
        await shujuku.markAsRead(activityId, msgId);
      }
    }

    if (pendingList.length > 0) {
      notify(`📡 监听${pendingList.length}条任务...`);
      for (const { activityId, activityName, msgId } of pendingList) {
        sessionPendingTasks++;
        shujuku.listenMessage(`youhuiquan/${activityId}/xiaoxi/${msgId}`, async data => {
          await showReport(activityId, activityName, data, true);
          await shujuku.markAsRead(activityId, msgId);
          if (--sessionPendingTasks < 0) sessionPendingTasks = 0;
        });
      }
    }

    notify('👋 您好！我是Yt小助手，有什么可以帮您的？');
    await showActivityCards();
    jiemian.updateSelectedTags(!!getCurrentImage());

  } catch (e) {
    console.error('初始化失败：', e);
    jiemian.showError('初始化失败');
  }
}

window.onload = init;