
import React from 'react';
import { FloatingChatWindow } from './FloatingChatWindow';
import { ChatWindowSession, ChatMessage } from '../types';
import { AnimatePresence } from 'motion/react';

interface FloatingChatManagerProps {
  windows: ChatWindowSession[];
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  onFocus: (id: string) => void;
  onAddMessage: (id: string, message: ChatMessage) => void;
  profile: { name: string, callsign: string, personality: string };
}

export const FloatingChatManager: React.FC<FloatingChatManagerProps> = ({
  windows,
  onClose,
  onMinimize,
  onFocus,
  onAddMessage,
  profile
}) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      <div className="relative w-full h-full pointer-events-auto">
        <AnimatePresence>
          {windows.map((session) => (
            <FloatingChatWindow 
              key={session.id}
              session={session}
              onClose={onClose}
              onMinimize={onMinimize}
              onFocus={onFocus}
              onAddMessage={onAddMessage}
              profile={profile}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
