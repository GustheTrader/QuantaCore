
// Flatfile-based memory management
export interface MemoryNode {
  id: string;
  content: string;
  associations: string[];
  confidence: number;
  lastAccessed: number;
}

class MemoryService {
  private memory: MemoryNode[] = [];

  constructor() {
    this.loadFromFlatfile();
  }

  private loadFromFlatfile() {
    // In a real flatfile system, we'd read from a file.
    // Here, we simulate it using localStorage as the persistent "flatfile".
    const saved = localStorage.getItem('quanta_cognitive_flatfile');
    if (saved) this.memory = JSON.parse(saved);
  }

  private saveToFlatfile() {
    localStorage.setItem('quanta_cognitive_flatfile', JSON.stringify(this.memory));
  }

  addMemory(content: string, associations: string[] = []) {
    const node: MemoryNode = {
      id: Math.random().toString(36).substr(2, 9),
      content,
      associations,
      confidence: 1.0,
      lastAccessed: Date.now()
    };
    this.memory.push(node);
    this.saveToFlatfile();
    return node;
  }

  getMemory() {
    return this.memory;
  }

  performCognitiveMaintenance() {
    const now = Date.now();
    this.memory = this.memory.map(node => ({
      ...node,
      confidence: Math.max(0, node.confidence - (now - node.lastAccessed) / 10000000000)
    })).filter(node => node.confidence > 0.1);
    this.saveToFlatfile();
  }
}

export const memoryService = new MemoryService();
