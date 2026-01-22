// 界面交互模块 - 完全重构版
import { getTime } from '../gongyong/gongju.js';
import { AVATAR_SYS, renderMessage, renderDetailContent, renderPendingResult, renderProductCard, renderProductDetailContent, renderLoginCard } from './xuanran.js';
import { readFileContent } from '../yewu/wenjian.js';
import * as denglu from '../yewu/denglu.js';

const $ = id => document.getElementById(id);
let elements = {};
let attachments = [];
let selectedActivities = [];
let featureTags = { research: false, genImage: false, webSearch: false };
let pendingResultRow = null;
let callbacks = {};

// 登录弹窗状态
let loginModalState = {
  system: null, // 'scm' | 'pms'
  step: 1,      // 1=账号密码, 2=二维码
  captchaBase64: null,
  qrcodeUrl: null,
  error: null
};

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
    actionLeft: document.querySelector('.action-left'),
    // 登录弹窗元素
    loginModal: $('loginModal'),
    loginModalBody: $('loginModalBody')
  };

  // 事件绑定
  elements.sendBtn.onclick = () => callbacks.onSend?.();
  elements.inputText.oninput = autoResize;

  // 键盘事件：电脑端 Enter 发送，Shift+Enter 换行；手机端保持默认
elements.inputText.onkeydown = e => {
  // 检测移动设备，移动端不处理，保持默认行为
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) return;
  
  // 电脑端：Enter 发送（非 Shift+Enter）
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();  // 阻止默认换行
    callbacks.onSend?.();
  }
  // Shift+Enter 不阻止，允许换行
};
  
  // 图片预览模态框 - 点击背景关闭，点击图片不关闭
  elements.imageModal.onclick = e => {
    if (e.target === elements.imageModal) {
      elements.imageModal.classList.remove('show');
    }
  };
  elements.imagePreview.onclick = e => e.stopPropagation();
  
  // 登录弹窗 - 点击背景关闭
  elements.loginModal.onclick = e => {
    if (e.target === elements.loginModal) {
      closeLoginModal();
    }
  };
  
  // 拖拽上传
  elements.inputPanel.ondragover = e => { e.preventDefault(); elements.inputPanel.classList.add('drag-over'); };
  elements.inputPanel.ondragleave = () => elements.inputPanel.classList.remove('drag-over');
  elements.inputPanel.ondrop = e => { e.preventDefault(); elements.inputPanel.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); };
  
  // 粘贴上传
  elements.inputText.onpaste = async e => {
    const files = [...(e.clipboardData?.items || [])].filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean);
    if (files.length) { e.preventDefault(); await handleFiles(files); }
  };
  
  // 文件选择
  elements.fileInput.onchange = e => handleFiles(e.target.files);

  // 全局方法
  window.showDetail = id => { elements.detailBody.innerHTML = renderDetailContent(id); elements.detailModal.classList.add('show'); };
  window.closeDetail = () => { elements.detailModal.classList.remove('show'); };
  window.showImagePreview = url => { elements.imagePreview.src = url; elements.imageModal.classList.add('show'); };
  window.toggleFeatureTag = tag => { featureTags[tag] = !featureTags[tag]; updateActionBar(); };
  window.removeAttachment = i => { attachments.splice(i, 1); updateAttachmentTags(); };
  window.clearCachedImage = () => { callbacks.onClearImage?.(); updateSelectedTags(); showToast('已清除缓存图片'); };
  window.triggerFileUpload = () => elements.fileInput.click();
  
  // 商品详情弹窗
  window.showProductDetail = id => {
    elements.detailBody.innerHTML = renderProductDetailContent(id);
    elements.detailModal.classList.add('show');
  };
  
  // 登录弹窗方法
  window.openLoginModal = openLoginModal;
  window.closeLoginModal = closeLoginModal;
  window.refreshCaptcha = refreshCaptcha;
  window.submitLoginStep1 = submitLoginStep1;
  window.refreshQrcode = refreshQrcode;
  
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
  
  // 检测是否为结果卡片、商品卡片或登录卡片
  const isReport = html.includes('report-card');
  const isProduct = html.includes('product-card');
  const isLogin = html.includes('login-card');
  
  if (isReport || isProduct || isLogin) {
    // 结果卡片/商品卡片/登录卡片：不使用bubble包装，直接渲染
    row.innerHTML = `${AVATAR_SYS}<div class="msg-content">${html}<div class="timestamp">${getTime()}</div></div>`;
  } else {
    // 普通消息：使用标准渲染
    row.innerHTML = renderMessage(html, type, options);
  }
  
  elements.msgArea.appendChild(row);
  
  requestAnimationFrame(() => {
    elements.msgArea.scrollTop = elements.msgArea.scrollHeight;
    if (!isReport && !isProduct && !isLogin) checkActivityLayout();
  });
}

/**
 * 添加商品卡片消息
 * @param {Object} product - 主要商品数据
 * @param {Array} allProducts - 所有商品列表
 */
export function addProductCard(product, allProducts) {
  const cardHtml = renderProductCard(product, allProducts);
  addMessage(cardHtml, 'sys');
}

/**
 * 添加登录卡片消息
 * @param {string} message - 提示消息
 */
export function addLoginCard(message) {
  const cardHtml = renderLoginCard(message);
  addMessage(cardHtml, 'sys');
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

// ============================================
// 登录弹窗功能
// ============================================

/**
 * 打开登录弹窗
 * @param {string} system - 'scm' | 'pms'
 */
async function openLoginModal(system) {
  if (system === 'pms') {
    showToast('PMS系统暂未开放');
    return;
  }
  
  loginModalState = {
    system,
    step: 1,
    captchaBase64: null,
    qrcodeUrl: null,
    error: null
  };
  
  // 重置登录模块状态
  denglu.resetLoginState();
  
  // 显示弹窗
  elements.loginModal.classList.add('show');
  
  // 渲染步骤1界面并加载验证码
  renderLoginStep1();
  await refreshCaptcha();
}

/**
 * 关闭登录弹窗
 */
function closeLoginModal() {
  elements.loginModal.classList.remove('show');
  denglu.stopPolling();
  denglu.resetLoginState();
  loginModalState = {
    system: null,
    step: 1,
    captchaBase64: null,
    qrcodeUrl: null,
    error: null
  };
}

/**
 * 渲染步骤1界面（账号密码）
 */
function renderLoginStep1() {
  const errorHtml = loginModalState.error 
    ? `<div class="login-error"><span class="login-error-icon">⚠️</span>${loginModalState.error}</div>` 
    : '';
  
  const captchaHtml = loginModalState.captchaBase64
    ? `<img src="${loginModalState.captchaBase64}" class="login-captcha-img" onclick="refreshCaptcha()" title="点击刷新验证码">`
    : `<div class="login-captcha-loading">加载中...</div>`;
  
  elements.loginModalBody.innerHTML = `
    <div class="login-steps">
      <div class="login-step active">
        <span class="login-step-num">1</span>
        <span>账号登录</span>
      </div>
      <span class="login-step-arrow">→</span>
      <div class="login-step">
        <span class="login-step-num">2</span>
        <span>企微扫码</span>
      </div>
    </div>
    
    ${errorHtml}
    
    <div class="login-form-group">
      <label class="login-form-label">账号</label>
      <input type="text" id="loginAccount" class="login-form-input" placeholder="请输入SCM账号" autocomplete="username">
    </div>
    
    <div class="login-form-group">
      <label class="login-form-label">密码</label>
      <input type="password" id="loginPassword" class="login-form-input" placeholder="请输入密码" autocomplete="current-password">
    </div>
    
    <div class="login-form-group">
      <label class="login-form-label">验证码</label>
      <div class="login-captcha-row">
        <input type="text" id="loginCaptcha" class="login-form-input" placeholder="请输入验证码" maxlength="6">
        ${captchaHtml}
      </div>
    </div>
    
    <button class="login-submit-btn" onclick="submitLoginStep1()">下一步</button>
  `;
  
  // 聚焦到账号输入框
  setTimeout(() => $('loginAccount')?.focus(), 100);
  
  // 回车提交
  ['loginAccount', 'loginPassword', 'loginCaptcha'].forEach(id => {
    const el = $(id);
    if (el) {
      el.onkeydown = e => {
        if (e.key === 'Enter') submitLoginStep1();
      };
    }
  });
}

/**
 * 刷新验证码
 */
async function refreshCaptcha() {
  loginModalState.captchaBase64 = null;
  loginModalState.error = null;
  
  // 更新验证码显示为加载状态
  const captchaContainer = document.querySelector('.login-captcha-row');
  if (captchaContainer) {
    const img = captchaContainer.querySelector('.login-captcha-img, .login-captcha-loading');
    if (img) {
      img.outerHTML = `<div class="login-captcha-loading">加载中...</div>`;
    }
  }
  
  const result = await denglu.getCaptcha();
  
  if (result.success) {
    loginModalState.captchaBase64 = result.captcha_base64;
    // 更新验证码图片
    const loading = document.querySelector('.login-captcha-loading');
    if (loading) {
      loading.outerHTML = `<img src="${result.captcha_base64}" class="login-captcha-img" onclick="refreshCaptcha()" title="点击刷新验证码">`;
    }
  } else {
    loginModalState.error = result.message || '获取验证码失败';
    renderLoginStep1();
  }
}

/**
 * 提交步骤1（账号密码登录）
 */
async function submitLoginStep1() {
  const account = $('loginAccount')?.value?.trim();
  const password = $('loginPassword')?.value;
  const captcha = $('loginCaptcha')?.value?.trim();
  
  if (!account) {
    loginModalState.error = '请输入账号';
    renderLoginStep1();
    return;
  }
  
  if (!password) {
    loginModalState.error = '请输入密码';
    renderLoginStep1();
    return;
  }
  
  if (!captcha) {
    loginModalState.error = '请输入验证码';
    renderLoginStep1();
    return;
  }
  
  // 禁用按钮
  const btn = document.querySelector('.login-submit-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '验证中...';
  }
  
  const result = await denglu.loginStep1(account, password, captcha);
  
  if (result.success) {
    // 进入步骤2
    loginModalState.step = 2;
    loginModalState.error = null;
    await renderLoginStep2();
  } else {
    loginModalState.error = result.info || '登录失败';
    // 刷新验证码
    await refreshCaptcha();
    renderLoginStep1();
  }
}

/**
 * 渲染步骤2界面（企微二维码）
 */
async function renderLoginStep2() {
  elements.loginModalBody.innerHTML = `
    <div class="login-steps">
      <div class="login-step done">
        <span class="login-step-num">✓</span>
        <span>账号登录</span>
      </div>
      <span class="login-step-arrow">→</span>
      <div class="login-step active">
        <span class="login-step-num">2</span>
        <span>企微扫码</span>
      </div>
    </div>
    
    <div class="login-qrcode-section">
      <div class="login-qrcode-tip">请使用企业微信扫描二维码完成验证</div>
      <div class="login-qrcode-container">
        <div class="login-qrcode-loading">
          <div class="pending-spin"></div>
          <span>加载二维码...</span>
        </div>
      </div>
      <div class="login-qrcode-status" id="qrcodeStatus">等待扫码...</div>
    </div>
  `;
  
  // 初始化二维码
  const qrResult = await denglu.initQrcode();
  
  if (qrResult.success) {
    // 显示二维码
    const container = document.querySelector('.login-qrcode-container');
    if (container) {
      // 优先使用直连URL
      const qrcodeUrl = qrResult.qrcode_url;
      container.innerHTML = `<img src="${qrcodeUrl}" class="login-qrcode-img" onerror="this.src='${qrResult.qrcode_proxy_url || qrcodeUrl}'">`;
    }
    
    // 开始轮询
    denglu.startPolling(
      // 状态变化回调
      (status, message) => {
        const statusEl = $('qrcodeStatus');
        if (statusEl) {
          statusEl.textContent = message;
          statusEl.className = 'login-qrcode-status';
          if (status === 'scanned') {
            statusEl.classList.add('success');
          }
        }
      },
      // 扫码成功回调
      async (authCode) => {
        const statusEl = $('qrcodeStatus');
        if (statusEl) {
          statusEl.textContent = '扫码成功，正在完成登录...';
          statusEl.className = 'login-qrcode-status success';
        }
        
        // 完成登录
        const result = await denglu.completeLogin(authCode);
        
        if (result.success) {
          // 显示成功界面
          renderLoginSuccess(result.message);
          
          // 2秒后关闭弹窗
          setTimeout(() => {
            closeLoginModal();
            showToast('登录成功！');
          }, 2000);
        } else {
          // 显示错误
          if (statusEl) {
            statusEl.textContent = result.message || '登录失败';
            statusEl.className = 'login-qrcode-status error';
          }
          
          // 显示刷新按钮
          const container = document.querySelector('.login-qrcode-section');
          if (container && !container.querySelector('.login-qrcode-refresh')) {
            container.insertAdjacentHTML('beforeend', `
              <button class="login-qrcode-refresh" onclick="refreshQrcode()">🔄 刷新二维码</button>
            `);
          }
        }
      },
      // 错误回调
      (message) => {
        const statusEl = $('qrcodeStatus');
        if (statusEl) {
          statusEl.textContent = message;
          statusEl.className = 'login-qrcode-status error';
        }
        
        // 显示刷新按钮
        const container = document.querySelector('.login-qrcode-section');
        if (container && !container.querySelector('.login-qrcode-refresh')) {
          container.insertAdjacentHTML('beforeend', `
            <button class="login-qrcode-refresh" onclick="refreshQrcode()">🔄 刷新二维码</button>
          `);
        }
      }
    );
  } else {
    // 二维码初始化失败
    const container = document.querySelector('.login-qrcode-container');
    if (container) {
      container.innerHTML = `<div class="login-qrcode-loading"><span>❌ ${qrResult.message || '加载失败'}</span></div>`;
    }
    
    // 显示刷新按钮
    const section = document.querySelector('.login-qrcode-section');
    if (section) {
      section.insertAdjacentHTML('beforeend', `
        <button class="login-qrcode-refresh" onclick="refreshQrcode()">🔄 重试</button>
      `);
    }
  }
}

/**
 * 刷新二维码
 */
async function refreshQrcode() {
  denglu.stopPolling();
  await renderLoginStep2();
}

/**
 * 渲染登录成功界面
 */
function renderLoginSuccess(message) {
  elements.loginModalBody.innerHTML = `
    <div class="login-success">
      <div class="login-success-icon">✅</div>
      <div class="login-success-text">${message || '登录成功'}</div>
      <div class="login-success-subtext">即将自动关闭...</div>
    </div>
  `;
}
