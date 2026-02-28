
import { SemanticPage, SPT } from "../../types";
import { syncMemoryToSupabase, fetchMemoriesFromSupabase } from "../supabaseService";

export class SemanticMMU {
  private l1Cache: SemanticPage[] = [];
  private l2RAM: SemanticPage[] = [];
  private spt: SPT = { pages: {} };
  private readonly L1_LIMIT = 5;
  private readonly L2_LIMIT = 20;

  /**
   * Alg 2: Semantic Importance Slicing & Paging
   */
  async manageMemory(newPage: SemanticPage) {
    // 1. Check L1 Capacity
    if (this.l1Cache.length >= this.L1_LIMIT) {
      // 2. Evict based on Semantic Importance Score I(σ)
      const victimIndex = this.findVictim(this.l1Cache);
      const victim = this.l1Cache.splice(victimIndex, 1)[0];
      
      // 3. Swap-out to L2 Semantic RAM
      await this.archiveToL2(victim);
    }

    // 4. Insert into L1
    this.l1Cache.push(newPage);
    this.spt.pages[newPage.id] = 'L1';
  }

  private async archiveToL2(page: SemanticPage) {
    if (this.l2RAM.length >= this.L2_LIMIT) {
      // L2 Overflow -> Archive to L3 Vector KB (Supabase)
      const victimIndex = this.findVictim(this.l2RAM);
      const victim = this.l2RAM.splice(victimIndex, 1)[0];
      await this.archiveToL3(victim);
    }
    this.l2RAM.push(page);
    this.spt.pages[page.id] = 'L2';
    console.log(`[S-MMU] Paged out ${page.id} to L2 RAM`);
  }

  private async archiveToL3(page: SemanticPage) {
    console.log(`[S-MMU] Archiving ${page.id} to L3 Vector KB (Supabase)...`);
    await syncMemoryToSupabase({
      id: page.id,
      title: `AgentOS Memory: ${page.id}`,
      content: page.content,
      category: 'AgentOS',
      type: 'distilled',
      assignedAgents: page.tags,
      timestamp: page.lastAccessed
    });
    this.spt.pages[page.id] = 'L3';
  }

  private findVictim(cache: SemanticPage[]): number {
    // Simple heuristic: lowest importance score
    let minScore = Infinity;
    let victimIdx = 0;
    
    cache.forEach((page, idx) => {
      if (page.importance < minScore) {
        minScore = page.importance;
        victimIdx = idx;
      }
    });
    
    return victimIdx;
  }

  async recall(pageId: string): Promise<SemanticPage | null> {
    const location = this.spt.pages[pageId];
    if (location === 'L1') {
      return this.l1Cache.find(p => p.id === pageId) || null;
    }
    if (location === 'L2') {
      // Page Fault! Swap back to L1
      const pageIdx = this.l2RAM.findIndex(p => p.id === pageId);
      if (pageIdx !== -1) {
        const page = this.l2RAM.splice(pageIdx, 1)[0];
        await this.manageMemory(page);
        return page;
      }
    }
    if (location === 'L3') {
      // L3 Recall: Fetch from Supabase
      console.log(`[S-MMU] L3 Page Fault! Recalling ${pageId} from Vector KB...`);
      const memories = await fetchMemoriesFromSupabase();
      const memory = memories?.find(m => m.id === pageId);
      if (memory) {
        const page: SemanticPage = {
          id: memory.id,
          content: memory.content,
          importance: 50, // Re-entry importance
          lastAccessed: Date.now(),
          tags: memory.assignedAgents
        };
        await this.manageMemory(page);
        return page;
      }
    }
    return null;
  }

  getTelemetry() {
    return {
      l1Size: this.l1Cache.length,
      l2Size: this.l2RAM.length,
      l3Size: Object.values(this.spt.pages).filter(v => v === 'L3').length,
      pageFaults: 0 
    };
  }
}

export const smmu = new SemanticMMU();
