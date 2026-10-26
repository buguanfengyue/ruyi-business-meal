import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8789;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server/index.mjs'], {
  cwd: root,
  env: { ...process.env, DATABASE_PATH: ':memory:', RUYI_API_PORT: String(port), WECHAT_AUTH_MODE: 'mock', MOCK_WECHAT_PHONE: '15805320100' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => { output += chunk; });
child.stderr.on('data', (chunk) => { output += chunk; });

async function request(pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
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
  assert.equal(health.body.auth.mode, 'mock');

  const config = await request('/api/auth/config');
  assert.equal(config.response.status, 200);
  assert.equal(config.body.auth.mock, true);

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ code: 'local-test-code' }),
  });
  assert.equal(login.response.status, 200);
  assert.match(login.body.session.token, /^ruyi_/);

  const phone = await request('/api/auth/phone', {
    method: 'POST',
    headers: { authorization: `Bearer ${login.body.session.token}` },
    body: JSON.stringify({ code: 'local-phone-code' }),
  });
  assert.equal(phone.response.status, 200);
  assert.equal(phone.body.user.phone, '15805320100');

  const me = await request('/api/me', {
    headers: { authorization: `Bearer ${login.body.session.token}` },
  });
  assert.equal(me.response.status, 200);
  assert.equal(me.body.authenticated, true);
  assert.equal(me.body.user.phone, '15805320100');

  console.log('Auth smoke test passed');
} finally {
  child.kill('SIGTERM');
}
