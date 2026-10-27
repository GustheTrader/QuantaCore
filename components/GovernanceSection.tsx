import React from 'react';
import { Link } from 'react-router-dom';

const sections = {
  policy: {
    title: 'Policy',
    description: 'Review agent boundaries, knowledge sharing and operating guidance.',
    cards: [
      { title: 'Agent knowledge & sharing', path: '/agent-house', text: 'Open an agent’s memory governance controls to review private knowledge, sharing and retention policy.' },
      { title: 'Skills & change review', path: '/rsi-lab/skills', text: 'Review proposed skills and staged agent changes before applying them.' },
      { title: 'Operating guide', path: '/system-guide', text: 'Read setup requirements and operating instructions for connected systems.' }
    ]
  },
  security: {
    title: 'Security',
    description: 'Inspect security evidence, connected access and data intake.',
    cards: [
      { title: 'Iron Claw', path: '/iron-claw', text: 'Open the security workspace and inspect its reported runtime status.' },
      { title: 'Readiness & evidence', path: '/rsi-lab/evidence', text: 'Review module readiness and evidence packages.' },
      { title: 'Connections & access', path: '/connections', text: 'Review model and tool connections, including shared or personal Google accounts.' },
      { title: 'Data intake', path: '/data-intake', text: 'Preview and validate source data before assigning it to a workspace.' }
    ]
  }
};

export default function GovernanceSection({ section }: { section: keyof typeof sections }) {
  const content = sections[section];
  return <main className="mx-auto max-w-6xl p-6 md:p-10">
    <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Governance</p>
    <h1 className="mt-3 text-3xl font-bold text-white">{content.title}</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{content.description}</p>
    <div className="mt-8 grid gap-4 md:grid-cols-2">
      {content.cards.map(card => <Link key={card.path} to={card.path} className="rounded-2xl border border-emerald-400/20 bg-slate-900/60 p-6 hover:border-emerald-300/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300">
        <h2 className="text-lg font-semibold text-emerald-200">{card.title} →</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">{card.text}</p>
      </Link>)}
    </div>
    <p className="mt-6 text-xs text-slate-500">These sections organize existing controls. Check each workspace’s status for available protections.</p>
  </main>;
}
