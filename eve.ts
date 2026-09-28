import express from 'express';
import { createServer as createViteServer, loadEnv } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProviderStore } from './server/provider-store';
import { createInferenceRouters } from './server/inference-router';
import { createCliRouter } from './server/cli-router';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  // Provider credentials stay server-side; load the ignored local .env without
  // defining or injecting any key into the browser bundle.
  const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  for (const [key, value] of Object.entries(loadEnv(mode, __dirname, ''))) {
    if (process.env[key] === undefined || !process.env[key]?.trim()) process.env[key] = value;
  }

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));
  const providerStore = new ProviderStore(path.join(__dirname, '.quanta'));
  const inference = createInferenceRouters(providerStore);
  app.use('/api/inference', inference.api);
  app.use('/api/cli', createCliRouter(providerStore));
  app.get('/api/openmuse/status', async (_req, res) => {
    try {
      const response = await fetch('http://127.0.0.1:8787/api/health', { signal: AbortSignal.timeout(2000) });
      if (!response.ok) throw new Error('OpenMuse health check failed');
      const health = await response.json();
      res.json({ reachable: true, mode: health.mode, agentConfigured: Boolean(health.agentConfigured), browserConfigured: Boolean(health.browserConfigured) });
    } catch {
      res.json({ reachable: false, mode: null, agentConfigured: false, browserConfigured: false });
    }
  });
  app.use('/v1', inference.openai);
  app.use('/api', (_req, res) => res.status(404).json({ error: { message: 'Unknown API endpoint.' } }));

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('/{*path}', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(PORT, '127.0.0.1');
  server.on('listening', () => console.log(`Server running on http://127.0.0.1:${PORT}`));
  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error(`Local server could not bind port ${PORT}: ${error.code || 'startup error'}`);
    process.exit(1);
  });
}

startServer();
