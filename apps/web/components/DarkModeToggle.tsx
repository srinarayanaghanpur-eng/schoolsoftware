"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function DarkModeToggle({ className = "" }: { className?: string }) {
  const { dark, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition hover:bg-[#e9ebfa] dark:hover:bg-[#2a2d3a] ${className}`}
    >
      {dark ? <Sun size={19} className="text-[#f5c842]" /> : <Moon size={19} className="text-[#313581]" />}
    </button>
  );
}
