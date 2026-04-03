import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/client-entry.ts',
      name: 'growi-plugin-page-load-timer',
      fileName: 'client-entry',
      formats: ['iife'],
    },
  },
});
