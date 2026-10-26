// Online backup of the SQLite database into data/backups/, keeping the newest
// BACKUP_KEEP files (default 14). Safe to run while the API is serving.
// Schedule daily, e.g. cron: 30 3 * * * cd /srv/ruyi && npm run db:backup
import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../server/db.mjs';

const source = process.env.DATABASE_PATH || 'data/ruyi.db';
if (!fs.existsSync(source)) {
  console.error(`数据库不存在：${source}`);
  process.exit(1);
}
const dir = process.env.BACKUP_DIR || path.join(path.dirname(path.resolve(source)), 'backups');
const keep = Math.max(1, Number(process.env.BACKUP_KEEP) || 14);
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
const target = path.join(dir, `ruyi-${stamp}.db`);

const db = openDatabase(source);
try {
  db.backupTo(target);
  const check = openDatabase(target);
  const integrity = check.one('PRAGMA integrity_check').integrity_check;
  check.close();
  if (integrity !== 'ok') throw new Error(`备份校验失败：${integrity}`);
} finally {
  db.close();
}

const backups = fs.readdirSync(dir).filter((f) => /^ruyi-\d{8}-\d{6}\.db$/.test(f)).sort();
for (const old of backups.slice(0, Math.max(0, backups.length - keep))) fs.rmSync(path.join(dir, old));
console.log(`备份完成：${target}（保留最近 ${keep} 份）`);
