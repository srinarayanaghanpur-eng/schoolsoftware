"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PickerChangeEvent = { target: { value: string; name: string } };

type DatePickerProps = {
  value: string;
  onChange: (event: PickerChangeEvent) => void;
  type?: "date" | "month";
  name?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  placeholder?: string;
  /** Render only a calendar icon button as the trigger (used inside composite fields). */
  iconOnly?: boolean;
  ariaLabel?: string;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateString(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function parseValue(value: string, type: "date" | "month") {
  const match = type === "date" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: type === "date" ? Number(match[3]) : 1 };
}

function formatDisplay(value: string, type: "date" | "month") {
  const parsed = parseValue(value, type);
  if (!parsed) return "";
  if (type === "month") return `${MONTHS[parsed.month]} ${parsed.year}`;
  return `${pad(parsed.day)} ${MONTHS[parsed.month].slice(0, 3)} ${parsed.year}`;
}

export function DatePicker({
  value,
  onChange,
  type = "date",
  name = "",
  required = false,
  disabled = false,
  min,
  max,
  className = "field",
  placeholder,
  iconOnly = false,
  ariaLabel
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const parsed = parseValue(value, type);
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = parseValue(value, type);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value, type]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const emit = (next: string) => {
    onChange({ target: { value: next, name } });
  };

  const inRange = (candidate: string) => {
    if (min && candidate < min) return false;
    if (max && candidate > max) return false;
    return true;
  };

  const selectDay = (day: number) => {
    emit(toDateString(viewYear, viewMonth, day));
    setOpen(false);
  };

  const selectMonth = (month: number) => {
    emit(`${viewYear}-${pad(month + 1)}`);
    setOpen(false);
  };

  const prev = () => {
    if (type === "month") return setViewYear((y) => y - 1);
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };

  const next = () => {
    if (type === "month") return setViewYear((y) => y + 1);
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const todayStr = toDateString(today.getFullYear(), today.getMonth(), today.getDate());

  const display = formatDisplay(value, type);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={
          iconOnly
            ? "grid h-8 w-8 place-items-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"
            : `${className} flex items-center justify-between gap-2 text-left`
        }
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        {!iconOnly && (
          <span className={display ? "" : "text-[hsl(var(--muted-foreground))]"}>
            {display || placeholder || (type === "month" ? "Select month" : "Select date")}
          </span>
        )}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-60" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="3" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>
      {/* keeps native form `required` validation working */}
      {!iconOnly && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          value={value}
          onChange={() => undefined}
          required={required}
          name={name || undefined}
        />
      )}
      {open && (
        <div
          role="dialog"
          className={`absolute top-[calc(100%+6px)] z-50 w-72 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-[0_14px_34px_rgb(var(--shadow-rgb)/0.18)] ${iconOnly ? "right-0" : "left-0"}`}
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={prev} className="rounded-lg px-2 py-1 text-sm font-bold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Previous">
              ‹
            </button>
            <div className="flex items-center gap-1 text-sm font-extrabold text-[hsl(var(--foreground))]">
              {type === "date" && <span>{MONTHS[viewMonth]}</span>}
              <input
                type="number"
                className="w-16 rounded-lg border border-transparent bg-transparent text-center font-extrabold outline-none focus:border-[hsl(var(--ring))]"
                value={viewYear}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  if (y >= 1900 && y <= 2200) setViewYear(y);
                }}
                aria-label="Year"
              />
            </div>
            <button type="button" onClick={next} className="rounded-lg px-2 py-1 text-sm font-bold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Next">
              ›
            </button>
          </div>

          {type === "month" ? (
            <div className="grid grid-cols-3 gap-1">
              {MONTHS.map((label, m) => {
                const candidate = `${viewYear}-${pad(m + 1)}`;
                const selected = value === candidate;
                const isCurrent = today.getFullYear() === viewYear && today.getMonth() === m;
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={!inRange(candidate)}
                    onClick={() => selectMonth(m)}
                    className={`rounded-xl px-2 py-2 text-xs font-bold transition-colors disabled:opacity-30 ${
                      selected
                        ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                        : isCurrent
                          ? "border border-[hsl(var(--ring))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                          : "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                    }`}
                  >
                    {label.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                {WEEKDAYS.map((d) => (
                  <span key={d} className="py-1">{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstWeekday }).map((_, i) => (
                  <span key={`pad-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const candidate = toDateString(viewYear, viewMonth, day);
                  const selected = value === candidate;
                  const isToday = candidate === todayStr;
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={!inRange(candidate)}
                      onClick={() => selectDay(day)}
                      className={`h-8 rounded-lg text-xs font-bold transition-colors disabled:opacity-30 ${
                        selected
                          ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                          : isToday
                            ? "border border-[hsl(var(--ring))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                            : "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-2 flex items-center justify-between border-t border-[hsl(var(--border))] pt-2 text-xs font-bold">
            <button type="button" className="text-[hsl(var(--muted-foreground))] hover:underline" onClick={() => { emit(""); setOpen(false); }}>
              Clear
            </button>
            <button
              type="button"
              className="text-[hsl(var(--primary))] hover:underline"
              onClick={() => {
                emit(type === "month" ? todayStr.slice(0, 7) : todayStr);
                setOpen(false);
              }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
