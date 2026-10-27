import test from 'node:test';
import assert from 'node:assert/strict';
import { CodingAgents } from './coding-agents';

test('subscription test refuses disconnected accounts without running a tool', async () => {
  const coding = new CodingAgents('/tmp') as any;
  coding.authentication = async () => [];
  coding.runNative = () => { throw new Error('must not execute'); };
  await assert.rejects(coding.testSubscription('codex', 'gpt-6-luna'), /Connect this subscription/);
});

test('subscription test refuses models outside the discovered catalog', async () => {
  const coding = new CodingAgents('/tmp') as any;
  coding.authentication = async () => [{ id: 'codex', connected: true }];
  coding.subscriptionModels = async () => ({ models: [] });
  await assert.rejects(coding.testSubscription('codex', '--injected'), /listed subscription model/);
});

test('subscription test extracts the Codex final reply and resets the running lock', async () => {
  const coding = new CodingAgents('/tmp') as any;
  coding.authentication = async () => [{ id: 'codex', connected: true }];
  coding.subscriptionModels = async () => ({ models: [{ agent: 'codex', model: 'gpt-6-luna' }] });
  coding.runNative = async (_agent: string, args: string[]) => {
    assert.ok(args.includes('--ephemeral'));
    assert.ok(args.includes('read-only'));
    return JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'READY' } });
  };
  assert.equal((await coding.testSubscription('codex', 'gpt-6-luna')).reply, 'READY');
  assert.equal(coding.testRunning, false);
  coding.runNative = async () => { throw new Error('quota reached'); };
  await assert.rejects(coding.testSubscription('codex', 'gpt-6-luna'), /quota reached/);
  assert.equal(coding.testRunning, false);
});

 test('subscription chat forwards the conversation without truncating at the test limit', async () => {
  const coding = new CodingAgents('/tmp') as any;
  coding.authentication = async () => [{ id: 'grok-native', connected: true }];
  coding.subscriptionModels = async () => ({ models: [{ agent: 'grok-native', model: 'grok-test' }] });
  coding.runNative = async (_agent: string, args: string[]) => {
    assert.equal(args[1], 'Prior conversation and current request');
    assert.equal(args[args.indexOf('--tools') + 1], '');
    return JSON.stringify({ text: 'x'.repeat(2000) });
  };
  assert.equal((await coding.testSubscription('grok-native', 'grok-test', 'Prior conversation and current request')).reply.length, 2000);
  await assert.rejects(coding.testSubscription('grok-native', 'grok-test', 'x'.repeat(100001)), /100,000/);
});
