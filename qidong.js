// 应用启动器
import { initFingerprint, getDeviceId, extractIds } from './gongyong/gongju.js';
import * as ai from './danaoji/hexin.js';
import * as gongju from './danaoji/gongju.js';
import * as shujuku from './yewu/shujuku.js';
import { executeSend } from './yewu/faquan.js';
import { getCurrentImage, clearCurrentImage } from './yewu/tupian.js';
import * as jiemian from './jiemian/jiaohui.js';
import { renderReport, renderActivityList } from './jiemian/xuanran.js';

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

// 传统发券（调用核心函数）
async function handleTraditionalDispatch(ids) {
  const activities = jiemian.getSelectedActivities();
  jiemian.clearSelectedActivities();

  if (!activities.length || !ids.length) {
    notify('⚠️ 缺少活动或ID');
    return;
  }

  await executeSend(activities, ids, getSendContext());
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

  // 先检查是否有内容（不清空附件，后面根据情况处理）
  const hasAttachments = document.getElementById('attachmentTags').children.length > 0;
  if (!content && !hasAttachments) return;

  jiemian.clearInput();

  // 有活动标签 → 传统发券
  if (selectedActivities.length > 0) {
    const attachments = jiemian.getAndClearAttachments();
    const userImages = attachments.filter(a => a.type === 'image').map(a => a.data);
    const userFiles = attachments.filter(a => a.type === 'file').map(a => a.name);

    notify(content.replace(/\n/g, '<br>') || '[附件]', 'user', { tags: selectedActivities, images: userImages, files: userFiles });

    const ids = extractIds(content);
    if (ids.length === 0) {
      jiemian.clearSelectedActivities();
      return notify('⚠️ 未识别到ID');
    }
    await handleTraditionalDispatch(ids);
    return;
  }

  // "活动"关键字
  if (content === '活动') {
    jiemian.getAndClearAttachments(); // 清空附件
    notify(content, 'user');
    await showActivityCards();
    return;
  }

  // AI模式 - 附件在handleAIChat中处理
  const attachments = jiemian.getAndClearAttachments();
  const userImages = attachments.filter(a => a.type === 'image').map(a => a.data);
  const userFiles = attachments.filter(a => a.type === 'file').map(a => a.name);
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

    notify('👋 您好！我是小Le，有什么可以帮您的？');
    await showActivityCards();
    jiemian.updateSelectedTags(!!getCurrentImage());

  } catch (e) {
    console.error('初始化失败：', e);
    jiemian.showError('初始化失败');
  }
}

window.onload = init;
