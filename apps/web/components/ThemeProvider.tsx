"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type ThemeContextValue = {
  dark: boolean;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  dark: false,
  toggle: () => {}
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("erp-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored === "dark" || (!stored && prefersDark);
    setDark(isDark);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      if (dark) { document.documentElement.classList.add("dark"); } else { document.documentElement.classList.remove("dark"); }
      localStorage.setItem("erp-theme", dark ? "dark" : "light");
    }
  }, [dark, mounted]);

  const toggle = () => {
    // Enable the smooth theme transition just for the switch, then remove it
    // so later hover/focus transitions stay snappy. Skipped entirely when the
    // user prefers reduced motion.
    try {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) {
        document.documentElement.classList.add("theme-anim");
        window.setTimeout(() => document.documentElement.classList.remove("theme-anim"), 350);
      }
    } catch {
      // Non-browser context — toggle still applies below.
    }
    setDark((v) => !v);
  };


  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
