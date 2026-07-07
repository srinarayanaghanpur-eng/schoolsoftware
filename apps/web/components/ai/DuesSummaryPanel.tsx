"use client";

import { Loader2, BarChart3, IndianRupee, Users, School, Bell, Receipt, Search, RefreshCw } from "lucide-react";
import { formatCurrencyINR } from "@/lib/utils/formatCurrency";

interface ClassSummary {
  class: string;
  studentCount: number;
  totalDue: number;
}

interface TopDueCase {
  studentName: string;
  totalDue: number;
}

interface DuesSummaryData {
  totalStudents: number;
  totalDueAmount: number;
  classWiseSummary: ClassSummary[];
  topDueCases: TopDueCase[];
  suggestedReminderPlan: string;
  summaryUpdatedAt?: string | null;
}

interface Props {
  data: DuesSummaryData | null;
  loading: boolean;
  error: string | null;
  onSummarize: () => void;
}

export function DuesSummaryPanel({ data, loading, error, onSummarize }: Props) {
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 h-3 w-20 rounded bg-muted" />
              <div className="h-7 w-28 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="animate-pulse rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 h-4 w-36 rounded bg-muted" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 w-full rounded bg-muted" />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 py-8 text-sm font-semibold text-muted-foreground">
          <Loader2 size={18} className="animate-spin" />
          Analyzing fee data safely...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-4 rounded-2xl border border-red-200 bg-red-50 p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-100 text-red-600">
          <Search size={22} />
        </span>
        <div>
          <h3 className="text-base font-extrabold text-red-800">Error loading summary</h3>
          <p className="mt-1 text-sm font-medium text-red-700">{error}</p>
          <button type="button" onClick={onSummarize} className="btn-ghost mt-3 flex items-center gap-2 text-xs font-bold text-red-700">
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <button
          type="button"
          onClick={onSummarize}
          className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold shadow-lg"
        >
          <BarChart3 size={18} />
          Summarize Dues
        </button>
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          Click to fetch the latest fee due summary from ERP data.
        </p>
      </div>
    );
  }

  if (data.totalStudents === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-16 text-center">
        <span className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-600">
          <Receipt size={32} />
        </span>
        <h3 className="text-xl font-extrabold text-foreground">No Fee Dues Found</h3>
        <p className="mt-1 max-w-md text-sm font-medium text-muted-foreground">
          All selected students are clear for the current filters.
        </p>
        <button type="button" onClick={onSummarize} className="btn-ghost mt-4 flex items-center gap-2 text-xs font-bold">
          <RefreshCw size={14} /> Refresh Summary
        </button>
      </div>
    );
  }

  const classesWithDues = data.classWiseSummary.length;
  const remindersNeeded = data.totalStudents > 0 ? Math.ceil(data.totalStudents / 50) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users size={16} />
            <span className="text-xs font-bold">Total Due Students</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-foreground">{data.totalStudents}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <IndianRupee size={16} />
            <span className="text-xs font-bold">Total Due Amount</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-foreground">{formatCurrencyINR(data.totalDueAmount)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <School size={16} />
            <span className="text-xs font-bold">Classes with Dues</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-foreground">{classesWithDues}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Bell size={16} />
            <span className="text-xs font-bold">Reminders Needed</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-foreground">{remindersNeeded}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h4 className="mb-4 text-sm font-extrabold text-foreground">Class-wise Dues</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 pr-4 text-xs font-bold uppercase text-muted-foreground">Class</th>
                  <th className="pb-2 pr-4 text-xs font-bold uppercase text-muted-foreground">Students</th>
                  <th className="pb-2 text-xs font-bold uppercase text-muted-foreground text-right">Total Due</th>
                </tr>
              </thead>
              <tbody>
                {data.classWiseSummary.map((c) => (
                  <tr key={c.class} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-4 font-bold text-foreground">{c.class}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{c.studentCount}</td>
                    <td className="py-2.5 text-right font-bold text-foreground">{formatCurrencyINR(c.totalDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h4 className="mb-4 text-sm font-extrabold text-foreground">Top Due Cases</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 pr-4 text-xs font-bold uppercase text-muted-foreground">#</th>
                  <th className="pb-2 pr-4 text-xs font-bold uppercase text-muted-foreground">Student</th>
                  <th className="pb-2 text-xs font-bold uppercase text-muted-foreground text-right">Amount Due</th>
                </tr>
              </thead>
              <tbody>
                {data.topDueCases.map((s, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-4 text-muted-foreground">{i + 1}</td>
                    <td className="py-2.5 pr-4 font-medium text-foreground">{s.studentName}</td>
                    <td className="py-2.5 text-right font-bold text-foreground">{formatCurrencyINR(s.totalDue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.topDueCases.length === 0 && (
              <p className="py-4 text-center text-sm font-medium text-muted-foreground">No top due cases data available.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h4 className="mb-2 text-sm font-extrabold text-foreground">Suggested Reminder Plan</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">{data.suggestedReminderPlan}</p>
      </div>
    </div>
  );
}
