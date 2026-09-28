// =====================================================================
// yh-data-gateway —— Cloudflare Workers (module) + Durable Object realtime
// Data plane: D1 docs table (SjkModule HTTP backend)
// Realtime:   YhNotifyDO - WebSocket hibernation broadcast + alarm self-check
// =====================================================================

const ALLOWED = new Set([
  'login_accounts', 'device_logins', 'yeji_templates', 'yeji_targets',
  'coupons', 'coupon_index', 'notebooks', 'gongju_items', 'model_configs'
]);

function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-yh-token',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

function jsonR(request, status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders(request) });
}

function originAllowed(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!origin) return false;
  let host;
  try { host = new URL(origin).hostname.toLowerCase(); } catch (e) { return false; }
  const allow = String(env.ORIGIN_ALLOWLIST || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return allow.some((entry) => host === entry || host.endsWith('.' + entry));
}

function tokenValid(request, env) {
  if (String(env.TOKEN_REQUIRED || '') !== 'true') return true;
  const token = request.headers.get('x-yh-token') || '';
  return token !== '' && token === String(env.YH_TOKEN || '');
}

// Realtime notify: internal call to the DO (best effort; one retry + alarm self-check covers failures)
async function notifyCollection(env, collection) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const id = env.YH_NOTIFY.idFromName('global');
      const stub = env.YH_NOTIFY.get(id);
      await stub.fetch('https://yh-gateway.internal/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-yh-token': String(env.YH_TOKEN || '') },
        body: JSON.stringify({ collection })
      });
      return;
    } catch (e) {
      if (attempt < 2) await new Promise((r) => setTimeout(r, 300));
      else console.warn('[notify] failed after retry (alarm will cover):', e && e.message);
    }
  }
}

async function handle(body, env) {
  const col = String(body.collection || '');
  if (!ALLOWED.has(col)) throw new Error('COLLECTION_NOT_ALLOWED: ' + col);
  const db = env.DB;
  const now = Date.now();

  switch (body.op) {
    case 'get': {
      const row = await db.prepare('SELECT data FROM docs WHERE collection=?1 AND id=?2')
        .bind(col, String(body.docId)).first();
      return row ? JSON.parse(row.data) : null;
    }
    case 'getWhere': {
      const limit = Number(body.limit) || 200;
      const res = await db.prepare('SELECT id, data FROM docs WHERE collection=?1 AND json_extract(data, ?2) = ?3 LIMIT ?4')
        .bind(col, '$.' + String(body.field), body.value, limit).all();
      return (res.results || []).map((r) => ({ ...JSON.parse(r.data), _id: r.id }));
    }
    case 'getAll': {
      const limit = Number(body.limit) || 1000;
      const res = await db.prepare('SELECT id, data FROM docs WHERE collection=?1 LIMIT ?2')
        .bind(col, limit).all();
      return (res.results || []).map((r) => ({ ...JSON.parse(r.data), _id: r.id }));
    }
    case 'add': {
      const id = body.docId || ('auto-' + crypto.randomUUID());
      await db.prepare('INSERT INTO docs (collection,id,data,updated_at) VALUES (?1,?2,?3,?4)')
        .bind(col, id, JSON.stringify(body.data || {}), now).run();
      await notifyCollection(env, col);
      return id;
    }
    case 'set': {
      await db.prepare('INSERT INTO docs (collection,id,data,updated_at) VALUES (?1,?2,?3,?4) '
        + 'ON CONFLICT(collection,id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at')
        .bind(col, String(body.docId), JSON.stringify(body.data || {}), now).run();
      await notifyCollection(env, col);
      return true;
    }
    case 'update': {
      const row = await db.prepare('SELECT data FROM docs WHERE collection=?1 AND id=?2')
        .bind(col, String(body.docId)).first();
      if (!row) throw new Error('DOC_NOT_EXISTS: ' + body.docId);
      const data = JSON.parse(row.data);
      for (const [k, v] of Object.entries(body.patch || {})) data[k] = v;
      await db.prepare('UPDATE docs SET data=?1, updated_at=?2 WHERE collection=?3 AND id=?4')
        .bind(JSON.stringify(data), now, col, String(body.docId)).run();
      await notifyCollection(env, col);
      return true;
    }
    case 'upsert': {
      const row = await db.prepare('SELECT data FROM docs WHERE collection=?1 AND id=?2')
        .bind(col, String(body.docId)).first();
      if (row) return handle({ ...body, op: 'update' }, env);
      return handle({ ...body, op: 'set', data: body.patch || body.data || {} }, env);
    }
    case 'remove': {
      await db.prepare('DELETE FROM docs WHERE collection=?1 AND id=?2')
        .bind(col, String(body.docId)).run();
      await notifyCollection(env, col);
      return true;
    }
    case 'updateWhere': {
      const res = await db.prepare(
        'UPDATE docs SET data = json_patch(data, ?1), updated_at=?2 '
        + 'WHERE collection=?3 AND id=?4 AND json_extract(data, ?5) = ?6')
        .bind(JSON.stringify(body.patch || {}), now, col, String(body.docId),
          '$.' + String(body.wherePath || ''), body.whereValue).run();
      const changed = !!(res.meta && res.meta.changes > 0);
      if (changed) await notifyCollection(env, col);
      return { changed };
    }
    default:
      throw new Error('UNKNOWN_OP: ' + body.op);
  }
}

// =====================================================================
// YhNotifyDO - realtime broadcast (WebSocket Hibernation + alarm self-check)
// =====================================================================
export class YhNotifyDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/connect') {
      // Auth: browsers always send Origin (must be allowlisted); non-browser clients
      // may omit Origin but MUST carry the valid token. Token is the primary credential.
      const origin = request.headers.get('Origin');
      if (origin && !originAllowed(request, this.env)) {
        return jsonR(request, 403, { ok: false, error: 'ORIGIN_NOT_ALLOWED' });
      }
      if (url.searchParams.get('token') !== String(this.env.YH_TOKEN || '')) {
        return jsonR(request, 401, { ok: false, error: 'TOKEN_INVALID' });
      }
      const collections = (url.searchParams.get('collections') || '')
        .split(',').map(s => s.trim()).filter(c => ALLOWED.has(c));
      const pair = new WebSocketPair();
      this.state.acceptWebSocket(pair[1], collections);
      // ensure the self-check alarm is running (rolling 60s)
      const cur = await this.state.storage.getAlarm();
      if (!cur) await this.state.storage.setAlarm(Date.now() + 60000);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (url.pathname === '/notify') {
      if (request.headers.get('x-yh-token') !== String(this.env.YH_TOKEN || '')) {
        return jsonR(request, 401, { ok: false, error: 'TOKEN_INVALID' });
      }
      let body;
      try { body = await request.json(); } catch (e) { body = null; }
      const collection = body && String(body.collection || '');
      if (!collection || !ALLOWED.has(collection)) return jsonR(request, 400, { ok: false, error: 'BAD_COLLECTION' });
      let notified = 0;
      for (const ws of this.state.getWebSockets(collection)) {
        try { ws.send(JSON.stringify({ type: 'change', collection })); notified++; } catch (e) { }
      }
      // rolling alarm (self-check keeps running while any client is connected)
      const cur = await this.state.storage.getAlarm();
      if (!cur) await this.state.storage.setAlarm(Date.now() + 60000);
      return jsonR(request, 200, { ok: true, notified });
    }

    return jsonR(request, 404, { ok: false, error: 'NOT_FOUND' });
  }

  // Fallback self-check: compare per-collection MAX(updated_at) against stored versions,
  // broadcast any change (covers lost /notify calls). Runs every 60s while alarm is set.
  async alarm() {
    try {
      const res = await this.env.DB.prepare(
        'SELECT collection, MAX(updated_at) AS v FROM docs GROUP BY collection').all();
      const prev = (await this.state.storage.get('versions')) || {};
      const next = {};
      for (const r of (res.results || [])) {
        next[r.collection] = r.v;
        if (prev[r.collection] !== undefined && prev[r.collection] !== r.v) {
          for (const ws of this.state.getWebSockets(r.collection)) {
            try { ws.send(JSON.stringify({ type: 'change', collection: r.collection })); } catch (e) { }
          }
        }
      }
      await this.state.storage.put('versions', next);
    } catch (e) {
      console.warn('[do] alarm self-check failed:', e && e.message);
    }
    await this.state.storage.setAlarm(Date.now() + 60000);
  }

  async webSocketMessage(ws, message) {
    // subscription update: {"subscribe": ["col1","col2"]} | heartbeat: {"ping":1} -> {"type":"pong"}
    try {
      const msg = JSON.parse(message);
      if (msg && msg.ping) {
        try { ws.send(JSON.stringify({ type: 'pong' })); } catch (e) { }
        return;
      }
      if (Array.isArray(msg.subscribe)) {
        const tags = msg.subscribe.filter(c => ALLOWED.has(c));
        this.state.setTags(ws, tags);
      }
    } catch (e) { /* ignore malformed */ }
  }

  webSocketClose(ws) { /* hibernation cleanup is automatic */ }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Realtime endpoints -> DO singleton
    if (url.pathname === '/connect' || url.pathname === '/notify') {
      const id = env.YH_NOTIFY.idFromName('global');
      const stub = env.YH_NOTIFY.get(id);
      return stub.fetch(request);
    }

    // GET: health check (Origin validated; no token required)
    if (request.method === 'GET') {
      if (!originAllowed(request, env)) return jsonR(request, 403, { ok: false, error: 'ORIGIN_NOT_ALLOWED' });
      return jsonR(request, 200, { ok: true, service: 'yh-data-gateway', time: Date.now() });
    }

    if (!originAllowed(request, env)) return jsonR(request, 403, { ok: false, error: 'ORIGIN_NOT_ALLOWED' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
    if (!tokenValid(request, env)) return jsonR(request, 401, { ok: false, error: 'TOKEN_INVALID' });
    if (request.method !== 'POST') return jsonR(request, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonR(request, 400, { ok: false, error: 'BAD_JSON' });
    }

    try {
      if (!body || !body.op) return jsonR(request, 400, { ok: false, error: 'MISSING_OP' });
      const data = await handle(body, env);
      return jsonR(request, 200, { ok: true, data });
    } catch (error) {
      const msg = String((error && error.message) || error);
      if (/no\s*such\s*table/i.test(msg)) {
        if (body.op === 'get') return jsonR(request, 200, { ok: true, data: null });
        if (body.op === 'getWhere' || body.op === 'getAll') return jsonR(request, 200, { ok: true, data: [] });
      }
      return jsonR(request, 500, { ok: false, error: msg });
    }
  }
};


