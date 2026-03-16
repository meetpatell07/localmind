"use client";

import { create } from "zustand";

interface ChatStore {
  sessionId: string | null;
  setSessionId: (id: string) => void;
  ollamaOnline: boolean;
  setOllamaOnline: (online: boolean) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  sessionId: null,
  setSessionId: (id) => set({ sessionId: id }),
  ollamaOnline: true,
  setOllamaOnline: (online) => set({ ollamaOnline: online }),
}));
