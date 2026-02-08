
import { GoogleGenAI } from "@google/genai";
import { MechNode, HotPathLog, EdgeDomain } from "../types";

const getAI = () => {
  const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) || 
         ((window as any).process?.env?.API_KEY) || 
         '';
  return new GoogleGenAI({ apiKey });
};

const REGIONS = ['us-east', 'us-west', 'eu-central', 'ap-northeast', 'sa-east'];

export const spinUpMechNode = (id: string): MechNode => ({
  id,
  region: REGIONS[Math.floor(Math.random() * REGIONS.length)],
  status: 'spinning',
  latency: Math.floor(Math.random() * 20) + 5,
  load: 0
});

export const simulateRedisMetrics = () => ({
  opsPerSec: Math.floor(Math.random() * 50000) + 12000,
  hitRate: 0.95 + (Math.random() * 0.04),
  memoryUsage: `${(Math.random() * 2 + 0.5).toFixed(1)}GB`
});

export const generateEdgeLogic = async (domains: EdgeDomain[], logCallback: (log: HotPathLog) => void) => {
  const ai = getAI();
  const domainStr = domains.join(', ');
  
  // 1. Simulate Redis Subscription
  logCallback({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    level: 'info',
    source: 'REDIS',
    message: `Subscribed to channels: [${domainStr.toUpperCase()}_FEED] via Hot Path.`
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are the EDGE AGENT, a high-frequency trading bot controller.
      DOMAINS: ${domainStr}
      
      Generate 3 highly technical execution logs representing "Arbitrage" or "Prediction" opportunities found in milliseconds.
      Use jargon like: "Spread detected", "Redis Key Expiry", "Cloudflare Worker Handoff", "Atomic Swap", "Odds divergence".
      
      Format: JSON Array of strings.`,
      config: { responseMimeType: "application/json" }
    });

    const logs: string[] = JSON.parse(response.text || '[]');
    
    logs.forEach((msg, i) => {
      setTimeout(() => {
        logCallback({
          id: `exec_${Date.now()}_${i}`,
          timestamp: Date.now(),
          level: 'exec',
          source: 'MECH',
          message: msg,
          latency: Math.floor(Math.random() * 45) + 5
        });
      }, i * 800);
    });

  } catch (e) {
    logCallback({
      id: `err_${Date.now()}`,
      timestamp: Date.now(),
      level: 'crit',
      source: 'CORE',
      message: "Neural inference latency spike. Rerouting..."
    });
  }
};
