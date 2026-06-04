import { fileURLToPath } from 'url';
import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      // Forward JARVIS-brain calls to the always-on Docker reasoning core.
      '/api': {
        target: process.env.JARVIS_BRAIN_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
      // Forward version-control telemetry (+ SSE stream) to the host-side git daemon,
      // which watches every repo and snapshots dirty work (scripts/git-daemon.mjs).
      '/gitd': {
        target: process.env.JARVIS_GIT_DAEMON_URL || 'http://127.0.0.1:7878',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/gitd/, ''),
      },
    },
  },
  plugins: [react()],
  assetsInclude: ['**/*.task'],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
  }
});
