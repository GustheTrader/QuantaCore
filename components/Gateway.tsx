
import React, { useState, useEffect } from 'react';

// Mock Data Types
interface Channel {
  id: string;
  name: string;
  icon: string; // SVG path
  color: string;
  type: 'messaging' | 'work' | 'social';
  status: 'connected' | 'connecting' | 'offline';
}

interface GatewaySession {
  id: string;
  channelId: string;
  user: string;
  avatar: string;
  lastMessage: string;
  timestamp: number;
  unread: number;
  status: 'active' | 'idle';
  events: GatewayEvent[];
  messages: { role: 'user' | 'agent', content: string, time: number }[];
}

interface GatewayEvent {
  id: string;
  type: 'incoming' | 'outgoing' | 'tool_call' | 'system';
  payload: string;
  timestamp: number;
}

const CHANNELS: Channel[] = [
  { id: 'whatsapp', name: 'WhatsApp', color: 'text-green-400', type: 'messaging', status: 'connected', icon: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z' },
  { id: 'telegram', name: 'Telegram', color: 'text-blue-400', type: 'messaging', status: 'connected', icon: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-1.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z' },
  { id: 'slack', name: 'Slack', color: 'text-rose-400', type: 'work', status: 'connected', icon: 'M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52h-2.52zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.522 2.521 2.527 2.527 0 0 1-2.522-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.522 2.527 2.527 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z' },
  { id: 'discord', name: 'Discord', color: 'text-indigo-400', type: 'social', status: 'connected', icon: 'M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.03.01.06.02.09.01c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12z' },
  { id: 'signal', name: 'Signal', color: 'text-blue-500', type: 'messaging', status: 'offline', icon: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.25a9.75 9.75 0 1 1 0 19.5 9.75 9.75 0 0 1 0-19.5zm-.375 4.125a.75.75 0 0 0-.75.75c0 .356.25.653.587.732 2.378.537 3.538 1.583 3.538 3.393 0 1.95-1.425 3.03-4.57 3.228v1.397a.75.75 0 0 0 1.5 0v-1.328c2.19-.187 3.07-1.028 3.07-1.9 0-.81-.537-1.467-2.038-1.807-2.377-.537-3.537-1.583-3.537-3.392 0-1.95 1.425-3.03 4.57-3.229V6.375a.75.75 0 0 0-1.5 0v1.328c-2.19.188-3.07 1.028-3.07 1.9 0 .81.537 1.467 2.038 1.807l.342.077c2.378.537 3.538 1.583 3.538 3.393 0 1.95-1.425 3.03-4.57 3.228v.005a.75.75 0 0 0 .75-.75v-.652c3.145-.198 4.57-1.278 4.57-3.228 0-1.81-1.16-2.856-3.538-3.393l-.342-.077c-2.378-.537-3.538-1.583-3.538-3.393 0-1.95 1.425-3.03 4.57-3.228v.63z' },
  { id: 'teams', name: 'MS Teams', color: 'text-purple-500', type: 'work', status: 'connected', icon: 'M16.5 6.75c1.657 0 3 1.343 3 3s-1.343 3-3 3-3-1.343-3-3 1.343-3 3-3zM6 9c1.657 0 3 1.343 3 3s-1.343 3-3 3-3-1.343-3-3 1.343-3 3-3zM16.5 14.25c2.343 0 4.343 1.343 4.343 3v2.25h-8.686v-2.25c0-1.657 2-3 4.343-3zM6 16.5c2.343 0 4.343 1.343 4.343 3v2.25H1.657v-2.25c0-1.657 2-3 4.343-3z' }
];

const MOCK_SESSIONS: GatewaySession[] = [
  {
    id: 's_01',
    channelId: 'whatsapp',
    user: '+1 (555) 029-3991',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    lastMessage: 'Can you confirm the trade execution details?',
    timestamp: Date.now() - 1000 * 60 * 5,
    unread: 2,
    status: 'active',
    events: [
        { id: 'e1', type: 'incoming', payload: 'Message received via Local Bridge', timestamp: Date.now() - 1000 * 60 * 5 },
        { id: 'e2', type: 'system', payload: 'Decrypted via Double Ratchet', timestamp: Date.now() - 1000 * 60 * 5 },
        { id: 'e3', type: 'tool_call', payload: 'Invoked: QTradeAnalyst.verify_execution()', timestamp: Date.now() - 1000 * 60 * 4 }
    ],
    messages: [
        { role: 'user', content: 'Hey, I need a check on the BTC position.', time: Date.now() - 1000 * 60 * 10 },
        { role: 'agent', content: 'Checking ledger now. Sovereign node confirms entry at 64,200.', time: Date.now() - 1000 * 60 * 8 },
        { role: 'user', content: 'Can you confirm the trade execution details?', time: Date.now() - 1000 * 60 * 5 }
    ]
  },
  {
    id: 's_02',
    channelId: 'slack',
    user: 'Sarah Connor (DevOps)',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    lastMessage: 'Server metrics looking stable now.',
    timestamp: Date.now() - 1000 * 60 * 45,
    unread: 0,
    status: 'idle',
    events: [
        { id: 'e4', type: 'incoming', payload: 'Webhook Event: Slack', timestamp: Date.now() - 1000 * 60 * 45 },
        { id: 'e5', type: 'tool_call', payload: 'Invoked: QOps.check_latency()', timestamp: Date.now() - 1000 * 60 * 44 }
    ],
    messages: [
        { role: 'user', content: 'Any alerts on the US-East node?', time: Date.now() - 1000 * 60 * 50 },
        { role: 'agent', content: 'Scanning metrics... CPU load nominal at 24%.', time: Date.now() - 1000 * 60 * 48 },
        { role: 'user', content: 'Server metrics looking stable now.', time: Date.now() - 1000 * 60 * 45 }
    ]
  },
  {
    id: 's_03',
    channelId: 'telegram',
    user: 'Alpha Syndicate',
    avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=Alpha',
    lastMessage: 'New macro signals detected in FX markets.',
    timestamp: Date.now() - 1000 * 60 * 120,
    unread: 5,
    status: 'active',
    events: [
        { id: 'e6', type: 'incoming', payload: 'Telegram MTProto Update', timestamp: Date.now() - 1000 * 60 * 120 }
    ],
    messages: [
        { role: 'user', content: 'New macro signals detected in FX markets.', time: Date.now() - 1000 * 60 * 120 }
    ]
  }
];

const Gateway: React.FC = () => {
  const [activeChannelId, setActiveChannelId] = useState<string>('all');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(MOCK_SESSIONS[0].id);
  const [controlView, setControlView] = useState<'chat' | 'events'>('chat');
  const [input, setInput] = useState('');

  const filteredSessions = activeChannelId === 'all' 
    ? MOCK_SESSIONS 
    : MOCK_SESSIONS.filter(s => s.channelId === activeChannelId);

  const activeSession = MOCK_SESSIONS.find(s => s.id === selectedSessionId);

  return (
    <div className="h-[calc(100vh-100px)] animate-in fade-in duration-700 flex overflow-hidden">
      
      {/* 1. CHANNEL RAIL (Left) */}
      <div className="w-20 bg-slate-950 border-r border-slate-800 flex flex-col items-center py-6 space-y-4 shrink-0 z-20">
        <button 
          onClick={() => setActiveChannelId('all')}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activeChannelId === 'all' ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-900 text-slate-500 hover:text-white'}`}
          title="All Channels"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
        </button>
        <div className="w-10 h-px bg-slate-800 my-2"></div>
        {CHANNELS.map(c => (
          <button 
            key={c.id} 
            onClick={() => setActiveChannelId(c.id)}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all relative group ${activeChannelId === c.id ? 'bg-slate-800 border-2 border-slate-700' : 'hover:bg-slate-900'}`}
            title={c.name}
          >
            <svg className={`w-6 h-6 ${c.color}`} fill="currentColor" viewBox="0 0 24 24"><path d={c.icon} /></svg>
            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-950 ${c.status === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
          </button>
        ))}
      </div>

      {/* 2. INBOX LIST (Middle) */}
      <div className="w-80 bg-[#020617] border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-outfit font-black text-white uppercase tracking-tighter italic">Unified <span className="text-emerald-400">Gateway</span></h2>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1">Local-First Control Plane</p>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredSessions.map(session => {
            const channel = CHANNELS.find(c => c.id === session.channelId);
            return (
              <button 
                key={session.id} 
                onClick={() => setSelectedSessionId(session.id)}
                className={`w-full p-4 border-b border-slate-800/50 flex items-start space-x-3 text-left transition-all hover:bg-slate-900/50 ${selectedSessionId === session.id ? 'bg-slate-900 border-l-4 border-l-orange-500' : 'border-l-4 border-l-transparent'}`}
              >
                <div className="relative">
                  <img src={session.avatar} alt="User" className="w-10 h-10 rounded-xl bg-slate-800" />
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-slate-950 flex items-center justify-center`}>
                    <svg className={`w-3 h-3 ${channel?.color}`} fill="currentColor" viewBox="0 0 24 24"><path d={channel?.icon || ''} /></svg>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-sm font-bold text-white truncate">{session.user}</h4>
                    <span className="text-[9px] font-mono text-slate-500">{new Date(session.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                  </div>
                  <p className={`text-xs truncate ${session.unread > 0 ? 'text-white font-bold' : 'text-slate-500'}`}>{session.lastMessage}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. ACTIVE CONTROL PLANE (Right) */}
      <div className="flex-1 flex flex-col bg-slate-950/30 relative">
        {/* Background Grid */}
        <div className="absolute inset-0 bg-mesh opacity-30 pointer-events-none"></div>

        {activeSession ? (
          <>
            {/* Header */}
            <div className="h-20 border-b border-slate-800 flex items-center justify-between px-8 bg-[#020617]/80 backdrop-blur-md z-10">
              <div className="flex items-center space-x-4">
                <img src={activeSession.avatar} alt="Active" className="w-10 h-10 rounded-xl bg-slate-800" />
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">{activeSession.user}</h3>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">End-to-End Encrypted via Local Bridge</span>
                  </div>
                </div>
              </div>
              
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                <button 
                  onClick={() => setControlView('chat')}
                  className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${controlView === 'chat' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                >
                  Chat View
                </button>
                <button 
                  onClick={() => setControlView('events')}
                  className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${controlView === 'events' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                >
                  Control Plane
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-hidden relative">
              {controlView === 'chat' ? (
                <div className="h-full flex flex-col">
                  <div className="flex-1 p-8 overflow-y-auto custom-scrollbar space-y-6">
                    {activeSession.messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[70%] p-5 rounded-2xl ${msg.role === 'user' ? 'bg-slate-800 text-white rounded-tl-none' : 'bg-emerald-600/10 border border-emerald-500/20 text-emerald-100 rounded-tr-none'}`}>
                          <p className="text-sm font-medium leading-relaxed">{msg.content}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest mt-2 opacity-50">{new Date(msg.time).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-6 border-t border-slate-800 bg-[#020617]">
                    <div className="relative group">
                      <input 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder={`Message ${activeSession.user} via Sovereign Gateway...`}
                        className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-4 pl-6 pr-32 text-white outline-none focus:border-orange-500/50 transition-all"
                      />
                      <button className="absolute right-2 top-2 bottom-2 px-6 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all">
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full p-8 overflow-y-auto custom-scrollbar">
                  <div className="max-w-4xl mx-auto space-y-4">
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-6">System Events & Tool Traces</h4>
                    {activeSession.events.map(event => (
                      <div key={event.id} className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl font-mono text-xs flex items-start space-x-4 animate-in slide-in-from-right-4 duration-300">
                        <div className={`w-2 h-full min-h-[20px] rounded-full ${
                          event.type === 'incoming' ? 'bg-emerald-500' : 
                          event.type === 'tool_call' ? 'bg-orange-500' : 
                          event.type === 'system' ? 'bg-indigo-500' : 'bg-slate-500'
                        }`}></div>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className="font-bold text-white uppercase">{event.type}</span>
                            <span className="text-slate-600">{new Date(event.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <p className="text-slate-400">{event.payload}</p>
                        </div>
                      </div>
                    ))}
                    
                    <div className="p-6 mt-8 border-2 border-dashed border-slate-800 rounded-2xl text-center">
                       <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">End of Logic Stream</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-600">
            <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            <p className="text-xs font-black uppercase tracking-widest">Select a channel to engage</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Gateway;
