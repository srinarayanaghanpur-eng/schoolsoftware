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
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-primary transition hover:bg-accent ${className}`}
    >
      {dark ? <Sun size={19} className="text-warning" /> : <Moon size={19} />}
    </button>
  );
}
