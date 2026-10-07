import { tsImport } from 'tsx/esm/api';
import { fileURLToPath } from 'node:url';
const { ProviderStore } = await tsImport('../server/provider-store.ts', import.meta.url);
const { migrateBootstrapSecrets } = await tsImport('../server/bootstrap-secrets.ts', import.meta.url);
const store = new ProviderStore(fileURLToPath(new URL('../.quanta/', import.meta.url)));
export const getLocalSecrets = () => migrateBootstrapSecrets(store);
export const saveLocalSecrets = data => store.setOAuthCredentials(data, 'bootstrap');
