import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getLocalSecrets } from './protected-secrets.mjs';
const args = process.argv.slice(2);
if (!['up', 'down', 'ps', 'logs', 'restart', 'stop', 'start'].includes(args[0])) throw new Error('Supported operations: up, down, ps, logs, restart, stop, start. Configuration output is withheld to protect secrets.');
const secrets = await getLocalSecrets();
if (!secrets.paperclipServerSecret) throw new Error('Prepare protected Paperclip credentials first.');
const result = spawnSync('docker', ['compose', '-p', 'quanta-paperclip', '-f', fileURLToPath(new URL('../deploy/paperclip.compose.yml', import.meta.url)), ...args], { stdio: 'inherit', windowsHide: true, env: { ...process.env, PAPERCLIP_BETTER_AUTH_SECRET: secrets.paperclipServerSecret } });
process.exitCode = result.status ?? 1;
