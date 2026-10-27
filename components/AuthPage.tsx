
import React, { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import HindsightGnoesisNeuralCore from './HindsightGnoesisNeuralCore';
import SovereignTrustSection from './SovereignTrustSection';
import AgentActivationSelector from './AgentActivationSelector';
import SovereignTokensShowcase from './SovereignTokensShowcase';
import SovereignSiHeader from './SovereignSiHeader';
import HarnessRouterShowcase from './HarnessRouterShowcase';
import NeuralLinkWelcome from './NeuralLinkWelcome';
import { AGENT_TRACKS, getAgentTrack } from '../lib/agent-tracks';
import type { UserTrack } from '../types';
import { isSupabaseConfigured, signInAsTestGuest, signInWithProvider, type SignInProvider } from '../services/supabaseService';

interface AuthPageProps {
  onLogin: (data: { email: string, track: UserTrack }) => void;
  replayWelcome?: boolean;
}

const AuthPage: React.FC<AuthPageProps> = ({ onLogin, replayWelcome = false }) => {
  const [showNeuralWelcome, setShowNeuralWelcome] = useState(() => {
    if (replayWelcome) return true;
    try {
      return window.localStorage.getItem('quanta_neural_link_initialized_v1') !== 'true';
    } catch {
      return true;
    }
  });
  const [email, setEmail] = useState('');
  const [track, setTrack] = useState<UserTrack>('personal');
  const [loading, setLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [emailConsent, setEmailConsent] = useState(false);
  const authFormRef = useRef<HTMLDivElement>(null);
  const selectedAgent = getAgentTrack(track);

  const features = [
    {
      title: "Persistent Memory",
      agent: "Consumer Memory Agent",
      desc: "Source-linked memory for your preferences, documents and research. The Gnoesis Neural Core architecture connects retrieval, facts, observations and knowledge pages, with an Obsidian ingestion path configured separately.",
      icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
      accent: "text-orange-500",
      border: "border-orange-500/20"
    },
    {
      title: "Sovereign Local AI",
      agent: "Consumer Privacy Agent",
      desc: "Choose an installed Ollama model on your own computer for local text inference. Your chosen route controls where submitted context goes; cloud and gateway connections remain explicit choices.",
      icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
      accent: "text-emerald-400",
      border: "border-emerald-500/20"
    },
    {
      title: "FPT-Omega Engine",
      agent: "Consumer Research Agent",
      desc: "Production design routes this First Principles Thinking engine into deep research, novel solving, and cross-domain SME work across engineering, physics, quantum physics, or metaphysics. It separates source evidence from assumptions and stages derived claims for review before they update durable knowledge.",
      icon: "M13 10V3L4 14h7v7l9-11h-7z",
      accent: "text-emerald-500",
      border: "border-emerald-500/20"
    },
    {
      title: "Neural Cortex",
      agent: "Consumer Routing Agent",
      desc: "Centralized orchestration layer for all SME cores. Intelligent task routing and context management ensure that the most qualified specialized agent handles every specific query with maximum precision.",
      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
      accent: "text-orange-400",
      border: "border-orange-500/20"
    },
    {
      title: "SME Council",
      agent: "Consumer Review Agent",
      desc: "Multi-agent strategic debate protocol. Specialized agents (Proposer, Critic, Judge) autonomously debate problems, check logic chains, and synthesize outcomes to provide board-level executive direction.",
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857",
      accent: "text-emerald-400",
      border: "border-emerald-500/20"
    },
    {
      title: "Hybrid Inference",
      agent: "Consumer Inference Agent",
      desc: "Choose OpenAI compatible APIs, Ollama Local, Ollama Cloud, OpenRouter, Fireworks AI or OmniRoute. Load the current model catalog and choose the route for your text agents, with no silent provider fallback.",
      icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z",
      accent: "text-orange-500",
      border: "border-orange-500/20"
    }
  ];
  const splashSpecialistIds: UserTrack[] = ['credit', 'rwa-defi', 'asset-recovery', 'prediction', 'clipping'];
  const featuredSpecialists = AGENT_TRACKS.filter(agent => splashSpecialistIds.includes(agent.id));

  const [oauthBusy, setOauthBusy] = useState<SignInProvider | null>(null);
  const handleProvider = async (provider: SignInProvider) => {
    setOauthBusy(provider);
    setAuthMessage('');
    try { await signInWithProvider(provider, track); }
    catch (error) {
      console.error('Provider sign-in failed', error);
      setAuthMessage(`${provider === 'google' ? 'Google' : 'GitHub'} sign-in could not start. Check that the provider is enabled in Supabase Authentication → Providers.`);
      setOauthBusy(null);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@') || !emailConsent) return;
    setLoading(true);
    setAuthMessage('');
    if (import.meta.env.PROD) {
      if (!isSupabaseConfigured) {
        setAuthMessage('Guest access is not configured yet. Supabase settings are missing from this deployment.');
        setLoading(false);
        return;
      }
      try {
        await signInAsTestGuest(email, track);
        onLogin({ email: email.toLowerCase().trim(), track });
      } catch (error) {
        console.error('Guest access failed', error);
        setAuthMessage('Guest access could not start. Check that Supabase anonymous sign-ins are enabled and the test email table migration is applied.');
      } finally {
        setLoading(false);
      }
      return;
    }
    onLogin({ email: email.toLowerCase().trim(), track });
  };

  const downloadWhitepaper = () => {
    const link = document.createElement('a');
    link.href = '/whitepapers/QuantaOS_Sovereign_Intelligence_Whitepaper_v1.4.pdf';
    link.download = 'QuantaOS_Sovereign_Intelligence_Whitepaper_v1.4.pdf';
    link.click();
  };

  const completeNeuralWelcome = () => {
    try {
      window.localStorage.setItem('quanta_neural_link_initialized_v1', 'true');
    } catch {
      // The splash can still open if browser storage is unavailable.
    }
    setShowNeuralWelcome(false);
  };

  return (
    <AnimatePresence mode="wait">
      {showNeuralWelcome ? (
        <NeuralLinkWelcome key="neural-link-welcome" onComplete={completeNeuralWelcome} />
      ) : (
    <div key="splash" className="min-h-screen bg-[#020617] text-white selection:bg-orange-500/30 overflow-x-hidden">
      {/* Hero Section */}
      <div className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-40">
        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 via-transparent to-orange-500/5 pointer-events-none blur-[150px] animate-pulse"></div>
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-orange-900/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="max-w-6xl w-full z-10 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <SovereignSiHeader onNavigate={path => {
            window.location.hash = path;
            authFormRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
          }} />
          
          <h2 className="mb-4 text-4xl font-outfit font-black uppercase leading-[0.96] tracking-tighter sm:text-6xl md:text-[6rem]">
            <span className="block text-white">QuantaCore-<span className="bg-gradient-to-r from-lime-300 via-cyan-300 to-fuchsia-300 bg-clip-text text-transparent">SI-OS</span></span>
            <span className="mt-2 block text-emerald-300">with Neural</span>
            <span className="block text-white">Logic Cores and Loops.</span>
          </h2>
          
          <p className="my-6 font-outfit text-xl font-bold sm:text-3xl" style={{ color: '#b6ff36', textShadow: '0 0 24px #a3ff3655' }}>Sovereign Agentic Composable SI Systems that U Own!</p>
          <div className="mb-12 mt-6">
            <p className="text-lg font-outfit font-bold tracking-tight text-white sm:text-xl md:text-3xl">
              <span className="block">Your data. <span className="text-emerald-300">Your Pipeline.</span> Your Private Output.</span>
              <span className="mt-2 block">You own the Super <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-emerald-400 bg-clip-text text-transparent">Intelligence.</span></span>
            </p>
            <p className="mx-auto mt-5 max-w-4xl text-sm leading-7 text-slate-300 sm:text-base md:text-lg">
              <span className="font-bold text-emerald-300">Sovereign Composability SI</span> for local and cloud AI. You choose your privacy, model, and data. Harness intelligence with custom guardrails, security, transparency, and trust—a Lego builder system you own.
            </p>
          </div>
          
          <p className="max-w-4xl mx-auto text-slate-400 text-xl md:text-2xl font-medium leading-relaxed mb-20 italic">
            Private intelligence loops anchored in a <span className="text-white font-black border-b-2 border-orange-500/50 pb-1">sovereign substrate</span> for the autonomous operator.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 mb-20">
            <button 
              onClick={() => authFormRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="px-14 py-7 quanta-btn-orange text-white rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-sm shadow-[0_0_50px_rgba(249,115,22,0.3)] active:scale-95 flex items-center space-x-4 transition-all animate-glow-orange"
            >
              <span>Initialize Neural Link</span>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </button>
            <button 
              onClick={downloadWhitepaper}
              className="px-14 py-7 bg-slate-900 border-2 border-slate-800 text-slate-400 rounded-[2.5rem] font-black uppercase tracking-[0.3em] text-sm hover:border-orange-500/50 hover:text-white transition-all flex items-center space-x-3 group"
            >
              <svg className="w-5 h-5 group-hover:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              <span>Whitepaper PDF · v1.4</span>
            </button>
          </div>

          {/* Infrastructure Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
            {features.map((f, i) => (
              <div key={i} className={`sme-card-enhanced p-10 rounded-[3rem] group border ${f.border} transition-all duration-500`}>
                <div className={`w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center mb-8 ${f.accent} group-hover:scale-110 group-hover:border-current transition-all shadow-inner`}>
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={f.icon} /></svg>
                </div>
                <h3 className="text-2xl font-outfit font-black text-white mb-4 uppercase tracking-tighter italic group-hover:text-white">{f.title}</h3>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/5 px-3 py-1.5 mb-4 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  {f.agent}
                </div>
                <div className="text-slate-400 text-xs font-bold uppercase tracking-widest leading-relaxed">
                  {f.desc}
                </div>
              </div>
            ))}
          </div>


          <SovereignTrustSection />

          <HarnessRouterShowcase />

          <SovereignTokensShowcase />

          <HindsightGnoesisNeuralCore />

          <section aria-labelledby="specialist-agents-title" className="mt-28 text-left">
            <div className="mx-auto mb-10 max-w-3xl text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-300">Specialist hands · built for real workflows</p>
              <h2 id="specialist-agents-title" className="mt-4 text-3xl font-outfit font-black uppercase tracking-tight text-white sm:text-5xl">Agents &amp; use cases. Or forge your own.</h2>
              <p className="mt-4 text-sm leading-6 text-slate-400 sm:text-base">Bring focused analysis into your sovereign agent system. Each specialist starts with a role, practical examples and a suggested harness fit.</p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {featuredSpecialists.map(agent => (
                <article key={agent.id} className="sme-card-enhanced group flex h-full flex-col rounded-[2rem] border p-6 transition-all duration-500 hover:-translate-y-1" style={{ borderColor: `${agent.from}55`, background: `linear-gradient(145deg, ${agent.from}14, rgba(2,6,23,.94) 56%, ${agent.to}12)` }}>
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/75" style={{ color: agent.from }}>
                      <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={agent.icon} /></svg>
                    </span>
                    <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-slate-300">{agent.directoryGroup}</span>
                  </div>
                  <h3 className="text-xl font-outfit font-black leading-tight text-white">{agent.label}</h3>
                  <p className="mt-2 min-h-10 text-xs leading-5 text-slate-400">{agent.description}</p>

                  <div className="mt-5">
                    <h4 className="text-[9px] font-black uppercase tracking-[.18em]" style={{ color: agent.from }}>Use cases</h4>
                    <ul className="mt-3 space-y-3">
                      {agent.caseStudies.map(useCase => <li key={useCase.title} className="border-l-2 pl-3" style={{ borderColor: `${agent.from}70` }}>
                        <p className="text-xs font-bold leading-5 text-slate-200">{useCase.title}</p>
                        <p className="mt-0.5 text-[11px] leading-5 text-slate-400">{useCase.outcome}</p>
                      </li>)}
                    </ul>
                  </div>

                  <div className="mt-5 rounded-xl border border-cyan-300/15 bg-slate-950/55 p-3">
                    <p className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-300">Suggested harness · candidate</p>
                    <p className="mt-1 text-xs font-bold text-white">{agent.harnessFit.primary}</p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-400">{agent.harnessFit.rationale}</p>
                  </div>

                  <button type="button" onClick={() => {
                    setTrack(agent.id);
                    authFormRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
                  }} className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[.12em] text-slate-950 transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" style={{ background: `linear-gradient(115deg, ${agent.from}, ${agent.to})`, marginTop: '1.25rem' }}>
                    Choose {agent.label}
                    <span aria-hidden="true">→</span>
                  </button>
                </article>
              ))}
                <article className="sme-card-enhanced group flex flex-col h-full rounded-[2rem] border border-lime-300/35 p-6 transition-all duration-500" style={{ background: 'linear-gradient(145deg, #b6ff3612, #020617 60%, #67e8f910)' }}>
                  <div aria-hidden="true" className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-300/30 bg-lime-300/10 text-lime-300">
                    <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v4m-2-2h4M5 10h14l-3 5h-3v3h4v3H7v-3h4v-3H8l-3-5Z" /></svg>
                  </div>
                  <p className="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-lime-300">Your vision · your agents</p>
                  <h3 className="mb-4 font-outfit text-2xl font-black leading-tight text-white">Forge your own Agent or Agentic Team</h3>
                  <p className="text-sm leading-6 text-slate-400">Define your agent’s purpose, personality and skills. Shape the roles and workflow for the team you want to build.</p>
                  <div className="my-6 flex flex-wrap gap-2 text-[10px] font-bold text-cyan-200"><span className="rounded-full border border-cyan-300/20 px-3 py-1.5">Purpose</span><span className="rounded-full border border-cyan-300/20 px-3 py-1.5">Skills</span><span className="rounded-full border border-cyan-300/20 px-3 py-1.5">Team roles</span></div>
                  <a href="#/sme-builder" onClick={() => authFormRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })} className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-950 transition-colors hover:bg-lime-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-200">Open the Forge <span aria-hidden="true">→</span></a>
                </article>
            </div>
          </section>
        </div>
      </div>

      {/* Auth Form Section */}
      <div ref={authFormRef} className="min-h-screen flex items-center justify-center p-6 relative bg-slate-950/90 border-t border-orange-500/20">
        <div className="max-w-7xl w-full z-10 text-center">
          <div className="w-32 h-32 quanta-btn-orange rounded-[3rem] mx-auto mb-10 shadow-[0_0_60px_rgba(249,115,22,0.4)] flex items-center justify-center animate-glow">
            <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h2 className="text-6xl font-outfit font-black text-white mb-4 uppercase tracking-tighter italic">Core <span className="text-orange-500">Sync</span></h2>
          <p className="text-slate-500 font-black uppercase tracking-[0.5em] text-[11px] mb-20">Test Guest Access · Email Not Verified</p>

          <div className="bg-[#020617] p-6 sm:p-10 lg:p-12 rounded-[2rem] sm:rounded-[3rem] shadow-2xl border-2 border-orange-500/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/5 blur-3xl pointer-events-none"></div>
            <form onSubmit={handleAuth} className="space-y-12">
              <div className="space-y-5">
                <AgentActivationSelector value={track} onChange={setTrack} disabled={loading} />
                <p aria-live="polite" className="text-sm text-slate-400 text-left">
                  <span className="font-bold text-white">{selectedAgent.label}</span> selected. Activate your workspace below.
                </p>
              </div>

              {isSupabaseConfigured && <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" disabled={loading || !!oauthBusy} onClick={() => handleProvider('google')} className="flex items-center justify-center gap-3 rounded-2xl border-2 border-slate-700 bg-white py-5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100 disabled:opacity-50">
                    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.8 6C12.3 13.4 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-16.8z"/><path fill="#FBBC05" d="M10.4 28.8c-.5-1.4-.8-3-.8-4.8s.3-3.3.8-4.8l-7.8-6C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.7-4.2-13.6-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>
                    {oauthBusy === 'google' ? 'Opening Google…' : 'Continue with Google'}
                  </button>
                  <button type="button" disabled={loading || !!oauthBusy} onClick={() => handleProvider('github')} className="flex items-center justify-center gap-3 rounded-2xl border-2 border-slate-700 bg-slate-900 py-5 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50">
                    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
                    {oauthBusy === 'github' ? 'Opening GitHub…' : 'Continue with GitHub'}
                  </button>
                </div>
                <p className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-600"><span className="h-px flex-1 bg-slate-800" />or continue as test guest<span className="h-px flex-1 bg-slate-800" /></p>
              </div>}

              <div className="text-left space-y-4">
                <label className="block text-orange-400 text-[10px] font-black uppercase tracking-[0.4em] px-2">Test Contact Email</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-slate-950 border-2 border-slate-800 text-white rounded-2xl py-8 px-10 focus:outline-none focus:border-orange-500 transition-all font-mono text-base shadow-inner"
                  required
                />
                <label className="flex items-start gap-3 px-2 text-left text-xs leading-relaxed text-slate-400">
                  <input
                    type="checkbox"
                    checked={emailConsent}
                    onChange={(event) => setEmailConsent(event.target.checked)}
                    className="mt-0.5 accent-orange-500"
                    required
                  />
                  <span>I agree to store this email in Supabase so QuantaCore can contact me about the test. This address is not verified by guest access.</span>
                </label>
              </div>

              <button 
                type="submit"
                disabled={loading || !emailConsent}
                style={{ background: `linear-gradient(115deg, ${selectedAgent.from}, ${selectedAgent.to})`, boxShadow: `0 12px 40px ${selectedAgent.from}25` }}
                className="w-full py-7 px-5 text-slate-950 rounded-2xl font-black uppercase tracking-[0.2em] text-xs sm:text-sm transition-shadow flex items-center justify-center gap-4 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span>Activating {selectedAgent.label}...</span>
                  </>
                ) : (
                  <>
                    <span>Continue as Test Guest</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </>
                )}
              </button>

              {authMessage && <p role="status" aria-live="polite" className="text-left text-sm text-cyan-200">{authMessage}</p>}

              <div className="pt-4 flex items-center justify-center space-x-4 opacity-60">
                 <div className="h-px w-8 bg-slate-800"></div>
                 <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.5em]">
                   Privacy <span className="text-orange-500/80">&</span> Sovereignty
                 </p>
                 <div className="h-px w-8 bg-slate-800"></div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
      )}
    </AnimatePresence>
  );
};

export default AuthPage;
