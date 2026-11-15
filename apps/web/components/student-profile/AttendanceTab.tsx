"use client";

import { AlertCircle, CalendarCheck, CalendarDays, Clock, Percent, Sparkles } from "lucide-react";

export function AttendanceTab({ student }: { student: Record<string, unknown> }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <CalendarCheck size={16} />
            </span>
            <h2 className="text-lg font-extrabold text-foreground">Attendance</h2>
          </div>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Attendance records for {String(student.studentName || "this student")}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-border bg-muted/50 px-3 py-1 text-[10px] font-bold text-muted-foreground">
          <Sparkles size={11} />
          Module preview
        </span>
      </div>

      <div className="profile-rise relative overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-orange-50/70 to-transparent p-4 dark:border-amber-500/20 dark:from-amber-500/10 dark:via-orange-500/5">
        <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-amber-400/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <AlertCircle size={19} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Student attendance is not tracked yet</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              The current ERP tracks staff attendance only. Student attendance records are not stored in the database, so there is no attendance history to display for this student.
            </p>
          </div>
        </div>
      </div>

      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="profile-stat card p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Working Days</p>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays size={17} />
            </div>
          </div>
          <p className="mt-4 text-2xl font-extrabold text-foreground">—</p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">Awaiting attendance data</p>
        </div>
        <div className="profile-stat card p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Present Days</p>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CalendarCheck size={17} />
            </div>
          </div>
          <p className="mt-4 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">—</p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">No records available</p>
        </div>
        <div className="profile-stat card p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Attendance %</p>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
              <Percent size={17} />
            </div>
          </div>
          <p className="mt-4 text-2xl font-extrabold text-primary">—</p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">Calculated once enabled</p>
        </div>
      </div>

      <div className="profile-card-hover card relative overflow-hidden p-8 text-center">
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" aria-hidden="true">
          <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border-[18px] border-primary" />
          <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-[14px] border-primary" />
        </div>
        <div className="relative">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Clock size={24} />
          </div>
          <p className="mt-4 text-sm font-bold text-foreground">No attendance records available</p>
          <p className="mx-auto mt-1 max-w-md text-xs font-medium leading-relaxed text-muted-foreground">
            To enable student attendance tracking, contact your system administrator to configure the student attendance module.
          </p>
        </div>
      </div>
    </div>
  );
}
