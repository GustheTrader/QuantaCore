import express from 'express';
import { spawnSync } from 'node:child_process';
import { AGENT_TRACKS } from '../lib/agent-tracks';
import { getProviderDefinition, isCompatibleProvider } from '../lib/inference-providers';
import { ProviderStore } from './provider-store';
import { ResearchManager } from './research-manager';
import type { RunRequest } from '../lib/research-contract';

const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const harnesses = ['codex', 'claude', 'opencode', 'pi', 'cursor', 'vscode', 'copilot-app', 'copilot-cli', 'deepseek'] as const;

function words(input: string): string[] {
  const result: string[] = [];
  const matcher = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (const match of input.matchAll(matcher)) result.push(match[1] ?? match[2] ?? match[3]);
  return result;
}

function fireconnectAvailable() {
  try {
    const command = process.platform === 'win32' ? 'where.exe' : 'which';
    return spawnSync(command, ['fireconnect'], { windowsHide: true, timeout: 2500, stdio: 'ignore' }).status === 0;
  } catch { return false; }
}

export function createCliRouter(store: ProviderStore, research?: ResearchManager) {
  const router = express.Router();
  router.use((req, res, next) => {
    const origin = req.get('origin');
    if (!localHosts.has(req.hostname) || req.get('X-Quanta-Client') !== 'local-ui') return res.status(403).json({ error: 'Local Quanta access required.' });
    if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ error: 'Cross-origin CLI access denied.' });
    next();
  });

  router.post('/run', async (req, res) => {
    try {
      const raw = req.body?.command;
      if (typeof raw !== 'string' || raw.length > 4000) return res.status(400).json({ error: 'Enter a command of at most 4000 characters.' });
      const args = words(raw.trim());
      const [command, first, ...rest] = args;
      let lines: string[];
      switch (command?.toLowerCase()) {
        case undefined:
        case 'help':
          lines = [
            'Quanta CLI · local control commands',
            'help                 Show this command list',
            'status               Check the local server and selected text route',
            'agents               List the eight operational agents',
            'providers            Show saved model routes without keys',
            'models <provider>    Discover the provider model catalog',
            'harnesses            List FireConnect coding harnesses and install state',
            'harness <name>       Show setup and restore commands for one harness',
            'ask <provider> <prompt>  Send a prompt to that explicitly chosen provider',
            'trading health|run|status|cancel|resume|decisions|backtest  Gnoesis Agenic Research',
            'clear                Clear this terminal window'
          ];
          break;
        case 'trading': {
          if (!research) throw new Error('Research runtime is unavailable.');
          const options: Record<string,string> = {};
          for (let i=0; i<rest.length; i++) {
            if (rest[i]==='--confirm') options.confirm='true';
            else if (rest[i].startsWith('--') && rest[i+1] && !rest[i+1].startsWith('--')) options[rest[i].slice(2)]=rest[++i];
            else if (i===0 && !rest[i].startsWith('--')) options.id=rest[i];
            else throw new Error('Invalid trading option.');
          }
          const makeRequest = ():RunRequest => {
            if(options.confirm!=='true') throw new Error('Review the research console estimate first; include --confirm to start model calls.');
            if(!options.ticker||!options.date||!options.deep) throw new Error('Use --ticker AAPL --date YYYY-MM-DD --deep provider/model --quick provider/model --confirm.');
            return {ticker:options.ticker.toUpperCase(),trade_date:options.date,asset_type:'stock',models:{deep:options.deep,quick:options.quick||options.deep},selected_analysts:['market','social','news','fundamentals'],debate_rounds:1,risk_rounds:1,budget:{max_calls:Number(options.calls||60),max_tokens:Number(options.tokens||200000),max_output_tokens:Number(options.output||2048),max_duration_seconds:Number(options.seconds||900),max_cost_usd:options.usd===undefined?null:Number(options.usd)},portfolio:null,mode:options.fixture==='true'?'fixture':'research',confirmed:true};
          };
          let result:unknown;
          if(first==='health') result=await research.health();
          else if(first==='decisions') result={runs:research.store.list().filter(run=>run.decision&&(!options.ticker||run.ticker===options.ticker.toUpperCase()))};
          else if(first==='status') result=options.id?research.store.get(options.id):{runs:research.store.list()};
          else if(first==='cancel') result=await research.cancel(options.id||'');
          else if(first==='resume') result=await research.resume(options.id||'');
          else if(first==='estimate') result=await research.estimate(makeRequest());
          else if(first==='run') result=await research.submit(makeRequest(),options.key);
          else if(first==='backtest') result=options.id?research.batchStatus(options.id):await research.batch({tickers:(options.tickers||options.ticker||'').split(',').map(x=>x.toUpperCase()),dates:(options.dates||options.date||'').split(','),template:makeRequest()},options.key);
          else result={name:'Gnoesis Agenic Research',help:['trading health','trading estimate --ticker AAPL --date 2025-01-02 --deep local/model --confirm','trading run --ticker AAPL --date 2025-01-02 --deep local/model --confirm --calls 60 --tokens 200000 --seconds 900','trading status <run_id>','trading cancel <run_id>','trading resume <run_id>','trading decisions --ticker AAPL','trading backtest --ticker AAPL --date 2025-01-02 --tickers AAPL,MSFT --dates 2025-01-02,2025-01-03 --deep local/model --confirm'],research_only:true};
          lines=JSON.stringify(result,null,2).split('\n'); break;
        }
        case 'status': {
          const data = await store.publicConfig();
          const selected = data.connections.find(connection => connection.id === data.preferredProvider);
          lines = [
            'Quanta OS local server: responding on 127.0.0.1:3000',
            `Preferred text route: ${data.preferredProvider}${selected?.model ? ` / ${selected.model}` : ''}`,
            `OpenAI-compatible gateway key: ${data.gatewayKeyConfigured ? 'configured' : 'not configured'}`,
            `FireConnect CLI: ${fireconnectAvailable() ? 'installed' : 'not detected'}`,
            'Coding harness settings are changed only by FireConnect commands you run yourself.'
          ];
          break;
        }
        case 'agents':
          lines = AGENT_TRACKS.map(agent => `${agent.label} · ${agent.description}`);
          break;
        case 'providers': {
          const data = await store.publicConfig();
          lines = data.connections.map(connection => `${connection.id.padEnd(18)} ${connection.model || '(no model)'} · ${connection.hasKey ? 'key saved' : getProviderDefinition(connection.id)?.requiresKey ? 'key needed' : 'no key required'}`);
          lines.unshift('Configured text routes (keys are never displayed):');
          break;
        }
        case 'models': {
          if (!first || !isCompatibleProvider(first)) throw new Error('Use models <provider>; run providers to see provider IDs.');
          const response = await fetch(`http://127.0.0.1:3000/api/inference/providers/${first}/models`, { headers: { 'X-Quanta-Client': 'local-ui' }, signal: AbortSignal.timeout(22000) });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error?.message || 'Model catalog request failed.');
          lines = [`${first}: ${data.data.length} models returned`, ...data.data.slice(0, 30).map((model: { id: string }) => `  ${model.id}`)];
          if (data.data.length > 30) lines.push(`  … ${data.data.length - 30} more. Use Settings for the full catalog.`);
          break;
        }
        case 'harnesses':
          lines = [
            `FireConnect CLI: ${fireconnectAvailable() ? 'installed' : 'not detected'}`,
            `Supported coding harnesses: ${harnesses.join(', ')}`,
            'Run harness <name> for official connect, status and restore commands.',
            'On Windows, the FireConnect installer requires Git Bash; installation and login remain separate operator steps.'
          ];
          break;
        case 'harness': {
          if (!first || !harnesses.includes(first as typeof harnesses[number])) throw new Error(`Choose a harness: ${harnesses.join(', ')}.`);
          lines = [
            `FireConnect setup for ${first}:`,
            '1. Install FireConnect from its official GitHub project (use Git Bash on Windows).',
            '2. Run: fireconnect login',
            `3. Run: fireconnect ${first} on`,
            `4. Check: fireconnect ${first} status`,
            `5. Restore original settings: fireconnect ${first} off`,
            'Quanta displays these commands; it does not edit your coding harness settings.'
          ];
          break;
        }
        case 'ask': {
          if (!first || !isCompatibleProvider(first) || !rest.length) throw new Error('Use ask <provider> <prompt>. This sends the prompt to the named provider.');
          const prompt = rest.join(' ');
          if (prompt.length > 3000) throw new Error('Keep prompts under 3000 characters in the CLI.');
          const response = await fetch('http://127.0.0.1:3000/api/inference/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Quanta-Client': 'local-ui' },
            body: JSON.stringify({ provider: first, messages: [{ role: 'user', content: prompt }] }),
            signal: AbortSignal.timeout(180000)
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error?.message || 'Inference request failed.');
          const content = data.choices?.[0]?.message?.content;
          if (typeof content !== 'string') throw new Error('The provider returned no text response.');
          lines = [`${first} / ${data.model || 'configured model'}`, content.slice(0, 30000)];
          break;
        }
        case 'clear':
          lines = [];
          break;
        default:
          throw new Error(`Unknown command: ${command}. Run help.`);
      }
      res.json({ lines });
    } catch (error: any) {
      res.status(400).json({ error: String(error?.message || 'Command failed.').slice(0, 500) });
    }
  });

  return router;
}
