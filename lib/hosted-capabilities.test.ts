import test from 'node:test';
import assert from 'node:assert/strict';
import { isHostedSite, localOnlyReason } from './hosted-capabilities';

test('local-only screens are recognised, including nested routes', () => {
  assert.match(localOnlyReason('/work-zone') || '', /Paperclip/);
  assert.match(localOnlyReason('/rsi-lab/intent') || '', /RSI/);
  assert.equal(localOnlyReason('/chat'), null);
  assert.equal(localOnlyReason('/agentsx'), null);
  assert.equal(isHostedSite('127.0.0.1'), false);
  assert.equal(isHostedSite('localhost'), false);
  assert.equal(isHostedSite('quanta-core.vercel.app'), true);
});
