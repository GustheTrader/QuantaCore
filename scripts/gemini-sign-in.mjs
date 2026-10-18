import { spawn } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { createInterface } from 'node:readline';

// Use the CLI's supported authentication protocol. Never create a session or send a prompt.
const [entry, linkFile] = process.argv.slice(2);
if (!entry || !linkFile) throw new Error('Missing local Gemini authentication entry point.');
const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)));
env.GEMINI_CLI_TRUST_WORKSPACE = 'false';
// Keep authentication in the child we own so cancellation also stops its callback server.
env.GEMINI_CLI_NO_RELAUNCH = 'true';
delete env.GEMINI_CLI_AUTH_OVERRIDE;
delete env.NO_BROWSER;
const child = spawn(process.execPath, [entry, '--acp'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env });
let finished = false;
function clearLink() { try { unlinkSync(linkFile); } catch {} }
function finish(code, message) {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  clearLink();
  console.log(message);
  child.kill();
  process.exitCode = code;
}
const timeout = setTimeout(() => finish(1, 'Google sign-in timed out. Start browser sign-in again.'), 300000);
const send = (id, method, params) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
console.log('Opening Google browser authorization through Gemini CLI…');
console.log('Complete Google login and consent in your browser. No workspace prompt is sent.');
const lines = createInterface({ input: child.stdout });
lines.on('line', line => {
  if (line.length > 65536 || finished) return;
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message.id === 1) {
    if (message.error || !message.result?.authMethods?.some(m => m.id === 'oauth-personal' && (!m.type || m.type === 'agent'))) {
      finish(1, 'This Gemini CLI did not offer Google browser authentication. Update the native sign-in tool.'); return;
    }
    send(2, 'authenticate', { methodId: 'oauth-personal' });
  } else if (message.id === 2) {
    if (message.error) finish(1, 'Google authentication was not completed. Start browser sign-in again.');
    else if (message.result && typeof message.result === 'object') finish(0, 'Google sign-in completed. Quanta will refresh the connection badge.');
  } else if (message.method && message.id !== undefined) {
    // This client offers no files, terminals, tools, sessions or permission approvals.
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Authentication-only client.' } }) + '\n');
  }
});
let diagnostic = '';
child.stderr.on('data', chunk => {
  diagnostic = (diagnostic + chunk.toString()).slice(-16384);
  for (const candidate of diagnostic.matchAll(/https:\/\/accounts\.google\.com\/[^\s\u001b]+/g)) {
    try {
      const url = new URL(candidate[0]);
      const callback = new URL(url.searchParams.get('redirect_uri') || '');
      if (url.hostname !== 'accounts.google.com' || !url.pathname.startsWith('/o/oauth2/') || url.searchParams.get('response_type') !== 'code' || !url.searchParams.get('client_id') || !url.searchParams.get('state') || callback.hostname !== '127.0.0.1' || callback.protocol !== 'http:' || callback.pathname !== '/oauth2callback') continue;
      writeFileSync(linkFile, JSON.stringify({ authorizeUrl: url.toString(), expiresAt: Date.now() + 300000 }), { mode: 0o600 });
    } catch {}
  }
});
child.on('error', () => finish(1, 'Could not start the installed Gemini CLI.'));
child.on('exit', () => { if (!finished) finish(1, 'Google sign-in ended before authentication completed.'); });
child.stdin.on('error', () => { if (!finished) finish(1, 'Google authentication connection closed.'); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => finish(1, 'Google sign-in cancelled.'));
process.on('exit', () => { clearLink(); child.kill(); });
send(1, 'initialize', { protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: 'quanta-google-sign-in', version: '1' } });
