import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/client-entry.ts',
      name: 'GrowiPluginPageLoadTimer',
      fileName: 'client-entry',
      formats: ['iife'],
    },
  },
});
