import type { AbacusStreamChunk } from '../types';

/** Deprecated unverified agent endpoint. Cloud work now uses the approved local job gateway. */
export const streamAbacusAgent = async (
  _agentId: string,
  _userMessage: string,
  _onChunk: (chunk: AbacusStreamChunk) => void,
  _sessionId?: string
): Promise<string> => {
  throw new Error('Open Hybrid Cloud in Settings or /hybrid.html to configure your Abacus deployment and approve a cloud job. The legacy browser agent endpoint has been retired.');
};
