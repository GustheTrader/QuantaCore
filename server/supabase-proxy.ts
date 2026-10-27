import type { Request, Response } from 'express';

const TARGET = process.env.QUANTA_SUPABASE_TARGET || 'http://127.0.0.1:8000';
const ALLOWED = /^\/(auth|rest)\/v1(\/|$|\?)/;
const HOP = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'cookie', 'accept-encoding']);

/** Same-origin gateway to the Supabase API on this machine so the browser never needs the private Supabase host. */
export const supabaseProxy = async (req: Request, res: Response) => {
  if (!ALLOWED.test(req.url)) return res.status(404).json({ error: 'not found' });
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k) && typeof v === 'string') headers[k] = v;
  if (headers['x-quanta-auth']) { headers.authorization = headers['x-quanta-auth']; delete headers['x-quanta-auth']; }
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(await (async () => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    return chunks;
  })());
  try {
    const upstream = await fetch(`${TARGET}${req.url}`, { method: req.method, headers, body, redirect: 'manual' });
    res.status(upstream.status);
    upstream.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k)) res.setHeader(k, v); });
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(502).json({ error: 'supabase unavailable' });
  }
};
