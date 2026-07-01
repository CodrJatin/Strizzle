import { create } from 'zustand';

interface NotificationState {
  unreadCount: number;
  increment: () => void;
  reset: () => void;
  setUnreadCount: (count: number) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  increment: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  reset: () => set({ unreadCount: 0 }),
  setUnreadCount: (count) => set({ unreadCount: count }),
}));
