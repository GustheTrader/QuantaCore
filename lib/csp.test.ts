import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentSecurityPolicy } from './csp';

test('policy allows only first-party scripts and listed connections', () => {
  const hosted = contentSecurityPolicy('hosted');
  assert.match(hosted, /script-src 'self';/);
  assert.doesNotMatch(hosted, /unsafe-eval|cdn\.tailwindcss|esm\.sh/);
  assert.doesNotMatch(hosted, /127\.0\.0\.1|localhost/);
  assert.match(contentSecurityPolicy('local'), /ws:\/\/127\.0\.0\.1:\*/);
  assert.match(contentSecurityPolicy('local'), /frame-src 'self' http:\/\/127\.0\.0\.1:\*/);
});

test('vercel.json serves the same hosted policy', () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const header = vercel.headers[0].headers.find((h: any) => h.key === 'Content-Security-Policy');
  assert.equal(header.value, contentSecurityPolicy('hosted'));
});

test('index.html loads no remote scripts', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  assert.doesNotMatch(html, /importmap/);
});
