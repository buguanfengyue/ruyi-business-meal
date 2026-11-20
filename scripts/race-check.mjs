/**
 * S4: same-coupon concurrent create-order race.
 * Expect exactly one 201 and the rest 409; coupon ends as used.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.RUYI_RACE_PORT || 8795);
const BASE = `http://127.0.0.1:${port}`;
const CONCURRENCY = Number(process.env.RACE_N || 50);

function startServer() {
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
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (c) => { output += c; });
  child.stderr.on('data', (c) => { output += c; });
  return { child, output: () => output };
}

async function call(pathname, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { status: res.status, body: json };
}

async function ready() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const h = await call('/api/health');
      if (h.status === 200) return;
    } catch { /* retry */ }
    await wait(50);
  }
  throw new Error('API failed to start');
}

const { child, output } = startServer();
try {
  await ready();
  const login = await call('/api/auth/login', { method: 'POST', body: { code: 'race-coupon-user' } });
  assert.equal(login.status, 200);
  const token = login.body.session.token;
  await call('/api/session/register', { token, method: 'POST', body: { nickname: '并发券测' } });

  const coupons = (await call('/api/coupons?status=available', { token })).body.coupons;
  const coupon = coupons.find((c) => Number(c.threshold) <= 114);
  assert.ok(coupon, '需要可用券（SEED_DEMO=1）');

  const body = {
    fulfillment: 'pickup',
    schedule: '尽快送达',
    items: [{ productId: 'a', quantity: 3 }],
    customer: { phone: '13800000001' },
    couponId: coupon.id,
  };

  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, () => call('/api/orders', { token, method: 'POST', body })),
  );
  const counts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  console.log(`S4 same-coupon race x${CONCURRENCY}:`, counts);

  assert.equal(counts[201], 1, `券超发：201=${counts[201]}`);
  assert.equal((counts[409] || 0) + (counts[201] || 0), CONCURRENCY, '仅允许 201/409');

  const after = (await call('/api/coupons', { token })).body.coupons.find((c) => c.id === coupon.id);
  assert.equal(after.status, 'used', '券最终应为 used');

  // D10: same requestId must collapse concurrent creates to one order.
  const idemBody = {
    fulfillment: 'pickup',
    schedule: '尽快送达',
    items: [{ productId: 'd', quantity: 1 }],
    customer: { phone: '13800000001' },
    requestId: `race-d10-${Date.now()}`,
  };
  const dups = await Promise.all(
    Array.from({ length: 10 }, () => call('/api/orders', { token, method: 'POST', body: idemBody })),
  );
  const dupCounts = dups.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const orderIds = new Set(dups.map((r) => r.body?.order?.id).filter(Boolean));
  console.log('D10 concurrent create with requestId x10:', dupCounts, `uniqueOrders=${orderIds.size}`);
  assert.equal(orderIds.size, 1, `幂等键失效：产生 ${orderIds.size} 个订单`);
  assert.equal((dupCounts[201] || 0) + (dupCounts[200] || 0), 10, '仅允许 200/201');

  console.log('Race check passed');
} catch (error) {
  console.error(error);
  console.error(output());
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
}
