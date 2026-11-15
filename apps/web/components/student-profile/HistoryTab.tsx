"use client";

import {
  Activity,
  Award,
  History as HistoryIcon,
  IndianRupee,
  Pencil,
  Trash2,
  UserPlus,
  UserRound
} from "lucide-react";

function actionMeta(action: string) {
  const value = action.toLowerCase();
  if (value.includes("certificate")) {
    return {
      chip: "text-[#7a3fbf] bg-[#f3eafd] dark:bg-violet-500/10 dark:text-violet-300",
      iconWrap: "bg-[#f3eafd] text-[#7a3fbf] dark:bg-violet-500/10 dark:text-violet-300",
      icon: <Award size={15} />
    };
  }
  if (value.includes("payment") || value.includes("fee")) {
    return {
      chip: "text-[#18765e] bg-[#e6f8ef] dark:bg-emerald-500/10 dark:text-emerald-300",
      iconWrap: "bg-[#e6f8ef] text-[#18765e] dark:bg-emerald-500/10 dark:text-emerald-300",
      icon: <IndianRupee size={15} />
    };
  }
  if (value.includes("admission") || value.includes("student.created")) {
    return {
      chip: "text-[#3033a1] bg-[#eef0ff] dark:bg-primary/10 dark:text-primary",
      iconWrap: "bg-[#eef0ff] text-[#3033a1] dark:bg-primary/10 dark:text-primary",
      icon: <UserPlus size={15} />
    };
  }
  if (value.includes("edit") || value.includes("update")) {
    return {
      chip: "text-[#ad7413] bg-[#fff7e6] dark:bg-amber-500/10 dark:text-amber-300",
      iconWrap: "bg-[#fff7e6] text-[#ad7413] dark:bg-amber-500/10 dark:text-amber-300",
      icon: <Pencil size={15} />
    };
  }
  if (value.includes("cancel") || value.includes("delete")) {
    return {
      chip: "text-[#d84d5b] bg-[#fff7f8] dark:bg-rose-500/10 dark:text-rose-300",
      iconWrap: "bg-[#fff7f8] text-[#d84d5b] dark:bg-rose-500/10 dark:text-rose-300",
      icon: <Trash2 size={15} />
    };
  }
  return {
    chip: "text-[#6f7898] bg-[#f4f5fb] dark:bg-muted dark:text-muted-foreground",
    iconWrap: "bg-[#f4f5fb] text-[#6f7898] dark:bg-muted dark:text-muted-foreground",
    icon: <Activity size={15} />
  };
}

export function HistoryTab({
  student,
  logs
}: {
  student: Record<string, unknown>;
  logs: Record<string, unknown>[];
}) {
  const formatActor = (log: Record<string, unknown>) => String(log.actorName || log.actorId || "System");

  const formatDate = (value: unknown) => {
    if (!value) return "—";
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <HistoryIcon size={16} />
            </span>
            <h2 className="text-lg font-extrabold text-foreground">History</h2>
          </div>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Chronological record of actions for {String(student.studentName || "this student")}
          </p>
        </div>
        {logs.length > 0 && (
          <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
            <Activity size={11} />
            {logs.length} {logs.length === 1 ? "entry" : "entries"}
          </span>
        )}
      </div>

      {logs.length === 0 && (
        <div className="profile-card-hover card p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <HistoryIcon size={24} />
          </div>
          <p className="mt-4 text-sm font-bold text-foreground">No history records found</p>
          <p className="mx-auto mt-1 max-w-sm text-xs font-medium text-muted-foreground">
            History entries are created when actions are performed on this student record.
          </p>
        </div>
      )}

      {logs.length > 0 && (
        <ol className="profile-timeline space-y-3">
          {logs.map((log, index) => {
            const action = String(log.action || "—");
            const meta = actionMeta(action);
            return (
              <li
                key={String(log.id || `log-${index}`)}
                className="profile-timeline-item profile-rise"
                style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}
              >
                <span className={`profile-timeline-dot ${meta.iconWrap}`} aria-hidden="true">
                  {meta.icon}
                </span>
                <div className="profile-card-hover card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${meta.chip}`}>
                      {action.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")}
                    </span>
                    <time className="ml-auto text-[10px] font-medium text-muted-foreground">{formatDate(log.createdAt)}</time>
                  </div>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-foreground">
                    {String(log.reason || log.description || log.action || "—")}
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                    <UserRound size={12} />
                    <span className="truncate" title={formatActor(log)}>{formatActor(log)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
