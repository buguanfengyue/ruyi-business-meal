/**
 * Automated edge matrix from 压力测试与边缘测试方案.md §7 (API-only).
 * Records PASS / GAP / FAIL. Exit 1 only on FAIL (unexpected regressions).
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.RUYI_EDGE_PORT || 8796);
const BASE = `http://127.0.0.1:${port}`;
const results = [];

function record(id, status, detail = '') {
  results.push({ id, status, detail });
  console.log(`${status} ${id}${detail ? ` — ${detail}` : ''}`);
}

function startServer(extraEnv = {}) {
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_PATH: ':memory:',
      RUYI_API_PORT: String(port),
      WECHAT_AUTH_MODE: 'mock',
      PAYMENT_MODE: 'mock',
      SEED_DEMO: '1',
      STORE_HOURS: '00:00-24:00',
      RATE_LIMIT_PER_MINUTE: '100000',
      ADMIN_USERNAME: 'edgeboss',
      ADMIN_PASSWORD: 'correct-horse-edge',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (c) => { output += c; });
  child.stderr.on('data', (c) => { output += c; });
  return { child, output: () => output };
}

async function call(pathname, { token, method = 'GET', body, raw, headers = {} } = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: raw !== undefined ? raw : (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { status: res.status, body: json, text };
}

async function ready() {
  for (let i = 0; i < 50; i += 1) {
    try {
      if ((await call('/api/health')).status === 200) return;
    } catch { /* retry */ }
    await wait(50);
  }
  throw new Error('API failed to start');
}

async function login(code) {
  const res = await call('/api/auth/login', { method: 'POST', body: { code } });
  assert.equal(res.status, 200, `login ${code}`);
  return res.body.session.token;
}

let active = startServer();
try {
  await ready();

  // A1/A2: mock + SEED_DEMO silently falls back to demo-user when no/invalid session.
  {
    const r = await call('/api/orders');
    if (r.status === 401 && r.body?.error?.code === 'AUTH_REQUIRED') {
      record('A1', 'PASS', 'status=401 AUTH_REQUIRED');
    } else {
      record('A1', 'GAP', `mock demo 回落：无 token 仍 ${r.status}（user=${r.body?.orders ? 'demo-orders' : JSON.stringify(r.body).slice(0, 80)}）`);
    }
  }

  {
    const r = await call('/api/me', { token: 'ruyi_forged_token_xxx' });
    if (r.status === 401) {
      record('A2', 'PASS', 'status=401');
    } else {
      record('A2', 'GAP', `伪造 token 未 401：status=${r.status} authenticated=${r.body?.authenticated} user=${r.body?.user?.id}`);
    }
  }

  {
    const token = await login('edge-logout');
    await call('/api/auth/logout', { token, method: 'POST' });
    const me = await call('/api/me', { token });
    const orders = await call('/api/orders', { token });
    // /api/me 设计上可返回 authenticated:false；受保护接口在 mock 下仍会回落 demo。
    if (orders.status === 401) {
      record('A4', 'PASS', `/api/me authenticated=${me.body?.authenticated}; /api/orders=401`);
    } else {
      record('A4', 'GAP', `退出后旧 token：/api/me authenticated=${me.body?.authenticated} user=${me.body?.user?.id}; /api/orders=${orders.status}`);
    }
  }

  {
    const t1 = await login('mock:dual-session');
    const t2 = await login('mock:dual-session');
    const a = await call('/api/me', { token: t1 });
    const b = await call('/api/me', { token: t2 });
    record(
      'A5',
      a.status === 200 && b.status === 200 && a.body.user.id === b.body.user.id
        && a.body.authenticated && b.body.authenticated && t1 !== t2 ? 'PASS' : 'FAIL',
      `user=${a.body?.user?.id} tokensDistinct=${t1 !== t2}`,
    );
  }

  {
    const token = await login('edge-phone');
    const r = await call('/api/auth/phone', { token, method: 'POST', body: { code: '' } });
    record('A7', r.status < 500 ? 'PASS' : 'FAIL', `status=${r.status} code=${r.body?.error?.code}`);
  }

  {
    const r = await call('/api/addresses', { token: await login('edge-json'), method: 'POST', raw: '{bad' });
    record('B1', r.status === 400 && r.body?.error?.code === 'INVALID_JSON' ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  {
    const token = await login('edge-big');
    const huge = 'x'.repeat(1024 * 1024 + 64);
    const r = await call('/api/addresses', {
      token,
      method: 'POST',
      raw: JSON.stringify({ name: 'a', phone: '13800000000', detail: huge }),
    });
    record('B2', r.status === 413 && r.body?.error?.code === 'PAYLOAD_TOO_LARGE' ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  {
    const r = await call('/api/addresses', { token: await login('edge-array'), method: 'POST', raw: '[]' });
    record('B3', r.status === 400 ? 'PASS' : 'FAIL', `status=${r.status} code=${r.body?.error?.code}`);
  }

  {
    const token = await login('edge-qty');
    await call('/api/session/register', { token, method: 'POST', body: { nickname: 'qty' } });
    const reject = [
      { productId: 'a', quantity: 0 },
      { productId: 'a', quantity: 100 },
      { productId: 'a', quantity: 1.5 },
    ];
    let rejectOk = true;
    const details = [];
    for (const item of reject) {
      const r = await call('/api/cart/quote', { token, method: 'POST', body: { items: [item] } });
      details.push(`${JSON.stringify(item.quantity)}→${r.status}/${r.body?.error?.code || '-'}`);
      if (r.status !== 400 || r.body?.error?.code !== 'INVALID_QUANTITY') rejectOk = false;
    }
    const stringQty = await call('/api/cart/quote', {
      token,
      method: 'POST',
      body: { items: [{ productId: 'a', quantity: '2' }] },
    });
    details.push(`"2"→${stringQty.status}/${stringQty.body?.error?.code || '-'}`);
    if (!rejectOk) {
      record('B4', 'FAIL', details.join('; '));
    } else if (stringQty.status === 200) {
      record('B4', 'GAP', `0/100/1.5 已拒；字符串 "2" 被 Number() 接受（文档期望 INVALID_QUANTITY）。${details.join('; ')}`);
    } else {
      record('B4', 'PASS', details.join('; '));
    }
  }

  {
    const token = await login('edge-dup');
    const r = await call('/api/cart/quote', {
      token,
      method: 'POST',
      body: { items: [{ productId: 'a', quantity: 1 }, { productId: 'a', quantity: 1 }] },
    });
    record('B5', r.status === 400 && r.body?.error?.code === 'DUPLICATE_PRODUCT' ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  {
    const token = await login('edge-miss');
    const r = await call('/api/cart/quote', {
      token,
      method: 'POST',
      body: { items: [{ productId: 'no-such-product', quantity: 1 }] },
    });
    record('B6', r.status === 400 || r.status === 404 ? 'PASS' : 'FAIL', `status=${r.status} code=${r.body?.error?.code}`);
  }

  // B6b: unavailable product → 409 PRODUCT_UNAVAILABLE
  {
    const adminLogin = await call('/api/admin/login', {
      method: 'POST',
      body: { username: 'edgeboss', password: 'correct-horse-edge' },
    });
    assert.equal(adminLogin.status, 200);
    const admin = adminLogin.body.token;
    const products = (await call('/api/admin/products', { token: admin })).body.products
      || (await call('/api/products')).body.products;
    const target = products.find((p) => p.id === 'a') || products[0];
    const put = await call(`/api/admin/products/${target.id}`, {
      token: admin,
      method: 'PUT',
      body: { ...target, available: false, price: target.price ?? target.listPrice },
    });
    const token = await login('edge-unavail');
    const r = await call('/api/cart/quote', {
      token,
      method: 'POST',
      body: { items: [{ productId: target.id, quantity: 1 }] },
    });
    // restore
    await call(`/api/admin/products/${target.id}`, {
      token: admin,
      method: 'PUT',
      body: { ...target, available: true, price: target.price ?? target.listPrice },
    });
    record(
      'B6b',
      r.status === 409 && r.body?.error?.code === 'PRODUCT_UNAVAILABLE' ? 'PASS' : (put.status >= 400 ? 'GAP' : 'FAIL'),
      `adminPut=${put.status} quote=${r.status} code=${r.body?.error?.code}`,
    );
  }

  {
    const token = await login('edge-long');
    const r = await call('/api/addresses', {
      token,
      method: 'POST',
      body: { name: '名'.repeat(100), phone: '13900000000', detail: '址'.repeat(500) },
    });
    record('B7', r.status === 201 || r.status === 400 ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  {
    const token = await login('edge-sched');
    await call('/api/session/register', { token, method: 'POST', body: { nickname: 'sched' } });
    const r = await call('/api/orders', {
      token,
      method: 'POST',
      body: {
        fulfillment: 'pickup',
        schedule: '明天随便',
        items: [{ productId: 'a', quantity: 1 }],
        customer: { phone: '13800000002' },
      },
    });
    record('B8', r.status === 400 && r.body?.error?.code === 'INVALID_SCHEDULE' ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  {
    const token = await login('edge-addr');
    await call('/api/session/register', { token, method: 'POST', body: { nickname: 'addr' } });
    const r = await call('/api/orders', {
      token,
      method: 'POST',
      body: {
        fulfillment: 'delivery',
        schedule: '尽快送达',
        items: [{ productId: 'a', quantity: 1 }],
        customer: { phone: '13800000003' },
        addressId: 'addr_not_exist',
      },
    });
    record('B9', r.status === 400 ? 'PASS' : 'FAIL', `code=${r.body?.error?.code}`);
  }

  {
    const r = await call('/api/does-not-exist');
    record('B10', r.status === 404 ? 'PASS' : 'FAIL', `status=${r.status}`);
  }

  {
    const token = await login('edge-redeem');
    const r = await call('/api/coupons/redeem', { token, method: 'POST', body: { code: 'NOPE-CODE' } });
    record('C6', r.status === 400 || r.status === 404 ? 'PASS' : 'FAIL', `status=${r.status} code=${r.body?.error?.code}`);
  }

  {
    const token = await login('edge-self-invite');
    const me = await call('/api/me', { token });
    const before = (await call('/api/invite', { token })).body;
    const self = await call('/api/auth/login', {
      method: 'POST',
      body: { code: 'edge-self-invite', inviterId: me.body.user.id },
    });
    const after = (await call('/api/invite', { token })).body;
    const invitedGrew = (after.invited?.length || 0) > (before.invited?.length || 0);
    record(
      'F2',
      self.status === 200 && !invitedGrew ? 'PASS' : 'FAIL',
      `relogin=${self.status} invitedBefore=${before.invited?.length || 0} after=${after.invited?.length || 0}`,
    );
  }

  // E1: pause accepting via admin settings
  {
    const adminLogin = await call('/api/admin/login', {
      method: 'POST',
      body: { username: 'edgeboss', password: 'correct-horse-edge' },
    });
    assert.equal(adminLogin.status, 200, 'admin login');
    const admin = adminLogin.body.token;
    const settings = (await call('/api/admin/settings', { token: admin })).body.settings;
    const closedStore = { ...settings.store, accepting: false, notice: '暂停接单测试' };
    const put = await call('/api/admin/settings/store', { token: admin, method: 'PUT', body: closedStore });
    assert.equal(put.status, 200, `set accepting false got ${put.status}`);

    const token = await login('edge-paused');
    await call('/api/session/register', { token, method: 'POST', body: { nickname: 'paused' } });
    const r = await call('/api/orders', {
      token,
      method: 'POST',
      body: {
        fulfillment: 'pickup',
        schedule: '尽快送达',
        items: [{ productId: 'a', quantity: 1 }],
        customer: { phone: '13800000004' },
      },
    });
    record('E1', r.status === 409 && r.body?.error?.code === 'STORE_CLOSED' ? 'PASS' : 'FAIL', `status=${r.status} code=${r.body?.error?.code}`);
  }

  // S9 rate limit with default-ish 5 — separate process
  active.child.kill('SIGTERM');
  await wait(300);
  active = startServer({ RATE_LIMIT_PER_MINUTE: '5', STORE_HOURS: '00:00-24:00' });
  await ready();
  {
    const statuses = [];
    for (let i = 0; i < 8; i += 1) {
      const r = await call('/api/auth/login', { method: 'POST', body: { code: `rate-${i}` } });
      statuses.push(r.status);
    }
    const limited = statuses.filter((s) => s === 429).length;
    record('S9', limited >= 1 ? 'PASS' : 'FAIL', `login statuses=${statuses.join(',')} limited=${limited}`);
  }

  const summary = {
    at: new Date().toISOString(),
    pass: results.filter((r) => r.status === 'PASS').length,
    gap: results.filter((r) => r.status === 'GAP').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
    results,
  };
  const outDir = path.join(root, 'results');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'edge-check.json'), JSON.stringify(summary, null, 2));

  console.log(`\nEdge check: ${summary.pass} PASS / ${summary.gap} GAP / ${summary.fail} FAIL`);
  if (summary.fail) {
    console.error('Failed:', results.filter((r) => r.status === 'FAIL'));
    process.exitCode = 1;
  } else {
    console.log('Edge check finished (GAP = documented product/doc mismatches under mock)');
  }
} catch (error) {
  console.error(error);
  console.error(active.output());
  process.exitCode = 1;
} finally {
  active.child.kill('SIGTERM');
}
