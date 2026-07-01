import { create } from 'zustand';

export type HiveRole = 'owner' | 'admin' | 'member' | 'viewer';

interface HiveState {
  currentHiveId: string | null;
  userRole: HiveRole | null;
  setHiveContext: (hiveId: string | null, role: HiveRole | null) => void;
  clearHiveContext: () => void;
}

export const useHiveStore = create<HiveState>((set) => ({
  currentHiveId: null,
  userRole: null,
  setHiveContext: (hiveId, role) => set({ currentHiveId: hiveId, userRole: role }),
  clearHiveContext: () => set({ currentHiveId: null, userRole: null }),
}));
