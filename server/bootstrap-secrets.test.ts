import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ProviderStore } from './provider-store';
import { migrateBootstrapSecrets } from './bootstrap-secrets';
test('bootstrap migration verifies protected credentials before removing exact plaintext sources', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(),'bootstrap-migration-'));
  try {
    const source={email:'fixture@example.test',password:'fixture-secret'};
    await fs.writeFile(path.join(directory,'paperclip-auth.json'),JSON.stringify(source));
    await fs.writeFile(path.join(directory,'business-connector-keys.json'),JSON.stringify({twenty:'fixture-connector'}));
    await fs.writeFile(path.join(directory,'paperclip.env'),'BETTER_AUTH_SECRET=fixture-server-secret\n');
    const store=new ProviderStore(directory); const migrated=await migrateBootstrapSecrets(store);
    assert.deepEqual(migrated.paperclipAuth,source); assert.equal(migrated.paperclipServerSecret,'fixture-server-secret');
    assert.equal((await fs.readFile(path.join(directory,'bootstrap-credentials.json'),'utf8')).includes('fixture-secret'),false);
    await assert.rejects(fs.stat(path.join(directory,'paperclip-auth.json')),/ENOENT/);
    assert.deepEqual((await migrateBootstrapSecrets(new ProviderStore(directory))).connectorKeys,{twenty:'fixture-connector'});
  } finally { await fs.rm(directory,{recursive:true,force:true}); }
});
