import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export type Workspace = 'work' | 'personal' | 'ideas';
export interface HermesConversation {
  id: string; workspace: Workspace; title: string; storedId?: string; liveId?: string;
  messages: { role: string; content: string }[]; activity: { type: string; payload: any }[];
  pending: { id: string; method: string; params: any }[];
  attachments: { name: string; refText?: string }[];
  running: boolean; partial: string; error: string; updatedAt: number;
}
const validWorkspace = (value: unknown): Workspace => {
  if (value !== 'work' && value !== 'personal' && value !== 'ideas') throw new Error('Select Work, Personal or Ideas.');
  return value;
};

export class HermesManager {
  private socket?: WebSocket;
  private connecting?: Promise<void>;
  private requests = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private sessions: HermesConversation[];
  private file: string;
  private token: string;
  private port: number;
  private executable: string;
  private root: string;
  private launch?: Promise<void>;
  private starting = false;
  private ready = false;
  private startupError = '';
  constructor(root: string, options: { port?: number; token?: string; executable?: string } = {}) {
    this.root = root;
    const directory = path.join(root, '.quanta', 'hermes');
    mkdirSync(directory, { recursive: true });
    this.file = path.join(directory, 'sessions.json');
    const tokenFile = path.join(directory, 'gateway-token');
    this.token = options.token || (existsSync(tokenFile) ? readFileSync(tokenFile, 'utf8').trim() : randomBytes(32).toString('hex'));
    if (!options.token && !existsSync(tokenFile)) writeFileSync(tokenFile, this.token, { mode: 0o600 });
    this.port = options.port || Number(process.env.GNOESIS_HERMES_PORT || 9120);
    this.executable = options.executable || process.env.GNOESIS_HERMES_EXE || path.join(process.env.LOCALAPPDATA || '', 'hermes', 'bin', 'hermes.exe');
    this.sessions = existsSync(this.file) ? JSON.parse(readFileSync(this.file, 'utf8')) : [];
    for (const session of this.sessions) {
      session.liveId = undefined;
      if (session.running) session.error = 'Service restarted during a turn. Resume the conversation; the prompt was not replayed.';
      session.running = false; session.pending = [];
      session.attachments ||= [];
    }
  }
  private persist() {
    writeFileSync(this.file + '.tmp', JSON.stringify(this.sessions, null, 2), { mode: 0o600 });
    renameSync(this.file + '.tmp', this.file);
  }
  list(workspace: unknown) { return this.sessions.filter(s => s.workspace === validWorkspace(workspace)); }
  private own(workspace: unknown, id: string) {
    const session = this.list(workspace).find(s => s.id === id);
    if (!session) throw new Error('Conversation not found in this workspace.');
    return session;
  }
  async status() {
    try { await this.connect(); return { connected: true, starting: this.starting, chatReady: true, profiles: { work: 'gnoesis-work', personal: 'gnoesis-personal' } }; }
    catch { return { connected: false, starting: this.starting, chatReady: false, message: this.startupError || 'Start the local Hermes backend to connect.' }; }
  }
  private command(args: string[]) {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(this.executable, args, { windowsHide: true, stdio: 'ignore', cwd: this.root,
        env: { ...process.env, HERMES_HOME: process.env.HERMES_HOME || path.join(process.env.LOCALAPPDATA || '', 'hermes') } });
      const timer = setTimeout(() => { child.kill(); reject(new Error('Hermes profile setup timed out.')); }, 120_000);
      child.on('error', error => { clearTimeout(timer); reject(error); });
      child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('Hermes profile setup failed.')); });
    });
  }
  async start() {
    if ((await this.status()).connected) return;
    if (this.launch) return this.launch;
    this.launch = (async () => {
      this.starting = true;
      this.startupError = '';
      if (!existsSync(this.executable)) throw new Error('Hermes executable not found. Configure GNOESIS_HERMES_EXE.');
      const home = process.env.HERMES_HOME || path.join(process.env.LOCALAPPDATA || '', 'hermes');
      for (const workspace of ['work', 'personal', 'ideas'] as const) {
        const profile = 'gnoesis-' + workspace;
        if (!existsSync(path.join(home, 'profiles', profile, 'config.yaml'))) {
          await this.command(['profile', 'create', profile, '--clone-from', 'default', '--no-alias', '--description', `Gnoesis ${workspace} workspace. Keep its conversations and memory scoped to ${workspace}.`]);
        }
        mkdirSync(path.join(this.root, '.quanta', 'hermes', 'workspaces', workspace), { recursive: true });
      }
      const log = openSync(path.join(this.root, '.quanta', 'hermes', 'gateway.log'), 'a', 0o600);
      const child = spawn(this.executable, ['serve', '--host', '127.0.0.1', '--port', String(this.port), '--isolated'], {
        windowsHide: true, detached: true, stdio: ['ignore', log, log], cwd: this.root,
        env: { ...process.env, HERMES_HOME: home, HERMES_DASHBOARD_SESSION_TOKEN: this.token },
      });
      closeSync(log);
      let launchError: Error | undefined;
      child.on('error', error => { launchError = error; }); child.unref();
      for (let attempt = 0; attempt < 120; attempt++) {
        if (launchError) throw launchError;
        try { await this.connect(); return; } catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
      }
      throw new Error('Hermes did not become ready. Check its local startup logs.');
    })().catch(error => { this.startupError = (error as Error).message; throw error; }).finally(() => { this.launch = undefined; this.starting = false; });
    return this.launch;
  }
  private connect(): Promise<void> {
    if (this.ready && this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.connecting = new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${this.port}/api/ws?token=${encodeURIComponent(this.token)}`);
      this.socket = socket;
      const timer = setTimeout(() => { socket.close(); reject(new Error('Hermes connection timed out.')); }, 3000);
      socket.addEventListener('message', event => {
        for (const line of String(event.data).split('\n').filter(Boolean)) {
          let frame: any; try { frame = JSON.parse(line); } catch { continue; }
          if (frame.method === 'event' && frame.params?.type === 'gateway.ready') { this.ready = true; clearTimeout(timer); resolve(); }
          const pending = this.requests.get(String(frame.id));
          if (pending && !frame.method) {
            clearTimeout(pending.timer); this.requests.delete(String(frame.id));
            frame.error ? pending.reject(new Error(frame.error.message || 'Hermes request failed.')) : pending.resolve(frame.result);
          } else if (frame.method) this.receive(frame);
        }
      });
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Hermes backend is unavailable.')); });
      socket.addEventListener('close', () => {
        if (this.socket !== socket) return;
        this.ready = false;
        clearTimeout(timer); reject(new Error('Hermes backend disconnected.'));
        for (const request of this.requests.values()) { clearTimeout(request.timer); request.reject(new Error('Hermes backend disconnected.')); }
        this.requests.clear();
        for (const session of this.sessions) {
          if (session.running) { session.running = false; session.error = 'Hermes disconnected during this turn. Check its saved session before resending.'; }
          session.liveId = undefined; session.pending = [];
        }
        this.persist();
      });
    }).finally(() => { this.connecting = undefined; });
    return this.connecting;
  }
  private receive(frame: any) {
    const params = frame.params || {};
    const session = this.sessions.find(s => s.liveId === params.session_id);
    if (!session) return;
    if (frame.method !== 'event') {
      session.pending.push({ id: String(frame.id), method: frame.method, params });
      if (frame.method === 'approval') void this.rpc('approval.received', { session_id: session.liveId, profile: 'gnoesis-' + session.workspace, request_id: params.request_id }).catch(() => {});
    } else {
      const payload = params.payload || {};
      if (params.type === 'message.delta') session.partial += String(payload.text || payload.delta || '');
      else if (params.type === 'message.complete') {
        session.running = false;
        const content = typeof payload.text === 'string' ? payload.text : session.partial;
        if (content) session.messages.push({ role: 'assistant', content });
      session.partial = ''; session.error = payload.error || payload.failure_reason || (payload.status === 'error' ? 'Hermes returned an incomplete response.' : '');
      } else if (params.type === 'error') { session.error = payload.message || 'Hermes session failed.'; session.running = false; }
      else if (params.type === 'session.title') session.title = payload.title || session.title;
      else if (params.type === 'request.cancel') session.pending = session.pending.filter(p => p.id !== String(payload.id));
      else if (['tool.start', 'tool.complete', 'status.update', 'notice'].includes(params.type)) {
        session.activity.push({ type: params.type, payload }); session.activity = session.activity.slice(-50);
      }
    }
    session.updatedAt = Date.now();
    if (params.type !== 'message.delta') this.persist();
  }
  private async rpc(method: string, params: Record<string, unknown>): Promise<any> {
    await this.connect();
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.requests.delete(id); reject(new Error('Hermes request timed out.')); }, 60_000);
      this.requests.set(id, { resolve, reject, timer });
      this.socket!.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }
  async workspaceRpc(workspace: unknown, method: string, params: Record<string, unknown> = {}) {
    const scope = validWorkspace(workspace);
    if (!['cron.manage', 'mcp.servers.status'].includes(method)) throw new Error('Unsupported workspace operation.');
    const result = await this.rpc(method, { ...params, profile: 'gnoesis-' + scope });
    if (result?.error) throw new Error(String(result.error));
    return result;
  }
  async create(workspace: unknown) {
    const scope = validWorkspace(workspace);
    const result = await this.rpc('session.create', {
      profile: 'gnoesis-' + scope, source: 'gnoesis', title: 'New conversation',
      cwd: path.join(this.root, '.quanta', 'hermes', 'workspaces', scope), cwd_explicit: true,
    });
    const session: HermesConversation = { id: randomUUID(), workspace: scope, title: 'New conversation', storedId: result.stored_session_id,
      liveId: result.session_id, messages: [], activity: [], pending: [], attachments: [], running: false, partial: '', error: '', updatedAt: Date.now() };
    this.sessions.unshift(session); this.persist(); return session;
  }
  private async resume(session: HermesConversation) {
    await this.connect();
    if (!session.liveId) {
      const result = await this.rpc('session.resume', { profile: 'gnoesis-' + session.workspace, session_id: session.storedId });
      session.liveId = result.session_id;
    }
  }
  async send(workspace: unknown, id: string, text: unknown) {
    const session = this.own(workspace, id);
    if (typeof text !== 'string' || !text.trim() || text.length > 32_000) throw new Error('Enter a message up to 32,000 characters.');
    if (session.running) throw new Error('This conversation is already running.');
    await this.resume(session);
    session.running = true; session.partial = ''; session.error = ''; session.pending = [];
    session.messages.push({ role: 'user', content: text }); session.title = session.messages.length === 1 ? text.slice(0, 60) : session.title;
    this.persist();
    const refs = session.attachments.map(file => file.refText).filter(Boolean);
    try {
      await this.rpc('prompt.submit', { profile: 'gnoesis-' + session.workspace, session_id: session.liveId,
        text: refs.length ? `${text}\n\nAttached files:\n${refs.join('\n')}` : text });
      session.attachments = []; this.persist();
    }
    catch (error) { session.running = false; session.error = (error as Error).message; this.persist(); throw error; }
    return session;
  }
  async stop(workspace: unknown, id: string) {
    const session = this.own(workspace, id); await this.resume(session);
    return this.rpc('session.interrupt', { profile: 'gnoesis-' + session.workspace, session_id: session.liveId });
  }
  async answer(workspace: unknown, id: string, requestId: string, result: any) {
    const session = this.own(workspace, id);
    const request = session.pending.find(p => p.id === requestId);
    if (!request) throw new Error('This request is no longer pending.');
    if (request.method === 'approval' && !(request.params.choices?.length ? request.params.choices.filter((choice: string) => ['once', 'session', 'always', 'deny'].includes(choice)) : ['once', 'deny']).includes(result?.choice)) throw new Error('Choose an approval scope offered by Hermes.');
    if (request.method === 'approval' && request.params.choices?.length && !request.params.choices.includes(result?.choice)) throw new Error('This approval choice is not offered by Hermes.');
    if (request.method !== 'approval' && request.method !== 'clarify') throw new Error('This request requires the native Hermes interface.');
    if (request.method === 'clarify' && !result?.answers && typeof result?.answer !== 'string') throw new Error('Enter an answer.');
    if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) throw new Error('Hermes disconnected; this request cannot be answered.');
    this.socket!.send(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
    session.pending = session.pending.filter(p => p.id !== requestId); this.persist();
  }
  async attach(workspace: unknown, id: string, name: unknown, data: unknown) {
    const session = this.own(workspace, id);
    if (session.running) throw new Error('Attach files before sending a message.');
    if (typeof name !== 'string' || typeof data !== 'string' || data.length > 1_500_000 || !data.startsWith('data:')) throw new Error('Choose a file smaller than 1 MB.');
    await this.resume(session);
    const params = { profile: 'gnoesis-' + session.workspace, session_id: session.liveId };
    let result: any;
    if (data.startsWith('data:image/')) result = await this.rpc('image.attach_bytes', { ...params, filename: path.basename(name), content_base64: data.slice(data.indexOf(',') + 1) });
    else if (data.startsWith('data:application/pdf')) result = await this.rpc('pdf.attach', { ...params, filename: path.basename(name), content_base64: data.slice(data.indexOf(',') + 1) });
    else result = await this.rpc('file.attach', { ...params, name: path.basename(name), data_url: data });
    if (result.attached === false) throw new Error('Hermes did not attach this file.');
    session.attachments.push({ name: path.basename(name), ...(result.ref_text ? { refText: result.ref_text } : {}) });
    this.persist(); return result;
  }
  async remove(workspace: unknown, id: string) {
    const session = this.own(workspace, id);
    if (session.running) throw new Error('Stop this conversation before removing it.');
    if (session.liveId) await this.rpc('session.close', { profile: 'gnoesis-' + session.workspace, session_id: session.liveId });
    this.sessions = this.sessions.filter(s => s.id !== id); this.persist();
  }
  close() { this.socket?.close(); }
}
