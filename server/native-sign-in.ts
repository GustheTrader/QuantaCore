import { execFile } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type NativeSignInStatus = {
  id: 'claude' | 'grok-native' | 'gemini';
  connected: boolean;
  state: 'connected' | 'disconnected' | 'expired' | 'unavailable';
  label: string;
  checkedAt: string;
  expiresAt?: string;
};

// Credentials stay in their native stores. Return only status, never token or profile fields.
function readCredentials(file: string): Record<string, any> | undefined {
  if (!existsSync(file)) return undefined;
  if (statSync(file).size > 65536) throw new Error('Credential store exceeds the status read limit.');
  const data = JSON.parse(readFileSync(file, 'utf8'));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid native credential store.');
  return data;
}

const present = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
export function claudeSignInStatus(data: Record<string, any> | undefined, now = Date.now()): Pick<NativeSignInStatus, 'connected' | 'state' | 'label' | 'expiresAt'> {
  const account = data?.claudeAiOauth;
  if (!account || !present(account.accessToken)) return { connected: false, state: 'disconnected', label: 'Not connected' };
  const expiry = Number(account.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= 0 || expiry > 8640000000000000) return { connected: false, state: 'unavailable', label: 'Claude sign-in needs checking' };
  return { connected: expiry > now, state: expiry > now ? 'connected' : 'expired', label: expiry > now ? 'Connected · Claude Code' : 'Claude sign-in needs renewal', expiresAt: new Date(expiry).toISOString() };
}
export function grokSignInStatus(data: Record<string, any> | undefined, now = Date.now()): Pick<NativeSignInStatus, 'connected' | 'state' | 'label' | 'expiresAt'> {
  const entries = Object.entries(data || {}).filter(([issuer, value]) => issuer.startsWith('https://auth.x.ai::') && value && typeof value === 'object');
  let expired: string | undefined;
  for (const [, entry] of entries) {
    if (entry.auth_mode !== 'oidc' || !present(entry.key)) continue;
    const expiry = Date.parse(entry.expires_at);
    if (!Number.isFinite(expiry)) continue;
    if (expiry > now) return { connected: true, state: 'connected', label: 'Connected · Grok CLI', expiresAt: new Date(expiry).toISOString() };
    expired = new Date(expiry).toISOString();
  }
  return expired ? { connected: false, state: 'expired', label: 'Grok sign-in needs renewal', expiresAt: expired } : { connected: false, state: 'disconnected', label: 'Not connected' };
}

export function geminiSignInStatus(data: Record<string, any> | undefined, now = Date.now()): Pick<NativeSignInStatus, 'connected' | 'state' | 'label' | 'expiresAt'> {
  if (!data || !present(data.access_token)) return { connected: false, state: 'disconnected', label: 'Not connected' };
  const expiry = Number(data.expiry_date);
  if (!Number.isFinite(expiry) || expiry <= 0) return { connected: false, state: 'unavailable', label: 'Google sign-in needs checking' };
  return { connected: expiry > now, state: expiry > now ? 'connected' : 'expired', label: expiry > now ? 'Connected · Gemini CLI' : 'Google sign-in needs renewal', expiresAt: new Date(expiry).toISOString() };
}

export class NativeSignIn {
  private cached?: { until: number; result: NativeSignInStatus[] };
  private pending?: Promise<NativeSignInStatus[]>;
  constructor(private executable: (agent: NativeSignInStatus['id']) => string | undefined) {}
  invalidate() { this.cached = undefined; }
  async status(): Promise<NativeSignInStatus[]> {
    if (this.cached && this.cached.until > Date.now()) return this.cached.result;
    if (this.pending) return this.pending;
    this.pending = this.read().then(result => { this.cached = { until: Date.now() + 3000, result }; return result; }).finally(() => { this.pending = undefined; });
    return this.pending;
  }
  private async read(): Promise<NativeSignInStatus[]> {
    const checkedAt = new Date().toISOString();
    const home = process.env.USERPROFILE || os.homedir();
    const check = async (id: NativeSignInStatus['id']): Promise<NativeSignInStatus> => {
      const executable = this.executable(id);
      if (!executable) return { id, connected: false, state: 'unavailable', label: 'Sign-in tool not installed', checkedAt };
      try {
        if (id === 'claude') {
          const file = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'), '.credentials.json');
          const credentials = readCredentials(file);
          if (credentials) return { id, ...claudeSignInStatus(credentials), checkedAt };
          // Fall back to the CLI on systems whose native credentials live in an OS vault.
          const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)));
          const raw = await new Promise<string>((resolve, reject) => {
            execFile(executable, ['auth', 'status'], { env, windowsHide: true, timeout: 8000, maxBuffer: 65536 }, (error, stdout) => {
              // Claude uses exit 1 for logged out; its JSON is still the authoritative status.
              if (error && !stdout.trim()) reject(new Error('Native sign-in status unavailable.')); else resolve(stdout);
            });
          });
          const data = JSON.parse(raw);
          const connected = data.loggedIn === true && data.authMethod === 'claude.ai';
          return { id, connected, state: connected ? 'connected' : 'disconnected', label: connected ? 'Connected · Claude Code' : 'Not connected', checkedAt };
        }
        const data = id === 'grok-native' ? readCredentials(path.join(home, '.grok', 'auth.json')) : readCredentials(path.join(process.env.GEMINI_CLI_HOME || path.join(home, '.gemini'), 'oauth_creds.json'));
        return { id, ...(id === 'grok-native' ? grokSignInStatus(data) : geminiSignInStatus(data)), checkedAt };
      } catch { return { id, connected: false, state: 'unavailable', label: 'Native sign-in status unavailable', checkedAt }; }
    };
    return Promise.all((['claude', 'grok-native', 'gemini'] as const).map(check));
  }
}
