import express from 'express';

type Venue = 'alpaca' | '0x' | 'polymarket';
export async function venueRead(venue: Venue, query: Record<string, unknown>, request: typeof fetch = fetch) {
  let url: URL;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const value = (name: string, pattern: RegExp) => {
    const v = query[name];
    if (typeof v !== 'string' || !pattern.test(v)) throw new Error(`Invalid ${name}`);
    return v;
  };
  if (venue === 'polymarket') {
    url = new URL('https://clob.polymarket.com/book');
    url.searchParams.set('token_id', value('token_id', /^\d{1,100}$/));
  } else if (venue === 'alpaca') {
    if (!process.env.ALPACA_PAPER_KEY_ID || !process.env.ALPACA_PAPER_SECRET_KEY) throw new Error('Alpaca paper credentials are not configured locally');
    url = new URL('https://data.alpaca.markets/v2/stocks/quotes/latest');
    url.searchParams.set('symbols', value('symbol', /^[A-Z][A-Z0-9.]{0,14}$/));
    url.searchParams.set('feed', 'iex');
    headers['APCA-API-KEY-ID'] = process.env.ALPACA_PAPER_KEY_ID;
    headers['APCA-API-SECRET-KEY'] = process.env.ALPACA_PAPER_SECRET_KEY;
  } else if (venue === '0x') {
    if (!process.env.ZEROX_API_KEY) throw new Error('0x API key is not configured locally');
    url = new URL('https://api.0x.org/swap/allowance-holder/price');
    const chain = value('chainId', /^(1|8453|42161|137)$/);
    url.searchParams.set('chainId', chain);
    for (const name of ['sellToken', 'buyToken']) url.searchParams.set(name, value(name, /^0x[0-9a-fA-F]{40}$/));
    const amount = value('sellAmount', /^[1-9]\d{0,77}$/);
    if (BigInt(amount) > (1n << 256n) - 1n) throw new Error('Invalid sellAmount');
    url.searchParams.set('sellAmount', amount);
    headers['0x-api-key'] = process.env.ZEROX_API_KEY;
    headers['0x-version'] = 'v2';
  } else throw new Error('Unknown venue');
  const response = await request(url, { method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Venue returned HTTP ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty venue response');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value: chunk } = await reader.read();
    if (done) break;
    size += chunk.length;
    if (size > 1_000_000) { await reader.cancel(); throw new Error('Venue response too large'); }
    chunks.push(chunk);
  }
  const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  return { venue, mode: 'read-only', receivedAt: new Date().toISOString(), data };
}

export function createVenueRouter() {
  const router = express.Router();
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(req.hostname) || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '') || req.get('X-Quanta-Client') !== 'local-ui' || (origin && origin !== `http://${req.get('host')}`)) {
      res.status(403).json({ error: 'Local gateway access required' }); return;
    }
    next();
  });
  router.get('/status', (_req, res) => res.json({ mode: 'read-only', executionEnabled: false, venues: [
    { id: 'alpaca', sector: 'tradfi', configured: Boolean(process.env.ALPACA_PAPER_KEY_ID && process.env.ALPACA_PAPER_SECRET_KEY), feed: 'iex' },
    { id: '0x', sector: 'defi', configured: Boolean(process.env.ZEROX_API_KEY), indicativeOnly: true },
    { id: 'polymarket', sector: 'prediction', configured: true, publicData: true },
  ] }));
  router.get('/:venue/quote', async (req, res) => {
    if (!['alpaca', '0x', 'polymarket'].includes(String(req.params.venue))) { res.status(404).json({ error: 'Unknown venue' }); return; }
    try { res.json(await venueRead(req.params.venue as Venue, req.query)); }
    catch (error) { const message = error instanceof Error ? error.message : ''; res.status(502).json({ error: /^(Invalid |.*credentials are not configured|0x API key is not configured|Venue returned HTTP|Venue response too large)/.test(message) ? message : 'Venue read failed' }); }
  });
  router.all('/{*path}', (_req, res) => res.status(405).json({ error: 'Execution is disabled; this gateway supports market reads only' }));
  return router;
}
