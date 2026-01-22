// 登录模块 - 药师帮SCM系统登录
// 支持账号密码 + 企微扫码二次验证

import * as shujuku from './shujuku.js';

// ============================================
// API配置
// ============================================
const LOGIN_API_BASE = 'https://1317825751-7n6chwizun.ap-guangzhou.tencentscf.com';

// 登录状态
let loginState = {
  step: 'idle', // idle, captcha, step1, qrcode, polling, step2, done
  account: '',
  cookies: null,
  webKey: '',
  clientKey: '',
  lastStatus: 'QRCODE_SCAN_NEVER',
  openDataSid: null,
  pollingTimer: null,
  onStatusChange: null,
  onError: null,
  onSuccess: null
};

// ============================================
// 工具函数
// ============================================

async function api(path, options = {}) {
  const fetchOptions = {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...options.headers }
  };
  
  // 只有在有body时才添加
  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }
  
  try {
    const response = await fetch(LOGIN_API_BASE + path, fetchOptions);
    
    // 获取响应文本
    const text = await response.text();
    
    // 检查是否为空响应
    if (!text || text.trim() === '') {
      console.error(`[denglu.api] 空响应: ${path}, status: ${response.status}`);
      return { success: false, message: '服务器返回空响应' };
    }
    
    // 尝试解析JSON
    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error(`[denglu.api] JSON解析失败: ${path}`, text.slice(0, 200));
      return { success: false, message: `响应解析失败: ${text.slice(0, 100)}` };
    }
  } catch (fetchError) {
    console.error(`[denglu.api] 请求失败: ${path}`, fetchError);
    return { success: false, message: `网络请求失败: ${fetchError.message}` };
  }
}

// ============================================
// 登录流程函数
// ============================================

/**
 * 获取验证码
 * @returns {Object} { success, captcha_base64, cookies, message }
 */
export async function getCaptcha() {
  try {
    const result = await api('/captcha');
    if (result.success) {
      loginState.cookies = result.cookies;
      loginState.step = 'captcha';
    }
    return result;
  } catch (e) {
    console.error('[denglu.getCaptcha] 错误:', e);
    return { success: false, message: `获取验证码失败：${e.message}` };
  }
}

/**
 * 账号密码登录（第一步）
 * @param {string} account - 账号
 * @param {string} password - 密码
 * @param {string} captcha - 验证码
 * @returns {Object} { success, status, info, cookies }
 */
export async function loginStep1(account, password, captcha) {
  if (!loginState.cookies) {
    return { success: false, info: '请先获取验证码' };
  }
  
  try {
    const result = await api('/login/step1', {
      method: 'POST',
      body: {
        account,
        password,
        captcha,
        cookies: loginState.cookies
      }
    });
    
    if (result.success) {
      loginState.account = account;
      loginState.cookies = result.cookies;
      loginState.step = 'step1';
    }
    
    return result;
  } catch (e) {
    console.error('[denglu.loginStep1] 错误:', e);
    return { success: false, info: `登录请求失败：${e.message}` };
  }
}

/**
 * 初始化企微二维码
 * @returns {Object} { success, web_key, qrcode_url, qrcode_proxy_url, message }
 */
export async function initQrcode() {
  if (!loginState.account) {
    return { success: false, message: '请先完成账号密码登录' };
  }
  
  try {
    const result = await api('/qrcode/init', {
      method: 'POST',
      body: { account: loginState.account }
    });
    
    if (result.success) {
      loginState.webKey = result.web_key;
      loginState.clientKey = result.client_key;
      loginState.lastStatus = 'QRCODE_SCAN_NEVER';
      loginState.openDataSid = null;
      loginState.step = 'qrcode';
    }
    
    return result;
  } catch (e) {
    console.error('[denglu.initQrcode] 错误:', e);
    return { success: false, message: `获取二维码失败：${e.message}` };
  }
}

/**
 * 查询扫码状态（单次）
 * @returns {Object} { success, status, auth_code, open_data_sid }
 */
export async function checkQrcodeStatus() {
  if (!loginState.webKey) {
    return { success: false, status: 'ERROR', message: '二维码未初始化' };
  }
  
  try {
    const result = await api('/qrcode/status', {
      method: 'POST',
      body: {
        web_key: loginState.webKey,
        last_status: loginState.lastStatus,
        open_data_sid: loginState.openDataSid
      }
    });
    
    if (result.success) {
      loginState.lastStatus = result.status;
      if (result.open_data_sid) {
        loginState.openDataSid = result.open_data_sid;
      }
    }
    
    return result;
  } catch (e) {
    console.error('[denglu.checkQrcodeStatus] 错误:', e);
    return { success: false, status: 'ERROR', message: `查询状态失败：${e.message}` };
  }
}

/**
 * 开始轮询扫码状态
 * @param {Function} onStatusChange - 状态变化回调 (status, message)
 * @param {Function} onSuccess - 扫码成功回调 (authCode)
 * @param {Function} onError - 错误回调 (message)
 */
export function startPolling(onStatusChange, onSuccess, onError) {
  loginState.onStatusChange = onStatusChange;
  loginState.onSuccess = onSuccess;
  loginState.onError = onError;
  loginState.step = 'polling';
  
  const poll = async () => {
    const result = await checkQrcodeStatus();
    
    if (!result.success) {
      onError?.(result.message || '查询状态失败');
      return;
    }
    
    const status = result.status;
    
    switch (status) {
      case 'QRCODE_SCAN_NEVER':
        onStatusChange?.('waiting', '等待扫码...');
        loginState.pollingTimer = setTimeout(poll, 2000);
        break;
        
      case 'QRCODE_SCAN_ING':
        onStatusChange?.('scanned', '已扫码，请在手机上确认');
        loginState.pollingTimer = setTimeout(poll, 2000);
        break;
        
      case 'QRCODE_SCAN_SUCC':
        onStatusChange?.('success', '扫码成功');
        onSuccess?.(result.auth_code);
        break;
        
      case 'QRCODE_SCAN_ERR':
        onError?.('扫码失败，请重试');
        break;
        
      case 'QRCODE_SCAN_TIMEOUT':
        onError?.('二维码已过期，请刷新');
        break;
        
      case 'QRCODE_SCAN_CANCEL':
        onError?.('用户取消扫码');
        break;
        
      default:
        onError?.(`未知状态：${status}`);
    }
  };
  
  poll();
}

/**
 * 停止轮询
 */
export function stopPolling() {
  if (loginState.pollingTimer) {
    clearTimeout(loginState.pollingTimer);
    loginState.pollingTimer = null;
  }
}

/**
 * 完成登录（第二步）
 * @param {string} authCode - 扫码获取的授权码
 * @returns {Object} { success, token, cookies, login_time, expire_time, ... }
 */
export async function loginStep2(authCode) {
  try {
    console.log('[denglu.loginStep2] 开始登录, authCode:', authCode?.slice(0, 20) + '...');
    
    const result = await api('/login/step2', {
      method: 'POST',
      body: {
        auth_code: authCode,
        account: loginState.account,
        cookies: loginState.cookies
      }
    });
    
    console.log('[denglu.loginStep2] 响应:', result);
    
    if (result.success) {
      loginState.cookies = result.cookies;
      loginState.step = 'step2';
    }
    
    return result;
  } catch (e) {
    console.error('[denglu.loginStep2] 错误:', e);
    return { success: false, info: `登录完成失败：${e.message}` };
  }
}

/**
 * 获取用户信息
 * @param {Object} step2Result - loginStep2的返回结果
 * @returns {Object} { success, credentials, provider_info }
 */
export async function getUserInfo(step2Result) {
  try {
    console.log('[denglu.getUserInfo] 获取用户信息...');
    
    const result = await api('/user/info', {
      method: 'POST',
      body: {
        cookies: step2Result.cookies,
        login_time: step2Result.login_time,
        expire_time: step2Result.expire_time
      }
    });
    
    console.log('[denglu.getUserInfo] 响应:', result);
    
    if (result.success) {
      loginState.step = 'done';
    }
    
    return result;
  } catch (e) {
    console.error('[denglu.getUserInfo] 错误:', e);
    return { success: false, message: `获取用户信息失败：${e.message}` };
  }
}

/**
 * 保存登录凭证到数据库
 * @param {Object} credentials - 凭证信息
 * @param {Object} providerInfo - 供应商信息
 * @returns {Object} { success, message }
 */
export async function saveCredentials(credentials, providerInfo) {
  try {
    // 使用账户名称作为节点key
    const accountName = providerInfo.username || loginState.account;
    
    // 构建存储数据
    const authData = {
      token: credentials.token,
      cookies: credentials.cookies,
      provider_id_m: credentials.provider_id_m || providerInfo.provider_id || '',
      login_time: credentials.login_time,
      expire_time: credentials.expire_time,
      time_update: new Date().toLocaleString('zh-CN', { 
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false 
      }).replace(/\//g, '/'),
      // 额外存储供应商信息
      provider_name: providerInfo.provider_name || '',
      provider_short_name: providerInfo.provider_short_name || ''
    };
    
    await shujuku.saveAuth(accountName, authData);
    
    return { success: true, message: '登录信息已保存', accountName };
  } catch (e) {
    return { success: false, message: `保存失败：${e.message}` };
  }
}

/**
 * 完整登录流程（从扫码成功到保存凭证）
 * @param {string} authCode - 授权码
 * @returns {Object} { success, message, accountName }
 */
export async function completeLogin(authCode) {
  // 1. 完成登录第二步
  const step2Result = await loginStep2(authCode);
  if (!step2Result.success) {
    return { success: false, message: step2Result.info || '登录失败' };
  }
  
  // 2. 获取用户信息
  const userInfo = await getUserInfo(step2Result);
  if (!userInfo.success) {
    return { success: false, message: userInfo.message || '获取用户信息失败' };
  }
  
  // 3. 保存凭证
  const saveResult = await saveCredentials(userInfo.credentials, userInfo.provider_info);
  if (!saveResult.success) {
    return { success: false, message: saveResult.message };
  }
  
  return { 
    success: true, 
    message: `登录成功！欢迎 ${userInfo.provider_info.provider_name || userInfo.provider_info.username}`,
    accountName: saveResult.accountName,
    providerInfo: userInfo.provider_info
  };
}

/**
 * 重置登录状态
 */
export function resetLoginState() {
  stopPolling();
  loginState = {
    step: 'idle',
    account: '',
    cookies: null,
    webKey: '',
    clientKey: '',
    lastStatus: 'QRCODE_SCAN_NEVER',
    openDataSid: null,
    pollingTimer: null,
    onStatusChange: null,
    onError: null,
    onSuccess: null
  };
}

/**
 * 获取当前登录步骤
 */
export function getLoginStep() {
  return loginState.step;
}

/**
 * 获取二维码图片（代理方式，备用）
 * @returns {Object} { success, image }
 */
export async function getQrcodeImage() {
  if (!loginState.webKey) {
    return { success: false, message: '二维码未初始化' };
  }
  
  try {
    const result = await api(`/qrcode/image?key=${loginState.webKey}`);
    return result;
  } catch (e) {
    console.error('[denglu.getQrcodeImage] 错误:', e);
    return { success: false, message: `获取二维码失败：${e.message}` };
  }
}
