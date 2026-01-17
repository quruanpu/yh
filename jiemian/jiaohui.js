// 界面交互模块
import { getTime } from '../gongyong/gongju.js';
import { AVATAR_SYS, renderMessage, renderDetailContent, renderPendingResult } from './xuanran.js';
import { readFileContent } from '../yewu/wenjian.js';

// DOM元素缓存
const $ = id => document.getElementById(id);
let elements = {};

// 状态
let attachments = [];
let selectedActivities = [];
let featureTags = { research: false, genImage: false, webSearch: false };
let pendingResultRow = null;

// 回调
let callbacks = {};

// 初始化
export function init(cbs) {
  callbacks = cbs;
  elements = {
    overlay: $('initOverlay'),
    msgArea: $('msgArea'),
    inputText: $('inputText'),
    sendBtn: $('sendBtn'),
    selectedTagsEl: $('selectedTags'),
    attachmentTagsEl: $('attachmentTags'),
    toastEl: $('toast'),
    detailModal: $('detailModal'),
    detailBody: $('detailBody'),
    imageModal: $('imageModal'),
    imagePreview: $('imagePreview'),
    deviceIdDisplay: $('deviceIdDisplay'),
    inputPanel: $('inputPanel'),
    imageInput: $('imageInput'),
    fileInput: $('fileInput')
  };

  setupEvents();
  setupGlobalMethods();
}

// 设置事件
function setupEvents() {
  elements.sendBtn.onclick = () => callbacks.onSend?.();
  elements.inputText.onkeydown = e => {
    if (e.keyCode === 13 && !e.shiftKey) {
      e.preventDefault();
      callbacks.onSend?.();
    }
  };

  elements.detailModal.onclick = e => { if (e.target === elements.detailModal) closeDetail(); };

  // 拖拽
  elements.inputPanel.ondragover = e => { e.preventDefault(); elements.inputPanel.classList.add('drag-over'); };
  elements.inputPanel.ondragleave = () => elements.inputPanel.classList.remove('drag-over');
  elements.inputPanel.ondrop = e => {
    e.preventDefault();
    elements.inputPanel.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  };

  // 粘贴
  elements.inputText.onpaste = async e => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      await handleFiles(files);
    }
  };

  // 文件选择
  elements.imageInput.onchange = e => handleFiles(e.target.files);
  elements.fileInput.onchange = e => handleFiles(e.target.files);

  // 上传按钮
  const uploadBtn = $('uploadBtn');
  if (uploadBtn) uploadBtn.onclick = () => elements.fileInput.click();
}

// 设置全局方法
function setupGlobalMethods() {
  window.showDetail = id => { elements.detailBody.innerHTML = renderDetailContent(id); elements.detailModal.classList.add('show'); };
  window.closeDetail = () => elements.detailModal.classList.remove('show');
  window.showImagePreview = url => { elements.imagePreview.src = url; elements.imageModal.classList.add('show'); };
  window.closeImagePreview = () => elements.imageModal.classList.remove('show');
  elements.imageModal.onclick = closeImagePreview;

  window.toggleFeatureTag = tag => {
    featureTags[tag] = !featureTags[tag];
    updateSelectedTags();
  };

  window.removeSelectedTag = i => { selectedActivities.splice(i, 1); updateSelectedTags(); };
  window.removeAttachment = i => { attachments.splice(i, 1); updateAttachmentTags(); updateSelectedTags(); };
  window.clearCachedImage = () => { callbacks.onClearImage?.(); updateSelectedTags(); showToast('已清除缓存图片'); };

  window.addActivityTag = (name, keyword, cid) => {
    if (selectedActivities.some(a => a.cid === cid)) {
      showToast('已添加');
      return;
    }
    selectedActivities.push({ name, keyword, cid });
    updateSelectedTags();
    elements.inputText.focus();
  };
}

// 文件处理
async function handleFiles(files) {
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => {
        attachments.push({ type: 'image', name: file.name, data: e.target.result });
        updateAttachmentTags();
      };
      reader.readAsDataURL(file);
    } else {
      const content = await readFileContent(file);
      attachments.push({ type: 'file', name: file.name, content });
      updateAttachmentTags();
    }
  }
}

// 更新标签栏
export function updateSelectedTags(hasImage = false) {
  let html = '';

  // 功能标签：研究
  const researchClass = featureTags.research ? 'feature-tag active' : 'feature-tag';
  html += `<div class="${researchClass}" onclick="toggleFeatureTag('research')">🔬 研究</div>`;

  // 功能标签：生图
  const genImageClass = featureTags.genImage ? 'feature-tag active' : 'feature-tag';
  html += `<div class="${genImageClass}" onclick="toggleFeatureTag('genImage')">🎨 生图</div>`;

  // 功能标签：网络
  const webSearchClass = featureTags.webSearch ? 'feature-tag active' : 'feature-tag';
  html += `<div class="${webSearchClass}" onclick="toggleFeatureTag('webSearch')">🌐 网络</div>`;

  // 缓存图片标签
  if (hasImage && attachments.filter(a => a.type === 'image').length === 0) {
    html += `<div class="selected-tag image-cached" onclick="clearCachedImage()" title="点击清除">
      <span>🖼️</span><span class="tag-name">图片可用</span><span class="tag-close">×</span>
    </div>`;
  }

  // 活动标签
  selectedActivities.forEach((item, i) => {
    html += `<div class="selected-tag" onclick="removeSelectedTag(${i})">
      <span>🎁</span><span class="tag-name">${item.name}</span><span class="tag-close">×</span>
    </div>`;
  });

  elements.selectedTagsEl.innerHTML = html;
}

// 更新附件标签
function updateAttachmentTags() {
  if (attachments.length === 0) {
    elements.attachmentTagsEl.innerHTML = '';
    return;
  }

  elements.attachmentTagsEl.innerHTML = attachments.map((att, i) => {
    if (att.type === 'image') {
      return `<div class="attachment-tag">
        <img src="${att.data}">
        <span class="att-name">${att.name}</span>
        <span class="att-close" onclick="removeAttachment(${i})">×</span>
      </div>`;
    } else {
      const ext = att.name.split('.').pop().toLowerCase();
      let icon = '📄';
      if (ext === 'xlsx' || ext === 'xls') icon = '📊';
      else if (ext === 'csv') icon = '📋';
      else if (ext === 'pdf') icon = '📕';
      else if (ext === 'json') icon = '🔧';

      return `<div class="attachment-tag"><span>${icon}</span><span class="att-name">${att.name}</span><span class="att-close" onclick="removeAttachment(${i})">×</span></div>`;
    }
  }).join('');
}

// Toast
export function showToast(msg, duration = 1500) {
  elements.toastEl.textContent = msg;
  elements.toastEl.classList.add('show');
  setTimeout(() => elements.toastEl.classList.remove('show'), duration);
}

// 隐藏加载遮罩
export function hideOverlay() {
  elements.overlay.classList.add('hidden');
  elements.inputText.disabled = false;
  elements.sendBtn.disabled = false;
}

// 显示错误
export function showError(msg) {
  document.querySelector('.init-text').textContent = msg;
  document.querySelector('.init-subtext').textContent = '请刷新重试';
}

// 设置设备ID显示
export function setDeviceId(id) {
  elements.deviceIdDisplay.textContent = id;
}

// 添加消息
export function addMessage(html, type, options = {}) {
  const row = document.createElement('div');
  row.className = `msg-row ${type === 'sys' ? 'msg-left' : 'msg-right'}`;
  row.innerHTML = renderMessage(html, type, options);
  elements.msgArea.appendChild(row);
  setTimeout(() => elements.msgArea.scrollTop = elements.msgArea.scrollHeight, 100);
}

// 创建AI回复行
export function createReplyRow(withThinking = false) {
  let thinkingEl = null;

  if (withThinking) {
    const thinkingRow = document.createElement('div');
    thinkingRow.className = 'msg-row msg-left';
    thinkingRow.innerHTML = `${AVATAR_SYS}<div class="msg-content"><div class="thinking-bubble"><div class="thinking-header" onclick="this.parentElement.classList.toggle('collapsed')"><span>🧠</span><span class="thinking-title">思考中...</span><span class="thinking-toggle">▼</span></div><div class="thinking-body"></div></div></div>`;
    elements.msgArea.appendChild(thinkingRow);
    thinkingEl = thinkingRow.querySelector('.thinking-body');
  }

  const replyRow = document.createElement('div');
  replyRow.className = 'msg-row msg-left';
  replyRow.innerHTML = `${AVATAR_SYS}<div class="msg-content"><div class="bubble"><span class="typing-cursor">▍</span></div><div class="timestamp">${getTime()}</div></div>`;
  elements.msgArea.appendChild(replyRow);

  const replyEl = replyRow.querySelector('.bubble');
  elements.msgArea.scrollTop = elements.msgArea.scrollHeight;

  return {
    updateThinking: text => {
      if (thinkingEl) {
        thinkingEl.innerHTML = text.replace(/\n/g, '<br>');
        thinkingEl.parentElement.querySelector('.thinking-title').textContent = '思考过程';
        elements.msgArea.scrollTop = elements.msgArea.scrollHeight;
      }
    },
    updateContent: text => {
      replyEl.innerHTML = text.replace(/\n/g, '<br>') + '<span class="typing-cursor">▍</span>';
      elements.msgArea.scrollTop = elements.msgArea.scrollHeight;
    },
    updateToolCall: name => {
      replyEl.innerHTML = `<span class="tool-status">${name}</span><span class="typing-cursor">▍</span>`;
      elements.msgArea.scrollTop = elements.msgArea.scrollHeight;
    },
    finish: text => {
      if (text && text.trim()) replyEl.innerHTML = text.replace(/\n/g, '<br>');
      else replyRow.remove();
    }
  };
}

// 设置按钮状态
export function setButtonState(running) {
  elements.sendBtn.textContent = running ? '停止' : '确认';
  elements.sendBtn.classList.toggle('running', running);
}

// 获取输入内容
export function getInputText() {
  return elements.inputText.value.trim();
}

// 清空输入
export function clearInput() {
  elements.inputText.value = '';
}

// 获取并清空附件
export function getAndClearAttachments() {
  const current = [...attachments];
  attachments = [];
  updateAttachmentTags();
  return current;
}

// 获取选中的活动
export function getSelectedActivities() {
  return [...selectedActivities];
}

// 清空选中的活动
export function clearSelectedActivities() {
  selectedActivities = [];
  updateSelectedTags();
}

// 获取功能标签状态
export function getFeatureTags() {
  return { ...featureTags };
}

// 清除功能标签
export function clearFeatureTags() {
  featureTags = { research: false, genImage: false, webSearch: false };
  updateSelectedTags();
}

// 滚动到底部
export function scrollToBottom() {
  elements.msgArea.scrollTop = elements.msgArea.scrollHeight;
}

// 显示等待结果提示
export function showPendingResult(total, done = 0) {
  if (!pendingResultRow) {
    pendingResultRow = document.createElement('div');
    pendingResultRow.className = 'msg-row msg-left pending-row';
    pendingResultRow.innerHTML = `${AVATAR_SYS}<div class="msg-content">
      <div class="pending-container"></div>
    </div>`;
    elements.msgArea.appendChild(pendingResultRow);
  }
  pendingResultRow.querySelector('.pending-container').innerHTML = renderPendingResult(total, done);
  elements.msgArea.scrollTop = elements.msgArea.scrollHeight;
}

// 更新等待结果进度
export function updatePendingResult(total, done) {
  if (pendingResultRow) {
    pendingResultRow.querySelector('.pending-container').innerHTML = renderPendingResult(total, done);
  }
}

// 移除等待结果提示
export function removePendingResult() {
  if (pendingResultRow) {
    pendingResultRow.remove();
    pendingResultRow = null;
  }
}