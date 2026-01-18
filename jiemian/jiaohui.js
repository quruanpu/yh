// 界面交互模块 - 完全重构版
import { getTime } from '../gongyong/gongju.js';
import { AVATAR_SYS, renderMessage, renderDetailContent, renderPendingResult } from './xuanran.js';
import { readFileContent } from '../yewu/wenjian.js';

const $ = id => document.getElementById(id);
let elements = {};
let attachments = [];
let selectedActivities = [];
let featureTags = { research: false, genImage: false, webSearch: false };
let pendingResultRow = null;
let callbacks = {};

// 检测并设置活动列表布局
function checkActivityLayout() {
  const lists = document.querySelectorAll('.activity-list:not([data-checked])');
  lists.forEach(list => {
    list.setAttribute('data-checked', '1');
    const names = list.querySelectorAll('.item-name');
    if (!names.length) return;
    list.classList.remove('single-column');
    requestAnimationFrame(() => {
      const hasOverflow = [...names].some(el => el.scrollWidth > el.clientWidth);
      if (hasOverflow) list.classList.add('single-column');
    });
  });
}

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
    locationDisplay: $('locationDisplay'),
    inputPanel: $('inputPanel'),
    fileInput: $('fileInput'),
    actionLeft: document.querySelector('.action-left')
  };

  // 事件绑定
  elements.sendBtn.onclick = () => callbacks.onSend?.();
  elements.inputText.oninput = autoResize;
  elements.imageModal.onclick = () => { elements.imageModal.classList.remove('show'); };
  elements.inputPanel.ondragover = e => { e.preventDefault(); elements.inputPanel.classList.add('drag-over'); };
  elements.inputPanel.ondragleave = () => elements.inputPanel.classList.remove('drag-over');
  elements.inputPanel.ondrop = e => { e.preventDefault(); elements.inputPanel.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); };
  elements.inputText.onpaste = async e => {
    const files = [...(e.clipboardData?.items || [])].filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean);
    if (files.length) { e.preventDefault(); await handleFiles(files); }
  };
  elements.fileInput.onchange = e => handleFiles(e.target.files);

  // 全局方法
  window.showDetail = id => { elements.detailBody.innerHTML = renderDetailContent(id); elements.detailModal.classList.add('show'); };
  window.closeDetail = () => { elements.detailModal.classList.remove('show'); };
  window.showImagePreview = url => { elements.imagePreview.src = url; elements.imageModal.classList.add('show'); };
  window.toggleFeatureTag = tag => { featureTags[tag] = !featureTags[tag]; updateActionBar(); };
  window.removeAttachment = i => { attachments.splice(i, 1); updateAttachmentTags(); };
  window.clearCachedImage = () => { callbacks.onClearImage?.(); updateSelectedTags(); showToast('已清除缓存图片'); };
  window.triggerFileUpload = () => elements.fileInput.click();
  
  window.toggleActivityTag = (name, keyword, cid) => {
    const index = selectedActivities.findIndex(a => a.cid === cid);
    const card = document.querySelector(`.activity-item[data-cid="${cid}"]`);
    if (index >= 0) {
      selectedActivities.splice(index, 1);
      card?.classList.remove('selected');
    } else {
      selectedActivities.push({ name, keyword, cid });
      card?.classList.add('selected');
    }
    updateSelectedTags();
    elements.inputText.focus();
  };
  
  window.removeSelectedTag = i => {
    const cid = selectedActivities[i]?.cid;
    selectedActivities.splice(i, 1);
    updateSelectedTags();
    document.querySelector(`.activity-item[data-cid="${cid}"]`)?.classList.remove('selected');
  };

  updateActionBar();
  
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      document.querySelectorAll('.activity-list[data-checked]').forEach(list => list.removeAttribute('data-checked'));
      checkActivityLayout();
    }, 100);
  });
}

function autoResize() {
  const t = elements.inputText;
  t.style.height = '20px';
  t.style.height = Math.min(t.scrollHeight, 100) + 'px';
  t.classList.toggle('expanded', t.scrollHeight > 100);
}

async function handleFiles(files) {
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => { attachments.push({ type: 'image', name: file.name, data: e.target.result }); updateAttachmentTags(); };
      reader.readAsDataURL(file);
    } else {
      attachments.push({ type: 'file', name: file.name, content: await readFileContent(file) });
      updateAttachmentTags();
    }
  }
}

function updateActionBar() {
  const tag = (key, icon) => `<div class="feature-tag${featureTags[key] ? ' active' : ''}" onclick="toggleFeatureTag('${key}')">${icon}</div>`;
  elements.actionLeft.innerHTML = tag('research', '🔬') + tag('genImage', '🎨') + tag('webSearch', '🌐') +
    `<button type="button" class="icon-btn" onclick="triggerFileUpload()" title="上传文件"><img src="svg/shangchuan.svg" alt="上传"></button>`;
}

export function updateSelectedTags(hasImage = false) {
  let html = '';
  if (hasImage && !attachments.some(a => a.type === 'image')) {
    html += `<div class="selected-tag image-cached" onclick="clearCachedImage()" title="点击清除"><span>🖼️</span><span class="tag-name">图片可用</span><span class="tag-close">×</span></div>`;
  }
  selectedActivities.forEach((item, i) => {
    html += `<div class="selected-tag" onclick="removeSelectedTag(${i})"><span>🎁</span><span class="tag-name">${item.name}</span><span class="tag-close">×</span></div>`;
  });
  elements.selectedTagsEl.innerHTML = html;
}

function updateAttachmentTags() {
  const icons = { xlsx: '📊', xls: '📊', csv: '📋', pdf: '📕', json: '🔧' };
  elements.attachmentTagsEl.innerHTML = attachments.map((att, i) => {
    const icon = att.type === 'image' ? `<img src="${att.data}">` : `<span>${icons[att.name.split('.').pop().toLowerCase()] || '📄'}</span>`;
    return `<div class="attachment-tag">${icon}<span class="att-name">${att.name}</span><span class="att-close" onclick="removeAttachment(${i})">×</span></div>`;
  }).join('');
}

export function showToast(msg, duration = 1500) {
  elements.toastEl.textContent = msg;
  elements.toastEl.classList.add('show');
  setTimeout(() => elements.toastEl.classList.remove('show'), duration);
}

export function hideOverlay() {
  elements.overlay.classList.add('hidden');
  elements.inputText.disabled = false;
  elements.sendBtn.disabled = false;
}

export function showError(msg) {
  document.querySelector('.init-text').textContent = msg;
  document.querySelector('.init-subtext').textContent = '请刷新重试';
}

export function setDeviceId(id) { elements.deviceIdDisplay.textContent = id; }

export function setLocation(location) {
  if (location) {
    const text = `${location.country} ${location.region} ${location.city} · ${location.isp}`;
    elements.locationDisplay.textContent = text;
  } else {
    elements.locationDisplay.textContent = '定位失败';
  }
}

/**
 * 添加消息 - 完全重构版
 * 
 * 关键改动：
 * 结果卡片(.report-card)不再被.bubble包装，直接作为.msg-content的子元素
 * 这彻底避免了.bubble样式的干扰
 */
export function addMessage(html, type, options = {}) {
  const row = document.createElement('div');
  row.className = `msg-row ${type === 'sys' ? 'msg-left' : 'msg-right'}`;
  
  // 检测是否为结果卡片
  const isReport = html.includes('report-card');
  
  if (isReport) {
    // 结果卡片：不使用bubble包装，直接渲染
    row.innerHTML = `${AVATAR_SYS}<div class="msg-content">${html}<div class="timestamp">${getTime()}</div></div>`;
  } else {
    // 普通消息：使用标准渲染
    row.innerHTML = renderMessage(html, type, options);
  }
  
  elements.msgArea.appendChild(row);
  
  requestAnimationFrame(() => {
    elements.msgArea.scrollTop = elements.msgArea.scrollHeight;
    if (!isReport) checkActivityLayout();
  });
}

/**
 * 创建回复行 - 重构版
 * 
 * 关键改动：
 * 始终创建思考气泡结构，但默认隐藏
 * 当有思考内容时自动显示，支持AI自主调用deep_think
 */
export function createReplyRow(withThinking = false) {
  // 始终创建思考气泡，但默认隐藏（除非预先指定需要）
  const thinkingRow = document.createElement('div');
  thinkingRow.className = 'msg-row msg-left';
  thinkingRow.innerHTML = `${AVATAR_SYS}<div class="msg-content"><div class="thinking-bubble"><div class="thinking-header" onclick="this.parentElement.classList.toggle('collapsed')"><span>🧠</span><span class="thinking-title">思考中...</span><span class="thinking-toggle">▼</span></div><div class="thinking-body"></div></div></div>`;
  
  // 默认隐藏，除非预先指定需要显示
  if (!withThinking) {
    thinkingRow.style.display = 'none';
  }
  
  elements.msgArea.appendChild(thinkingRow);
  const thinkingEl = thinkingRow.querySelector('.thinking-body');
  const thinkingTitle = thinkingRow.querySelector('.thinking-title');

  // 创建回复气泡
  const replyRow = document.createElement('div');
  replyRow.className = 'msg-row msg-left';
  replyRow.innerHTML = `${AVATAR_SYS}<div class="msg-content"><div class="bubble"><span class="typing-cursor">▍</span></div><div class="timestamp">${getTime()}</div></div>`;
  elements.msgArea.appendChild(replyRow);
  const replyEl = replyRow.querySelector('.bubble');
  elements.msgArea.scrollTop = elements.msgArea.scrollHeight;

  const scroll = () => elements.msgArea.scrollTop = elements.msgArea.scrollHeight;
  
  return {
    // 更新思考内容 - 有内容时自动显示思考气泡
    updateThinking: text => {
      if (text) {
        // 有内容时显示思考气泡
        thinkingRow.style.display = '';
        thinkingEl.innerHTML = text.replace(/\n/g, '<br>');
        thinkingTitle.textContent = '思考过程';
        scroll();
      }
    },
    // 更新回复内容
    updateContent: text => {
      replyEl.innerHTML = text.replace(/\n/g, '<br>') + '<span class="typing-cursor">▍</span>';
      scroll();
    },
    // 更新工具调用状态
    updateToolCall: name => {
      replyEl.innerHTML = `<span class="tool-status">${name}</span><span class="typing-cursor">▍</span>`;
      scroll();
    },
    // 完成回复
    finish: text => {
      // 如果思考气泡没有内容，移除它
      if (!thinkingEl.innerHTML.trim()) {
        thinkingRow.remove();
      }
      // 处理回复内容
      if (text?.trim()) {
        replyEl.innerHTML = text.replace(/\n/g, '<br>');
      } else {
        replyRow.remove();
      }
    }
  };
}

export function setButtonState(running) {
  elements.sendBtn.textContent = running ? '停止' : '确认';
  elements.sendBtn.classList.toggle('running', running);
}

export function getInputText() { return elements.inputText.value.trim(); }

export function clearInput() {
  elements.inputText.value = '';
  elements.inputText.style.height = '20px';
  elements.inputText.classList.remove('expanded');
  elements.inputText.blur();
  setTimeout(() => elements.inputText.focus(), 10);
}

export function getAndClearAttachments() {
  const current = [...attachments];
  attachments = [];
  updateAttachmentTags();
  return current;
}

export function getSelectedActivities() { return [...selectedActivities]; }
export function clearSelectedActivities() {
  selectedActivities.forEach(a => {
    document.querySelector(`.activity-item[data-cid="${a.cid}"]`)?.classList.remove('selected');
  });
  selectedActivities = [];
  updateSelectedTags();
}
export function getFeatureTags() { return { ...featureTags }; }
export function clearFeatureTags() { featureTags = { research: false, genImage: false, webSearch: false }; updateActionBar(); }
export function scrollToBottom() { elements.msgArea.scrollTop = elements.msgArea.scrollHeight; }

export function showPendingResult(total, done = 0) {
  if (!pendingResultRow) {
    pendingResultRow = document.createElement('div');
    pendingResultRow.className = 'msg-row msg-left pending-row';
    pendingResultRow.innerHTML = `${AVATAR_SYS}<div class="msg-content"><div class="pending-container"></div></div>`;
    elements.msgArea.appendChild(pendingResultRow);
  }
  pendingResultRow.querySelector('.pending-container').innerHTML = renderPendingResult(total, done);
  elements.msgArea.scrollTop = elements.msgArea.scrollHeight;
}

export function updatePendingResult(total, done) {
  pendingResultRow?.querySelector('.pending-container')?.replaceChildren();
  pendingResultRow?.querySelector('.pending-container')?.insertAdjacentHTML('beforeend', renderPendingResult(total, done));
}

export function removePendingResult() {
  pendingResultRow?.remove();
  pendingResultRow = null;
}