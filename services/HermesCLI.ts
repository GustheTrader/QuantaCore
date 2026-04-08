
import WebSocket from 'ws';

export interface CLIMessage {
  type: 'execute' | 'status' | 'result' | 'log' | 'fpt_audit';
  id: string;
  payload: any;
  timestamp: number;
}

export interface FPTResult {
  decisionId: string;
  query: string;
  deconstruction: string[];
  axioms: string[];
  reconstruction: string;
  confidenceScore: number;
  actionItems: string[];
  traceId: string;
  latency: number;
}

export class HermesCLI {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private messageHandlers: Map<string, (payload: any) => void> = new Map();
  private pendingRequests: Map<string, { resolve: (value: any) => void, reject: (reason: any) => void, timeout: NodeJS.Timeout }> = new Map();

  constructor(serverUrl: string = 'ws://localhost:3001') {
    this.serverUrl = serverUrl;
  }

  async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.on('open', () => {
          console.log('[HermesCLI] Connected to HermesBridge');
          this.reconnectAttempts = 0;
          this.sendStatus('connected');
          resolve(true);
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('close', () => {
          console.log('[HermesCLI] Disconnected from HermesBridge');
          this.attemptReconnect();
        });

        this.ws.on('error', (err) => {
          console.error('[HermesCLI] WebSocket error:', err.message);
          reject(err);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[HermesCLI] Reconnecting... attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      setTimeout(() => this.connect().catch(() => {}), 2000 * this.reconnectAttempts);
    }
  }

  private handleMessage(rawData: string) {
    try {
      const message: CLIMessage = JSON.parse(rawData);

      switch (message.type) {
        case 'execute':
          this.handleExecute(message);
          break;
        case 'result':
        case 'fpt_audit':
          const pending = this.pendingRequests.get(message.id || '');
          if (pending) {
            pending.resolve(message.payload);
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(message.id || '');
          }
          break;
        case 'log':
          console.log(`[LOG] ${message.payload}`);
          break;
        case 'cli_status':
          console.log(`[STATUS] ${JSON.stringify(message.payload)}`);
          break;
        default:
          console.log(`[MSG] ${message.type}:`, message.payload);
      }

      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        handler(message.payload);
      }
    } catch (e) {
      console.error('[HermesCLI] Parse error:', e);
    }
  }

  private handleExecute(message: CLIMessage) {
    console.log(`[EXEC] Command: ${message.payload?.command || message.payload}`);
    if (message.payload?.fptContext) {
      console.log('[EXEC] FPT Context attached');
    }
  }

  private send(message: CLIMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('[HermesCLI] Not connected');
    }
  }

  private sendStatus(status: string) {
    this.send({
      type: 'status',
      id: Math.random().toString(36).substr(2, 9),
      payload: { status },
      timestamp: Date.now()
    });
  }

  async sendCommand(command: string, context?: any): Promise<FPTResult | null> {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substr(2, 9);
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Command timeout'));
      }, 60000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.send({
        type: 'execute',
        id,
        payload: { command, context },
        timestamp: Date.now()
      });
    });
  }

  onMessage(type: string, handler: (payload: any) => void) {
    this.messageHandlers.set(type, handler);
  }

  async log(message: string) {
    this.send({
      type: 'log',
      id: Math.random().toString(36).substr(2, 9),
      payload: message,
      timestamp: Date.now()
    });
  }

  async sendFPTResult(audit: FPTResult) {
    this.send({
      type: 'fpt_audit',
      id: audit.decisionId,
      payload: audit,
      timestamp: Date.now()
    });
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export default HermesCLI;

export async function runHermesCLIInteractive() {
  const cli = new HermesCLI();
  
  try {
    await cli.connect();
    console.log('╔════════════════════════════════════════════╗');
    console.log('║     HERMES CLI - FPT Ground Truth Engine   ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('Connected to HermesBridge');
    console.log('Type your decision query or :quit to exit\n');

    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const prompt = () => {
      rl.question('hermes> ', async (input) => {
        if (input === ':quit' || input === ':q') {
          cli.disconnect();
          rl.close();
          return;
        }

        if (input.trim()) {
          try {
            const result = await cli.sendCommand(input);
            console.log('\n[FPT RESULT]');
            console.log(JSON.stringify(result, null, 2));
            console.log('');
          } catch (e) {
            console.error('[ERROR]', e);
          }
        }
        prompt();
      });
    };

    prompt();
  } catch (e) {
    console.error('Failed to connect:', e);
  }
}