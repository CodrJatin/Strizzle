import { create } from 'zustand';

interface ThemeState {
  theme: string;
  setTheme: (theme: string) => void;
}

const getInitialTheme = (): string => {
  if (typeof window === 'undefined') return 'default';
  const match = document.cookie.match(/(^|;)\s*strizzle-theme\s*=\s*([^;]+)/);
  return match ? match[2] : 'default';
};

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => {
    set({ theme });
    if (typeof window === 'undefined') return;

    // Set cookie that expires in 1 year
    const isProd = process.env.NODE_ENV === 'production';
    document.cookie = `strizzle-theme=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax${isProd ? '; Secure' : ''}`;

    let resolvedTheme = theme;
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      resolvedTheme = isDark ? 'dark' : 'default';
    }

    document.documentElement.setAttribute('data-theme', resolvedTheme);
    if (resolvedTheme === 'dark' || resolvedTheme === 'high-contrast') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },
}));
