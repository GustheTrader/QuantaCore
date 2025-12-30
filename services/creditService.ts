
import { UserCredits } from '../types';

const STORAGE_KEY = 'quanta_user_credits';

export const getCredits = (): UserCredits => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return JSON.parse(saved);
  
  const initial: UserCredits = {
    cloudTokens: 10000,
    deepAgentTokens: 5000,
    lastSync: Date.now()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
};

export const deductCloudCredits = (amount: number = 10) => {
  const credits = getCredits();
  // Don't deduct if in sovereign mode (handled by settings check in components usually, 
  // but we enforce here if needed. For now, assume this is called only for credit-based compute).
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

export const checkHasCredits = (type: 'cloud' | 'agent'): boolean => {
  const credits = getCredits();
  const settings = JSON.parse(localStorage.getItem('quanta_api_settings') || '{}');
  
  // If user is in BYOK (Sovereign) mode, they don't use platform credits
  if (settings.computeMode === 'sovereign') return true;
  
  return type === 'cloud' ? credits.cloudTokens > 0 : credits.deepAgentTokens > 0;
};
