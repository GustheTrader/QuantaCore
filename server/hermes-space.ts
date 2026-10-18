import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, lstatSync, realpathSync, renameSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function hermesSpace(root: string, workspace: string) {
  if (!['work', 'personal', 'ideas'].includes(workspace)) throw new Error('Unknown space.');
  const directory = path.join(root, '.quanta', 'hermes', 'workspaces', workspace);
  mkdirSync(directory, { recursive: true });
  const record = path.join(root, '.quanta', 'hermes', workspace + '-missions.json');
  const missions = () => existsSync(record) ? JSON.parse(readFileSync(record, 'utf8')) : [];
  return {
    missions,
    saveMission(body: any) {
      if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200) throw new Error('Enter a mission title.');
      const rows = missions();
      rows.push({ id: randomUUID(), title: body.title.trim(), prompt: String(body.prompt || '').slice(0, 32000), status: 'planned', createdAt: Date.now() });
      writeFileSync(record + '.tmp', JSON.stringify(rows, null, 2)); renameSync(record + '.tmp', record); return rows;
    },
    memory() {
      const home = process.env.HERMES_HOME || path.join(process.env.LOCALAPPDATA || '', 'hermes');
      return ['MEMORY.md', 'USER.md'].map(name => {
        const file = path.join(home, 'profiles', 'gnoesis-' + workspace, 'memories', name);
        return { name, content: existsSync(file) ? readFileSync(file, 'utf8').slice(0, 200000) : '' };
      });
    },
    files(relative = '') {
      const target = path.resolve(directory, relative);
      const resolvedRoot = realpathSync(directory);
      if (target !== directory && !target.startsWith(directory + path.sep)) throw new Error('File is outside this space.');
      if (lstatSync(target).isSymbolicLink()) throw new Error('Symbolic links are not followed.');
      const resolved = realpathSync(target);
      if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) throw new Error('File is outside this space.');
      if (lstatSync(target).isDirectory()) return { entries: readdirSync(target, { withFileTypes: true }).filter(item => !item.isSymbolicLink()).map(item => ({ name: item.name, directory: item.isDirectory() })) };
      const stat = lstatSync(target);
      if (stat.size > 1000000) throw new Error('Preview is limited to 1 MB.');
      return { content: readFileSync(target, 'utf8') };
    },
  };
}
