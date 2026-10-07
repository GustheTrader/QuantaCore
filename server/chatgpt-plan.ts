import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ChatGptOAuth } from './chatgpt-oauth';
import { boundedJson } from './bounded-json';

const fail = (message: string, status = 400) => Object.assign(new Error(message), { status });
type Route = { accountId: string; model: string; businessEnabled: boolean };
export function responsesInput(messages: any[]) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 40 || JSON.stringify(messages).length > 50000) throw fail('Provide up to 40 text messages under 50 KB');
  if (messages.some(m => !m || !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string')) throw fail('Only text messages are supported');
  const instructions = ['You are a business planning analyst. Produce reviewable recommendations. You cannot perform business actions, send messages, publish, spend money, or execute trades.', ...messages.filter(m => m.role === 'system').map(m => m.content)].join('\n');
  const input = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));
  if (!input.length) throw fail('Provide at least one user or assistant message');
  return { instructions, input };
}
export async function completedResponse(response: Response, secret = '') {
  const redact = (value: string) => secret ? value.split(secret).join('[REDACTED]') : value;
  if (!response.ok) {
    let error: any; try { error = await boundedJson(response); } catch {}
    throw fail(redact(String(error?.error?.message || error?.detail || `ChatGPT plan request returned HTTP ${response.status}`)).slice(0, 500), response.status);
  }
  const contentType = response.headers.get('content-type');
  // Some authenticated Responses transports omit the header. The bounded parser
  // still requires a completed SSE event and usable text before returning success.
  if (contentType && !contentType.includes('text/event-stream')) throw fail('ChatGPT plan response was not an event stream', 502);
  const reader = response.body?.getReader();
  if (!reader) throw fail('Empty ChatGPT plan response', 502);
  const decoder = new TextDecoder();
  let buffer = '', size = 0, output = '', completed: any;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2_000_000) throw fail('ChatGPT plan response exceeded the local limit', 502);
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!data || data === '[DONE]') continue;
        const event = JSON.parse(data);
        if (event.type === 'response.output_text.delta') output += event.delta || '';
        if (['response.failed', 'response.incomplete', 'error'].includes(event.type)) {
          const error = event.response?.error || event.error || event;
          throw fail(redact(String(error.code || error.message || event.type)).slice(0, 500), 502);
        }
        if (event.type === 'response.completed') {
          if (event.response?.status && event.response.status !== 'completed') throw fail('ChatGPT plan response did not complete successfully', 502);
          completed = event.response;
        }
      }
    }
  } finally { await reader.cancel().catch(() => {}); }
  if (!completed) throw fail('ChatGPT plan stream ended before response.completed', 502);
  if (!output) output = (completed.output || []).flatMap((item: any) => item.content || []).filter((item: any) => item.type === 'output_text').map((item: any) => item.text).join('');
  if (!output.trim()) throw fail('ChatGPT plan returned no usable text', 502);
  return { id: completed.id || randomUUID(), object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: completed.model, choices: [{ index: 0, message: { role: 'assistant', content: output }, finish_reason: 'stop' }], usage: completed.usage, billing: 'chatgpt-plan' };
}

export class ChatGptPlan {
  private file: string;
  private activeCalls = 0;
  constructor(root: string, readonly oauth: ChatGptOAuth, private request: typeof fetch = fetch) { this.file = path.join(root, '.quanta', 'business-chatgpt-route.json'); }
  route(): Route { return existsSync(this.file) ? JSON.parse(readFileSync(this.file, 'utf8')) : { accountId: '', model: '', businessEnabled: false }; }
  async status() { return { ...await this.oauth.status(), route: this.route(), apiKeyFallback: false }; }
  async models(expectedAccountId?: string) {
    const token = await this.oauth.getAccessToken(expectedAccountId);
    const response = await this.request('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw fail(`ChatGPT model catalog returned HTTP ${response.status}`, response.status);
    const data = await boundedJson(response);
    if (!Array.isArray(data.models)) throw fail('ChatGPT plan catalog did not contain a models array', 502);
    return data.models.filter((model: any) => model.visibility === 'list' && typeof model.slug === 'string').map((model: any) => ({ id: model.slug, name: model.display_name || model.slug }));
  }
  async configure(model: string, businessEnabled: boolean) {
    const state = await this.oauth.status();
    if (!state.activeAccountId) throw fail('Connect a ChatGPT account first', 409);
    const models = await this.models(state.activeAccountId);
    if (!models.some((item: any) => item.id === model)) throw fail('Select a model from this account’s current catalog');
    if ((await this.oauth.status()).activeAccountId !== state.activeAccountId) throw fail('Selected ChatGPT account changed. Reload its catalog before saving.', 409);
    const route: Route = { accountId: state.activeAccountId, model, businessEnabled };
    mkdirSync(path.dirname(this.file), { recursive: true }); writeFileSync(this.file + '.tmp', JSON.stringify(route)); renameSync(this.file + '.tmp', this.file);
    return this.status();
  }
  async complete(messages: any[], business = false) {
    const route = this.route();
    const state = await this.oauth.status();
    if (!route.model || !route.accountId || route.accountId !== state.activeAccountId || (business && !route.businessEnabled)) throw fail('Choose a ChatGPT model and explicitly enable this account for Business connectors', 403);
    if (this.activeCalls >= 1) throw fail('A ChatGPT plan request is already running', 429);
    const input = responsesInput(messages);
    this.activeCalls++;
    try {
      const token = await this.oauth.getAccessToken(route.accountId);
      const response = await this.request('https://api.openai.com/v1/responses', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(90000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: route.model, ...input, stream: true, store: false }) });
      return await completedResponse(response, token);
    } finally { this.activeCalls--; }
  }
}
