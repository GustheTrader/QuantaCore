import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { motionTokens, springs } from '../lib/motion-tokens';

interface NeuralLinkWelcomeProps {
  key?: string;
  onComplete: () => void;
}

const sparks = [
  { x: 0, y: -112, color: '#a3e635' },
  { x: 79, y: -79, color: '#34d399' },
  { x: 112, y: 0, color: '#fbbf24' },
  { x: 79, y: 79, color: '#fb923c' },
  { x: 0, y: 112, color: '#34d399' },
  { x: -79, y: 79, color: '#a3e635' },
  { x: -112, y: 0, color: '#fbbf24' },
  { x: -79, y: -79, color: '#fb923c' },
];

export default function NeuralLinkWelcome({ onComplete }: NeuralLinkWelcomeProps) {
  const [initializing, setInitializing] = useState(false);
  const timer = useRef<number | null>(null);
  const reducedMotion = useReducedMotion() ?? false;

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const initialize = () => {
    if (initializing) return;
    setInitializing(true);
    const duration = reducedMotion ? motionTokens.duration.fast : motionTokens.duration.handshake;
    timer.current = window.setTimeout(onComplete, duration * 1000);
  };

  const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300';

  return (
    <motion.main
      key="neural-link-welcome"
      initial={{ opacity: 0, ...(reducedMotion ? {} : { y: motionTokens.distance.sm }) }}
      animate={{ opacity: 1, ...(reducedMotion ? {} : { y: 0 }) }}
      exit={{ opacity: 0, ...(reducedMotion ? {} : { y: -motionTokens.distance.xs }) }}
      transition={{ duration: reducedMotion ? motionTokens.duration.fast : motionTokens.duration.normal, ease: motionTokens.easing.smooth }}
      aria-labelledby="neural-link-title"
      className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#050907] px-5 py-10 text-white selection:bg-emerald-400/30 sm:px-8"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.18) 1px, transparent 1px)', backgroundSize: '56px 56px', maskImage: 'radial-gradient(ellipse at center, black 15%, transparent 76%)' }} />
        <div className="absolute -left-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-emerald-500/[0.08] blur-[100px]" />
        <div className="absolute -right-40 bottom-0 h-[26rem] w-[26rem] rounded-full bg-orange-500/[0.07] blur-[100px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />
      </div>

      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center">
        <header className="mb-10 flex w-full items-center justify-between gap-4 sm:mb-14">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-300/[0.07]">
              <svg aria-hidden="true" className="h-5 w-5 text-emerald-300" viewBox="0 0 24 24" fill="none">
                <path d="M12 2.8 14.3 9.7 21.2 12l-6.9 2.3L12 21.2l-2.3-6.9L2.8 12l6.9-2.3L12 2.8Z" stroke="currentColor" strokeWidth="1.35" />
                <circle cx="12" cy="12" r="2.2" fill="currentColor" />
              </svg>
            </span>
            <div>
              <p className="font-outfit text-xs font-black uppercase tracking-[0.22em] text-white">QuantaCore</p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Sovereign agentic operating system</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.025] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-400 sm:px-4">
            <span className={`h-1.5 w-1.5 rounded-full ${initializing ? 'bg-amber-300' : 'bg-emerald-300'}`} />
            {initializing ? 'Link sequence active' : 'First-run handshake'}
          </div>
        </header>

        <div className="grid w-full items-center gap-8 md:grid-cols-[1fr_1.05fr] md:gap-12 lg:gap-20">
          <section className="order-2 text-center md:order-1 md:text-left">
            <p className="mb-5 inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300/90">
              <span className="h-px w-7 bg-emerald-300/70" />
              A new signal begins here
            </p>
            <h1 id="neural-link-title" className="max-w-xl font-outfit text-4xl font-semibold leading-[1.03] tracking-[-0.055em] text-white sm:text-5xl lg:text-6xl">
              Initialize your <span className="bg-gradient-to-r from-orange-300 via-amber-200 to-emerald-300 bg-clip-text text-transparent">Neural Link.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-lg text-sm leading-7 text-slate-400 sm:text-base md:mx-0">
              Bring your agents into one deliberate operating field. QuantaCore gives each task a place to think, route, and return useful work.
            </p>
            <p className="mx-auto mt-3 max-w-lg text-xs leading-6 text-slate-500 md:mx-0">
              This first-run sequence opens your control plane. Model and provider connections remain yours to configure explicitly.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500 md:justify-start">
              <span><span className="mr-2 text-emerald-300">01</span>Choose your agents</span>
              <span><span className="mr-2 text-amber-300">02</span>Shape the context</span>
              <span><span className="mr-2 text-orange-300">03</span>Route the work</span>
            </div>

            <motion.button
              type="button"
              onClick={initialize}
              disabled={initializing}
              whileHover={reducedMotion || initializing ? undefined : { y: -motionTokens.distance.xs, scale: motionTokens.scale.pop }}
              whileTap={reducedMotion || initializing ? undefined : { scale: motionTokens.scale.press }}
              transition={springs.snappy}
              className={`mt-9 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-emerald-200/30 bg-gradient-to-r from-emerald-300 via-lime-200 to-amber-200 px-6 py-4 font-outfit text-xs font-black uppercase tracking-[0.19em] text-[#06100b] shadow-[0_0_45px_rgba(52,211,153,0.13)] transition-[filter,box-shadow] hover:brightness-105 hover:shadow-[0_0_55px_rgba(52,211,153,0.22)] disabled:cursor-wait disabled:opacity-90 sm:w-auto ${focus}`}
            >
              {initializing ? 'Establishing Neural Link' : 'Initialize Neural Link'}
              <svg aria-hidden="true" className={`h-4 w-4 ${initializing ? 'opacity-60' : ''}`} viewBox="0 0 24 24" fill="none">
                <path d="M13 3 5 14h6l-1 7 9-11h-6l1-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </motion.button>
            <p role="status" aria-live="polite" className="mt-4 min-h-5 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
              {initializing ? 'Welcome sequence active · preparing your workspace' : 'Initialize once to continue · remember this device'}
            </p>
          </section>

          <section aria-label="Neural link signal visualization" className="order-1 flex justify-center md:order-2">
            <div className="relative flex h-[19rem] w-[19rem] items-center justify-center sm:h-[24rem] sm:w-[24rem]">
              <div aria-hidden="true" className="absolute inset-8 rounded-full bg-emerald-300/[0.045] blur-2xl" />
              <div aria-hidden="true" className="absolute inset-2 rounded-full border border-white/[0.07]" />
              <div aria-hidden="true" className="absolute inset-8 rounded-full border border-dashed border-emerald-200/[0.13]" />

              <motion.div
                aria-hidden="true"
                animate={reducedMotion ? { opacity: 0.65 } : { rotate: initializing ? 360 : -360 }}
                transition={reducedMotion ? { duration: motionTokens.duration.fast } : { duration: initializing ? motionTokens.duration.orbitFast : motionTokens.duration.orbit, ease: motionTokens.easing.linear, repeat: Infinity }}
                className="absolute inset-5 rounded-full border border-emerald-200/[0.23]"
                style={{ clipPath: 'polygon(50% 0%, 100% 0%, 100% 50%, 50% 50%)' }}
              >
                <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-200 shadow-[0_0_16px_rgba(167,243,208,0.9)]" />
              </motion.div>
              <motion.div
                aria-hidden="true"
                animate={reducedMotion ? { opacity: 0.45 } : { rotate: initializing ? -360 : 360 }}
                transition={reducedMotion ? { duration: motionTokens.duration.fast } : { duration: initializing ? motionTokens.duration.orbit : motionTokens.duration.orbitFast, ease: motionTokens.easing.linear, repeat: Infinity }}
                className="absolute inset-12 rounded-full border border-orange-200/[0.16]"
                style={{ clipPath: 'polygon(0% 0%, 50% 0%, 50% 50%, 0% 50%)' }}
              >
                <span className="absolute right-0 top-1/2 h-2 w-2 translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-200 shadow-[0_0_15px_rgba(253,186,116,0.9)]" />
              </motion.div>

              {sparks.map((spark, index) => (
                <motion.span
                  key={`${spark.x}-${spark.y}`}
                  aria-hidden="true"
                  initial={false}
                  animate={initializing ? (reducedMotion ? { opacity: 1 } : { opacity: 1, x: spark.x, y: spark.y, scale: 1 }) : reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.35 }}
                  transition={{ duration: reducedMotion ? motionTokens.duration.fast : motionTokens.duration.handshake, delay: reducedMotion ? 0 : index * motionTokens.duration.instant, ease: motionTokens.easing.smooth }}
                  className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ backgroundColor: spark.color, boxShadow: `0 0 18px ${spark.color}` }}
                />
              ))}

              <motion.div
                aria-hidden="true"
                animate={reducedMotion ? { opacity: initializing ? 0.84 : 1 } : initializing ? { scale: [1, 1.16, 1.08], opacity: [1, 0.75, 1] } : { scale: [1, 1.035, 1], opacity: 1 }}
                transition={initializing
                  ? { duration: reducedMotion ? motionTokens.duration.fast : motionTokens.duration.handshake, ease: motionTokens.easing.smooth }
                  : reducedMotion ? { duration: motionTokens.duration.fast } : { duration: motionTokens.duration.orbitFast, ease: motionTokens.easing.smooth, repeat: Infinity }}
                className="relative flex h-28 w-28 items-center justify-center rounded-[2rem] border border-white/20 bg-[#0a1812]/90 shadow-[0_0_70px_rgba(52,211,153,0.2),inset_0_0_35px_rgba(52,211,153,0.08)] sm:h-36 sm:w-36"
              >
                <div className="absolute inset-2 rounded-[1.5rem] border border-emerald-100/10" />
                <svg className="relative h-12 w-12 text-emerald-200 sm:h-14 sm:w-14" viewBox="0 0 64 64" fill="none">
                  <path d="M32 5 38.2 25.8 59 32l-20.8 6.2L32 59l-6.2-20.8L5 32l20.8-6.2L32 5Z" stroke="currentColor" strokeWidth="1.35" />
                  <path d="M32 17 35.6 28.4 47 32l-11.4 3.6L32 47l-3.6-11.4L17 32l11.4-3.6L32 17Z" stroke="#FDBA74" strokeWidth="1.1" />
                  <circle cx="32" cy="32" r="3.3" fill="white" />
                </svg>
              </motion.div>

              <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-white/[0.08] bg-[#07100c]/85 px-3 py-2 font-mono text-[8px] uppercase tracking-[0.17em] text-slate-500 backdrop-blur sm:bottom-3">
                <span className="text-emerald-300">Q</span>
                Neural core <span className="text-slate-700">/</span> local signal
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-9 flex w-full flex-col items-center justify-between gap-2 border-t border-white/[0.07] pt-5 font-mono text-[8px] uppercase tracking-[0.16em] text-slate-600 sm:flex-row">
          <span>Private by design · you choose every model route</span>
          <span>Control plane access · 01 / 01</span>
        </footer>
      </div>
    </motion.main>
  );
}
