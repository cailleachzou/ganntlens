import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AIProvider } from '../types';

export interface LLMConfig {
  provider: AIProvider;
  endpoint?: string;
  apiKey?: string;
  model?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts: string;
}

interface AIState {
  config: LLMConfig;
  messages: ChatMessage[];
  loading: boolean;
  setConfig: (config: LLMConfig) => void;
  addMessage: (msg: Omit<ChatMessage, 'ts'>) => void;
  clearMessages: () => void;
  setLoading: (b: boolean) => void;
}

const defaultConfig: LLMConfig = { provider: 'mock' };

export const useAIStore = create<AIState>()(
  persist(
    (set) => ({
      config: defaultConfig,
      messages: [],
      loading: false,
      setConfig: (config) => set({ config }),
      addMessage: (msg) =>
        set((state) => ({
          messages: [...state.messages, { ...msg, ts: new Date().toISOString() }]
        })),
      clearMessages: () => set({ messages: [] }),
      setLoading: (b) => set({ loading: b })
    }),
    { name: 'pm-ai-config' }
  )
);
