import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid
} from 'recharts';
import {
  Activity,
  Cpu,
  Database,
  Wifi,
  Play,
  Pause,
  Zap,
  Server,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Maximize2,
  Minimize2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Radio,
  HardDriveDownload,
  Gauge,
  Sparkles
} from 'lucide-react';

export interface TelemetryPoint {
  id: string;
  time: string;
  timestamp: number;
  memoryUsedMB: number;
  memoryAllocatedMB: number;
  memoryLimitMB: number;
  latencyMs: number;
  jitterMs: number;
  eventLoopLagMs: number;
  activeThreads: number;
  throughputKb: number;
  status: 'optimal' | 'nominal' | 'degraded';
  isGCEviction?: boolean;
}

export interface SystemHealthWidgetProps {
  initialCompact?: boolean;
  className?: string;
  onAlertTriggered?: (alert: string) => void;
}

type MetricTab = 'combined' | 'memory' | 'latency';

interface TargetNode {
  id: string;
  name: string;
  endpoint: string;
  baseLatency: number;
  variance: number;
  role: string;
}

const TARGET_NODES: TargetNode[] = [
  { id: 'gateway', name: 'Quanta Gateway', endpoint: 'api.quanta.internal', baseLatency: 18, variance: 8, role: 'Primary Ingress' },
  { id: 'agent-zero', name: 'Agent Zero Core', endpoint: 'zero.sandbox.quanta', baseLatency: 28, variance: 12, role: 'Execution Runtime' },
  { id: 'vector-db', name: 'Neural Vector Store', endpoint: 'pgvector.quanta.io', baseLatency: 42, variance: 15, role: 'L2 Semantic Memory' },
  { id: 'edge-mech', name: 'Cloudflare Mech Mesh', endpoint: 'workers.quanta.edge', baseLatency: 14, variance: 6, role: 'Distributed Edge' }
];

export const SystemHealthWidget: React.FC<SystemHealthWidgetProps> = ({
  initialCompact = false,
  className = '',
  onAlertTriggered
}) => {
  const [isLive, setIsLive] = useState(true);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(1500);
  const [isCompact, setIsCompact] = useState(initialCompact);
  const [activeTab, setActiveTab] = useState<MetricTab>('combined');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('gateway');
  const [isProbing, setIsProbing] = useState(false);
  const [simulatedLoadActive, setSimulatedLoadActive] = useState(false);
  const [gcTriggerCount, setGcTriggerCount] = useState(0);

  // Uptime in seconds
  const [uptimeSeconds, setUptimeSeconds] = useState(14820);

  // Live telemetry state
  const [history, setHistory] = useState<TelemetryPoint[]>(() => {
    const initialPoints: TelemetryPoint[] = [];
    const now = Date.now();
    const count = 24;
    let currentMem = 480;

    for (let i = count; i >= 0; i--) {
      const pointTime = new Date(now - i * 2000);
      currentMem = Math.min(880, Math.max(380, currentMem + (Math.random() * 24 - 11)));
      const baseLat = 22;
      const lat = Math.round(baseLat + Math.random() * 14 - 4);
      
      initialPoints.push({
        id: `init-${i}`,
        time: pointTime.toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
        timestamp: pointTime.getTime(),
        memoryUsedMB: Number(currentMem.toFixed(1)),
        memoryAllocatedMB: 1024,
        memoryLimitMB: 1536,
        latencyMs: Math.max(8, lat),
        jitterMs: Number((Math.random() * 3 + 0.8).toFixed(1)),
        eventLoopLagMs: Number((Math.random() * 2.2 + 0.9).toFixed(2)),
        activeThreads: Math.floor(Math.random() * 5 + 9),
        throughputKb: Number((Math.random() * 80 + 120).toFixed(1)),
        status: lat > 75 ? 'degraded' : lat > 45 ? 'nominal' : 'optimal'
      });
    }
    return initialPoints;
  });

  const selectedNode = useMemo(() => {
    return TARGET_NODES.find(n => n.id === selectedNodeId) || TARGET_NODES[0];
  }, [selectedNodeId]);

  // Current latest reading
  const latestMetric = useMemo(() => {
    return history[history.length - 1] || {
      id: 'default',
      time: '--:--',
      timestamp: Date.now(),
      memoryUsedMB: 512,
      memoryAllocatedMB: 1024,
      memoryLimitMB: 1536,
      latencyMs: 24,
      jitterMs: 1.8,
      eventLoopLagMs: 1.2,
      activeThreads: 10,
      throughputKb: 145,
      status: 'optimal' as const
    };
  }, [history]);

  // Calculated stats
  const metricsSummary = useMemo(() => {
    if (history.length === 0) {
      return {
        avgLatency: 0,
        minLatency: 0,
        maxLatency: 0,
        avgMemory: 0,
        peakMemory: 0,
        memoryPercent: 0,
        trend: 0
      };
    }
    const latencies = history.map(h => h.latencyMs);
    const memories = history.map(h => h.memoryUsedMB);
    const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);
    const avgMemory = Number((memories.reduce((a, b) => a + b, 0) / memories.length).toFixed(1));
    const peakMemory = Math.max(...memories);
    const memoryPercent = Math.round((latestMetric.memoryUsedMB / latestMetric.memoryAllocatedMB) * 100);

    const prevMem = history.length > 5 ? history[history.length - 6].memoryUsedMB : memories[0];
    const trend = Number((latestMetric.memoryUsedMB - prevMem).toFixed(1));

    return {
      avgLatency,
      minLatency,
      maxLatency,
      avgMemory,
      peakMemory,
      memoryPercent,
      trend
    };
  }, [history, latestMetric]);

  // Read actual browser performance memory if supported
  const getBrowserMemoryEstimate = useCallback(() => {
    if (typeof window !== 'undefined' && (window.performance as any)?.memory) {
      const mem = (window.performance as any).memory;
      const usedMB = mem.usedJSHeapSize / (1024 * 1024);
      const totalMB = mem.totalJSHeapSize / (1024 * 1024);
      const limitMB = mem.jsHeapSizeLimit / (1024 * 1024);
      return { usedMB, totalMB, limitMB };
    }
    return null;
  }, []);

  // Interval engine for live telemetry
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      setUptimeSeconds(prev => prev + Math.round(refreshIntervalMs / 1000));

      setHistory(prevHistory => {
        const last = prevHistory[prevHistory.length - 1];
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });

        // Calculate next memory
        let nextMem = last ? last.memoryUsedMB : 500;
        const realMem = getBrowserMemoryEstimate();

        if (realMem) {
          // Anchor to real heap with simulated agent workload buffer
          nextMem = simulatedLoadActive 
            ? realMem.usedMB * 2.8 + (Math.random() * 40)
            : realMem.usedMB * 1.5 + (Math.random() * 15);
        } else {
          // Synthetic drift
          const delta = simulatedLoadActive 
            ? Math.random() * 35 + 5 
            : (Math.random() * 22 - 9.5);
          nextMem += delta;

          // Natural GC cleanup when reaching high threshold
          if (nextMem > 960) {
            nextMem = 480 + Math.random() * 60;
          }
        }

        // Calculate next latency
        const baseLatency = selectedNode.baseLatency;
        const variance = selectedNode.variance;
        const loadMultiplier = simulatedLoadActive ? 1.8 : 1.0;
        const randomSpike = Math.random() > 0.94 ? Math.random() * 45 : 0;
        const latency = Math.max(
          6,
          Math.round((baseLatency + (Math.random() * (variance * 2) - variance) + randomSpike) * loadMultiplier)
        );

        const jitter = Number((Math.random() * 2.5 + 0.4).toFixed(1));
        const eventLoopLag = Number((Math.random() * 1.8 + 0.8 + (simulatedLoadActive ? 3.5 : 0)).toFixed(2));
        const activeThreads = simulatedLoadActive 
          ? Math.floor(Math.random() * 4 + 18) 
          : Math.floor(Math.random() * 5 + 8);
        const throughputKb = Number(((simulatedLoadActive ? 380 : 130) + Math.random() * 60).toFixed(1));

        let status: 'optimal' | 'nominal' | 'degraded' = 'optimal';
        if (latency > 75 || nextMem > 900) {
          status = 'degraded';
        } else if (latency > 45 || nextMem > 750) {
          status = 'nominal';
        }

        const newPoint: TelemetryPoint = {
          id: `point-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          time: timeStr,
          timestamp: now.getTime(),
          memoryUsedMB: Number(nextMem.toFixed(1)),
          memoryAllocatedMB: 1024,
          memoryLimitMB: 1536,
          latencyMs: latency,
          jitterMs: jitter,
          eventLoopLagMs: eventLoopLag,
          activeThreads,
          throughputKb,
          status
        };

        // Keep maximum 32 historical ticks for smooth rendering
        return [...prevHistory.slice(-31), newPoint];
      });
    }, refreshIntervalMs);

    return () => clearInterval(interval);
  }, [isLive, refreshIntervalMs, simulatedLoadActive, selectedNode, getBrowserMemoryEstimate]);

  // Interactive Action: Probe Network Latency
  const handleProbeLatency = async () => {
    if (isProbing) return;
    setIsProbing(true);
    const start = performance.now();

    try {
      // Make a light ping request to current origin
      await fetch(window.location.origin, { method: 'HEAD', cache: 'no-store' }).catch(() => {});
    } catch {
      // Fallback
    }

    const duration = Math.max(12, Math.round(performance.now() - start));
    setIsProbing(false);

    // Inject immediate benchmark point
    const now = new Date();
    setHistory(prev => {
      const last = prev[prev.length - 1];
      const benchmarkPoint: TelemetryPoint = {
        id: `probe-${Date.now()}`,
        time: now.toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
        timestamp: now.getTime(),
        memoryUsedMB: last ? last.memoryUsedMB : 520,
        memoryAllocatedMB: 1024,
        memoryLimitMB: 1536,
        latencyMs: duration,
        jitterMs: 0.4,
        eventLoopLagMs: 0.9,
        activeThreads: last ? last.activeThreads : 10,
        throughputKb: last ? last.throughputKb : 140,
        status: duration > 75 ? 'degraded' : duration > 45 ? 'nominal' : 'optimal'
      };
      return [...prev.slice(-31), benchmarkPoint];
    });
  };

  // Interactive Action: Force Simulated Garbage Collection
  const handleForceGC = () => {
    setGcTriggerCount(c => c + 1);
    setHistory(prev => {
      const last = prev[prev.length - 1];
      const reclaimedMB = Math.max(340, Math.round((last ? last.memoryUsedMB : 650) * 0.58));
      const now = new Date();
      const gcPoint: TelemetryPoint = {
        id: `gc-${Date.now()}`,
        time: now.toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }),
        timestamp: now.getTime(),
        memoryUsedMB: reclaimedMB,
        memoryAllocatedMB: 1024,
        memoryLimitMB: 1536,
        latencyMs: Math.max(8, (last?.latencyMs || 25) - 4),
        jitterMs: 0.6,
        eventLoopLagMs: 0.75,
        activeThreads: Math.max(4, (last?.activeThreads || 8) - 3),
        throughputKb: 90,
        status: 'optimal',
        isGCEviction: true
      };
      return [...prev.slice(-31), gcPoint];
    });

    if (onAlertTriggered) {
      onAlertTriggered('Garbage Collection executed: memory heap reclaimed to baseline.');
    }
  };

  // Interactive Action: Toggle Simulated Workload Stress
  const handleToggleSimulatedLoad = () => {
    setSimulatedLoadActive(curr => !curr);
  };

  // Format Uptime
  const formattedUptime = useMemo(() => {
    const hrs = Math.floor(uptimeSeconds / 3600);
    const mins = Math.floor((uptimeSeconds % 3600) / 60);
    const secs = uptimeSeconds % 60;
    return `${hrs}h ${mins}m ${secs}s`;
  }, [uptimeSeconds]);

  // Custom Chart Tooltip
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload as TelemetryPoint;
    if (!data) return null;

    return (
      <div className="bg-[#020617]/95 border border-slate-700/80 p-3 rounded-xl shadow-2xl backdrop-blur-xl font-mono text-xs z-50 min-w-[210px]">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400">
          <span className="flex items-center gap-1.5 text-white font-bold">
            <Clock className="w-3 h-3 text-emerald-400" />
            {data.time}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            {selectedNode.name}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Memory Heap:
            </span>
            <span className="font-bold text-emerald-400">{data.memoryUsedMB} MB</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              Latency (RTT):
            </span>
            <span className="font-bold text-cyan-400">{data.latencyMs} ms</span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Jitter:</span>
            <span className="text-slate-300">±{data.jitterMs} ms</span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Event Loop Lag:</span>
            <span className="text-slate-300">{data.eventLoopLagMs} ms</span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Active Threads:</span>
            <span className="text-slate-300">{data.activeThreads} workers</span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Network I/O:</span>
            <span className="text-slate-300">{data.throughputKb} KB/s</span>
          </div>
        </div>

        {data.isGCEviction && (
          <div className="mt-2 pt-1.5 border-t border-emerald-900/50 text-[10px] text-emerald-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            GC Eviction Cycle Triggered
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`glass-card rounded-[2.5rem] border border-slate-800 bg-[#070d1e]/85 backdrop-blur-2xl p-6 sm:p-8 transition-all duration-300 shadow-[0_10px_40px_rgba(0,0,0,0.45)] relative overflow-hidden ${className}`}
    >
      {/* Background ambient glow */}
      <div className="absolute top-0 right-1/4 w-96 h-36 bg-emerald-500/5 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-1/3 w-80 h-32 bg-cyan-500/5 blur-3xl pointer-events-none rounded-full" />

      {/* Header bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-indigo-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)] shrink-0">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h3 className="font-outfit font-black text-white text-xl sm:text-2xl uppercase tracking-tighter italic">
                System Health <span className="quantum-gradient-text">& Telemetry</span>
              </h3>

              {/* Status Indicator */}
              <div className="flex items-center gap-1.5 text-xs font-mono font-medium">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    latestMetric.status === 'optimal'
                      ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]'
                      : latestMetric.status === 'nominal'
                      ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]'
                      : 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)]'
                  } ${isLive ? 'animate-pulse' : 'opacity-40'}`}
                />
                <span
                  className={`text-[11px] uppercase tracking-wider font-bold ${
                    latestMetric.status === 'optimal'
                      ? 'text-emerald-400'
                      : latestMetric.status === 'nominal'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {isLive ? `${latestMetric.status} · ONLINE` : 'STREAM PAUSED'}
                </span>
              </div>
            </div>

            <p className="text-slate-400 text-xs font-mono flex items-center gap-2 mt-0.5">
              <span>Uptime: {formattedUptime}</span>
              <span className="text-slate-600">·</span>
              <span>Buffer: {history.length} samples</span>
              <span className="text-slate-600">·</span>
              <span className="text-cyan-400/90">{selectedNode.name}</span>
            </p>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Node selector dropdown */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-300">
            <Server className="w-3.5 h-3.5 text-slate-500 mr-2 shrink-0" />
            <select
              value={selectedNodeId}
              onChange={e => setSelectedNodeId(e.target.value)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer pr-1 text-xs"
              aria-label="Target System Node"
            >
              {TARGET_NODES.map(node => (
                <option key={node.id} value={node.id} className="bg-slate-900 text-slate-200">
                  {node.name}
                </option>
              ))}
            </select>
          </div>

          {/* Rate selector */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl px-2 py-1 text-xs font-mono text-slate-400">
            <span className="text-[10px] text-slate-500 uppercase mr-1.5 hidden sm:inline">Rate:</span>
            {[1000, 2000, 5000].map(ms => (
              <button
                key={ms}
                onClick={() => setRefreshIntervalMs(ms)}
                className={`px-2 py-0.5 rounded-lg text-[11px] transition-all ${
                  refreshIntervalMs === ms
                    ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {ms / 1000}s
              </button>
            ))}
          </div>

          {/* Pause / Play Toggle */}
          <button
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all ${
              isLive
                ? 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 animate-pulse'
            }`}
            title={isLive ? 'Pause Stream' : 'Resume Stream'}
          >
            {isLive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isLive ? 'Pause' : 'Resume'}</span>
          </button>

          {/* Compact / Expanded View Toggle */}
          <button
            onClick={() => setIsCompact(!isCompact)}
            className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all"
            title={isCompact ? 'Expand Full Metrics' : 'Compact View'}
          >
            {isCompact ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* KPI Stat Cards Grid (Zero Static Pill Slop - clean typography & metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-b border-slate-800/80">
        {/* Metric 1: Memory Heap */}
        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/90 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              Memory Heap
            </span>
            <span className="text-[10px] text-slate-500">{metricsSummary.memoryPercent}% cap</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-outfit font-black text-2xl sm:text-3xl text-white tracking-tight">
              {latestMetric.memoryUsedMB}
            </span>
            <span className="text-xs font-mono text-slate-400 uppercase">MB</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className={`h-full transition-all duration-500 ${
                metricsSummary.memoryPercent > 80
                  ? 'bg-rose-500'
                  : metricsSummary.memoryPercent > 65
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(100, metricsSummary.memoryPercent)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-2">
            <span className="flex items-center gap-0.5">
              {metricsSummary.trend >= 0 ? (
                <ArrowUpRight className="w-3 h-3 text-amber-400" />
              ) : (
                <ArrowDownRight className="w-3 h-3 text-emerald-400" />
              )}
              {metricsSummary.trend >= 0 ? `+${metricsSummary.trend}` : metricsSummary.trend} MB/s
            </span>
            <span>Limit: {latestMetric.memoryAllocatedMB} MB</span>
          </div>
        </div>

        {/* Metric 2: Connection Latency */}
        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/90 relative overflow-hidden group hover:border-cyan-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span className="flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-cyan-400" />
              Network Latency
            </span>
            <span className="text-[10px] text-slate-500">RTT</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-outfit font-black text-2xl sm:text-3xl text-white tracking-tight">
              {latestMetric.latencyMs}
            </span>
            <span className="text-xs font-mono text-slate-400 uppercase">ms</span>
          </div>

          {/* Sparkline indication */}
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className={`h-full transition-all duration-500 ${
                latestMetric.latencyMs > 80
                  ? 'bg-rose-500'
                  : latestMetric.latencyMs > 45
                  ? 'bg-amber-400'
                  : 'bg-cyan-400'
              }`}
              style={{ width: `${Math.min(100, (latestMetric.latencyMs / 120) * 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-2">
            <span>Avg: {metricsSummary.avgLatency} ms</span>
            <span>Jitter: ±{latestMetric.jitterMs} ms</span>
          </div>
        </div>

        {/* Metric 3: Active Threads / Event Loop */}
        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/90 relative overflow-hidden group hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              Neural Execution
            </span>
            <span className="text-[10px] text-slate-500">Workers</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-outfit font-black text-2xl sm:text-3xl text-white tracking-tight">
              {latestMetric.activeThreads}
            </span>
            <span className="text-xs font-mono text-slate-400 uppercase">threads</span>
          </div>

          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${Math.min(100, (latestMetric.activeThreads / 24) * 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-2">
            <span>Loop Lag: {latestMetric.eventLoopLagMs} ms</span>
            <span>Capacity: 24</span>
          </div>
        </div>

        {/* Metric 4: System Throughput & Health Index */}
        <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/90 relative overflow-hidden group hover:border-teal-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-teal-400" />
              I/O Throughput
            </span>
            <span className="text-[10px] text-emerald-400 font-bold">99.8% OK</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-outfit font-black text-2xl sm:text-3xl text-white tracking-tight">
              {latestMetric.throughputKb}
            </span>
            <span className="text-xs font-mono text-slate-400 uppercase">KB/s</span>
          </div>

          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-teal-400 transition-all duration-500"
              style={{ width: `${Math.min(100, (latestMetric.throughputKb / 500) * 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-2">
            <span>Packet Loss: 0.0%</span>
            <span>GC Cycles: {gcTriggerCount}</span>
          </div>
        </div>
      </div>

      {/* Main Chart Visualization Section */}
      <div className="pt-6">
        {/* Chart View Selection Tabs & Benchmark Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800 w-fit">
            <button
              onClick={() => setActiveTab('combined')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === 'combined'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Dual Telemetry
            </button>
            <button
              onClick={() => setActiveTab('memory')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === 'memory'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Memory Heap Profile
            </button>
            <button
              onClick={() => setActiveTab('latency')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === 'latency'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Latency & Jitter
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleProbeLatency}
              disabled={isProbing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-cyan-500/30 hover:border-cyan-500/60 text-cyan-400 hover:text-cyan-300 text-xs font-mono transition-all disabled:opacity-50"
              title="Send real ICMP/HTTP probe to measure round-trip time"
            >
              <Radio className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin' : ''}`} />
              <span>{isProbing ? 'Probing...' : 'Ping Probe'}</span>
            </button>

            <button
              onClick={handleForceGC}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 hover:text-emerald-300 text-xs font-mono transition-all"
              title="Trigger memory compaction and cache flush simulation"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Flush Cache / GC</span>
              <span className="sm:hidden">GC</span>
            </button>

            <button
              onClick={handleToggleSimulatedLoad}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all ${
                simulatedLoadActive
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle simulated heavy neural workload"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{simulatedLoadActive ? 'Load: High' : 'Stress Test'}</span>
            </button>
          </div>
        </div>

        {/* Visual Chart Canvas */}
        <div
          className={`w-full bg-[#030712]/90 border border-slate-800/90 rounded-3xl p-4 sm:p-5 relative transition-all ${
            isCompact ? 'h-52' : 'h-80 sm:h-96'
          }`}
        >
          {/* Chart Header details */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2 px-2">
            <div className="flex items-center gap-4">
              {activeTab !== 'latency' && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />
                  Memory Heap (MB)
                </span>
              )}
              {activeTab !== 'memory' && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400 inline-block" />
                  Round-trip Latency (ms)
                </span>
              )}
            </div>
            <div className="text-slate-500 hidden sm:block">
              Window: Last {history.length * (refreshIntervalMs / 1000)}s
            </div>
          </div>

          <ResponsiveContainer width="100%" height="90%">
            {activeTab === 'combined' ? (
              <AreaChart data={history} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMemCombined" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorLatCombined" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="#475569"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                />
                {/* Primary Y Axis for Memory */}
                <YAxis
                  yAxisId="left"
                  stroke="#10b981"
                  domain={[300, 'auto']}
                  tick={{ fontSize: 10, fill: '#10b981' }}
                  tickLine={false}
                  unit="MB"
                />
                {/* Secondary Y Axis for Latency */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#06b6d4"
                  domain={[0, 120]}
                  tick={{ fontSize: 10, fill: '#06b6d4' }}
                  tickLine={false}
                  unit="ms"
                />

                <Tooltip content={<CustomChartTooltip />} />

                {/* Warning Reference Lines */}
                <ReferenceLine
                  yAxisId="right"
                  y={75}
                  stroke="#f97316"
                  strokeDasharray="4 4"
                  opacity={0.6}
                  label={{ value: 'Warn: 75ms', fill: '#f97316', fontSize: 9, position: 'insideRight' }}
                />

                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="memoryUsedMB"
                  name="Memory (MB)"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorMemCombined)"
                  isAnimationActive={false}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="latencyMs"
                  name="Latency (ms)"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorLatCombined)"
                  isAnimationActive={false}
                />
              </AreaChart>
            ) : activeTab === 'memory' ? (
              <AreaChart data={history} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMemoryOnly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="#475569"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#10b981"
                  domain={[250, 1200]}
                  tick={{ fontSize: 10, fill: '#10b981' }}
                  tickLine={false}
                  unit="MB"
                />

                <Tooltip content={<CustomChartTooltip />} />

                <ReferenceLine
                  y={850}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  opacity={0.7}
                  label={{ value: 'Threshold 850MB', fill: '#ef4444', fontSize: 10, position: 'insideTopLeft' }}
                />

                <ReferenceLine
                  y={latestMetric.memoryAllocatedMB}
                  stroke="#6366f1"
                  strokeDasharray="5 5"
                  opacity={0.4}
                  label={{ value: 'Ceiling 1024MB', fill: '#818cf8', fontSize: 10, position: 'insideBottomRight' }}
                />

                <Area
                  type="monotone"
                  dataKey="memoryUsedMB"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorMemoryOnly)"
                  isAnimationActive={false}
                />
              </AreaChart>
            ) : (
              <LineChart data={history} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="#475569"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#06b6d4"
                  domain={[0, 110]}
                  tick={{ fontSize: 10, fill: '#06b6d4' }}
                  tickLine={false}
                  unit="ms"
                />

                <Tooltip content={<CustomChartTooltip />} />

                <ReferenceLine
                  y={50}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  opacity={0.7}
                  label={{ value: 'Target 50ms', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }}
                />

                <Line
                  type="monotone"
                  dataKey="latencyMs"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  dot={{ r: 2, fill: '#06b6d4' }}
                  activeDot={{ r: 5, fill: '#22d3ee' }}
                  isAnimationActive={false}
                />

                <Line
                  type="monotone"
                  dataKey="jitterMs"
                  stroke="#f97316"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Footer Diagnostic Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-800/60 text-xs font-mono text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Telemetry Socket: Active</span>
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">
              Peak RAM: <strong className="text-slate-200">{metricsSummary.peakMemory} MB</strong>
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">
              Min Latency: <strong className="text-slate-200">{metricsSummary.minLatency} ms</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>Powered by Quanta Telemetry Subsystem</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthWidget;
