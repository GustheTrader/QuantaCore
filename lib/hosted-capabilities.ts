// The hosted site (Vercel) serves only the built frontend plus Supabase Edge Functions.
// Screens that need the local QuantaCore server are hidden there instead of failing
// with confusing network errors. Keep this list in sync with docs/RELEASE.md.
export const LOCAL_ONLY_PATHS: Record<string, string> = {
  '/coding-harness': 'Coding harnesses and the CLI terminal run on your computer.',
  '/harness-router': 'HarnessRouter runs in Docker on your computer.',
  '/agent-house': 'Open House uses the local HarnessRouter and private local KBs.',
  '/openmuse': 'OpenMuse runs on your computer.',
  '/opendots': 'OpenDots runs in Docker on your computer.',
  '/agents': 'The agent directory uses local OpenDots sessions.',
  '/hermes': 'Hermes workspaces run on your computer.',
  '/work-zone': 'Paperclip runs in Docker on your computer.',
  '/quantatrade': 'QuantaTrade uses the local research worker and Paperclip.',
  '/lost-assets': 'Lost Asset Manager reads your local DuckDB database and source files.',
  '/research': 'The TradingAgents research worker runs on your computer.',
  '/alexandria': 'Firecrawl Alexandria keeps its API key on your computer.',
  '/rsi-lab': 'RSI experiments run in an isolated local worker.',
  '/mcp': 'MCP connectors are configured on your computer.',
  '/cloudroom': 'Cloudroom runs on your computer and keeps your Zo core token there.',
};

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
export const isHostedSite = (hostname = typeof window === 'undefined' ? '127.0.0.1' : window.location.hostname) => !LOOPBACK.has(hostname);

export function localOnlyReason(pathname: string): string | null {
  const match = Object.keys(LOCAL_ONLY_PATHS).find(path => pathname === path || pathname.startsWith(path + '/'));
  return match ? LOCAL_ONLY_PATHS[match] : null;
}
