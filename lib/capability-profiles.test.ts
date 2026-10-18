import test from 'node:test';
import assert from 'node:assert/strict';
import { checkProfile, classifyTool, replayPolicy } from './capability-profiles';

test('tool classification fails closed', () => {
  for (const tool of ['read_file', 'list_dir', 'grep', 'glob', 'view']) assert.equal(classifyTool(tool), 'read', tool);
  for (const tool of ['bash', 'write_file', 'edit', 'apply_patch', 'git_push', 'send_email', 'run_command', 'read_and_write', 'mystery_tool', '']) assert.equal(classifyTool(tool), 'side-effect', tool);
  assert.equal(classifyTool('web_search'), 'network-read');
  assert.equal(replayPolicy('read'), 'safe');
  assert.equal(replayPolicy('side-effect'), 'never');
});

test('profiles block write tools and unverified harnesses', () => {
  assert.equal(checkProfile(['read_file', 'grep'], 'read-only').allowed, true);
  const writable = checkProfile(['read_file', 'bash', 'write_file'], 'read-only');
  assert.equal(writable.allowed, false);
  assert.deepEqual(writable.blocked, ['bash', 'write_file']);
  assert.equal(checkProfile([], 'read-only').allowed, false);
  assert.equal(checkProfile(['read_file', ''], 'read-only').allowed, false, 'an unnamed tool must not disappear from the admission check');
  assert.equal(checkProfile(['read_file', 'web_search'], 'read-only').allowed, false);
  assert.equal(checkProfile(['read_file', 'web_search'], 'research').allowed, true);
});
