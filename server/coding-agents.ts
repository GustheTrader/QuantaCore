import { existsSync, mkdirSync, writeFileSync, readFileSync, renameSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn as spawnPty, type IPty } from 'node-pty';
import { NativeSignIn } from './native-sign-in';

type AgentId = 'codex' | 'claude' | 'gemini' | 'goose' | 'grok' | 'grok-native';
type Session = { id: string; agent: AgentId; workspace: string; scope: string; purpose: string; running: boolean; exitCode?: number; startedAt: number; chunks: { seq: number; data: string }[]; seq: number; pty: IPty; capability: string; intelligence: boolean; authLinkFile?: string };
export class CodingAgents {
  private sessions = new Map<string, Session>();
  private nativeSignIn = new NativeSignIn(agent => this.executable(agent));
  constructor(private root: string) {}
  authentication() { return this.nativeSignIn.status(); }
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
    return candidates.find(existsSync);
  }
  catalog() {
    return (['codex','claude','gemini','goose','grok','grok-native'] as AgentId[]).map(id => ({ id, label: { codex:'OpenAI Codex', claude:'Claude Code', gemini:'Google Gemini CLI', goose:'Goose', grok:'Grok via Goose', 'grok-native':'Grok native CLI' }[id], installed: !!this.executable(id), authentication: 'Native agent sign-in; complete or check it in the terminal', kind: id === 'grok' ? 'API provider through Goose' : 'Native coding agent' }));
  }
  list(workspace: string) { return [...this.sessions.values()].filter(s => s.workspace === workspace).map(s => this.public(s)); }
  private public(s: Session) {
    let authorizeUrl: string | undefined;
    if (s.running && s.agent === 'gemini' && s.purpose === 'auth' && s.authLinkFile && existsSync(s.authLinkFile)) {
      try {
        const link = JSON.parse(readFileSync(s.authLinkFile, 'utf8'));
        const url = new URL(link.authorizeUrl);
        if (url.protocol === 'https:' && url.hostname === 'accounts.google.com' && link.expiresAt > Date.now()) authorizeUrl = url.toString();
      } catch {}
    }
    return { id:s.id, agent:s.agent, workspace:s.workspace, scope:s.scope, purpose:s.purpose, running:s.running, exitCode:s.exitCode, startedAt:s.startedAt, intelligence:s.intelligence, ...(authorizeUrl ? { authorizeUrl } : {}) };
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
    let args: string[] = [];
    if (agent === 'codex') {
      args = purpose === 'auth' ? ['login', '--device-auth'] : ['--no-daemon','--no-alt-screen','-C',cwd,'--sandbox','workspace-write','--ask-for-approval','on-request'];
      if (intelligence) args.push('-c',`mcp_servers.gnoesis.command=${JSON.stringify(process.execPath)}`, '-c',`mcp_servers.gnoesis.args=${JSON.stringify([bridge])}`, '-c',`mcp_servers.gnoesis.env={GNOESIS_SPACE=${JSON.stringify(workspace)},GNOESIS_BRIDGE_CAPABILITY=${JSON.stringify(capability)},GNOESIS_BACKEND=${JSON.stringify(mcp.env.GNOESIS_BACKEND)}}`);
    } else if (agent === 'claude') {
      args = purpose === 'auth' ? ['auth','login'] : ['--permission-mode','default', ...(intelligence ? ['--mcp-config',claudeConfig] : [])];
    } else if (agent === 'gemini') {
      if (purpose === 'auth') {
        delete env.GEMINI_CLI_AUTH_OVERRIDE;
        // Authentication does not need permission to load or execute workspace configuration.
        env.GEMINI_CLI_TRUST_WORKSPACE = 'false';
        delete env.NO_BROWSER;
      }
      if (intelligence) {
        const settings = path.join(configDir, 'gemini-system-settings.json'); writeFileSync(settings, JSON.stringify({mcpServers:{gnoesis:mcp}}), {mode:0o600});
        env.GEMINI_CLI_SYSTEM_SETTINGS_PATH = settings;
      }
      args = purpose === 'auth' ? [path.join(this.root, 'scripts', 'gemini-sign-in.mjs'), executable, authLinkFile!] : ['--approval-mode','default'];
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
