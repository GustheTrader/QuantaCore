import { getLocalSecrets } from './protected-secrets.mjs';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const keys = (await getLocalSecrets()).connectorKeys || {};
const base = 'http://127.0.0.1:3000/api/business-bridge';
const status = await fetch(base + '/status', { headers: { 'X-Quanta-Client': 'local-ui' }, signal: AbortSignal.timeout(10000) });
console.log('Bridge status:', JSON.stringify(await status.json()));
const code = `import {guardedHttpAdapterFetch} from './server/src/adapters/http/remote-fetch.ts';let input='';process.stdin.on('data',chunk=>input+=chunk);process.stdin.on('end',async()=>{try{const token=JSON.parse(input).token;const response=await guardedHttpAdapterFetch('http://host.docker.internal:3000/api/business-bridge/paperclip/heartbeat',{method:'HEAD',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});console.log('Authenticated Paperclip guarded heartbeat probe:',response.status);if(response.status!==200)process.exitCode=1;}catch{console.log('Authenticated Paperclip guarded heartbeat probe unavailable');process.exitCode=1;}});`;
try { console.log(execFileSync('docker', ['exec', '-i', 'quanta-paperclip', 'node', '--import', './server/node_modules/tsx/dist/loader.mjs', '--input-type=module', '-e', code], { input: JSON.stringify({ token: keys.paperclip }), encoding: 'utf8', timeout: 45000, stdio: ['pipe', 'pipe', 'pipe'] }).trim()); }
catch { console.error('Docker heartbeat probe unavailable'); process.exitCode = 1; }
if (process.argv.includes('--model')) {
  const response = await fetch(base + '/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + keys.twenty, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'local', messages: [{ role: 'user', content: 'Local connection test: reply READY.' }] }), signal: AbortSignal.timeout(70000) });
  const data = await response.json();
  console.log('Local model test:', response.status, response.ok ? `nonemptyText=${Boolean(data.choices?.[0]?.message?.content)}` : data.error?.message);
  if (!response.ok) process.exitCode = 1;
}
