import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser uses relative `/api/*` URLs. Vite proxies those calls to the
// local Node mock server during development; production can point the same
// client at a deployed API via VITE_API_BASE_URL.
export default defineConfig({
  plugins: [react()],
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

