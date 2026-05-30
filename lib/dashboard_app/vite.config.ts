import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
    return {
      // relative asset paths so the built dist/ works wherever dashboard.py mounts it
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
        // dev: forward telemetry/command calls to the JARVIS backend (loopback :7327)
        proxy: {
          '/api': { target: 'http://127.0.0.1:7327', changeOrigin: true },
        },
      },
      plugins: [react()],
      assetsInclude: ['**/*.task'],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
