// CF 链路行为回归：真实 Worker + 真实 D1 + 真实 SjkModule/ZhanghuModule，19 项断言重跑
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { ProxyAgent } = require('c:/Users/zhixiaobo/AppData/Local/Temp/node_modules/undici');

const root = 'c:/Users/zhixiaobo/Desktop/yh-main/yh-main';
const GW = 'https://yhsjk.cfdaili.top';
const ORIGIN = 'https://ly.cqytyy.top';
const dispatcher = new ProxyAgent('http://127.0.0.1:7897');

// fetch 注入 Origin + 代理（模拟浏览器跨域行为）
const realFetch = global.fetch;
global.fetch = (url, opts = {}) => realFetch(url, {
  ...opts,
  dispatcher,
  headers: { Origin: ORIGIN, ...(opts.headers || {}) }
});

const results = [];
function test(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => { results.push(['PASS', name]); })
    .catch((e) => { results.push(['FAIL', name + ' :: ' + (e.message || e)]); });
}

async function main() {
  const w = {
    console,
    DeviceModule: {
      state: { deviceId: 'device_CFTEST01' },
      ready: async () => ({ deviceId: 'device_CFTEST01', deviceInfo: { device_name: 'CF-TestPC' } })
    }
  };
  new Function('window', fs.readFileSync(path.join(root, 'sjk/app.js'), 'utf8'))(w);
  const Sjk = w.SjkModule;
  Sjk.config.gatewayUrl = GW;
  Sjk.config.requestTimeoutMs = 15000;
  new Function('window', 'SjkModule', fs.readFileSync(path.join(root, 'denglu/zhanghu.js'), 'utf8'))(w, Sjk);
  const Zh = w.ZhanghuModule;
  await Zh.init();
  assert.strictEqual(Zh.state.deviceId, 'device_CFTEST01');
  results.push(['PASS', 'zhanghu: init 拿到设备码']);

  const cleanup = async () => {
    for (const [c, i] of [
      ['login_accounts', 'scm::P1::cf_userA'], ['device_logins', 'scm::device_CFTEST01::P1_cf_userA'],
      ['login_accounts', 'pms::P2::cf_pmsUser'], ['device_logins', 'pms::device_CFTEST01::P2_cf_pmsUser'],
      ['coupons', 'conn_test::cf_task_coupon']
    ]) { try { await Sjk.remove(c, i); } catch (e) { } }
  };
  await cleanup();

  await test('sjk: set/get 读写一致（真实 D1）', async () => {
    await Sjk.set('gongju_items', 'cf_t_doc1', { a: 1, nested: { b: 2 }, test_marker: 'YH-CF-TEST' });
    const doc = await Sjk.get('gongju_items', 'cf_t_doc1');
    assert.strictEqual(doc.a, 1);
    assert.strictEqual(doc.nested.b, 2);
  });

  await test('sjk: get 不存在 → null', async () => {
    assert.strictEqual(await Sjk.get('gongju_items', 'cf_t_nope'), null);
  });

  await test('sjk: update 严格语义（不存在报错）', async () => {
    let threw = false;
    try { await Sjk.update('gongju_items', 'cf_t_ghost', { x: 1 }); } catch (e) { threw = true; }
    assert.ok(threw);
  });

  await test('sjk: upsert 不存在 → 整写', async () => {
    await Sjk.upsert('gongju_items', 'cf_t_new1', { x: 9, test_marker: 'YH-CF-TEST' });
    const doc = await Sjk.get('gongju_items', 'cf_t_new1');
    console.log('[debug] upsert doc =', JSON.stringify(doc));
    assert.strictEqual(doc.x, 9);
  });

  await test('sjk: getWhere json_extract 条件查询', async () => {
    await Sjk.set('gongju_items', 'cf_t_w1', { test_marker: 'YH-CF-TEST', v: 1 });
    await Sjk.set('gongju_items', 'cf_t_w2', { test_marker: 'YH-CF-TEST', v: 2 });
    const list = await Sjk.getWhere('gongju_items', 'test_marker', '==', 'YH-CF-TEST');
    assert.strictEqual(list.filter(d => d.v).length, 2);
  });

  await test('sjk: getAll 全量读取', async () => {
    const list = await Sjk.getAll('gongju_items');
    assert.ok(list.some(d => d._id === 'cf_t_w1'), 'getAll 应包含测试文档');
  });

  await test('sjk: updateWhere 原子条件更新（changed true/false）', async () => {
    await Sjk.set('gongju_items', 'cf_t_u1', { test_marker: 'YH-CF-TEST', status: 'pending' });
    const r1 = await Sjk.updateWhere('gongju_items', 'cf_t_u1', { status: 'processing' }, 'status', 'pending');
    assert.strictEqual(r1.changed, true);
    const r2 = await Sjk.updateWhere('gongju_items', 'cf_t_u1', { status: 'processing' }, 'status', 'pending');
    assert.strictEqual(r2.changed, false);
  });

  await test('sjk: remove 删除', async () => {
    await Sjk.remove('gongju_items', 'cf_t_w2');
    assert.strictEqual(await Sjk.get('gongju_items', 'cf_t_w2'), null);
  });

  await test('zhanghu: saveScmLogin 写账户+设备索引（结构对齐）', async () => {
    const ok = await Zh.saveScmLogin('cf_userA', { token: 'tk1', provider_id: 'P1' }, { provider_id: 'P1', provider_name: '供一' }, { account: 'cf_userA', password: 'pw' });
    assert.strictEqual(ok, true);
    const acc = await Sjk.get('login_accounts', 'scm::P1::cf_userA');
    assert.strictEqual(acc.system, 'scm');
    assert.strictEqual(acc.username, 'cf_userA');
    assert.strictEqual(acc.provider_name, '供一');
    assert.strictEqual(acc.account_secret.password, 'pw');
    assert.ok(acc.devices['device_CFTEST01']);
    const idx = await Sjk.get('device_logins', 'scm::device_CFTEST01::P1_cf_userA');
    assert.strictEqual(idx.account, 'cf_userA');
    assert.strictEqual(idx.device_id, 'device_CFTEST01');
    assert.strictEqual(idx.invalid, false);
  });

  await test('zhanghu: 二次保存合并 devices（不丢其他设备痕迹）', async () => {
    const accDoc = await Sjk.get('login_accounts', 'scm::P1::cf_userA');
    accDoc.devices['device_OLD99'] = { login_time: 111 };
    await Sjk.set('login_accounts', 'scm::P1::cf_userA', accDoc);
    await Zh.saveScmLogin('cf_userA', { token: 'tk2', provider_id: 'P1' }, { provider_id: 'P1', provider_name: '供一' }, null);
    const acc = await Sjk.get('login_accounts', 'scm::P1::cf_userA');
    assert.ok(acc.devices['device_OLD99'], '旧设备痕迹保留');
    assert.ok(acc.devices['device_CFTEST01']);
  });

  await test('zhanghu: getDeviceLogins 返回结构与旧版同构', async () => {
    const r = await Zh.getDeviceLogins('scm');
    assert.strictEqual(r.scm.length, 1);
    assert.strictEqual(r.scm[0].username, 'cf_userA');
    assert.strictEqual(r.scm[0].provider_name, '供一');
    assert.ok(r.scm[0].credentials.token);
  });

  await test('zhanghu: findAllScmByProviderId 过滤与排序', async () => {
    const list = await Zh.findAllScmByProviderId('P1');
    assert.strictEqual(list.length, 1);
  });

  await test('zhanghu: markAccountInvalid 账户+当前设备索引双标记', async () => {
    await Zh.markAccountInvalid('scm', 'P1', 'cf_userA');
    const acc = await Sjk.get('login_accounts', 'scm::P1::cf_userA');
    const idx = await Sjk.get('device_logins', 'scm::device_CFTEST01::P1_cf_userA');
    assert.strictEqual(acc.invalid, true);
    assert.strictEqual(idx.invalid, true);
    await Zh.clearAccountInvalid('scm', 'P1', 'cf_userA');
    assert.strictEqual((await Sjk.get('login_accounts', 'scm::P1::cf_userA')).invalid, false);
  });

  await test('zhanghu: unshareLogin 清 credentials 保留 account_secret', async () => {
    const ok = await Zh.unshareLogin('scm', 'P1', 'cf_userA', 'credentials');
    assert.strictEqual(ok, true);
    const acc = await Sjk.get('login_accounts', 'scm::P1::cf_userA');
    assert.strictEqual(acc.credentials, null);
    assert.ok(acc.account_secret, 'secret 保留');
  });

  await test('zhanghu: unshareLogin 双清空 → 删账户+删设备索引', async () => {
    await Zh.unshareLogin('scm', 'P1', 'cf_userA', 'secret');
    assert.strictEqual(await Sjk.get('login_accounts', 'scm::P1::cf_userA'), null);
    assert.strictEqual(await Sjk.get('device_logins', 'scm::device_CFTEST01::P1_cf_userA'), null);
  });

  await test('zhanghu: savePmsLogin 回填 credentials.providerId/Name', async () => {
    await Zh.savePmsLogin('cf_pmsUser', { token: 'pt1' }, { supplierName: '供二' }, { sub_providers: [{ id: 'P2', provider_name: '供二' }] });
    const acc = await Sjk.get('login_accounts', 'pms::P2::cf_pmsUser');
    assert.strictEqual(acc.credentials.providerId, 'P2');
    assert.strictEqual(acc.credentials.providerName, '供二');
    assert.ok(acc.permissions.sub_providers);
  });

  await test('sjk: watchWhere 轮询（10s 内回调）', async () => {
    const p = new Promise((resolve) => {
      const unwatch = Sjk.watchWhere('gongju_items', 'test_marker', 'YH-CF-TEST', ({ docs }) => {
        unwatch();
        resolve(docs);
      });
      setTimeout(() => resolve(null), 25000);
    });
    const docs = await p;
    assert.ok(docs && docs.length >= 1, '轮询应返回数据');
  });

  await cleanup();
  // 清理 cf_t_* 测试文档
  for (const id of ['cf_t_doc1', 'cf_t_new1', 'cf_t_w1', 'cf_t_u1']) {
    try { await Sjk.remove('gongju_items', id); } catch (e) { }
  }

  let fail = 0;
  console.log('\n===== CF 链路行为回归 =====');
  results.forEach(([s, n]) => { if (s === 'FAIL') fail++; console.log(`${s === 'PASS' ? '✓' : '✗'} ${n}`); });
  console.log(`\n总计 ${results.length}：通过 ${results.length - fail}，失败 ${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('HARNESS ERROR:', e); process.exit(2); });
