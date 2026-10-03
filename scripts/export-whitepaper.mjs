import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { WHITEPAPER_TEXT } from '../services/whitepaperContent.ts';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const folder of ['docs', 'public/whitepapers', 'dist/whitepapers']) {
  const directory = path.join(root, folder);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'QuantaOS_Sovereign_Intelligence_Whitepaper_v1.4.txt'), WHITEPAPER_TEXT.trim() + '\n');
}
console.log('Whitepaper v1.4 exported to docs and local static downloads.');
