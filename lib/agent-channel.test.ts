import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHousePrompt, createAgentHouse, createHouseAgent, visibleMessages } from './agent-channel';

test('agent prompt excludes another agent private KB, private drafts and unrelated direct messages', () => {
  const house = createAgentHouse();
  const alice = { ...createHouseAgent(), name: 'Alice', role: 'Researcher' };
  const bob = { ...createHouseAgent(), name: 'Bob', role: 'Reviewer' };
  house.agents = [alice, bob];
  const note = (owner: string, text: string) => ({ id: crypto.randomUUID(), owner, text, title: 'Reference', source: 'Operator', createdAt: new Date().toISOString() });
  house.knowledge = [note('master', 'MASTER_SHARED_FACT'), note(alice.id, 'ALICE_PRIVATE_FACT'), note(bob.id, 'BOB_PRIVATE_SECRET')];
  const message = (text: string, recipient: string, state: 'draft' | 'published') => ({ id: crypto.randomUUID(), senderId: 'operator', senderName: 'Operator', text, recipient, state, createdAt: new Date().toISOString() });
  house.messages = [message('ALICE_DIRECT_MESSAGE', alice.id, 'published'), message('BOB_DIRECT_SECRET', bob.id, 'published'), message('UNPUBLISHED_SECRET', 'all', 'draft'), message('BROADCAST_MESSAGE', 'all', 'published')];
  const result = buildHousePrompt(house, alice.id, 'Analyze reference facts');
  for (const expected of ['MASTER_SHARED_FACT', 'ALICE_PRIVATE_FACT', 'ALICE_DIRECT_MESSAGE', 'BROADCAST_MESSAGE']) assert.ok(result.prompt.includes(expected), expected);
  for (const secret of ['BOB_PRIVATE_SECRET', 'BOB_DIRECT_SECRET', 'UNPUBLISHED_SECRET']) assert.ok(!result.prompt.includes(secret), secret);
  assert.equal(result.knowledgeIds.length, 2);
  assert.equal(visibleMessages(house, bob.id).length, 2);
});

test('maximum KB and conversation inputs stay inside the router prompt budget', () => {
  const house = createAgentHouse(); house.name = 'H'.repeat(60);
  const agent = { ...createHouseAgent(), name: 'N'.repeat(60), role: 'R'.repeat(200) }; house.agents = [agent];
  house.knowledge = Array.from({ length: 100 }, (_, i) => ({ id: String(i), owner: i % 2 ? agent.id : 'master', title: 'T'.repeat(100), text: 'X'.repeat(12000), source: 'test', createdAt: new Date().toISOString() }));
  const result = buildHousePrompt(house, agent.id, 'Task '.repeat(100));
  assert.ok(result.prompt.length <= 3000);
  assert.throws(() => buildHousePrompt(house, 'missing', 'Task'));
});
