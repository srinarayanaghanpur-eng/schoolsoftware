"use client";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { usePortalChild } from "@/components/PortalChildContext";
import { adminApiRequest } from "@/lib/adminApiClient";
import { CalendarDays, GraduationCap, Sun, BookOpenCheck, Building2 } from "lucide-react";
import { useEffect, useState } from "react";

type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  type: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  className?: string;
};

function getMonthDates(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return { firstDay: firstDay.getDay(), days };
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  holiday: <Sun size={14} />,
  exam: <GraduationCap size={14} />,
  event: <CalendarDays size={14} />,
  fee: <BookOpenCheck size={14} />,
};

const TYPE_COLORS: Record<string, string> = {
  holiday: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200",
  exam: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200",
  event: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200",
  fee: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200",
};

function CalendarView() {
  const { selectedChildId, selectedChild, children, switchChild, loading: childrenLoading } = usePortalChild();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  useEffect(() => {
    setLoading(true);
    adminApiRequest<{ ok: true; holidays: CalendarEvent[]; exams: CalendarEvent[] }>(
      `/api/portal/calendar?${selectedChildId ? `studentId=${encodeURIComponent(selectedChildId)}&` : ""}year=${viewYear}`
    )
      .then((r) => setEvents([...(r.holidays || []), ...(r.exams || [])]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedChildId, viewYear]);

  const { firstDay, days } = getMonthDates(viewYear, viewMonth);
  const monthName = new Date(viewYear, viewMonth).toLocaleString("default", { month: "long", year: "numeric" });

  function getEventsForDate(date: Date) {
    const dateStr = date.toISOString().slice(0, 10);
    return events.filter((e) => {
      if (e.date === dateStr) return true;
      if (e.startDate && e.endDate) {
        return dateStr >= e.startDate && dateStr <= e.endDate;
      }
      return false;
    });
  }

  function isToday(date: Date) {
    return date.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
  }

  return (
    <>
      <PageHeader title="School Calendar" description="Holidays, exams, and events" />

      <div className="space-y-4 p-4 md:p-7">
        {children.length > 1 && (
          <select
            className="field"
            value={selectedChildId}
            onChange={(e) => switchChild(e.target.value)}
          >
            {children.map((c) => (
              <option key={c.id} value={c.id}>{c.name} - Class {c.className}</option>
            ))}
          </select>
        )}

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="card p-4">
              <div className="mb-4 flex items-center justify-between">
                <button
                  className="rounded-lg border px-3 py-1.5 text-sm font-semibold hover:bg-muted"
                  onClick={() => {
                    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
                    else setViewMonth((m) => m - 1);
                  }}
                >
                  ← {new Date(viewYear, viewMonth - 1).toLocaleString("default", { month: "short" })}
                </button>
                <h2 className="text-lg font-extrabold">{monthName}</h2>
                <button
                  className="rounded-lg border px-3 py-1.5 text-sm font-semibold hover:bg-muted"
                  onClick={() => {
                    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
                    else setViewMonth((m) => m + 1);
                  }}
                >
                  {new Date(viewYear, viewMonth + 1).toLocaleString("default", { month: "short" })} →
                </button>
              </div>

              <div className="grid grid-cols-7 gap-px text-center text-xs font-semibold text-muted-foreground">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="py-2">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-px">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[80px] p-1" />
                ))}
                {days.map((date) => {
                  const dayEvents = getEventsForDate(date);
                  return (
                    <div
                      key={date.toISOString()}
                      className={`min-h-[80px] rounded-lg border p-1 text-xs transition ${
                        isToday(date)
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:bg-muted"
                      }`}
                    >
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                        isToday(date) ? "bg-primary font-bold text-primary-foreground" : ""
                      }`}>
                        {date.getDate()}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {dayEvents.slice(0, 3).map((e, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium leading-tight ${
                              TYPE_COLORS[e.type] || "bg-stone-100 text-stone-600"
                            }`}
                            title={e.title}
                          >
                            {TYPE_ICONS[e.type] || null}
                            <span className="truncate">{e.title}</span>
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-center text-[10px] font-semibold text-muted-foreground">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {events.length > 0 && (
              <div className="card p-4">
                <h3 className="mb-3 text-sm font-extrabold text-foreground">Upcoming Events</h3>
                <div className="space-y-2">
                  {events
                    .filter((e) => (e.date || e.startDate || "") >= today.toISOString().slice(0, 10))
                    .slice(0, 10)
                    .map((e, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          TYPE_COLORS[e.type] || "bg-stone-100"
                        }`}>
                          {TYPE_ICONS[e.type] || <CalendarDays size={14} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{e.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {e.date || `${e.startDate} → ${e.endDate}`}
                            {e.className ? ` · Class ${e.className}` : ""}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          TYPE_COLORS[e.type] || "bg-stone-100"
                        }`}>
                          {e.type}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function PortalCalendarPage() {
  return (
    <AppShell>
      <CalendarView />
    </AppShell>
  );
}
