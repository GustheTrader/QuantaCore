import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claudeSignInStatus, grokSignInStatus, geminiSignInStatus } from './native-sign-in';

test('Claude status remains available from its native OAuth store without exposing tokens', () => {
  const data = { claudeAiOauth: { accessToken: 'private-access', refreshToken: 'private-refresh', expiresAt: 2000, subscriptionType: 'private-plan' } };
  const result = claudeSignInStatus(data, 1000);
  assert.equal(result.connected, true);
  assert.equal(result.label, 'Connected · Claude Code');
  assert.doesNotMatch(JSON.stringify(result), /private|Token|subscriptionType/);
  assert.equal(claudeSignInStatus(data, 3000).state, 'expired');
  assert.equal(claudeSignInStatus({claudeAiOauth: {accessToken:'test'}}).state, 'unavailable');
  assert.equal(claudeSignInStatus(undefined).state, 'disconnected');
});

test('Grok reports an unexpired native OAuth login without exposing credential or profile fields', () => {
  const result = grokSignInStatus({ 'https://auth.x.ai::native-client': { auth_mode: 'oidc', key: 'private-test-key', refresh_token: 'private-refresh', email: 'private@example.com', expires_at: '2030-01-01T00:00:00Z' } }, Date.parse('2026-10-10T00:00:00Z'));
  assert.equal(result.connected, true);
  assert.equal(result.label, 'Connected · Grok CLI');
  assert.doesNotMatch(JSON.stringify(result), /private|email|refresh_token/);
});

test('Grok rejects missing, expired, unrelated and API-key credentials as browser connections', () => {
  const now = Date.parse('2026-10-10T00:00:00Z');
  assert.equal(grokSignInStatus(undefined, now).state, 'disconnected');
  const entry = { auth_mode: 'oidc', key: 'test', expires_at: '2025-01-01T00:00:00Z' };
  assert.equal(grokSignInStatus({ 'https://auth.x.ai::native-client': entry }, now).state, 'expired');
  assert.equal(grokSignInStatus({ 'https://unrelated.example': { ...entry, expires_at: '2030-01-01T00:00:00Z' } }, now).connected, false);
  assert.equal(grokSignInStatus({ 'https://auth.x.ai::native-client': { ...entry, auth_mode: 'api_key', expires_at: '2030-01-01T00:00:00Z' } }, now).connected, false);
});

test('Gemini reports cached access expiry independently of general API access and does not expose tokens', () => {
  const result = geminiSignInStatus({ access_token: 'private-access', refresh_token: 'private-refresh', expiry_date: 2000 }, 1000);
  assert.equal(result.connected, true);
  assert.doesNotMatch(JSON.stringify(result), /private|token/);
  assert.equal(geminiSignInStatus({ access_token: 'test', expiry_date: 2000 }, 3000).state, 'expired');
  assert.equal(geminiSignInStatus({ access_token: 'test' }, 1000).state, 'unavailable');
  assert.equal(geminiSignInStatus({}, 1000).state, 'disconnected');
});
