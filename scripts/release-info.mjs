// Computes the release identity for a build. Vercel provides the commit SHA; local
// builds read it from git and flag uncommitted changes, so a "dirty" build is never
// mistaken for a reviewed release.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git = (...args) => { try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };

export function releaseInfo(root = process.cwd(), env = process.env) {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const commit = env.VERCEL_GIT_COMMIT_SHA || env.GITHUB_SHA || git('-C', root, 'rev-parse', 'HEAD') || 'unknown';
  const hosted = !!env.VERCEL;
  // Vercel and CI build from a clean checkout of one commit.
  const dirty = hosted || env.CI ? false : git('-C', root, 'status', '--porcelain') !== '';
  return { version, commit, dirty, builtAt: new Date().toISOString(), target: hosted ? 'hosted' : 'local' };
}

if (process.argv[1]?.endsWith('release-info.mjs')) console.log(JSON.stringify(releaseInfo(), null, 2));
