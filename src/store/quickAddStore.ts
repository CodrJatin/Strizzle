import { create } from 'zustand';

interface QuickAddState {
  isOpen: boolean;
  defaultTab: 'text' | 'link' | 'file';
  open: (tab?: unknown) => void;
  close: () => void;
}

export const useQuickAddStore = create<QuickAddState>((set) => ({
  isOpen: false,
  defaultTab: 'text',
  open: (tab) => {
    const selectedTab = (typeof tab === 'string' && ['text', 'link', 'file'].includes(tab))
      ? (tab as 'text' | 'link' | 'file')
      : 'text';
    set({ isOpen: true, defaultTab: selectedTab });
  },
  close: () => set({ isOpen: false }),
}));
