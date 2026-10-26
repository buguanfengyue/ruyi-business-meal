import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * SQLite storage (Node's built-in node:sqlite, no native dependency).
 *
 * Money is stored as integer fen. Timestamps are ISO-8601 UTC strings.
 * Migrations are append-only: never edit a shipped entry, add a new one.
 */
const MIGRATIONS = [
  `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '',
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE products (
    id TEXT PRIMARY KEY,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    price_fen INTEGER NOT NULL,
    list_price_fen INTEGER NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    emoji TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    available INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    openid TEXT UNIQUE,
    unionid TEXT,
    nickname TEXT NOT NULL DEFAULT '未授权',
    phone TEXT NOT NULL DEFAULT '',
    registered INTEGER NOT NULL DEFAULT 0,
    balance_fen INTEGER NOT NULL DEFAULT 0,
    auth_mode TEXT NOT NULL DEFAULT 'mock',
    created_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);
  CREATE TABLE addresses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    detail TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX addresses_user ON addresses(user_id);
  CREATE TABLE coupons (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    amount_fen INTEGER NOT NULL,
    threshold_fen INTEGER NOT NULL,
    valid_from TEXT NOT NULL,
    valid_to TEXT NOT NULL,
    source TEXT NOT NULL,
    used_by TEXT,
    gift_code TEXT UNIQUE,
    gifted_at TEXT,
    claimed_by TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX coupons_user ON coupons(user_id);
  CREATE TABLE invitations (
    id TEXT PRIMARY KEY,
    inviter_id TEXT NOT NULL REFERENCES users(id),
    invitee_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'valid',
    created_at TEXT NOT NULL
  );
  CREATE INDEX invitations_inviter ON invitations(inviter_id);
  CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    pickup_no INTEGER NOT NULL,
    business_date TEXT NOT NULL,
    status TEXT NOT NULL,
    fulfillment TEXT NOT NULL,
    schedule TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    customer_phone TEXT NOT NULL,
    customer_nickname TEXT NOT NULL DEFAULT '',
    address_json TEXT,
    items_json TEXT NOT NULL,
    coupon_id TEXT,
    coupon_title TEXT,
    subtotal_fen INTEGER NOT NULL,
    discount_fen INTEGER NOT NULL,
    coupon_discount_fen INTEGER NOT NULL,
    total_fen INTEGER NOT NULL,
    member_level INTEGER NOT NULL DEFAULT 0,
    payment_method TEXT,
    transaction_id TEXT,
    refund_status TEXT,
    refund_no TEXT,
    cancel_reason TEXT,
    created_at TEXT NOT NULL,
    paid_at TEXT,
    accepted_at TEXT,
    completed_at TEXT,
    cancelled_at TEXT,
    refunded_at TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX orders_user ON orders(user_id, created_at);
  CREATE INDEX orders_status ON orders(status, created_at);
  CREATE INDEX orders_date ON orders(business_date);
  CREATE INDEX orders_updated ON orders(updated_at);
  CREATE TABLE payment_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT,
    kind TEXT NOT NULL,
    detail_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX payment_events_order ON payment_events(order_id);
  CREATE TABLE admins (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_login_at TEXT
  );
  CREATE TABLE admin_sessions (
    token_hash TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    detail_json TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX audit_created ON audit_log(created_at);
  `,
];

// node:sqlite rejects unknown names, undefined and booleans. Bind exactly the
// names a statement uses (missing ones as NULL) with normalised values.
function bindable(names, params = {}) {
  const out = {};
  for (const name of names) {
    const value = params?.[name];
    out[name] = value === undefined ? null : typeof value === 'boolean' ? Number(value) : value;
  }
  return out;
}
const paramNames = (sql) => [...new Set([...sql.replace(/'[^']*'/g, '').matchAll(/(?<![:\w]):([A-Za-z_]\w*)/g)].map((m) => m[1]))];

export function openDatabase(file = ':memory:') {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');

  const statements = new Map();
  const prepare = (sql, params) => {
    let entry = statements.get(sql);
    if (!entry) {
      entry = { statement: raw.prepare(sql), names: paramNames(sql) };
      statements.set(sql, entry);
    }
    return { statement: entry.statement, values: bindable(entry.names, params) };
  };
  const exec = (method) => (sql, params) => {
    const { statement, values } = prepare(sql, params);
    return statement[method](values);
  };

  let depth = 0;
  const db = {
    file,
    raw,
    one: (sql, params) => exec('get')(sql, params) ?? null,
    all: exec('all'),
    run: exec('run'),
    exec: (sql) => raw.exec(sql),
    /** Run `fn` atomically. Must be synchronous: no awaits inside. */
    tx(fn) {
      const savepoint = `sp${depth}`;
      raw.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`);
      depth += 1;
      try {
        const result = fn();
        if (result && typeof result.then === 'function') throw new Error('db.tx callback must be synchronous');
        depth -= 1;
        raw.exec(depth === 0 ? 'COMMIT' : `RELEASE ${savepoint}`);
        return result;
      } catch (error) {
        depth -= 1;
        raw.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
        throw error;
      }
    },
    /** Consistent online copy of the database file. */
    backupTo(target) {
      fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
      raw.exec(`VACUUM INTO '${String(target).replaceAll("'", "''")}'`);
    },
    close() {
      statements.clear();
      raw.close();
    },
  };

  migrate(db);
  return db;
}

function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(db.all('SELECT version FROM schema_migrations').map((row) => row.version));
  MIGRATIONS.forEach((sql, index) => {
    const version = index + 1;
    if (applied.has(version)) return;
    db.tx(() => {
      db.exec(sql);
      db.run('INSERT INTO schema_migrations (version, applied_at) VALUES (:version, :at)', { version, at: new Date().toISOString() });
    });
  });
}

export const schemaVersion = MIGRATIONS.length;
