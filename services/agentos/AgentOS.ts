
import { kernel } from "./ReasoningKernel";
import { smmu } from "./SemanticMMU";
import { hermes } from "./HermesProtocol";
import { scheduler } from "./CognitiveScheduler";
import { agentTools } from "./tools";
import { AgentOSState, SemanticPage } from "../../types";

export class AgentOS {
  private state: AgentOSState;

  constructor() {
    this.state = kernel.getState();
  }

  /**
   * The main entry point for a sovereign agentic task.
   */
  async runTask(agentId: string, query: string, tools: any[] = agentTools) {
    console.log(`[AgentOS] Initializing Sovereign Reasoning for ${agentId}...`);

    // 1. Memory Recall (L1/L2/L3)
    const contextPage = await smmu.recall(`ctx_${agentId}`);
    const context = contextPage ? contextPage.content : "No prior semantic context found.";

    // 2. Execution Loop (RK)
    let response = await kernel.execute(agentId, query, context);

    // 3. RIC: Reasoning Interrupt Cycle (Alg 1)
    let ricPasses = 0;
    while (response?.includes('<tool_call>') && ricPasses < 3) {
      console.log(`[AgentOS] RIC: Tool Interrupt detected. Pass ${ricPasses + 1}`);
      
      const interruptResult = await hermes.processInterrupt(response, tools);
      if (interruptResult) {
        console.log(`[AgentOS] RIC: Tool Result Aligned. Re-entering RK...`);
        // Feed the tool result back into the kernel for synthesis
        response = await kernel.execute(agentId, `TOOL_RESULT: ${interruptResult}`, context + "\n" + response);
      } else {
        break;
      }
      ricPasses++;
    }

    // 4. Memory Archival (S-MMU)
    const newPage: SemanticPage = {
      id: `page_${Date.now()}`,
      content: response || "",
      importance: this.calculateImportance(response || ""),
      lastAccessed: Date.now(),
      tags: [agentId, 'synthesis']
    };
    await smmu.manageMemory(newPage);

    // 5. Multi-Agent Sync (CSP)
    if (this.state.globalDrift > 0.5) {
      await scheduler.executeSyncPulse(this.state);
    }

    return response;
  }

  private calculateImportance(content: string): number {
    // Simple heuristic: length and keyword density
    return Math.min(100, (content.length / 100) + (content.includes('axiom') ? 20 : 0));
  }

  getTelemetry() {
    return {
      kernel: this.state,
      mmu: smmu.getTelemetry()
    };
  }
}

export const agentOS = new AgentOS();
