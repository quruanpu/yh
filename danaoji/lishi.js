// 对话历史管理 v2.0
// 优化：减少历史数量，降低对发券场景的干扰

const AI_HISTORY_VERSION = 50; // 更新版本号清除旧缓存
const AI_HISTORY_KEY = 'le_ai_history_v' + AI_HISTORY_VERSION;
const AI_MAX_HISTORY = 16; // 减少最大历史数量

let history = [];

export function load() {
  const savedVersion = localStorage.getItem('ai_history_version');
  if (savedVersion !== String(AI_HISTORY_VERSION)) {
    localStorage.removeItem(AI_HISTORY_KEY);
    localStorage.setItem('ai_history_version', AI_HISTORY_VERSION);
    history = [];
    return;
  }
  try { history = JSON.parse(localStorage.getItem(AI_HISTORY_KEY) || '[]'); }
  catch (e) { history = []; }
}

function save() {
  try {
    if (history.length > AI_MAX_HISTORY) history = history.slice(-AI_MAX_HISTORY);
    localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {}
}

export function add(role, content) {
  history.push({ role, content });
  save();
}

export function removeLast() {
  history.pop();
  save();
}

export function getRecent(count = 8) {
  return history.slice(-count);
}

export function clear() {
  history = [];
  save();
}