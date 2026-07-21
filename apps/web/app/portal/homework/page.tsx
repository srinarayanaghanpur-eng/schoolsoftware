"use client";

import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { usePortalChild } from "@/components/PortalChildContext";
import { adminApiRequest } from "@/lib/adminApiClient";
import { formatLabel } from "@sri-narayana/shared";
import { BookOpen, CalendarDays, FileText, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

type HomeworkItem = {
  id: string;
  title: string;
  subject: string;
  description: string;
  dueDate: string;
  assignedDate: string;
  attachments: { name: string; url: string }[];
  createdAt: string;
};

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date();
}

function HomeworkView() {
  const { selectedChildId, selectedChild, children, switchChild, loading: childrenLoading } = usePortalChild();
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedChildId) return;
    setLoading(true);
    adminApiRequest<{ ok: true; homework: HomeworkItem[] }>(`/api/portal/homework?studentId=${encodeURIComponent(selectedChildId)}`)
      .then((r) => setHomework(r.homework))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedChildId]);

  const subjects = [...new Set(homework.map((h) => h.subject))];
  const overdueCount = homework.filter((h) => isOverdue(h.dueDate)).length;
  const pendingCount = homework.filter((h) => !isOverdue(h.dueDate)).length;

  return (
    <>
      <PageHeader title="Homework" description={selectedChild ? `${selectedChild.name} · Class ${selectedChild.className}` : ""} />

      {children.length > 1 && (
        <div className="px-4 md:px-7">
          <select
            className="field"
            value={selectedChildId}
            onChange={(e) => switchChild(e.target.value)}
          >
            {children.map((c) => (
              <option key={c.id} value={c.id}>{c.name} - Class {c.className}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 md:p-7">
        <div className="card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <BookOpen size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-500">Total</p>
            <p className="text-xl font-extrabold">{homework.length}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-500">Pending</p>
            <p className="text-xl font-extrabold">{pendingCount}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
            <AlertCircle size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-500">Overdue</p>
            <p className="text-xl font-extrabold">{overdueCount}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : homework.length === 0 ? (
        <div className="p-8 text-center text-stone-400">No homework assigned yet.</div>
      ) : subjects.length > 1 && (
        <div className="flex flex-wrap gap-2 px-4 md:px-7">
          {subjects.map((s) => (
            <span key={s} className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-3 p-4 md:p-7">
        {homework.length === 0 ? null : homework.map((h) => (
          <div key={h.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-foreground">{h.title}</h3>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                  {formatLabel(h.subject)}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                isOverdue(h.dueDate)
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              }`}>
                {isOverdue(h.dueDate) ? "Overdue" : "Active"}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{h.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays size={12} /> Due: {h.dueDate}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} /> Assigned: {h.assignedDate || h.createdAt?.slice(0, 10)}
              </span>
            </div>
            {h.attachments?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {h.attachments.map((a, i) => (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                  >
                    <FileText size={12} /> {a.name}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export default function PortalHomeworkPage() {
  return (
    <AppShell>
      <HomeworkView />
    </AppShell>
  );
}
