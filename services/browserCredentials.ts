/**
 * Browser-held Gemini credentials are intentionally read from the user's local settings.
 * Never inject provider keys through Vite's `define` or commit them in index.html.
 */
export function getLocalGeminiApiKey(): string {
  try {
    const settings = JSON.parse(localStorage.getItem('quanta_api_settings') || '{}');
    if (settings.computeMode === 'sovereign' && typeof settings.geminiKey === 'string') {
      return settings.geminiKey;
    }
  } catch {
    // A missing or malformed local preference means no browser credential is configured.
  }
  return '';
}
