import clsx from "clsx";
import { memo, useMemo } from "react";
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
  present: {
    label: "Present",
    cell: "bg-emerald-50/70 border-emerald-100",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-700"
  },
  late: {
    label: "Late",
    cell: "bg-amber-50/70 border-amber-100",
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700"
  },
  cl: {
    label: "Casual Leave",
    cell: "bg-rose-50/70 border-rose-100",
    dot: "bg-rose-500",
    badge: "bg-rose-100 text-rose-700"
  },
  holiday: {
    label: "Holiday",
    cell: "bg-indigo-50/60 border-indigo-100",
    dot: "bg-indigo-400",
    badge: "bg-indigo-100 text-indigo-700"
  },
  absent: {
    label: "Absent",
    cell: "bg-slate-100 border-slate-200",
    dot: "bg-slate-500",
    badge: "bg-slate-200 text-slate-700"
  },
  not_marked: {
    label: "Not marked",
    cell: "bg-white border-[#eef0f7]",
    dot: "bg-slate-300",
    badge: "bg-slate-100 text-slate-400"
  }
};

const LEGEND_ORDER: AttendanceStatus[] = ["present", "late", "cl", "absent", "holiday", "not_marked"];

function AttendanceCalendarInner({ records, month = "2026-05" }: { records: AttendanceRecord[]; month?: string }) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const blanks = Array.from({ length: firstDay });
  const dates = Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
  const recordsByDate = useMemo(() => new Map(records.map((record) => [record.date, record])), [records]);

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

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e3e6f0] bg-white shadow-[0_2px_4px_rgba(36,42,94,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0f7] px-5 py-4">
        <div>
          <h3 className="text-base font-bold text-[#1b1d32]">{monthTitle}</h3>
          <p className="text-xs font-medium text-[#7d86a8]">
            {summary.present ?? 0} present · {summary.late ?? 0} late · {summary.absent ?? 0} absent
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {LEGEND_ORDER.map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5a6488]">
              <span className={clsx("h-2.5 w-2.5 rounded-full", STATUS_STYLES[status].dot)} />
              {STATUS_STYLES[status].label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-7 bg-[#f7f8fd] text-center text-[11px] font-bold uppercase tracking-[0.08em] text-[#7d86a8]">
            {WEEKDAYS.map((day, index) => (
              <div key={day} className={clsx("px-2 py-2.5", (index === 0 || index === 6) && "text-[#a3abc7]")}>
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-[#edf0f7] p-px">
            {blanks.map((_, index) => (
              <div key={`blank-${index}`} className="min-h-[104px] bg-[#fafbff]" />
            ))}
            {dates.map((date) => {
              const record = recordsByDate.get(date);
              const status: AttendanceStatus = record?.status ?? "not_marked";
              const style = STATUS_STYLES[status];
              const isToday = date === todayIso;
              const dayNumber = Number(date.slice(-2));

              return (
                <div
                  key={date}
                  className={clsx(
                    "group relative min-h-[104px] border bg-white p-2.5 transition duration-150 hover:z-10 hover:shadow-[0_6px_16px_rgba(36,42,94,0.10)]",
                    style.cell
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={clsx(
                        "grid h-7 w-7 place-items-center rounded-full text-sm font-bold",
                        isToday ? "bg-[#3033a1] text-white shadow-sm" : "text-[#2a2e45]"
                      )}
                    >
                      {dayNumber}
                    </span>
                    <span className={clsx("h-2.5 w-2.5 rounded-full ring-2 ring-white", style.dot)} />
                  </div>

                  {record ? (
                    <div className="mt-2.5 space-y-1.5">
                      <span className={clsx("inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide", style.badge)}>
                        {style.label}
                      </span>
                      <p className="text-xs font-semibold text-[#3a4061]">
                        {record.checkInTime
                          ? new Date(record.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "No check-in"}
                      </p>
                      <p className="text-[11px] font-medium capitalize text-[#9098b6]">{record.source}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] font-medium text-[#b3bad3]">{style.label}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrapped with React.memo to prevent unnecessary re-renders
// Only re-renders when records or month props actually change
export const AttendanceCalendar = memo(AttendanceCalendarInner);
