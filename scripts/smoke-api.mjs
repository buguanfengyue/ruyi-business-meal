import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8788;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server/mock-server.mjs'], {
  cwd: root,
  env: { ...process.env, RUYI_API_PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => { output += chunk; });
child.stderr.on('data', (chunk) => { output += chunk; });

async function request(pathname, options) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options?.headers || {}) },
  });
  const body = await response.json();
  return { response, body };
}

try {
  let health;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      health = await request('/api/health');
      break;
    } catch {
      await wait(50);
    }
  }
  assert.equal(health?.response.status, 200, output || 'API 未在预期端口启动');
  assert.equal(health.body.ok, true);

  const bootstrap = await request('/api/bootstrap');
  assert.equal(bootstrap.response.status, 200);
  assert.equal(bootstrap.body.products.length, 4);

  const products = await request('/api/products?category=soup');
  assert.equal(products.response.status, 200);
  assert.equal(products.body.products[0].id, 'd');

  const order = await request('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      items: [{ productId: 'a', quantity: 2 }, { productId: 'd', quantity: 1 }],
      customer: { phone: '15805320100', nickname: '本地测试' },
      fulfillment: 'delivery',
      note: 'smoke test',
    }),
  });
  assert.equal(order.response.status, 201);
  assert.match(order.body.order.id, /^RY/);
  assert.equal(order.body.order.items.length, 2);
  assert.equal(order.body.order.totals.total, 101.16);

  const orders = await request('/api/orders');
  assert.equal(orders.response.status, 200);
  assert.equal(orders.body.total, 1);

  console.log('API smoke test passed');
} finally {
  child.kill('SIGTERM');
}

