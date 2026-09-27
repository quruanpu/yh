// =====================================================================
// yh-data-gateway —— 运小助数据网关（TCB Event 函数形态，配合 HTTP 访问服务）
// 前端 SjkModule 的 HTTP 后端：解决 GitHub Pages 自定义域名的跨域问题。
// 约定：POST JSON { op, collection, docId?, data?/patch?, field?, value?, limit? }
// 返回：{ ok: true, data } / { ok: false, error }
// CORS：全开放（响应头 *），由集合白名单约束可访问面。
// =====================================================================
const Cloudbase = require('@cloudbase/node-sdk');

const app = Cloudbase.init({ env: Cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
};

const ALLOWED = new Set([
  'login_accounts', 'device_logins', 'yeji_templates', 'yeji_targets',
  'coupons', 'coupon_index', 'notebooks', 'gongju_items', 'model_configs'
]);

const MISSING = /not\s*exist|COLLECTION_NOT_EXIST|Db or Table not exist/i;

function httpResp(statusCode, payload) {
  return { statusCode, headers: CORS, body: JSON.stringify(payload) };
}

function hasDoc(res) {
  const d = res && res.data;
  return Array.isArray(d) ? d.length > 0 : !!d;
}

async function handle(op, p) {
  const col = String(p.collection || '');
  if (!ALLOWED.has(col)) throw new Error('COLLECTION_NOT_ALLOWED: ' + col);

  switch (op) {
    case 'get': {
      const res = await db.collection(col).doc(String(p.docId)).get();
      const d = res && res.data;
      return Array.isArray(d) ? (d.length ? d[0] : null) : (d || null);
    }
    case 'getWhere': {
      const res = await db.collection(col).where({ [String(p.field)]: p.value }).limit(Number(p.limit) || 200).get();
      return res.data || [];
    }
    case 'getAll': {
      const res = await db.collection(col).limit(Number(p.limit) || 1000).get();
      return res.data || [];
    }
    case 'add': {
      const res = await db.collection(col).add(p.data);
      return (res && res.id) || '';
    }
    case 'set': {
      await db.collection(col).doc(String(p.docId)).set(p.data);
      return true;
    }
    case 'update': {
      // 严格语义：文档不存在报错（与前端 SjkModule 行为一致）
      const docRef = db.collection(col).doc(String(p.docId));
      if (!hasDoc(await docRef.get())) throw new Error('DOC_NOT_EXISTS: ' + p.docId);
      await docRef.update(p.patch);
      return true;
    }
    case 'upsert': {
      const docRef = db.collection(col).doc(String(p.docId));
      if (hasDoc(await docRef.get())) await docRef.update(p.patch);
      else await docRef.set(p.patch);
      return true;
    }
    case 'remove': {
      await db.collection(col).doc(String(p.docId)).remove();
      return true;
    }
    default:
      throw new Error('UNKNOWN_OP: ' + op);
  }
}

exports.main = async (event) => {
  // OPTIONS 预检
  if (event && (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS')) {
    return httpResp(204, {});
  }

  let body = event && event.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  if (!body && event && event.op) body = event; // 兼容直接事件触发（CLI invoke）

  try {
    if (!body || !body.op) return httpResp(400, { ok: false, error: 'MISSING_OP' });
    const data = await handle(body.op, body);
    return httpResp(200, { ok: true, data });
  } catch (error) {
    const msg = String((error && error.message) || error);
    // 空库容错：集合不存在 → 与前端约定同构（null / 空数组）
    if (MISSING.test(msg)) {
      if (body.op === 'get') return httpResp(200, { ok: true, data: null });
      if (body.op === 'getWhere' || body.op === 'getAll') return httpResp(200, { ok: true, data: [] });
    }
    return httpResp(500, { ok: false, error: msg });
  }
};
