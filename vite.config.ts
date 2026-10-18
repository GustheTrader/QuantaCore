import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-ignore plain ESM helper shared with CI
import { releaseInfo } from './scripts/release-info.mjs';

const release = releaseInfo(__dirname);

// Publishes /version.json so anyone can confirm which commit a site was built from.
const releaseFile: Plugin = {
  name: 'quanta-release-info',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(release, null, 2) + '\n' }); },
};

export default defineConfig(() => ({
      server: {
        port: 3000,
        host: '127.0.0.1',
        watch: { ignored: ['**/FPhindsight/**', '**/.quanta/**'] },
      },
      optimizeDeps: { entries: ['index.html', 'hybrid.html'] },
      build: { rollupOptions: { input: { app: path.resolve(__dirname, 'index.html'), hybrid: path.resolve(__dirname, 'hybrid.html') } } },
      define: { __QUANTA_RELEASE__: JSON.stringify(release) },
      plugins: [react(), releaseFile],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    }));
