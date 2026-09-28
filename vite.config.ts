import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => ({
      server: {
        port: 3000,
        host: '127.0.0.1',
        watch: { ignored: ['**/FPhindsight/**', '**/.quanta/**'] },
      },
      optimizeDeps: { entries: ['index.html'] },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    }));
