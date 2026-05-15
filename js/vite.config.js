import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    outDir: '../prototypes/dist',
    emptyOutDir: false,
    target: 'esnext',
    minify: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        'cinema-smoke': resolve(__dirname, 'smoke/cinema-smoke.html'),
        'reactor-cinematic-marvel': resolve(__dirname, 'src/reactor-cinematic-marvel.ts'),
      },
      external: [],
      output: {
        entryFileNames: (chunk) => {
          return chunk.name === 'reactor-cinematic-marvel'
            ? 'reactor-cinematic-marvel.js'
            : 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
