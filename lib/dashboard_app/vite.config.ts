import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
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
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
