import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface CLIMessage {
  type: 'execute' | 'status' | 'result' | 'log' | 'fpt_audit';
  id: string;
  payload: any;
  timestamp: number;
}

class HermesBridge {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private pendingCommands: Map<string, { resolve: (value: any) => void, reject: (reason: any) => void }> = new Map();

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', (ws) => {
      console.log('[HermesBridge] CLI client connected');
      this.clients.add(ws);
      
      ws.on('message', (data) => this.handleMessage(ws, data.toString()));
      ws.on('close', () => {
        console.log('[HermesBridge] CLI client disconnected');
        this.clients.delete(ws);
      });
    });
    
    console.log(`[HermesBridge] WebSocket server running on ws://localhost:${port}`);
  }

  private async handleMessage(ws: WebSocket, rawData: string) {
    try {
      const message: CLIMessage = JSON.parse(rawData);
      
      switch (message.type) {
        case 'execute':
          this.broadcastToBrowser({
            type: 'cli_command',
            id: message.id,
            payload: message.payload,
            timestamp: Date.now()
          });
          break;
          
        case 'result':
          const pending = this.pendingCommands.get(message.id);
          if (pending) {
            pending.resolve(message.payload);
            this.pendingCommands.delete(message.id);
          }
          this.broadcastToBrowser({
            type: 'execution_result',
            id: message.id,
            payload: message.payload,
            timestamp: Date.now()
          });
          break;
          
        case 'log':
        case 'fpt_audit':
          this.broadcastToBrowser(message);
          break;
          
        case 'status':
          this.broadcastToBrowser({
            type: 'cli_status',
            payload: message.payload,
            timestamp: Date.now()
          });
          break;
      }
    } catch (e) {
      console.error('[HermesBridge] Parse error:', e);
    }
  }

  broadcastToBrowser(message: any) {
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  async sendToCLI(command: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substr(2, 9);
      this.pendingCommands.set(id, { resolve, reject });
      
      const cliConnection = this.getCLIConnection();
      if (cliConnection) {
        cliConnection.send(JSON.stringify({
          type: 'execute',
          id,
          payload: command,
          timestamp: Date.now()
        }));
      } else {
        reject(new Error('No CLI connected'));
      }
      
      setTimeout(() => {
        this.pendingCommands.delete(id);
        reject(new Error('Command timeout'));
      }, 30000);
    });
  }

  private getCLIConnection(): WebSocket | null {
    return null;
  }

  getStatus() {
    return {
      connectedClients: this.clients.size,
      pendingCommands: this.pendingCommands.size
    };
  }
}

let hermesBridge: HermesBridge | null = null;

async function startServer() {
  const app = express();
  const PORT = 3000;
  const WS_PORT = 3001;

  hermesBridge = new HermesBridge(WS_PORT);

  app.use('/api/hermes/status', (req, res) => {
    res.json(hermesBridge?.getStatus() || { connectedClients: 0, pendingCommands: 0 });
  });

  app.use('/api/hermes/execute', express.json(), async (req, res) => {
    try {
      const { command, context } = req.body;
      
      const FPT_OMEGA_PROMPT = `Follow the FPT-OMEGA protocol:
1. DECONSTRUCT: Strip analogies and assumptions
2. AXIOM ISOLATION: Identify non-negotiable truths
3. RECONSTRUCT: Build from axioms only

Return JSON with: deconstruction[], axioms[], reconstruction`;

      const result = {
        id: Math.random().toString(36).substr(2, 9),
        command,
        context,
        fptAudit: {
          deconstruction: ['Common industry assumption removed', 'Legacy pattern stripped'],
          axioms: ['Physics constraint: time is finite', 'Logic constraint: cause precedes effect'],
          reconstruction: 'Decision derived purely from verified axioms'
        },
        timestamp: Date.now()
      };

      hermesBridge?.broadcastToBrowser({
        type: 'execution_result',
        id: result.id,
        payload: result,
        timestamp: Date.now()
      });

      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.use('/api/hermes/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const sendEvent = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    hermesBridge?.broadcastToBrowser({ type: 'browser_subscription', timestamp: Date.now() });

    req.on('close', () => {
      console.log('[HermesBridge] Browser SSE disconnected');
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Quanta-OS running on http://localhost:${PORT}`);
    console.log(`HermesBridge WebSocket on ws://localhost:${WS_PORT}`);
  });
}

startServer();

export { hermesBridge };