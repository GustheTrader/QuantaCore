// Content Security Policy for the built app. Only this site's own scripts may run, and
// the page may only talk to the services listed here. If a script is ever injected, it
// cannot load code from elsewhere or send data to an unknown server.
// Keep vercel.json in sync: lib/csp.test.ts checks it.
export function contentSecurityPolicy(mode: 'local' | 'hosted') {
  const connect = ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co', 'https://generativelanguage.googleapis.com', 'wss://generativelanguage.googleapis.com', 'https://api.novita.ai', 'https://wttr.in'];
  if (mode === 'local') connect.push('http://127.0.0.1:*', 'http://localhost:*', 'ws://127.0.0.1:*', 'ws://localhost:*');
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https://generativelanguage.googleapis.com",
    `connect-src ${connect.join(' ')}`,
    "worker-src 'self' blob:",
    // Local mode may frame local apps such as Cloudroom (http://127.0.0.1:39886).
    `frame-src ${mode === 'local' ? "'self' http://127.0.0.1:* http://localhost:* " : ''}https://qs-terminal-systems-lab.brisk-beech-3852.chatgpt.site`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}
