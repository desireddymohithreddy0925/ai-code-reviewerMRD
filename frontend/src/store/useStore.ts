import { create } from 'zustand';
import { BackendResponse } from '../pages/Dashboard';

export interface ChatMessage { role: "user" | "assistant"; content: string; sources?: { file: string; line: number }[]; }

interface GlobalState {
  analysisResult: BackendResponse | null;
  setAnalysisResult: (result: BackendResponse | null) => void;
  selectedFile: string | null;
  setSelectedFile: (file: string | null) => void;
  chatHistory: ChatMessage[];
  setChatHistory: (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
}

const CHAT_HISTORY_KEY = 'reposage_chat_history';

const loadChatHistory = (): ChatMessage[] => {
  try {
    const saved = localStorage.getItem(CHAT_HISTORY_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {}
  return [];
};

const persistChatHistory = (history: ChatMessage[]) => {
  try { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history)); } catch {}
};

export const useStore = create<GlobalState>((set) => ({
  analysisResult: null,
  setAnalysisResult: (result) => set({ analysisResult: result }),
  selectedFile: null,
  setSelectedFile: (file) => set({ selectedFile: file }),
  chatHistory: loadChatHistory(),
  setChatHistory: (updater) => {
    const current = useStore.getState().chatHistory;
    const updated = typeof updater === 'function' ? updater(current) : updater;
    persistChatHistory(updated);
    set({ chatHistory: updated });
  },
}));
