import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ProviderStore } from './provider-store';
export async function migrateBootstrapSecrets(store: ProviderStore) {
  const saved = await store.getOAuthCredentials('bootstrap');
  const pending: string[] = [];
  for (const [file, field] of [['paperclip-auth.json', 'paperclipAuth'], ['business-connector-keys.json', 'connectorKeys'], ['paperclip.env', 'paperclipServerSecret']] as const) {
    const target = path.join(store.directory, file); let text: string;
    try { text = await fs.readFile(target, 'utf8'); } catch (e: any) { if (e.code === 'ENOENT') continue; throw e; }
    const value = file.endsWith('.env') ? text.match(/^BETTER_AUTH_SECRET=([A-Za-z0-9_-]+)\s*$/)?.[1] : JSON.parse(text);
    if (!value || (field === 'paperclipAuth' && (!value.email || !value.password)) || (field === 'connectorKeys' && Object.values(value).some(v => typeof v !== 'string'))) throw new Error('Invalid bootstrap secret file. Original preserved.');
    if (saved[field] && JSON.stringify(saved[field]) !== JSON.stringify(value)) throw new Error('Conflicting bootstrap secrets. Originals preserved.');
    saved[field] = value; pending.push(target);
  }
  if (pending.length) {
    await store.setOAuthCredentials(saved, 'bootstrap');
    const verified = await store.getOAuthCredentials('bootstrap');
    if (JSON.stringify(verified) !== JSON.stringify(saved)) throw new Error('Protected bootstrap verification failed. Originals preserved.');
    // Only exact, verified source files under this store are removed after a protected roundtrip.
    for (const target of pending) await fs.unlink(target);
  }
  return saved;
}
