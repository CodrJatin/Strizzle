import { create } from 'zustand';

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions | null;
  resolvePromise: ((value: boolean) => void) | null;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  onConfirm: () => void;
  onCancel: () => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  options: null,
  resolvePromise: null,
  confirm: (options) => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        options,
        resolvePromise: resolve,
      });
    });
  },
  onConfirm: () => {
    const resolve = get().resolvePromise;
    if (resolve) resolve(true);
    set({ isOpen: false, options: null, resolvePromise: null });
  },
  onCancel: () => {
    const resolve = get().resolvePromise;
    if (resolve) resolve(false);
    set({ isOpen: false, options: null, resolvePromise: null });
  },
}));
