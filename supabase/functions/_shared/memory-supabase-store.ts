import { memoryFailure, type MemoryBank, type MemoryRecord, type MemoryEvent, type MemoryChange, type MemoryStore } from './memory-governance.ts';

// Only the authenticated Edge handler constructs this with its admin client.
// Direct browser writes are revoked by the migration; every read is owner-scoped.
export class SupabaseMemoryStore implements MemoryStore {
  constructor(private client: any) {}
  private async rows(table: string, owner: string, filters: Record<string, string>, limit = 1) {
    let query = this.client.from(table).select('value').eq('owner_id', owner);
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
    if (error) throw memoryFailure('The memory ledger is unavailable. Apply the F08 migration and retry.', 503);
    return data.map((row: any) => row.value);
  }
  async bank(owner: string, id: string): Promise<MemoryBank | undefined> { return (await this.rows('quanta_memory_banks_v2', owner, { id }))[0]; }
  async record(owner: string, id: string): Promise<MemoryRecord | undefined> { return (await this.rows('quanta_memory_records_v2', owner, { id }))[0]; }
  async records(owner: string, bankId: string, limit: number): Promise<MemoryRecord[]> { return this.rows('quanta_memory_records_v2', owner, { bank_id: bankId }, limit); }
  async events(owner: string, bankId: string, limit: number): Promise<MemoryEvent[]> { return this.rows('quanta_memory_events_v2', owner, { bank_id: bankId }, limit); }
  async children(owner: string, recordId: string): Promise<MemoryRecord[]> { return this.rows('quanta_memory_records_v2', owner, { 'value->>previousId': recordId }, 1001); }
  async commit(owner: string, change: MemoryChange) {
    const { error } = await this.client.rpc('quanta_memory_commit_v2', { p_owner: owner, p_change: change });
    if (error) throw memoryFailure(error.code === '40001' ? 'Memory changed; refresh before retrying.' : 'Memory admission could not be committed.', error.code === '40001' ? 409 : 503);
  }
}
