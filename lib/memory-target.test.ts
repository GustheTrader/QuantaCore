import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMemoryTarget } from './memory-target';

test('memory stays local on this computer even in a production build', () => {
  assert.equal(resolveMemoryTarget({ hostname: '127.0.0.1', production: true }).target, 'local');
  assert.equal(resolveMemoryTarget({ hostname: 'localhost', production: true }).target, 'local');
  assert.equal(resolveMemoryTarget({ hostname: 'localhost', production: false }).target, 'local');
  assert.equal(resolveMemoryTarget({ hostname: 'quanta-core.vercel.app', production: true }).target, 'hosted');
  assert.equal(resolveMemoryTarget({ hostname: '127.0.0.1', production: true, configured: 'hosted' }).target, 'hosted');
  assert.equal(resolveMemoryTarget({ hostname: 'quanta-core.vercel.app', production: true, configured: 'LOCAL' }).target, 'local');
  assert.equal(resolveMemoryTarget({ hostname: 'localhost', production: true, configured: 'cloud' }).target, 'local', 'unknown values never select hosted');
});
