import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [entry] = process.argv.slice(2);
if (!entry) throw new Error('Missing installed Gemini CLI.');
const directory = path.dirname(entry);
const bundle = readdirSync(directory).find(name => name.startsWith('chunk-') && name.endsWith('.js') && /\bgetOauthClient,/.test(readFileSync(path.join(directory, name), 'utf8')));
if (!bundle) throw new Error('Installed Gemini authentication module is unavailable.');
const { getOauthClient } = await import(pathToFileURL(path.join(directory, bundle)).href);
if (typeof getOauthClient !== 'function') throw new Error('Installed Gemini authentication module is incompatible.');
process.env.NO_BROWSER = 'true';
process.env.GEMINI_CLI_TRUST_WORKSPACE = 'false';
console.log('Google sign-in only. Keep Quanta open, authorize in Google, then paste the code into Quanta.');
try {
  await getOauthClient('oauth-personal', {
    getProxy: () => undefined,
    isBrowserLaunchSuppressed: () => true,
    isInteractive: () => true,
    getAcpMode: () => false,
  });
  console.log('\nGoogle sign-in completed. Your Gemini connection is saved.');
  process.exit(0);
} catch {
  console.error('\nGoogle sign-in did not finish. Start a new Google sign-in and use its new code.');
  process.exit(1);
}
