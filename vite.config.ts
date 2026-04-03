import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/client-entry.ts',
      name: 'GrowrPluginPageLoadTimer',
      fileName: 'client-entry',
      formats: ['iife'],
    },
  },
});
