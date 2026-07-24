"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission, formatLabel } from "@sri-narayana/shared";
import { Search, Printer, Download, Eye, FileText } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Exam = {
  id: string;
  name: string;
  className: string;
  section?: string;
  examType: string;
  startDate: string;
  status: string;
};

const statusStyles: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ongoing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  completed: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-400",
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export default function ReportCardsPage() {
  const { role } = useAdminSession();
  const { years, selectedYear } = useAcademicYears();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!selectedYear?.id) { setLoading(false); return; }
    (async () => {
      try {
        const params = new URLSearchParams(`academicYearId=${selectedYear.id}&pageSize=100`);
        const data = await adminApiRequest<{ exams: Exam[] }>(`/api/admin/exams?${params}`);
        setExams(data.exams.filter((e) => e.status === "published" || e.status === "completed"));
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [selectedYear?.id]);

  const filtered = exams.filter((e) =>
    !searchTerm || e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.className.includes(searchTerm)
  );

  if (!hasPermission(role, "exams.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-red-500">Access denied.</div></section>;
  }

  return (
    <>
      <PageHeader title="Report Cards" description="View and print report cards for published exams" />

      <section className="space-y-4 p-4 md:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="field !pl-9"
              placeholder="Search exams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {!selectedYear?.id && (
            <div className="text-sm font-semibold text-amber-600">Select an academic year to load exams.</div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {exams.length === 0
              ? "No published or completed exams found for this academic year."
              : "No exams match your search."}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((exam) => (
              <div key={exam.id} className="card p-4 transition hover:shadow-md">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-bold text-foreground">{exam.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      Class {exam.className}{exam.section ? ` - ${exam.section}` : ""} · {formatLabel(exam.examType)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[exam.status] || ""}`}>
                    {formatLabel(exam.status)}
                  </span>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">{exam.startDate}</p>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/exams/${exam.id}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/20"
                  >
                    <Eye size={15} /> View Marks
                  </Link>
                  <Link
                    href={`/receipts/print/${exam.id}?type=report-card`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"
                  >
                    <Printer size={15} /> Report Card
                  </Link>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
                    onClick={async () => {
                      try {
                        const data = await adminApiRequest<{ ok: true; reportCards: unknown[] }>(
                          `/api/admin/exams/${exam.id}/report-card`
                        );
                        const blob = new Blob(
                          [JSON.stringify(data.reportCards, null, 2)],
                          { type: "application/json" }
                        );
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `report-card-${exam.name.replace(/\s+/g, "-")}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch { /* ignore */ }
                    }}
                  >
                    <Download size={14} /> Export
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
