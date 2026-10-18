// Decides where agent memory is stored. Private memory must never move from this
// computer to a cloud service just because the frontend was built in production mode.
export type MemoryTarget = 'local' | 'hosted';
const loopback = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export function resolveMemoryTarget(input: { configured?: string; hostname: string; production: boolean }): { target: MemoryTarget; reason: string } {
  const configured = input.configured?.trim().toLowerCase();
  if (configured === 'local' || configured === 'hosted') return { target: configured, reason: `Set by VITE_QUANTA_MEMORY_TARGET=${configured}.` };
  if (loopback.has(input.hostname)) return { target: 'local', reason: 'Running on this computer, so memory stays in the local Hindsight and Honcho services.' };
  if (input.production) return { target: 'hosted', reason: 'Hosted deployment: memory uses the Supabase quanta-memory function.' };
  return { target: 'local', reason: 'Development build defaults to local memory.' };
}

export const memoryTarget = () => resolveMemoryTarget({
  configured: import.meta.env.VITE_QUANTA_MEMORY_TARGET,
  hostname: typeof window === 'undefined' ? '127.0.0.1' : window.location.hostname,
  production: !!import.meta.env.PROD
});
