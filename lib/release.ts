// Release identity baked in at build time by vite.config.ts. Use it to confirm which
// source revision a running app or the hosted site was built from.
export interface ReleaseInfo { version: string; commit: string; dirty: boolean; builtAt: string; target: 'local' | 'hosted' }

declare const __QUANTA_RELEASE__: ReleaseInfo | undefined;

export const release: ReleaseInfo = typeof __QUANTA_RELEASE__ !== 'undefined'
  ? __QUANTA_RELEASE__
  : { version: '0.0.0-dev', commit: 'unknown', dirty: true, builtAt: '', target: 'local' };

export const releaseLabel = (info: ReleaseInfo = release) =>
  `v${info.version} · ${info.commit === 'unknown' ? 'unknown commit' : info.commit.slice(0, 7)}${info.dirty ? ' (uncommitted changes)' : ''}`;
