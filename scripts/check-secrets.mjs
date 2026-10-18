// Fails when a file that git would publish contains something shaped like a live
// credential. A key in frontend code is public the moment the site is deployed.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const PATTERNS = [
  ['Novita/Stripe-style key', /\bsk_[A-Za-z0-9_]{30,}/],
  ['OpenAI/OpenRouter-style key', /\bsk-(?:or-v1-|proj-|ant-)?[A-Za-z0-9_-]{32,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Firecrawl key', /\bfc-[a-f0-9]{32}\b/],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Supabase service JWT', /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]*cm9sZSI6InNlcnZpY2Vfcm9sZS[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/],
];
const SKIP = /\.(pdf|png|jpe?g|gif|webp|ico|mp4|woff2?|lock)$|package-lock\.json$/i;

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\n').filter(file => file && !SKIP.test(file));
const findings = [];
for (const file of files) {
  try { if (statSync(file).size > 2_000_000) continue; } catch { continue; }
  const text = readFileSync(file, 'utf8');
  for (const [label, pattern] of PATTERNS) {
    const match = pattern.exec(text);
    if (match) findings.push(`${file}:${text.slice(0, match.index).split('\n').length}  ${label}`);
  }
}
if (findings.length) {
  console.error(`Possible credentials found (values withheld):\n${findings.join('\n')}\nRemove them, revoke the keys, and keep secrets in .quanta or Supabase secrets.`);
  process.exit(1);
}
console.log(`Secret scan passed: ${files.length} files checked.`);
