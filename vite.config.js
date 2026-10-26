import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The browser uses relative `/api/*` URLs. Vite proxies those calls to the
// local Node mock server during development; production can point the same
// client at a deployed API via VITE_API_BASE_URL.
export default defineConfig({
  plugins: [react()],
  // Two apps: the customer web replica (index.html) and the merchant admin (admin.html).
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.RUYI_API_TARGET || 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
});

