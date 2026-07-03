"use client";

import clsx from "clsx";
import { memo, useEffect, useMemo, useState } from "react";
import { Circle, Clock, LogIn, LogOut, MapPin, Smartphone, Timer, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AttendanceRecord, AttendanceStatus } from "@sri-narayana/shared";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type StatusStyle = {
  label: string;
  cell: string;
  dot: string;
  badge: string;
};

// Soft, tinted palette for a calmer, more professional surface than the
// fully-saturated status colours used for inline badges elsewhere.
const STATUS_STYLES: Record<AttendanceStatus, StatusStyle> = {
  present: { label: "Present", cell: "bg-emerald-50/70 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800/60", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  late: { label: "Late", cell: "bg-amber-50/70 border-amber-100 dark:bg-amber-950/30 dark:border-amber-800/60", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  cl: { label: "Casual Leave", cell: "bg-rose-50/70 border-rose-100 dark:bg-rose-950/30 dark:border-rose-800/60", dot: "bg-rose-500", badge: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  holiday: { label: "Holiday", cell: "bg-indigo-50/60 border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-800/60", dot: "bg-indigo-400", badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" },
  absent: { label: "Absent", cell: "bg-slate-100 border-slate-200 dark:bg-slate-800/60 dark:border-slate-700", dot: "bg-slate-500", badge: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" },
  not_marked: { label: "Not marked", cell: "bg-card border-border", dot: "bg-slate-300", badge: "bg-muted text-muted-foreground" }
};

const LEGEND_ORDER: AttendanceStatus[] = ["present", "late", "cl", "absent", "holiday", "not_marked"];

function formatTime(iso?: string) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

function workedDuration(inIso?: string, outIso?: string) {
  if (!inIso || !outIso) return null;
  const ms = new Date(outIso).getTime() - new Date(inIso).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.round((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

function DetailTile({ icon: Icon, label, value, tone }: { icon?: LucideIcon; label: string; value: string; tone: string }) {
  const SafeIcon = Icon ?? Circle;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted px-3.5 py-3">
      <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-lg", tone)}>
        <SafeIcon size={17} strokeWidth={2.25} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="block truncate text-sm font-bold text-foreground">{value}</span>
      </span>
    </div>
  );
}

function AttendanceCalendarInner({ records, month = "2026-05" }: { records: AttendanceRecord[]; month?: string }) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const blanks = Array.from({ length: firstDay });
  const dates = Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
  const recordsByDate = useMemo(() => new Map(records.map((record) => [record.date, record])), [records]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Reset the open detail panel whenever the month or dataset changes.
  useEffect(() => setSelectedDate(null), [month, records]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const monthTitle = new Date(year, monthIndex, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const summary = useMemo(() => {
    const counts: Partial<Record<AttendanceStatus, number>> = {};
    for (const date of dates) {
      const status = recordsByDate.get(date)?.status ?? "not_marked";
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }, [dates, recordsByDate]);

  const selectedRecord = selectedDate ? recordsByDate.get(selectedDate) : undefined;
  const selectedStyle = selectedRecord ? STATUS_STYLES[selectedRecord.status] : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="text-base font-bold text-foreground">{monthTitle}</h3>
          <p className="text-xs font-medium text-muted-foreground">
            {summary.present ?? 0} present · {summary.late ?? 0} late · {summary.absent ?? 0} absent
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {LEGEND_ORDER.map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <span className={clsx("h-2.5 w-2.5 rounded-full", STATUS_STYLES[status].dot)} />
              {STATUS_STYLES[status].label}
            </span>
          ))}
        </div>
      </div>

      {/* Mobile: agenda list (the 7-column grid can't fit a phone) */}
      <div className="space-y-2 p-3 md:hidden">
        {dates.filter((date) => recordsByDate.has(date)).length === 0 ? (
          <p className="py-8 text-center text-sm font-medium text-muted-foreground">No attendance recorded this month.</p>
        ) : (
          dates
            .filter((date) => recordsByDate.has(date))
            .map((date) => {
              const record = recordsByDate.get(date)!;
              const style = STATUS_STYLES[record.status];
              const isToday = date === todayIso;
              const isSelected = date === selectedDate;
              const dayObj = new Date(`${date}T00:00:00`);
              return (
                <button
                  type="button"
                  key={date}
                  onClick={() => setSelectedDate((current) => (current === date ? null : date))}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                    style.cell,
                    isSelected && "ring-2 ring-ring"
                  )}
                >
                  <div className={clsx("flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg", isToday ? "bg-primary text-primary-foreground" : "bg-card text-foreground")}>
                    <span className="text-[10px] font-bold uppercase">{dayObj.toLocaleDateString(undefined, { weekday: "short" })}</span>
                    <span className="text-base font-extrabold leading-none">{Number(date.slice(-2))}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className={clsx("inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", style.badge)}>{style.label}</span>
                    <p className="mt-1 flex items-center gap-3 text-xs font-semibold text-foreground">
                      <span className="inline-flex items-center gap-1"><LogIn size={12} className="text-muted-foreground" />{formatTime(record.checkInTime)}</span>
                      <span className="inline-flex items-center gap-1"><LogOut size={12} className="text-muted-foreground" />{formatTime(record.checkOutTime)}</span>
                    </p>
                  </div>
                  <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", style.dot)} />
                </button>
              );
            })
        )}
      </div>

      {/* Desktop: month grid */}
      <div className="hidden overflow-x-auto md:block">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-7 bg-muted text-center text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {WEEKDAYS.map((day, index) => (
              <div key={day} className={clsx("px-2 py-2.5", (index === 0 || index === 6) && "text-muted-foreground")}>
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-border p-px">
            {blanks.map((_, index) => (
              <div key={`blank-${index}`} className="min-h-[104px] bg-muted" />
            ))}
            {dates.map((date, index) => {
              const record = recordsByDate.get(date);
              const status: AttendanceStatus = record?.status ?? "not_marked";
              const style = STATUS_STYLES[status];
              const isToday = date === todayIso;
              const isSelected = date === selectedDate;
              const clickable = Boolean(record);
              const dayNumber = Number(date.slice(-2));

              return (
                <button
                  type="button"
                  key={date}
                  disabled={!clickable}
                  onClick={() => clickable && setSelectedDate((current) => (current === date ? null : date))}
                  style={{ animationDelay: `${Math.min((firstDay + index) * 12, 360)}ms` }}
                  className={clsx(
                    "cal-cell group relative min-h-[104px] border bg-card p-2.5 text-left transition duration-150 focus:outline-none",
                    style.cell,
                    clickable
                      ? "cursor-pointer hover:z-10 hover:-translate-y-0.5 hover:shadow-lg focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring/40"
                      : "cursor-default",
                    isSelected && "z-10 shadow-lg ring-2 ring-ring"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={clsx(
                        "grid h-7 w-7 place-items-center rounded-full text-sm font-bold transition",
                        isToday ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground group-hover:bg-card/70"
                      )}
                    >
                      {dayNumber}
                    </span>
                    <span className={clsx("h-2.5 w-2.5 rounded-full ring-2 ring-card", style.dot)} />
                  </div>

                  {record ? (
                    <div className="mt-2.5 space-y-1.5">
                      <span className={clsx("inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", style.badge)}>
                        {style.label}
                      </span>
                    <p className="flex items-center gap-1 text-xs font-semibold text-foreground">
                        <LogIn size={12} className="text-muted-foreground" /> {formatTime(record.checkInTime)}
                      </p>
                      <p className="flex items-center gap-1 text-xs font-semibold text-foreground">
                        <LogOut size={12} className="text-muted-foreground" /> {formatTime(record.checkOutTime)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] font-medium text-muted-foreground">{style.label}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedRecord && selectedStyle && (
        <div key={selectedDate} className="cal-detail border-t border-border bg-muted/40 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Daily detail</p>
              <h4 className="mt-0.5 text-base font-bold text-foreground">
                {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric"
                })}
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <span className={clsx("inline-flex rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide", selectedStyle.badge)}>
                {selectedStyle.label}
              </span>
              <button
                type="button"
                aria-label="Close detail"
                onClick={() => setSelectedDate(null)}
                className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <DetailTile icon={LogIn} label="In time" value={formatTime(selectedRecord.checkInTime)} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" />
            <DetailTile icon={LogOut} label="Out time" value={formatTime(selectedRecord.checkOutTime)} tone="bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" />
            <DetailTile
              icon={Timer}
              label="Working hours"
              value={workedDuration(selectedRecord.checkInTime, selectedRecord.checkOutTime) ?? "—"}
              tone="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
            />
            <DetailTile
              icon={Clock}
              label="Late by"
              value={selectedRecord.lateMinutes > 0 ? `${selectedRecord.lateMinutes} min` : "On time"}
              tone="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
            />
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 capitalize">
              <Smartphone size={13} className="text-muted-foreground" /> {selectedRecord.source}
              {selectedRecord.deviceInfo ? ` · ${selectedRecord.deviceInfo}` : ""}
            </span>
            {typeof selectedRecord.distanceFromCampus === "number" && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={13} className="text-muted-foreground" /> {selectedRecord.distanceFromCampus} m from campus
              </span>
            )}
            {selectedRecord.remarks && <span className="italic">“{selectedRecord.remarks}”</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// Wrapped with React.memo to prevent unnecessary re-renders
// Only re-renders when records or month props actually change
export const AttendanceCalendar = memo(AttendanceCalendarInner);
