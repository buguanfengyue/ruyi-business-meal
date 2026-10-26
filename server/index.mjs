import { loadConfig } from './config.mjs';
import { createApp } from './app.mjs';

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const app = createApp({ config });
app.listen(config.port, config.host, () => {
  console.log(`[ruyi-api] listening on http://${config.host}:${config.port} (auth=${config.auth.mode}, payment=${config.pay.mode}, db=${config.databasePath})`);
});

let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    console.log(`[ruyi-api] ${signal} received, shutting down`);
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    await app.shutdown();
    process.exit(0);
  });
}
