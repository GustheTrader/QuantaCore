import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectEnv = path.join(root, '.env');
if (!fs.existsSync(projectEnv)) throw new Error('Create C:\\QuantaCore\\.env from .env.example first.');
process.loadEnvFile(projectEnv);
const apiKey = process.env.OPENROUTER_API_KEY?.trim();
if (!apiKey) throw new Error('OPENROUTER_API_KEY is empty in the local .env file.');

function upsert(file, entries) {
  let lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
  for (const [name, value] of Object.entries(entries)) {
    const index = lines.findIndex(line => line.startsWith(`${name}=`));
    const next = `${name}=${value}`;
    if (index < 0) lines.push(next);
    else lines[index] = next;
  }
  lines = lines.filter((line, index) => line || index < lines.length - 1);
  fs.writeFileSync(file, `${lines.join('\n').replace(/\n*$/, '')}\n`);
}

upsert(projectEnv, {
  HINDSIGHT_API_LLM_PROVIDER: 'openai',
  HINDSIGHT_API_LLM_API_KEY: apiKey,
  HINDSIGHT_API_LLM_MODEL: 'openrouter/free',
  HINDSIGHT_API_LLM_BASE_URL: 'https://openrouter.ai/api/v1'
});

const honchoRoot = path.join(root, '.quanta', 'honcho');
const profileDir = path.join(honchoRoot, 'profiles', 'quanta-core');
const profileEnv = path.join(profileDir, '.env');
fs.mkdirSync(profileDir, { recursive: true });
const honchoEntries = {
  LLM_OPENAI_API_KEY: apiKey,
  LLM_OPENAI_BASE_URL: 'https://openrouter.ai/api/v1',
  EMBED_MESSAGES: 'false'
};
for (const setting of [
  'DERIVER_MODEL_CONFIG',
  'SUMMARY_MODEL_CONFIG',
  'DREAM_DEDUCTION_MODEL_CONFIG',
  'DREAM_INDUCTION_MODEL_CONFIG',
  ...['minimal', 'low', 'medium', 'high', 'max'].map(level => `DIALECTIC_LEVELS__${level}__MODEL_CONFIG`)
]) {
  honchoEntries[`${setting}__TRANSPORT`] = 'openai';
  honchoEntries[`${setting}__MODEL`] = 'openrouter/free';
}
upsert(profileEnv, honchoEntries);
console.log('Configured local Hindsight and Honcho to use the OpenRouter free-model route. Secret values were not displayed.');
