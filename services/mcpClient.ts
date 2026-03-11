
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

// Assuming MuninnDB MCP server is running at this endpoint
const MCP_SERVER_URL = "http://localhost:3001/sse";

class MuninnMCPClient {
  private client: Client | null = null;

  async connect() {
    try {
      const transport = new SSEClientTransport(new URL(MCP_SERVER_URL));
      this.client = new Client({
        name: "QuantaOS-Muninn-Client",
        version: "1.0.0",
      }, {
        capabilities: {}
      });

      await this.client.connect(transport);
      console.log("Connected to MuninnDB MCP server");
    } catch (error) {
      console.error("Failed to connect to MuninnDB MCP server:", error);
    }
  }

  async queryMemory(query: string) {
    if (!this.client) return null;
    // Assuming the MCP server exposes a 'query_memory' tool
    return await this.client.callTool({
      name: "query_memory",
      arguments: { query }
    });
  }
}

export const muninnClient = new MuninnMCPClient();
