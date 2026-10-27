import type { Request } from 'express';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const LOOPBACK_SOCKETS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// QUANTA_TRUSTED_HOSTS lists extra hostnames (comma separated) that reach this loopback-only server through an
// authenticated front door, e.g. a private Zo service host. Sockets must still be loopback.
const trustedHosts = () => new Set((process.env.QUANTA_TRUSTED_HOSTS || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean));

export const isLocalHost = (hostname: string) => LOOPBACK_HOSTS.has(hostname) || trustedHosts().has(hostname.toLowerCase());
export const isLoopbackSocket = (req: Request) => LOOPBACK_SOCKETS.has(req.socket.remoteAddress || '');
const forwardedTrusted = (req: Request) => { const h = String(req.get('x-forwarded-host') || '').split(',')[0].trim().toLowerCase(); return isLoopbackSocket(req) && h && trustedHosts().has(h) ? h : ''; };
export const isProxied = (req: Request) => !!forwardedTrusted(req) || (!LOOPBACK_HOSTS.has(req.hostname) && trustedHosts().has(req.hostname.toLowerCase()));
export const publicOrigin = (req: Request) => `${isProxied(req) ? 'https' : req.protocol}://${forwardedTrusted(req) || req.get('host')}`;
export const sameOrigin = (req: Request) => { const origin = req.get('origin'); return !origin || origin === publicOrigin(req); };
