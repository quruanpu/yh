// 公共工具模块

// 时间工具
export const TimeUtil = {
  getNow: () => {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  },
  parse: str => str ? new Date(str.replace(/-/g, '/')) : null,
  isValid: (str, limit = 24 * 60 * 60 * 1000) => {
    const time = TimeUtil.parse(str);
    return time && (Date.now() - time.getTime()) <= limit;
  },
  calcDuration: (start, finish) => {
    const s = TimeUtil.parse(start), f = TimeUtil.parse(finish);
    if (!s || !f) return '-';
    const sec = Math.floor((f - s) / 1000);
    return sec < 60 ? `${sec}秒` : `${Math.floor(sec / 60)}分${sec % 60}秒`;
  }
};

// ID提取（7位数字、11位手机号、K码）
export const extractIds = content =>
  [...new Set(content.match(/(1[3-9]\d{9}|K\d{4,10}|\d{7})/gi) || [])];

// 设备指纹
let DEVICE_ID = null;
export const getDeviceId = () => DEVICE_ID;

export async function initFingerprint() {
  const cached = localStorage.getItem('fp_device_id');
  if (cached) DEVICE_ID = cached;
  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    const newId = 'ST_' + result.visitorId.substring(0, 8).toUpperCase();
    if (newId !== DEVICE_ID) {
      DEVICE_ID = newId;
      localStorage.setItem('fp_device_id', DEVICE_ID);
    }
  } catch (e) {
    if (!DEVICE_ID) {
      DEVICE_ID = 'ST_' + Math.random().toString(36).substr(2, 8).toUpperCase();
      localStorage.setItem('fp_device_id', DEVICE_ID);
    }
  }
  return DEVICE_ID;
}

// 获取当前时间字符串
export const getTime = () => new Date().toLocaleTimeString('zh-CN', { hour12: false });
