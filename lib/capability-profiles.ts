// Server-enforced tool permissions for agent harnesses.
// Telling a model "do not modify anything" is a request, not a boundary. These profiles
// decide which tools a harness may expose before a task is sent. Unknown tools are
// treated as side-effecting (fail closed).
export type ToolClass = 'read' | 'network-read' | 'side-effect';
export type CapabilityProfile = 'read-only' | 'research';

// Replay policy: only tools without side effects may be retried automatically after a
// crash or timeout. Anything else must be reported as interrupted, never re-fired.
export const replayPolicy = (kind: ToolClass) => (kind === 'side-effect' ? 'never' : 'safe');

const SIDE_EFFECT = /(write|edit|create|delete|remove|rm\b|move|rename|patch|apply|bash|shell|exec|terminal|command|run|spawn|install|commit|push|deploy|send|post|email|message|publish|upload|trade|order|pay|transfer|purchase|browser|click|type|computer)/i;
const NETWORK_READ = /^(web[_-]?search|web[_-]?fetch|fetch[_-]?url|http[_-]?get|search[_-]?web|browse[_-]?read)$/i;
const READ = /^(read|read[_-]?file|view|cat|list|ls|list[_-]?dir|glob|grep|search|find|get|stat|think|todo[_-]?read|lookup)([_-][a-z0-9_-]+)?$/i;

export function classifyTool(name: string): ToolClass {
  const tool = name.trim();
  if (!tool || SIDE_EFFECT.test(tool)) return 'side-effect';
  if (NETWORK_READ.test(tool)) return 'network-read';
  if (READ.test(tool)) return 'read';
  return 'side-effect';
}

const ALLOWED: Record<CapabilityProfile, ToolClass[]> = { 'read-only': ['read'], research: ['read', 'network-read'] };

export function checkProfile(tools: string[], profile: CapabilityProfile) {
  const blocked = tools.filter(tool => !ALLOWED[profile].includes(classifyTool(tool)));
  const verified = tools.length > 0;
  return { allowed: verified && blocked.length === 0, verified, blocked,
    reason: !verified ? 'This harness did not report its tools, so its permissions cannot be verified.'
      : blocked.length ? `This harness exposes tools outside the ${profile} profile: ${blocked.slice(0, 8).join(', ')}${blocked.length > 8 ? '…' : ''}. Disable them in HarnessRouter or pick a read-only harness.`
      : `All ${tools.length} tools fit the ${profile} profile.` };
}
