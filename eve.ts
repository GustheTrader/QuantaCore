import express from 'express';
import { supabaseProxy } from './server/supabase-proxy';
import { existsSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProviderStore } from './server/provider-store';
import { createZoMcpRouter } from './server/zo-mcp-router';
import { createInferenceRouters } from './server/inference-router';
import { createCliRouter } from './server/cli-router';
import { ResearchManager } from './server/research-manager';
import { createResearchRouter } from './server/research-router';
import { createMemoryRouter } from './server/memory-router';
import { createLostAssetsRouter } from './server/lost-assets-router';
import { createCloudroomRouter } from './server/cloudroom-router';
import { createHarnessRouterApi } from './server/harness-router';
import { createGeminiProxy } from './server/gemini-proxy';
import { contentSecurityPolicy } from './lib/csp';
import { createWorkzoneRouter } from './server/workzone-router';
import { createOpenDotsRouter } from './server/opendots-router';
import { HybridManager } from './server/hybrid-manager';
import { createHybridRouter } from './server/hybrid-router';
import { createVenueRouter } from './server/venue-router';
import { createBusinessBridge } from './server/business-bridge';
import { ChatGptOAuth } from './server/chatgpt-oauth';
import { ChatGptPlan } from './server/chatgpt-plan';
import { createChatGptRouter } from './server/chatgpt-router';
import { migrateBootstrapSecrets } from './server/bootstrap-secrets';
import { GoogleOAuth, createGoogleOAuthRouter } from './server/google-oauth';
import { OpenRouterOAuth, createOpenRouterOAuthRouter } from './server/openrouter-oauth';
import { HermesManager } from './server/hermes-manager';
import { createHermesRouter } from './server/hermes-router';
import { createHermesSkillRouter } from './server/hermes-skill-router';
import { createFirecrawlAlexandriaRouter } from './server/firecrawl-alexandria-router';
import { createComposioRouter } from './server/composio-router';
import { createTinyFishRouter } from './server/tinyfish-router';
import { RsiManager } from './server/rsi-manager';
import { createRsiRouter } from './server/rsi-router';
import { OperatingEvidence } from './server/operating-evidence';
import { createEvidenceRouter } from './server/evidence-router';
import { createQsReadOnlyRouter } from './server/qs-readonly-bridge';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  // Provider credentials stay server-side; load the ignored local .env without
  // defining or injecting any key into the browser bundle.
  if (process.argv.includes('--production')) process.env.NODE_ENV = 'production';
  for (const filename of ['.env', '.env.local']) if (existsSync(path.join(__dirname, filename))) process.loadEnvFile(path.join(__dirname, filename));

  const app = express();
  const hermes = new HermesManager(__dirname);
  const PORT = Number(process.env.QUANTA_PORT || 3000);

  app.use('/supa', supabaseProxy);
  app.use(express.json({ limit: '2mb' }));
  const operatingEvidence = new OperatingEvidence(__dirname);
  app.use(operatingEvidence.middleware());
  const providerStore = new ProviderStore(path.join(__dirname, '.quanta'));
  const rsi = new RsiManager(providerStore, __dirname, PORT);
  // Startup only migrates plaintext sources; it does not need to unlock saved bootstrap credentials.
  await migrateBootstrapSecrets(providerStore, false);
  const research = new ResearchManager(providerStore, __dirname);
  const hybrid = new HybridManager(providerStore, __dirname);
  const chatgpt = new ChatGptPlan(__dirname, new ChatGptOAuth(path.join(__dirname, '.quanta'), providerStore));
  const chatgptRoutes = createChatGptRouter(chatgpt);
  const googleRoutes = createGoogleOAuthRouter(new GoogleOAuth(providerStore));
  const openrouterRoutes = createOpenRouterOAuthRouter(new OpenRouterOAuth(providerStore));
  hybrid.start();
  const inference = createInferenceRouters(providerStore, research);
  app.use('/api/evidence', createEvidenceRouter(__dirname, operatingEvidence, providerStore, research.store));
  app.use('/api/qs-bridge', createQsReadOnlyRouter(__dirname, operatingEvidence));
  app.use('/api/inference', inference.api);
  app.use('/api/hermes', createHermesSkillRouter());
  app.use('/api/hermes', createHermesRouter(hermes, __dirname));
  app.use('/api/mcp/zo', createZoMcpRouter(providerStore));
  app.use('/api/trading', createResearchRouter(research));
  app.use('/api/cli', createCliRouter(providerStore, research));
  app.use('/api/memory', createMemoryRouter(__dirname));
  app.use('/api/lost-assets', createLostAssetsRouter(__dirname));
  app.use('/api/cloudroom', createCloudroomRouter(providerStore, __dirname));
  app.use('/api/firecrawl-alexandria', createFirecrawlAlexandriaRouter());
  app.use('/api/composio', createComposioRouter(providerStore));
  app.use('/api/tinyfish', createTinyFishRouter());
  app.use('/api/rsi', createRsiRouter(rsi));
  app.use('/api/harness-router', createHarnessRouterApi(providerStore));
  app.use('/api/gemini', createGeminiProxy(providerStore));
  app.use('/api/work-zone', createWorkzoneRouter(__dirname));
  app.use('/api/opendots', createOpenDotsRouter(__dirname));
  app.use('/api/hybrid', createHybridRouter(hybrid));
  app.use('/api/venues', createVenueRouter());
  app.use('/api/business-bridge', createBusinessBridge(__dirname, providerStore, hybrid, fetch, chatgpt));
  app.use('/api/chatgpt', chatgptRoutes.api);
  app.use('/auth/openai', chatgptRoutes.callback);
  app.use('/api/google-oauth', googleRoutes.api);
  app.use('/auth/google', googleRoutes.callback);
  app.use('/api/openrouter-oauth', openrouterRoutes.api);
  app.use('/auth/openrouter', openrouterRoutes.callback);
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
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Vite's dev server injects inline scripts, so the policy applies to built pages only.
    const csp = contentSecurityPolicy('local');
    app.use((_req, res, next) => { res.setHeader('Content-Security-Policy', csp); res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('/{*path}', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(PORT, '127.0.0.1');
  const shutdown = () => { rsi.close(); hermes.close(); hybrid.stop(); void research.stop().finally(() => server.close(() => { operatingEvidence.close(); process.exit(0); })); };
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  server.on('listening', () => { console.log(`Server running on http://127.0.0.1:${PORT}`); void research.start().catch(error=>{console.error(error.message);server.close(()=>process.exit(1));}); });
  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error(`Local server could not bind port ${PORT}: ${error.code || 'startup error'}`);
    process.exit(1);
  });
}

startServer();
