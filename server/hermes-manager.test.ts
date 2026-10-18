import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { HermesManager } from './hermes-manager';

class Gateway extends EventTarget {
  static OPEN = 1;
  static instance: Gateway;
  readyState = 1;
  calls: any[] = [];
  constructor() {
    super(); Gateway.instance = this;
    setTimeout(() => this.frame({ method: 'event', params: { type: 'gateway.ready' } }), 0);
  }
  frame(frame: any) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(frame) })); }
  send(raw: string) {
    const frame = JSON.parse(raw); this.calls.push(frame);
    if (!frame.method) return;
    const result = frame.method === 'session.create' ? { session_id: 'live-' + frame.params.profile, stored_session_id: 'stored-' + frame.params.profile } : { status: 'streaming' };
    setTimeout(() => this.frame({ id: frame.id, result }), 0);
  }
  close() { this.readyState = 3; this.dispatchEvent(new Event('close')); }
}
test('Hermes profile isolation, streaming, approval ownership, and restart recovery', async () => {
  const original = globalThis.WebSocket;
  globalThis.WebSocket = Gateway as unknown as typeof WebSocket;
  const root = mkdtempSync(path.join(tmpdir(), 'gnoesis-hermes-'));
  const manager = new HermesManager(root, { token: 'fixture-token' });
  try {
    assert.equal((await manager.status()).connected, true);
    const work = await manager.create('work');
    const personal = await manager.create('personal');
    const creates = Gateway.instance.calls.filter(c => c.method === 'session.create');
    assert.deepEqual(creates.map(c => c.params.profile), ['gnoesis-work', 'gnoesis-personal']);
    assert.notEqual(creates[0].params.cwd, creates[1].params.cwd);
    await assert.rejects(manager.send('personal', work.id, 'cross workspace'), /not found/);
    await manager.send('work', work.id, 'fixture');
    await assert.rejects(manager.send('work', work.id, 'duplicate'), /already running/);
    Gateway.instance.frame({ method: 'event', params: { session_id: work.liveId, type: 'message.delta', payload: { text: 'Hello' } } });
    assert.equal(manager.list('work')[0].partial, 'Hello');
    assert.equal(manager.list('personal')[0].partial, '');
    Gateway.instance.frame({ id: 'approval-1', method: 'approval', params: { session_id: work.liveId, request_id: 'approval-1', choices: ['once', 'deny'] } });
    await assert.rejects(manager.answer('personal', personal.id, 'approval-1', { choice: 'once' }), /no longer pending/);
    // A scope Hermes did not offer is rejected and never forwarded upstream.
    const forwarded = () => Gateway.instance.calls.filter(c => c.id === 'approval-1' && !c.method).length;
    await assert.rejects(manager.answer('work', work.id, 'approval-1', { choice: 'always' }), /approval scope offered by Hermes/);
    assert.equal(forwarded(), 0);
    assert.equal(manager.list('work')[0].pending.length, 1);
    await manager.answer('work', work.id, 'approval-1', { choice: 'deny' });
    assert.equal(forwarded(), 1);
    Gateway.instance.frame({ method: 'event', params: { session_id: work.liveId, type: 'message.complete', payload: { text: 'Hello world', status: 'complete' } } });
    assert.equal(work.running, false);
    assert.equal(work.messages[1].content, 'Hello world');
    assert.equal(personal.messages.length, 0);
    await manager.send('work', work.id, 'second fixture');
    const restored = new HermesManager(root, { token: 'fixture-token' });
    assert.equal(restored.list('work')[0].running, false);
    assert.match(restored.list('work')[0].error, /not replayed/);
    manager.close();
    assert.equal(work.running, false);
    assert.match(work.error, /disconnected/);
  } finally { globalThis.WebSocket = original; rmSync(root, { recursive: true, force: true }); }
});
