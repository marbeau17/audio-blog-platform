import { create } from 'zustand';
import type { User, Content } from '@/types';

interface AppState {
  // Auth
  user: User | null;
  setUser: (user: User | null) => void;

  // Player
  currentContent: Content | null;
  isPlayerVisible: boolean;
  setCurrentContent: (content: Content | null) => void;
  showPlayer: () => void;
  hidePlayer: () => void;

  // UI
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  user: null,
  setUser: (user) => set({ user }),

  // Player
  currentContent: null,
  isPlayerVisible: false,
  setCurrentContent: (content) => set({ currentContent: content, isPlayerVisible: !!content }),
  showPlayer: () => set({ isPlayerVisible: true }),
  hidePlayer: () => set({ isPlayerVisible: false }),

  // UI
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
}));
