"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { resolveTheme, type ThemeMode } from "@/lib/ui-model";
import { getStoredPreference, setStoredPreference } from "@/lib/browser-storage";

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = resolveTheme(getStoredPreference("kominfo-theme"), window.matchMedia("(prefers-color-scheme: dark)").matches);
      setTheme(next);
      document.documentElement.dataset.theme = next;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const value = useMemo(() => ({
    theme,
    toggleTheme: () => setTheme((current) => {
      const next = current === "light" ? "dark" : "light";
      setStoredPreference("kominfo-theme", next);
      document.documentElement.dataset.theme = next;
      return next;
    }),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
