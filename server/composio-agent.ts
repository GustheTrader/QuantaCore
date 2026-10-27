import { randomUUID } from 'node:crypto';
import { getProviderDefinition, isCompatibleProvider } from '../lib/inference-providers';
import type { ProviderStore } from './provider-store';

type Tool = { slug: string; toolkit: string; write: boolean };
/** Reads run on their own; anything that sends, creates, changes or deletes waits for the person's approval. */
const TOOLS: Tool[] = [
  { slug: 'GMAIL_FETCH_EMAILS', toolkit: 'gmail', write: false },
  { slug: 'GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID', toolkit: 'gmail', write: false },
  { slug: 'GMAIL_LIST_DRAFTS', toolkit: 'gmail', write: false },
  { slug: 'GMAIL_CREATE_EMAIL_DRAFT', toolkit: 'gmail', write: true },
  { slug: 'GMAIL_SEND_EMAIL', toolkit: 'gmail', write: true },
  { slug: 'GMAIL_REPLY_TO_THREAD', toolkit: 'gmail', write: true },
  { slug: 'GOOGLECALENDAR_FIND_EVENT', toolkit: 'googlecalendar', write: false },
  { slug: 'GOOGLECALENDAR_FREE_BUSY_QUERY', toolkit: 'googlecalendar', write: false },
  { slug: 'GOOGLECALENDAR_CREATE_EVENT', toolkit: 'googlecalendar', write: true },
  { slug: 'GOOGLECALENDAR_UPDATE_EVENT', toolkit: 'googlecalendar', write: true },
  { slug: 'GOOGLECALENDAR_DELETE_EVENT', toolkit: 'googlecalendar', write: true },
  { slug: 'GOOGLEDRIVE_LIST_FILES', toolkit: 'googledrive', write: false },
  { slug: 'GOOGLEDRIVE_GET_FILE_METADATA', toolkit: 'googledrive', write: false }
];
const BY_SLUG = new Map(TOOLS.map(t => [t.slug, t]));
const MAX_STEPS = 6, MAX_RESULT = 12_000;
const SYSTEM = 'You are Quanta\'s Google assistant. Use the provided tools to read the user\'s Gmail, Google Calendar and Google Drive. Never invent emails, events or files: if a tool returns nothing, say so. Sending mail and changing the calendar need the user\'s approval, which the system asks for; just call the tool. Be brief and plain. Today is ' + '{{DATE}}.';

type Pending = { user: string; tool: string; args: Record<string, unknown>; callId: string; expires: number };
const pending = new Map<string, Pending>();
const schemas = new Map<string, { at: number; def: any }>();

export type Composio = (path: string, init?: RequestInit) => Promise<any>;
const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });

async function schemaFor(composio: Composio, slug: string) {
  const hit = schemas.get(slug);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.def;
  const tool = await composio(`/tools/${slug}`);
  const props = { ...(tool.input_parameters?.properties || {}) };
  delete props.user_id; // the server pins the signed-in Google account; the model cannot pick another
  const def = { type: 'function', function: { name: slug, description: String(tool.description || slug).slice(0, 900), parameters: { type: 'object', properties: props, required: (tool.input_parameters?.required || []).filter((k: string) => k !== 'user_id') } } };
  schemas.set(slug, { at: Date.now(), def });
  return def;
}

async function connectedToolkits(composio: Composio, userId: string) {
  const data = await composio(`/connected_accounts?user_ids=${encodeURIComponent(userId)}&limit=100`);
  return new Set<string>((data.items || []).filter((a: any) => a.status === 'ACTIVE').map((a: any) => a.toolkit?.slug));
}

const trim = (value: unknown) => { const text = typeof value === 'string' ? value : JSON.stringify(value ?? null); return text.length > MAX_RESULT ? text.slice(0, MAX_RESULT) + '…[truncated]' : text; };

async function run(composio: Composio, userId: string, slug: string, args: Record<string, unknown>) {
  const out = await composio(`/tools/execute/${slug}`, { method: 'POST', body: JSON.stringify({ user_id: userId, arguments: args }) });
  return out.successful === false ? { error: out.error || 'The tool failed.' } : out.data ?? out;
}

export interface AgentContext { store: ProviderStore; composio: Composio; userId: string; }
type Message = Record<string, any>;

function cleanMessages(input: unknown): Message[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 60) throw fail('messages must be a short non-empty array.');
  return input.map((m: any) => {
    if (!['user', 'assistant', 'tool'].includes(m?.role)) throw fail('Unsupported message role.');
    const out: Message = { role: m.role, content: typeof m.content === 'string' ? m.content.slice(0, 20_000) : null };
    if (m.role === 'assistant' && Array.isArray(m.tool_calls)) out.tool_calls = m.tool_calls.map((c: any) => ({ id: String(c.id), type: 'function', function: { name: String(c.function?.name), arguments: String(c.function?.arguments ?? '{}').slice(0, 20_000) } }));
    if (m.role === 'tool') { out.tool_call_id = String(m.tool_call_id); out.content = String(m.content ?? '').slice(0, MAX_RESULT + 20); }
    return out;
  });
}

async function complete(store: ProviderStore, messages: Message[], tools: any[]) {
  const stored = await store.read();
  const provider = stored.preferredProvider;
  if (!isCompatibleProvider(provider)) throw fail('Pick a model provider with an API key in the Models panel first. Subscription sign-ins can\'t run tool calls here.', 409);
  const config = await store.connection(provider);
  if (!config.model) throw fail('Choose a model for your provider in the Models panel.', 409);
  if (getProviderDefinition(provider)!.requiresKey && !config.apiKey) throw fail('Add an API key for your selected provider in the Models panel.', 409);
  const url = new URL(config.baseUrl || getProviderDefinition(provider)!.baseUrl);
  if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) throw fail('Remote providers must use HTTPS.', 400);
  const response = await fetch(`${url.toString().replace(/\/$/, '')}/chat/completions`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(120_000),
    headers: { 'Content-Type': 'application/json', ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}) },
    body: JSON.stringify({ model: config.model, messages: [{ role: 'system', content: SYSTEM.replace('{{DATE}}', new Date().toISOString().slice(0, 10)) }, ...messages], tools, tool_choice: 'auto' })
  });
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok) throw fail(String(body?.error?.message || `Provider returned HTTP ${response.status}.`).split(config.apiKey || '\u0000').join('[REDACTED]').slice(0, 400), 502);
  const message = body.choices?.[0]?.message;
  if (!message) throw fail('The provider returned no answer.', 502);
  return { message, provider, model: config.model };
}

/** Run the tool-calling loop until the model answers or a write action needs approval. */
async function loop(ctx: AgentContext, messages: Message[]) {
  const connected = await connectedToolkits(ctx.composio, ctx.userId);
  const allowed = TOOLS.filter(t => connected.has(t.toolkit));
  if (!allowed.length) throw fail('Connect Gmail, Google Calendar or Google Drive first.', 409);
  const tools = await Promise.all(allowed.map(t => schemaFor(ctx.composio, t.slug)));
  const steps: { tool: string; ok: boolean }[] = [];
  for (let i = 0; i < MAX_STEPS; i++) {
    const { message, provider, model } = await complete(ctx.store, messages, tools);
    const assistant: Message = { role: 'assistant', content: message.content ?? null };
    const calls: any[] = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (!calls.length) { messages.push(assistant); return { messages, answer: String(message.content || ''), steps, provider, model }; }
    assistant.tool_calls = calls.map(c => ({ id: String(c.id), type: 'function', function: { name: String(c.function?.name), arguments: String(c.function?.arguments || '{}') } }));
    messages.push(assistant);
    for (let k = 0; k < calls.length; k++) {
      const call = assistant.tool_calls[k];
      const tool = BY_SLUG.get(call.function.name);
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* handled below */ }
      if (!tool || !allowed.includes(tool) || typeof args !== 'object' || Array.isArray(args)) { messages.push({ role: 'tool', tool_call_id: call.id, content: 'That tool is not available.' }); continue; }
      if (tool.write) {
        // Stop here: the remaining calls in this turn are answered after the person decides.
        const id = randomUUID();
        pending.set(id, { user: ctx.userId, tool: tool.slug, args, callId: call.id, expires: Date.now() + 600_000 });
        for (let j = k + 1; j < calls.length; j++) messages.push({ role: 'tool', tool_call_id: assistant.tool_calls[j].id, content: 'Skipped: waiting for approval of an earlier action. Ask again afterwards if still needed.' });
        return { messages, answer: String(message.content || ''), steps, provider, model, pending: { id, tool: tool.slug, args } };
      }
      try { messages.push({ role: 'tool', tool_call_id: call.id, content: trim(await run(ctx.composio, ctx.userId, tool.slug, args)) }); steps.push({ tool: tool.slug, ok: true }); }
      catch (cause: any) { messages.push({ role: 'tool', tool_call_id: call.id, content: `Error: ${String(cause.message).slice(0, 300)}` }); steps.push({ tool: tool.slug, ok: false }); }
    }
  }
  return { messages, answer: 'I stopped after several steps without a final answer. Try a narrower request.', steps };
}

export async function agentChat(ctx: AgentContext, input: unknown) {
  const messages = cleanMessages(input);
  if (messages[messages.length - 1].role !== 'user') throw fail('The last message must be from the user.');
  return loop(ctx, messages);
}

export async function agentDecide(ctx: AgentContext, input: unknown, pendingId: unknown, approve: unknown) {
  const now = Date.now();
  for (const [key, value] of pending) if (value.expires < now) pending.delete(key);
  const item = typeof pendingId === 'string' ? pending.get(pendingId) : undefined;
  if (!item || item.user !== ctx.userId) throw fail('That approval expired. Ask again.', 410);
  pending.delete(pendingId as string);
  const messages = cleanMessages(input);
  const content = approve === true ? await run(ctx.composio, ctx.userId, item.tool, item.args).then(trim).catch((cause: any) => `Error: ${String(cause.message).slice(0, 300)}`) : 'The user declined this action.';
  const at = messages.findIndex(m => m.role === 'assistant' && m.tool_calls?.some((c: any) => c.id === item.callId));
  if (at < 0) throw fail('The conversation no longer matches that approval.', 409);
  messages.splice(at + 1, 0, { role: 'tool', tool_call_id: item.callId, content });
  return loop(ctx, messages);
}
