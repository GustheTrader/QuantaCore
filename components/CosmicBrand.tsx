import { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export default function CosmicBrand({ size = 64, wordmark = true }: { size?: number; wordmark?: boolean }) {
  const id = useId().replace(/:/g, '');
  const reduced = useReducedMotion();
  return <span className="inline-flex max-w-full items-center gap-3">
    <svg role="img" aria-label="QuantaCore-SI-OS cosmic core logo" width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
      <defs>
        <radialGradient id={`${id}-sky`} cx="32%" cy="26%" r="80%"><stop stopColor="#351354"/><stop offset=".5" stopColor="#14091f"/><stop offset="1" stopColor="#020104"/></radialGradient>
        <radialGradient id={`${id}-nebula`}><stop stopColor="#d946ef" stopOpacity=".28"/><stop offset="1" stopColor="#7c3aed" stopOpacity="0"/></radialGradient>
        <radialGradient id={`${id}-core`}><stop stopColor="#ecffd2"/><stop offset=".35" stopColor="#b6ff36"/><stop offset="1" stopColor="#22d3ee" stopOpacity="0"/></radialGradient>
        <linearGradient id={`${id}-orbit`}><stop stopColor="#b6ff36"/><stop offset=".5" stopColor="#67e8f9"/><stop offset="1" stopColor="#e879f9"/></linearGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill={`url(#${id}-sky)`} stroke="#a78bfa" strokeOpacity=".3"/>
      <circle cx="30" cy="28" r="16" fill={`url(#${id}-nebula)`}/>
      <circle cx="70" cy="68" r="16" fill={`url(#${id}-nebula)`}/>
      <g fill="#f5edff">
        <circle cx="33" cy="13" r=".65"/><circle cx="15" cy="44" r=".7"/><circle cx="59" cy="19" r=".5"/>
        <circle cx="87" cy="55" r=".65"/><circle cx="43" cy="85" r=".8"/><circle cx="64" cy="80" r=".5"/>
      </g>
      <circle cx="50" cy="50" r="27" fill={`url(#${id}-core)`}/>
      <motion.g style={{ transformOrigin: '50px 50px' }} animate={reduced ? {} : { rotate: 360 }} transition={{ duration: 24, ease: 'linear', repeat: Infinity }}>
        <ellipse cx="50" cy="50" rx="42" ry="17" transform="rotate(-30 50 50)" fill="none" stroke={`url(#${id}-orbit)`} strokeWidth="1.5"/>
        <ellipse cx="50" cy="50" rx="42" ry="17" transform="rotate(55 50 50)" fill="none" stroke="#a78bfa" strokeOpacity=".65"/>
        <circle cx="86" cy="29" r="3" fill="#67e8f9"/><circle cx="27" cy="17" r="2.5" fill="#e879f9"/>
      </motion.g>
      <path d="M50 30 55 45 70 50 55 55 50 70 45 55 30 50 45 45Z" fill="#dfff9b"/>
      <path d="m55 57 10 10" stroke="#b6ff36" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="20" cy="73" r="1" fill="white"/><circle cx="73" cy="15" r="1" fill="white"/><circle cx="79" cy="78" r="1.5" fill="#e879f9"/>
    </svg>
    {wordmark && <span className="min-w-0"><span className="block font-outfit text-lg font-black tracking-tight sm:text-xl" style={{ color: '#b6ff36', textShadow: '0 0 20px #b6ff3630' }}>QuantaCore-SI-OS</span><span className="block text-[9px] uppercase tracking-[.18em] text-cyan-200/70">Sovereign · Agentic · Composable</span></span>}
  </span>;
}
