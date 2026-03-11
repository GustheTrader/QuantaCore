
import { useState, useCallback } from 'react';
import { ChatWindowSession, ChatMessage } from '../types';

export const useChatWindows = () => {
  const [windows, setWindows] = useState<ChatWindowSession[]>([]);

  const openChat = useCallback((agentName: string) => {
    setWindows(prev => {
      const maxZ = Math.max(...prev.map(w => w.zIndex), 100);
      const existing = prev.find(w => w.agentName === agentName);
      if (existing) {
        if (existing.isOpen && !existing.isMinimized && existing.zIndex === maxZ) return prev;
        return prev.map(w => 
          w.agentName === agentName 
            ? { ...w, isOpen: true, isMinimized: false, zIndex: maxZ + 1 } 
            : w
        );
      }
      
      const newWindow: ChatWindowSession = {
        id: `chat_${Math.random().toString(36).substr(2, 9)}`,
        agentName,
        messages: [{
          role: 'model',
          content: `Neural link established with ${agentName}. How can I assist your objectives?`,
          timestamp: Date.now()
        }],
        isOpen: true,
        isMinimized: false,
        zIndex: maxZ + 1
      };
      
      return [...prev, newWindow];
    });
  }, []);

  const closeChat = useCallback((id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  }, []);

  const toggleMinimize = useCallback((id: string) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, isMinimized: !w.isMinimized } : w
    ));
  }, []);

  const focusWindow = useCallback((id: string) => {
    setWindows(prev => {
      const maxZ = Math.max(...prev.map(w => w.zIndex), 100);
      const window = prev.find(w => w.id === id);
      if (window && window.zIndex === maxZ) return prev;
      
      return prev.map(w => 
        w.id === id ? { ...w, zIndex: maxZ + 1 } : w
      );
    });
  }, []);

  const addMessage = useCallback((id: string, message: ChatMessage) => {
    setWindows(prev => prev.map(w => 
      w.id === id ? { ...w, messages: [...w.messages, message] } : w
    ));
  }, []);

  return {
    windows,
    openChat,
    closeChat,
    toggleMinimize,
    focusWindow,
    addMessage
  };
};
