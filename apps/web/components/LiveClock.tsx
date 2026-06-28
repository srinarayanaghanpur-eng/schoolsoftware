"use client";

import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Live wall-clock that ticks every second (IST). Renders nothing until mounted
 * so server and client markup match (avoids hydration mismatch).
 */
export function LiveClock({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now
    ? now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })
    : "--:--:--";
  const date = now
    ? now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    : "";

  const wrap =
    tone === "dark"
      ? "border-white/15 bg-white/10 text-white"
      : "border-[#e3e6f0] bg-white text-[#1b1d32]";
  const iconTone = tone === "dark" ? "bg-[#f7c548] text-[#282a79]" : "bg-[#eeefff] text-[#3033a1]";
  const sub = tone === "dark" ? "text-[#d7dcff]" : "text-[#7d86a8]";

  return (
    <div className={`inline-flex items-center gap-3 rounded-2xl border px-4 py-2.5 ${wrap} ${className}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${iconTone}`}>
        <Clock3 size={18} />
      </span>
      <span className="leading-tight">
        <span className="block font-mono text-base font-extrabold tabular-nums tracking-tight">{time}</span>
        <span className={`block text-xs font-semibold ${sub}`}>{date}</span>
      </span>
    </div>
  );
}
