'use client';

import * as React from 'react';
import { useThemeStore } from '@/store/themeStore';

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme: string;
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const setTheme = useThemeStore((s) => s.setTheme);
  const theme = useThemeStore((s) => s.theme);

  // Sync server-side cookie theme value to Zustand store on mount
  React.useEffect(() => {
    if (initialTheme && initialTheme !== theme) {
      setTheme(initialTheme);
    }
  }, [initialTheme, setTheme, theme]);

  // Handle system theme updates dynamically if user theme is set to 'system'
  React.useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      // Re-trigger theme update
      setTheme('system');
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [theme, setTheme]);

  // Register service worker for PWA capabilities
  React.useEffect(() => {
    if (process.env.NODE_ENV === "development") return;

    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (registrations.length === 0) {
          navigator.serviceWorker
            .register("/sw.js")
            .then((registration) => {
              console.log("Serwist Service Worker registered with scope:", registration.scope);
            })
            .catch((err) => {
              console.error("Serwist Service Worker registration failed:", err);
            });
        }
      });
    }
  }, []);

  return <>{children}</>;
}
