import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.ts';

export default defineConfig(({ mode }) => {
  // Expose VITE_* vars to manifest.config.ts (which reads process.env at build time).
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    publicDir: 'public',
    plugins: [react(), crx({ manifest })],
    build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
  };
});
