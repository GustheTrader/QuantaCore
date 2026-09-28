#!/usr/bin/env node

const command = process.argv.slice(2).join(' ');
if (!command) {
  process.stdout.write('Quanta CLI\nUsage: node bin/quanta.mjs <command>\nRun: node bin/quanta.mjs help\n');
  process.exit(0);
}

const baseUrl = process.env.QUANTA_LOCAL_URL || 'http://127.0.0.1:3000';
let url;
try { url = new URL(baseUrl); }
catch { process.stderr.write('QUANTA_LOCAL_URL must be a local URL.\n'); process.exit(2); }
if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname) || url.protocol !== 'http:') {
  process.stderr.write('Quanta CLI connects only to the local server.\n');
  process.exit(2);
}

try {
  const response = await fetch(new URL('/api/cli/run', url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Quanta-Client': 'local-ui' },
    body: JSON.stringify({ command }),
    signal: AbortSignal.timeout(185000)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Local server returned HTTP ${response.status}.`);
  process.stdout.write(`${data.lines.join('\n')}\n`);
} catch (error) {
  process.stderr.write(`Quanta CLI: ${error.message}\n`);
  process.exitCode = 1;
}
