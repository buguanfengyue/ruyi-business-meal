/**
 * Lightweight Node load baseline (S0/S1-ish) without k6.
 * Starts an isolated mock API, then runs concurrent GETs and a short order loop.
 */
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.RUYI_LOAD_PORT || 8797);
const BASE = `http://127.0.0.1:${port}`;
const outDir = path.join(root, 'results');
fs.mkdirSync(outDir, { recursive: true });

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

async function call(pathname, opts = {}) {
  const started = performance.now();
  const res = await fetch(`${BASE}${pathname}`, {
    method: opts.method || 'GET',
    headers: {
      'content-type': 'application/json',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const ms = performance.now() - started;
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  return { status: res.status, body: json, ms };
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

function summarize(label, samples) {
  const ok = samples.filter((s) => s.status >= 200 && s.status < 300);
  const times = ok.map((s) => s.ms).sort((a, b) => a - b);
  const summary = {
    label,
    n: samples.length,
    ok: ok.length,
    fail: samples.length - ok.length,
    p50: Number(pct(times, 50).toFixed(1)),
    p95: Number(pct(times, 95).toFixed(1)),
    p99: Number(pct(times, 99).toFixed(1)),
    max: Number((times.at(-1) || 0).toFixed(1)),
  };
  console.log(summary);
  return summary;
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

const { child, output } = startServer();
const report = { at: new Date().toISOString(), scenarios: [] };
try {
  await ready();

  // S0 single-user baseline
  const s0 = [];
  for (const pathName of ['/api/health', '/api/bootstrap', '/api/products', '/api/products?category=soup']) {
    for (let i = 0; i < 20; i += 1) s0.push(await call(pathName));
  }
  report.scenarios.push(summarize('S0 sequential reads', s0));

  // Concurrent products (smoke probe from doc)
  const concurrent = await Promise.all(Array.from({ length: 300 }, () => call('/api/products')));
  report.scenarios.push(summarize('S1-ish 300 concurrent GET /api/products', concurrent));

  // Short order loop 10 VUs × 5 rounds
  const tokens = [];
  for (let i = 0; i < 10; i += 1) {
    const login = await call('/api/auth/login', { method: 'POST', body: { code: `load-vu-${i}` } });
    tokens.push(login.body.session.token);
    await call('/api/session/register', { token: tokens[i], method: 'POST', body: { nickname: `load${i}` } });
  }
  const orderSamples = [];
  await Promise.all(tokens.map(async (token, vu) => {
    for (let round = 0; round < 5; round += 1) {
      const quote = await call('/api/cart/quote', {
        token,
        method: 'POST',
        body: { items: [{ productId: 'a', quantity: 1 }] },
      });
      orderSamples.push(quote);
      const created = await call('/api/orders', {
        token,
        method: 'POST',
        body: {
          fulfillment: 'pickup',
          schedule: '尽快送达',
          items: [{ productId: 'a', quantity: 1 }],
          customer: { phone: `1390000${String(vu).padStart(4, '0')}` },
        },
      });
      orderSamples.push(created);
      if (created.status === 201) {
        const paid = await call(`/api/orders/${created.body.order.id}/pay`, { token, method: 'POST' });
        orderSamples.push(paid);
      }
    }
  }));
  report.scenarios.push(summarize('S3-ish 10 VU × 5 quote/order/pay', orderSamples));

  const out = path.join(outDir, 'load-baseline.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`Wrote ${out}`);
  console.log('Load baseline done');
} catch (error) {
  console.error(error);
  console.error(output());
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
}
