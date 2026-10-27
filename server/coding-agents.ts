import { existsSync, mkdirSync, writeFileSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn as spawnPty, type IPty } from 'node-pty';
import { execFile, spawn } from 'node:child_process';
import { NativeSignIn } from './native-sign-in';

type AgentId = 'codex' | 'claude' | 'gemini' | 'goose' | 'grok' | 'grok-native';
type Session = { id: string; agent: AgentId; workspace: string; scope: string; purpose: string; running: boolean; exitCode?: number; startedAt: number; chunks: { seq: number; data: string }[]; seq: number; pty: IPty; capability: string; intelligence: boolean; authLinkFile?: string };
export class CodingAgents {
  private sessions = new Map<string, Session>();
  private nativeSignIn = new NativeSignIn(agent => this.executable(agent));
  constructor(private root: string) {}
  authentication() { return this.nativeSignIn.status(); }
  private testRunning = false;
  private modelCache?: { until: number; models: { agent: string; model: string; label: string }[]; warnings: string[] };
  private nativeEnv() {
    return Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && !/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key))) as Record<string, string>;
  }
  private runNative(agent: AgentId, args: string[], timeout = 20000): Promise<string> {
    const executable = this.executable(agent);
    if (!executable) throw new Error('Provider tool is not installed.');
    const cwd = path.join(this.root, '.quanta', 'inference-check');
    mkdirSync(cwd, { recursive: true });
    return new Promise((resolve, reject) => { const child = execFile(executable.endsWith('.js') ? process.execPath : executable, executable.endsWith('.js') ? [executable, ...args] : args,
      { cwd, env: this.nativeEnv(), timeout, maxBuffer: 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
        if (error) reject(new Error((stderr || stdout || error.message).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').slice(-1600)));
        else resolve(stdout);
      }); child.stdin?.end(); });
  }
  private codexModels(): Promise<{ model: string; label: string }[]> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.executable('codex')!, ['app-server'], { env: this.nativeEnv(), stdio: ['pipe', 'pipe', 'ignore'] });
      let buffer = ''; let done = false;
      const finish = (error?: Error, rows?: any[]) => {
        if (done) return; done = true; clearTimeout(timer); child.kill();
        if (error) reject(error); else resolve((rows || []).filter(m => !m.hidden).map(m => ({ model: m.model, label: m.displayName || m.model })));
      };
      const timer = setTimeout(() => finish(new Error('Codex model discovery timed out.')), 20000);
      child.on('error', error => finish(error));
      child.on('exit', () => finish(new Error('Codex model discovery stopped.')));
      child.stdout.on('data', chunk => {
        buffer += chunk.toString();
        let newline: number;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
          try {
            const message = JSON.parse(line);
            if (message.id === 1) {
              child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
              child.stdin.write(JSON.stringify({ id: 2, method: 'model/list', params: { limit: 100 } }) + '\n');
            }
            if (message.id === 2) finish(message.error ? new Error(message.error.message) : undefined, message.result?.data);
          } catch {}
        }
      });
      child.stdin.on('error', () => {});
      child.stdin.write(JSON.stringify({ id: 1, method: 'initialize', params: { clientInfo: { name: 'quanta', version: '1' } } }) + '\n');
    });
  }
  async subscriptionModels() {
    if (this.modelCache && this.modelCache.until > Date.now()) return this.modelCache;
    const models: { agent: string; model: string; label: string }[] = [];
    const warnings: string[] = [];
    const statuses = await this.authentication();
    await Promise.all(statuses.filter(s => s.connected).map(async status => {
      try {
        let rows: { model: string; label: string }[] = [];
        if (status.id === 'codex') rows = await this.codexModels();
        if (status.id === 'claude') rows = ['haiku', 'sonnet', 'opus', 'fable'].map(model => ({ model, label: model[0].toUpperCase() + model.slice(1) + ' (CLI alias)' }));
        if (status.id === 'grok-native') {
          const raw = await this.runNative('grok-native', ['models']);
          rows = [...raw.matchAll(/^\s*[-*]\s+(grok-[\w.-]+)/gm)].map(m => ({ model: m[1], label: m[1] }));
        }
        if (status.id === 'gemini') rows = [{ model: 'auto', label: 'Auto (Google account default)' }];
        models.push(...rows.map(row => ({ agent: status.id, ...row })));
      } catch (error) { warnings.push(status.id + ': ' + (error as Error).message); }
    }));
    this.modelCache = { until: Date.now() + 15000, models, warnings };
    return this.modelCache;
  }
  async testSubscription(agent: string, model: string, input?: string) {
    if (this.testRunning) throw new Error('An inference test is already running.');
    const status = (await this.authentication()).find(s => s.id === agent);
    if (!status?.connected) throw new Error('Connect this subscription first.');
    const catalog = await this.subscriptionModels();
    if (!catalog.models.some(row => row.agent === agent && row.model === model)) throw new Error('Select a listed subscription model.');
    if (input !== undefined && (typeof input !== 'string' || !input.trim() || input.length > 100000)) throw new Error('Use a nonempty prompt up to 100,000 characters.');
    const prompt = input === undefined ? 'Connection check only. Do not use tools or inspect files. Reply with the single word READY.' : input;
    this.testRunning = true;
    try {
      let args: string[];
      if (agent === 'codex') args = ['exec', '--ignore-user-config', '--skip-git-repo-check', '--ephemeral', '--sandbox', 'read-only', '--json', '-m', model, prompt];
      else if (agent === 'claude') args = ['-p', prompt, '--model', model, '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--no-session-persistence', '--max-turns', '1', '--output-format', 'json'];
      else if (agent === 'grok-native') args = ['-p', prompt, '--model', model, '--tools', '', '--disable-web-search', '--no-subagents', '--max-turns', '1', '--output-format', 'json'];
      else args = ['-p', prompt, '--model', model, '--approval-mode', 'plan', '--output-format', 'json'];
      const raw = await this.runNative(agent as AgentId, args, 90000);
      let reply = '';
      if (agent === 'codex') {
        for (const line of raw.split('\n')) {
          try { const event = JSON.parse(line); if (event.type === 'item.completed' && event.item?.type === 'agent_message') reply += event.item.text; } catch {}
        }
      } else {
        const data = JSON.parse(raw);
        if (data.is_error || data.error) throw new Error(data.result || data.error?.message || 'Provider refused inference.');
        reply = data.result || data.response || data.text || data.content || '';
        if (Array.isArray(reply)) reply = reply.map((item: any) => item.text || '').join('');
      }
      if (typeof reply !== 'string' || !reply.trim()) throw new Error('Provider returned no usable reply.');
      return { agent, model, reply: reply.slice(0, input === undefined ? 1000 : 100000) };
    } finally { this.testRunning = false; }
  }
  private journal(s: Session) {
    const directory=path.join(this.root,'.quanta','coding-agents');mkdirSync(directory,{recursive:true});
    const file=path.join(directory,'sessions.json');const rows=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):[];
    const index=rows.findIndex((row:any)=>row.id===s.id);const value=this.public(s);if(index>=0)rows[index]=value;else rows.push(value);
    writeFileSync(file+'.tmp',JSON.stringify(rows.slice(-1000),null,2),{mode:0o600});renameSync(file+'.tmp',file);
  }
  private executable(agent: AgentId) {
    const local = process.env.LOCALAPPDATA || '';
    const tools = path.join(this.root, '.quanta', 'coding-tools', 'node_modules');
    const candidates = agent === 'codex' ? [path.join(local, 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe')]
      : agent === 'claude' ? [path.join(tools, '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'), path.join(process.env.USERPROFILE || '', '.local', 'bin', 'claude.exe')]
      : agent === 'gemini' ? [path.join(tools, '@google', 'gemini-cli', 'bundle', 'gemini.js')]
      : agent === 'grok-native' ? [path.join(this.root, '.quanta', 'coding-tools', 'grok', 'grok.exe'), path.join(process.env.USERPROFILE || '', '.grok', 'bin', 'grok.exe'), path.join(process.env.USERPROFILE || '', '.local', 'bin', 'grok.exe'), path.join(local, 'Programs', 'grok', 'grok.exe')]
      : [path.join(local, 'goose', 'bin', 'goose-package', 'goose.exe')];
    const found = candidates.find(existsSync);
    if (found || process.platform === 'win32') return found;
    const home = process.env.HOME || '';
    const binary = { codex: 'codex', claude: 'claude', 'grok-native': 'grok', goose: 'goose', gemini: '', grok: '' }[agent];
    const dirs = [...(process.env.PATH || '').split(path.delimiter), '/usr/local/bin', '/usr/bin', path.join(home, '.local', 'bin'), path.join(home, '.grok', 'bin')];
    if (agent === 'gemini') return [path.join(tools, '@google', 'gemini-cli', 'bundle', 'gemini.js')].find(existsSync);
    return binary ? dirs.map(dir => path.join(dir, binary)).find(existsSync) : undefined;
  }
  catalog() {
    return (['codex','claude','gemini','goose','grok','grok-native'] as AgentId[]).map(id => ({ id, label: { codex:'OpenAI Codex', claude:'Claude Code', gemini:'Google Gemini CLI', goose:'Goose', grok:'Grok via Goose', 'grok-native':'Grok native CLI' }[id], installed: !!this.executable(id), authentication: 'Native agent sign-in; complete or check it in the terminal', kind: id === 'grok' ? 'API provider through Goose' : 'Native coding agent' }));
  }
  list(workspace: string) { return [...this.sessions.values()].filter(s => s.workspace === workspace).map(s => this.public(s)); }
  private public(s: Session) {
    let authorizeUrl: string | undefined;
    let userCode: string | undefined;
    if (s.agent === 'codex' && s.purpose === 'auth' && s.running) {
      const output = s.chunks.map(chunk => chunk.data).join('').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
      userCode = output.match(/\b[A-Z0-9]{4,5}-[A-Z0-9]{4,5}\b/)?.[0];
      if (userCode) authorizeUrl = 'https://auth.openai.com/codex/device';
    }
    if (s.running && s.purpose === 'auth' && ['claude', 'gemini', 'grok-native'].includes(s.agent)) {
      const output = s.chunks.map(chunk => chunk.data).join('').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
      const hosts: Record<string, string[]> = { claude: ['claude.ai', 'claude.com', 'console.anthropic.com', 'platform.claude.com'], gemini: ['accounts.google.com'], 'grok-native': ['auth.x.ai', 'accounts.x.ai', 'grok.com', 'x.ai'] };
      for (const candidate of output.match(/https:\/\/[^\s<>"\x00-\x1f]+/g) || []) {
        try {
          const url = new URL(candidate);
          if (hosts[s.agent]?.includes(url.hostname) && !url.username && !url.password) authorizeUrl = url.toString();
        } catch {}
      }
    }
    if (s.running && s.agent === 'gemini' && s.purpose === 'auth' && s.authLinkFile && existsSync(s.authLinkFile)) {
      try {
        const link = JSON.parse(readFileSync(s.authLinkFile, 'utf8'));
        const url = new URL(link.authorizeUrl);
        if (url.protocol === 'https:' && url.hostname === 'accounts.google.com' && link.expiresAt > Date.now()) authorizeUrl = url.toString();
      } catch {}
    }
    return { id:s.id, agent:s.agent, workspace:s.workspace, scope:s.scope, purpose:s.purpose, running:s.running, exitCode:s.exitCode, startedAt:s.startedAt, intelligence:s.intelligence, ...(authorizeUrl ? { authorizeUrl } : {}), ...(userCode ? { userCode } : {}) };
  }
  private own(workspace: string, id: string) { const s = this.sessions.get(id); if (!s || s.workspace !== workspace) throw new Error('Coding session not found in this space.'); return s; }
  start(workspace: string, body: any) {
    if (!['work','personal','ideas'].includes(workspace)) throw new Error('Unknown space.');
    const agent = body.agent as AgentId;
    if (!['codex','claude','gemini','goose','grok','grok-native'].includes(agent)) throw new Error('Unknown coding agent.');
    const executable = this.executable(agent); if (!executable) throw new Error('Agent is not installed.');
    const ended=[...this.sessions.values()].filter(s=>!s.running);for(const previous of ended.slice(0,Math.max(0,ended.length-20)))this.sessions.delete(previous.id);
    const purpose = body.purpose === 'auth' ? 'auth' : 'work';
    const existingAuth = [...this.sessions.values()].find(s => s.workspace === workspace && s.agent === agent && s.purpose === 'auth' && s.running);
    if (purpose === 'auth' && existingAuth) return this.public(existingAuth);
    if ([...this.sessions.values()].filter(s => s.running).length >= 8) throw new Error('Stop an existing session before starting another.');
    const scope = body.scope === 'app' ? 'app' : 'space';
    const cwd = purpose === 'auth' ? path.join(this.root, '.quanta', 'coding-agents', 'sign-in', agent) : scope === 'app' ? this.root : path.join(this.root, '.quanta', 'hermes', 'workspaces', workspace);
    mkdirSync(cwd, { recursive:true });
    const configDir = path.join(this.root, '.quanta', 'coding-agents', workspace); mkdirSync(configDir, {recursive:true});
    const capability = randomUUID();
    const id = randomUUID();
    const authLinkFile = agent === 'gemini' && purpose === 'auth' ? path.join(configDir, `google-sign-in-${id}.json`) : undefined;
    const intelligence = body.intelligence === true && purpose === 'work';
    const env: Record<string,string> = {};
    for (const [key,value] of Object.entries(process.env)) if (value !== undefined && !/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)) env[key] = value;
    env.TERM = 'xterm-256color'; env.GNOESIS_SPACE = workspace;
    const bridge = path.join(this.root, 'scripts', 'coding-intelligence.mjs');
    const mcp = { command: process.execPath, args: [bridge], env: { GNOESIS_SPACE:workspace, GNOESIS_BRIDGE_CAPABILITY:capability, GNOESIS_BACKEND:`http://127.0.0.1:${process.env.QUANTA_PORT || 3000}` } };
    const claudeConfig = path.join(configDir, 'claude-mcp.json');
    writeFileSync(claudeConfig, JSON.stringify({mcpServers:{gnoesis:mcp}}), {mode:0o600});
    // A remote browser cannot reach the CLI's loopback callback, so Gemini sign-in falls back to its paste-a-code mode.
    const remoteGemini = agent === 'gemini' && purpose === 'auth' && !!process.env.QUANTA_TRUSTED_HOSTS;
    let args: string[] = [];
    if (agent === 'codex') {
      args = purpose === 'auth' ? ['login', '--device-auth'] : ['--no-daemon','--no-alt-screen','-C',cwd,'--sandbox','workspace-write','--ask-for-approval','on-request'];
      if (intelligence) args.push('-c',`mcp_servers.gnoesis.command=${JSON.stringify(process.execPath)}`, '-c',`mcp_servers.gnoesis.args=${JSON.stringify([bridge])}`, '-c',`mcp_servers.gnoesis.env={GNOESIS_SPACE=${JSON.stringify(workspace)},GNOESIS_BRIDGE_CAPABILITY=${JSON.stringify(capability)},GNOESIS_BACKEND=${JSON.stringify(mcp.env.GNOESIS_BACKEND)}}`);
    } else if (agent === 'claude') {
      args = purpose === 'auth' ? ['auth','login'] : ['--permission-mode','default', ...(intelligence ? ['--mcp-config',claudeConfig] : [])];
    } else if (agent === 'gemini') {
      if (purpose === 'auth' && remoteGemini) { env.NO_BROWSER = 'true'; env.GEMINI_CLI_TRUST_WORKSPACE = 'false'; }
      else if (purpose === 'auth') {
        delete env.GEMINI_CLI_AUTH_OVERRIDE;
        // Authentication does not need permission to load or execute workspace configuration.
        env.GEMINI_CLI_TRUST_WORKSPACE = 'false';
        delete env.NO_BROWSER;
      }
      if (intelligence) {
        const settings = path.join(configDir, 'gemini-system-settings.json'); writeFileSync(settings, JSON.stringify({mcpServers:{gnoesis:mcp}}), {mode:0o600});
        env.GEMINI_CLI_SYSTEM_SETTINGS_PATH = settings;
      }
      args = purpose === 'auth' ? (remoteGemini ? [path.join(this.root, 'scripts', 'gemini-remote-sign-in.mjs'), executable] : [path.join(this.root, 'scripts', 'gemini-sign-in.mjs'), executable, authLinkFile!]) : ['--approval-mode','default'];
    } else if (agent === 'grok-native') {
      if (intelligence) throw new Error('Native Grok intelligence attachment is not configured.');
      args = purpose === 'auth' ? ['login','--oauth'] : ['--cwd',cwd];
    } else {
      args = purpose === 'auth' ? ['configure'] : ['session', '--with-builtin','developer', ...(agent === 'grok' ? ['--provider','xai'] : [])];
      if (intelligence) args.push('--with-extension',`gnoesis:GNOESIS_SPACE=${workspace} GNOESIS_BRIDGE_CAPABILITY=${capability} GNOESIS_BACKEND=${mcp.env.GNOESIS_BACKEND} "${process.execPath}" "${bridge}"`);
    }
    const command = executable.endsWith('.js') ? process.execPath : executable;
    if (executable.endsWith('.js') && !(agent === 'gemini' && purpose === 'auth')) args.unshift(executable);
    const pty = spawnPty(command,args,{name:'xterm-256color',cols:100,rows:30,cwd,env});
    const session: Session = { id,agent,workspace,scope,purpose,running:true,startedAt:Date.now(),chunks:[],seq:0,pty,capability,intelligence,authLinkFile };
    this.sessions.set(session.id, session);
    this.journal(session);
    pty.onData(data => { session.chunks.push({seq:++session.seq,data}); while (session.chunks.length > 300 || session.chunks.reduce((sum,c) => sum+c.data.length,0) > 300000) session.chunks.shift(); });
    pty.onExit(({exitCode}) => { session.running=false;session.exitCode=exitCode;session.chunks.push({seq:++session.seq,data:`\r\n[Agent exited: ${exitCode}]\r\n`});if(session.authLinkFile){try{unlinkSync(session.authLinkFile);}catch{}}this.nativeSignIn.invalidate();this.journal(session); });
    return this.public(session);
  }
  output(workspace: string,id: string,after: number) { const s=this.own(workspace,id); return {...this.public(s), chunks:s.chunks.filter(c=>c.seq>after), seq:s.seq, truncated:after>0 && after < (s.chunks[0]?.seq || 1)-1}; }
  input(workspace:string,id:string,data:unknown) { const s=this.own(workspace,id); if(!s.running) throw new Error('Session has exited.'); if(typeof data!=='string'||data.length>32000) throw new Error('Invalid terminal input.');s.pty.write(data); }
  resize(workspace:string,id:string,cols:number,rows:number) { const s=this.own(workspace,id); if(s.running)s.pty.resize(Math.max(40,Math.min(240,Math.floor(cols))),Math.max(10,Math.min(100,Math.floor(rows)))); }
  stop(workspace:string,id:string) { const s=this.own(workspace,id);if(s.running)s.pty.kill(); }
  authorize(capability:string,workspace:string) { return [...this.sessions.values()].some(s=>s.running&&s.intelligence&&s.workspace===workspace&&s.capability===capability); }
}
