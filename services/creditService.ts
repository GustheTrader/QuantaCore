
import { UserCredits } from '../types';

const STORAGE_KEY = 'quanta_user_credits';

export const getCredits = (): UserCredits => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration for existing users
      if (parsed.visualEnergy === undefined) parsed.visualEnergy = 2000;
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse credits from storage:', e);
  }

  const initial: UserCredits = {
    cloudTokens: 10000,
    deepAgentTokens: 5000,
    visualEnergy: 2000,
    lastSync: Date.now()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
};

export const deductCloudCredits = (amount: number = 10) => {
  const credits = getCredits();
  credits.cloudTokens = Math.max(0, credits.cloudTokens - amount);
  credits.lastSync = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credits));
  window.dispatchEvent(new Event('quanta_credits_updated'));
};

export const deductDeepAgentCredits = (amount: number = 50) => {
  const credits = getCredits();
  credits.deepAgentTokens = Math.max(0, credits.deepAgentTokens - amount);
  credits.lastSync = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credits));
  window.dispatchEvent(new Event('quanta_credits_updated'));
};

export const deductVisualEnergy = (amount: number = 50) => {
  const credits = getCredits();
  credits.visualEnergy = Math.max(0, credits.visualEnergy - amount);
  credits.lastSync = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credits));
  window.dispatchEvent(new Event('quanta_credits_updated'));
};

export const checkHasCredits = (type: 'cloud' | 'agent' | 'visual'): boolean => {
  const credits = getCredits();

  try {
    const settings = JSON.parse(localStorage.getItem('quanta_api_settings') || '{}');
    // In sovereign mode, user provides their own API keys, so credits don't apply.
    // Verify they actually have a key configured before bypassing credit check.
    if (settings.computeMode === 'sovereign' && settings.geminiKey) return true;
  } catch (e) {
    console.error('Failed to parse API settings:', e);
  }

  if (type === 'cloud') return credits.cloudTokens > 0;
  if (type === 'agent') return credits.deepAgentTokens > 0;
  return credits.visualEnergy > 0;
};
