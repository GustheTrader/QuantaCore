import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { spawn } from 'node:child_process';
import { COMPATIBLE_PROVIDERS, type CompatibleProvider } from '../lib/inference-providers';

interface Connection { baseUrl: string; model: string; apiKey: string }
interface StoreData {
  connections: Partial<Record<CompatibleProvider, Connection>>;
  preferredProvider: string;
  gatewayKey: string;
}

const dpapi = (value: string, unprotect: boolean): Promise<string> => new Promise((resolve, reject) => {
  const operation = unprotect ? 'Unprotect' : 'Protect';
  const script = `Add-Type -AssemblyName System.Security; $data=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::${operation}($data,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser))`;
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.resume();
  child.on('error', () => reject(new Error('Windows credential protection is unavailable.')));
  child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error('Windows credential protection failed.')));
  child.stdin.end(unprotect ? value : Buffer.from(value).toString('base64'));
});

export class ProviderStore {
  private cached?: StoreData;
  private loading?: Promise<StoreData>;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(readonly directory: string) {}

  private async localCipherKey() {
    const file = path.join(this.directory, 'credential.key');
    try { return await fs.readFile(file); } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
      const key = randomBytes(32);
      await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
      await fs.writeFile(file, key, { mode: 0o600, flag: 'wx' });
      return key;
    }
  }

  private async protect(value: string) {
    if (!value) return '';
    if (process.platform === 'win32') return `dpapi:${await dpapi(value, false)}`;
    const key = await this.localCipherKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `aes:${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')}`;
  }

  private async unprotect(value: string) {
    if (!value) return '';
    if (value.startsWith('dpapi:')) return Buffer.from(await dpapi(value.slice(6), true), 'base64').toString('utf8');
    if (!value.startsWith('aes:')) throw new Error('Unsupported credential format. Saved configuration was preserved.');
    const bytes = Buffer.from(value.slice(4), 'base64');
    const cipher = createDecipheriv('aes-256-gcm', await this.localCipherKey(), bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8');
  }

  async read(): Promise<StoreData> {
    if (this.cached) return this.cached;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const envKey = process.env.OPENROUTER_API_KEY?.trim() || '';
      const envModel = process.env.OPENROUTER_MODEL?.trim() || '';
      const envBaseUrl = process.env.OPENROUTER_BASE_URL?.trim() || COMPATIBLE_PROVIDERS.find(provider => provider.id === 'openrouter')!.baseUrl;
      const data: StoreData = {
        connections: envKey || envModel ? { openrouter: { baseUrl: envBaseUrl, model: envModel, apiKey: envKey } } : {},
        preferredProvider: envKey && envModel ? 'openrouter' : 'gemini',
        gatewayKey: ''
      };
      let saved: any;
      try { saved = JSON.parse(await fs.readFile(path.join(this.directory, 'providers.json'), 'utf8')); }
      catch (error: any) {
        if (error.code === 'ENOENT') return this.cached = data;
        throw new Error('Cannot read provider configuration. The saved file was left in place.');
      }
      for (const provider of COMPATIBLE_PROVIDERS) {
        const entry = saved.connections?.[provider.id];
        if (entry) {
          const apiKey = await this.unprotect(entry.credential || '');
          data.connections[provider.id] = {
            baseUrl: entry.baseUrl || (provider.id === 'openrouter' ? envBaseUrl : provider.baseUrl),
            model: entry.model || (provider.id === 'openrouter' ? envModel : ''),
            apiKey: apiKey || (provider.id === 'openrouter' ? envKey : '')
          };
        }
      }
      data.preferredProvider = saved.preferredProvider || data.preferredProvider;
      data.gatewayKey = await this.unprotect(saved.gatewayCredential || '');
      return this.cached = data;
    })();
    try { return await this.loading; } finally { this.loading = undefined; }
  }

  async update(change: (data: StoreData) => void | Promise<void>) {
    this.writeQueue = this.writeQueue.catch(() => {}).then(async () => {
      const snapshot = structuredClone(await this.read());
      await change(snapshot);
      const connections: Record<string, unknown> = {};
      for (const [id, entry] of Object.entries(snapshot.connections)) {
        connections[id] = { baseUrl: entry.baseUrl, model: entry.model, credential: await this.protect(entry.apiKey) };
      }
      await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
      const file = path.join(this.directory, 'providers.json');
      const temporary = path.join(this.directory, 'providers.tmp');
      await fs.writeFile(temporary, JSON.stringify({ version: 1, preferredProvider: snapshot.preferredProvider, connections, gatewayCredential: await this.protect(snapshot.gatewayKey) }, null, 2), { mode: 0o600 });
      await fs.rename(temporary, file);
      this.cached = snapshot;
    });
    await this.writeQueue;
  }

  async connection(id: CompatibleProvider): Promise<Connection> {
    const data = await this.read();
    return data.connections[id] || { baseUrl: COMPATIBLE_PROVIDERS.find(provider => provider.id === id)!.baseUrl, model: '', apiKey: '' };
  }

  async publicConfig() {
    const data = await this.read();
    return {
      connections: await Promise.all(COMPATIBLE_PROVIDERS.map(async provider => {
        const connection = await this.connection(provider.id);
        return { id: provider.id, baseUrl: connection.baseUrl, model: connection.model, hasKey: Boolean(connection.apiKey) };
      })),
      preferredProvider: data.preferredProvider,
      gatewayKeyConfigured: Boolean(data.gatewayKey)
    };
  }
}
