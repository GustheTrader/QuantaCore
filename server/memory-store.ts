import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, realpathSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { bindCurrentEntity } from './operating-evidence';
import { memoryFailure, type MemoryBank, type MemoryRecord, type MemoryEvent, type MemoryChange, type MemoryStore } from '../supabase/functions/_shared/memory-governance';

export class LocalMemoryStore implements MemoryStore {
  private db: DatabaseSync;
  constructor(root: string) {
    const directory = path.join(root, '.quanta', 'memory-v2'); mkdirSync(directory, { recursive: true, mode: 0o700 });
    const actualRoot = realpathSync(root), actualDirectory = realpathSync(directory);
    if (!actualDirectory.startsWith(actualRoot + path.sep)) throw new Error('Memory directory must stay inside the application workspace.');
    if (process.platform === 'win32') {
      const directoryLiteral = actualDirectory.replace(/'/g, "''");
      const script = `$ErrorActionPreference='Stop'; $taskMemoryDirectory='${directoryLiteral}'; $taskMemoryAcl=[System.Security.AccessControl.DirectorySecurity]::new(); $taskMemoryAcl.SetAccessRuleProtection($true,$false); $taskMemorySid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $taskMemoryAcl.SetOwner($taskMemorySid); foreach($taskAllowedSid in @($taskMemorySid.Value,'S-1-5-18','S-1-5-32-544')) { $taskMemoryRule=[System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new($taskAllowedSid),'FullControl','ContainerInherit,ObjectInherit','None','Allow'); $taskMemoryAcl.AddAccessRule($taskMemoryRule) }; Set-Acl -LiteralPath $taskMemoryDirectory -AclObject $taskMemoryAcl`;
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, stdio: 'ignore', timeout: 20000 });
    } else chmodSync(directory, 0o700);
    const database = path.join(directory, 'ledger.sqlite'); this.db = new DatabaseSync(database);
    if (process.platform !== 'win32') chmodSync(database, 0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON;
      CREATE TABLE IF NOT EXISTS banks (id TEXT PRIMARY KEY, owner TEXT NOT NULL, version INTEGER NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, owner TEXT NOT NULL, bank_id TEXT NOT NULL REFERENCES banks(id), version INTEGER NOT NULL, value TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS memory_records_owner_bank ON records(owner, bank_id);
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, owner TEXT NOT NULL, bank_id TEXT NOT NULL REFERENCES banks(id), value TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS memory_events_owner_bank ON events(owner, bank_id);`);
  }
  async bank(owner: string, id: string): Promise<MemoryBank | undefined> { const row = this.db.prepare('SELECT value FROM banks WHERE owner=? AND id=?').get(owner, id); return row ? JSON.parse(String(row.value)) : undefined; }
  async record(owner: string, id: string): Promise<MemoryRecord | undefined> { const row = this.db.prepare('SELECT value FROM records WHERE owner=? AND id=?').get(owner, id); return row ? JSON.parse(String(row.value)) : undefined; }
  async records(owner: string, bankId: string, limit: number): Promise<MemoryRecord[]> { return this.db.prepare('SELECT value FROM records WHERE owner=? AND bank_id=? ORDER BY rowid DESC LIMIT ?').all(owner, bankId, limit).map(row => JSON.parse(String(row.value))); }
  async events(owner: string, bankId: string, limit: number): Promise<MemoryEvent[]> { return this.db.prepare('SELECT value FROM events WHERE owner=? AND bank_id=? ORDER BY rowid DESC LIMIT ?').all(owner, bankId, limit).map(row => JSON.parse(String(row.value))); }
  async children(owner: string, recordId: string): Promise<MemoryRecord[]> { return this.db.prepare("SELECT value FROM records WHERE owner=? AND json_extract(value,'$.previousId')=? LIMIT 1001").all(owner, recordId).map(row => JSON.parse(String(row.value))); }
  async commit(owner: string, change: MemoryChange) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (change.bank) {
        const bank = change.bank;
        const current = this.db.prepare('SELECT owner,version FROM banks WHERE id=?').get(bank.id);
        if (bank.owner !== owner || (current ? current.owner !== owner || Number(current.version) !== bank.version - 1 : bank.version !== 1)) throw memoryFailure('Memory policy changed; refresh before retrying.', 409);
        this.db.prepare('INSERT INTO banks VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,value=excluded.value').run(bank.id, owner, bank.version, JSON.stringify(bank));
      }
      for (const record of change.records || []) {
        const bank = this.db.prepare('SELECT owner,value FROM banks WHERE id=?').get(record.bankId);
        const current = this.db.prepare('SELECT owner,bank_id,version FROM records WHERE id=?').get(record.id);
        if (record.owner !== owner || !bank || bank.owner !== owner || (current ? current.owner !== owner || current.bank_id !== record.bankId || Number(current.version) !== record.version - 1 : record.version !== 1)) throw memoryFailure('Memory changed; refresh before retrying.', 409);
        if (JSON.parse(String(bank.value)).scope === 'master' && record.status === 'active' && record.reviewStatus !== 'human_reviewed') throw memoryFailure('Master knowledge requires human review.', 409);
        this.db.prepare('INSERT INTO records VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,value=excluded.value').run(record.id, owner, record.bankId, record.version, JSON.stringify(record));
      }
      for (const item of change.events || []) {
        if (item.owner !== owner || !this.db.prepare('SELECT id FROM banks WHERE id=? AND owner=?').get(item.bankId, owner)) throw memoryFailure('Invalid memory audit ownership.', 409);
        this.db.prepare('INSERT INTO events VALUES(?,?,?,?)').run(item.id, owner, item.bankId, JSON.stringify(item));
      }
      this.db.exec('COMMIT');
      for(const event of change.events||[])bindCurrentEntity('memory',event.id);
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  async checkpoint() { this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); }
}
