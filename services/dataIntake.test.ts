import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseIntake, validateIntake } from './dataIntake';
test('CSV preserves quoted commas, newlines and escaped quotes', () => {
  assert.deepEqual(parseCsv('name,content\r\n"A,B","hello\nworld ""yes"""'), [{ name: 'A,B', content: 'hello\nworld "yes"' }]);
  assert.throws(() => parseCsv('a,a\n1,2')); assert.throws(() => parseCsv('a,b\n1')); assert.throws(() => parseCsv('a\n"x'));
});
test('chat exports retain speakers, timestamps and conversation identity', () => {
  const rows = parseIntake('chat.json', JSON.stringify([{ title: 'Example', mapping: { a: { message: { author: { role: 'user' }, create_time: 123, content: { parts: ['hello'] } } } } }]));
  assert.deepEqual(rows, [{ conversation: 'Example', role: 'user', timestamp: 123, content: 'hello' }]);
  assert.equal(parseIntake('business.json', '[{"customer":"A"}]')[0].customer, 'A');
  assert.equal(parseIntake('note.md', '# personal')[0].content, '# personal');
});
test('trading flags invalid fields, duplicate records and time order', () => {
  const rows = [{ t: '2026-10-07T12:00:00Z', s: 'BTC', p: '3' }, { t: '2026-10-06T12:00:00Z', s: '', p: 'bad' }];
  const issues = validateIntake(rows, 'trading', { timestamp: 't', instrument: 's', price: 'p' });
  assert.ok(issues.some(i => i.includes('invalid prices'))); assert.ok(issues.some(i => i.includes('missing instruments'))); assert.ok(issues.some(i => i.includes('not ordered')));
  assert.ok(validateIntake([rows[0], rows[0]], 'business', {}).some(i => i.includes('duplicate')));
});
