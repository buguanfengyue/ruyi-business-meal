// Usage:
//   npm run admin:create -- <username>     create a merchant admin
//   npm run admin:password -- <username>   reset an admin's password
// The password is prompted (hidden) or read from ADMIN_NEW_PASSWORD.
import readline from 'node:readline';
import { loadConfig } from '../server/config.mjs';
import { openDatabase } from '../server/db.mjs';
import { createAdmin, setAdminPassword } from '../server/admin.mjs';

const [command, username] = process.argv.slice(2);
if (!['create', 'password'].includes(command) || !username) {
  console.error('用法：npm run admin:create -- <用户名>   或   npm run admin:password -- <用户名>');
  process.exit(1);
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => { if (text.includes(question)) process.stdout.write(text); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

let password = process.env.ADMIN_NEW_PASSWORD;
if (!password) {
  password = await ask('输入密码（至少 10 位）：');
  if (password !== await ask('再次输入密码：')) {
    console.error('两次输入不一致');
    process.exit(1);
  }
}

const config = loadConfig();
const db = openDatabase(config.databasePath);
try {
  if (command === 'create') createAdmin(db, username, password);
  else setAdminPassword(db, username, password);
  console.log(command === 'create' ? `已创建管理员 ${username}` : `已重置 ${username} 的密码，旧登录已失效`);
} catch (error) {
  console.error(error.message.includes('UNIQUE') ? `管理员已存在：${username}` : error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
