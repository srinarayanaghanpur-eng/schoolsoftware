"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

type Student = { id: string; studentName: string; admissionNumber: string; className: string; section: string; parentName: string; parentMobile: string };
type HistoryEntry = { id: string; channel: string; status: string; message: string; sentAt: string };

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-[#fff4df] text-[#b8791a]",
  sent: "bg-[#e6f8ef] text-[#14a762]",
  failed: "bg-[#fee7e7] text-[#ed515d]",
  skipped: "bg-[#f0f0f5] text-[#7d86a8]",
  duplicate: "bg-[#dbeafe] text-[#2563eb]",
  processing: "bg-[#fff4df] text-[#b8791a]",
};

export default function FeeReminderHistoryPage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  async function loadStudents() {
    if (!selectedYear?.id) { setStudents([]); return; }
    try {
      const params = new URLSearchParams({ academicYearId: selectedYear.id, pageSize: "200" });
      const data = await adminApiRequest<{ data?: Student[] }>(`/api/admin/students?${params}`);
      setStudents(data.data || []);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to load students");
    }
  }

  useEffect(() => { void loadStudents(); }, [selectedYear?.id]);

  async function loadHistory(studentId: string, cursor?: string | null) {
    if (!selectedYear?.id) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ studentId, academicYearId: selectedYear.id, pageSize: "50" });
      if (cursor) params.set("cursor", cursor);
      const data = await adminApiRequest<{ history: HistoryEntry[]; nextCursor: string | null; hasMore: boolean }>(
        `/api/admin/fee-reminder-history?${params}`
      );
      if (cursor) {
        setHistory((prev) => [...prev, ...data.history]);
      } else {
        setHistory(data.history);
      }
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  function selectStudent(student: Student) {
    setSelectedStudent(student);
    setStudentSearch("");
    setHistory([]);
    void loadHistory(student.id);
  }

  function clearSelection() {
    setSelectedStudent(null);
    setHistory([]);
    setNextCursor(null);
    setHasMore(false);
  }

  const filteredStudents = students.filter((s) =>
    !studentSearch ||
    s.studentName?.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.admissionNumber?.includes(studentSearch)
  ).slice(0, 10);

  function formatDate(value: string) {
    if (!value) return "--";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  }

  if (!hasPermission(role, "fee_reminders.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Fee Reminder History" description="View reminder history for a specific student." />
      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        {/* Student search */}
        <div className="card p-5">
          <label className="text-sm font-semibold text-[#303247]">Search student</label>
          {selectedStudent ? (
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#eef0ff] px-3 py-2 text-sm font-semibold text-[#3033a1]">
              {selectedStudent.studentName} ({selectedStudent.admissionNumber})
              <button type="button" onClick={clearSelection} className="ml-auto text-[#ed515d]"><X size={14} /></button>
            </div>
          ) : (
            <div className="relative mt-2">
              <input className="field" placeholder="Search by name or admission number..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
              {studentSearch && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-[#e0e3f0] bg-white shadow-lg max-h-48 overflow-y-auto">
                  {filteredStudents.length === 0 && <div className="px-3 py-2 text-xs text-[#7d86a8]">No students found</div>}
                  {filteredStudents.map((s) => (
                    <button key={s.id} type="button" onClick={() => selectStudent(s)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-[#f5f6fd]">{s.studentName} ({s.admissionNumber})</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {selectedStudent && (
          <>
            {/* Student info card */}
            <div className="card p-5">
              <h3 className="font-bold text-[#303247]">{selectedStudent.studentName}</h3>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                <div><span className="font-semibold text-[#7d86a8]">Class</span> <span className="text-[#303247]">{selectedStudent.className}</span></div>
                <div><span className="font-semibold text-[#7d86a8]">Section</span> <span className="text-[#303247]">{selectedStudent.section || "--"}</span></div>
                <div><span className="font-semibold text-[#7d86a8]">Parent</span> <span className="text-[#303247]">{selectedStudent.parentName || "--"}</span></div>
                <div><span className="font-semibold text-[#7d86a8]">Mobile</span> <span className="text-[#303247]">{selectedStudent.parentMobile || "--"}</span></div>
              </div>
            </div>

            {/* History table */}
            <div className="card hidden overflow-x-auto md:block">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3">Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && history.length === 0 ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={`skel-${i}`} className="border-t border-stone-100">
                        <td colSpan={5} className="px-4 py-3"><div className="h-5 w-full animate-pulse rounded bg-[#eef0f7]" /></td>
                      </tr>
                    ))
                  ) : history.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">No reminder history found</td></tr>
                  ) : history.map((h) => (
                    <tr key={h.id} className="border-t border-stone-100 hover:bg-[#fafbff]">
                      <td className="whitespace-nowrap px-4 py-3 text-[#7d86a8]">{formatDate(h.sentAt).split(",")[0] || "--"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          h.channel === "whatsapp" ? "bg-[#e6f8ef] text-[#14a762]" : "bg-[#eef0ff] text-[#3033a1]"
                        }`}>{h.channel?.toUpperCase() || "--"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_BADGE[h.status] ?? "bg-[#f0f0f5] text-[#7d86a8]"}`}>{h.status}</span>
                      </td>
                      <td className="max-w-[250px] truncate px-4 py-3 text-[#5f6888]" title={h.message}>{h.message || "--"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#7d86a8]">{formatDate(h.sentAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {loading && history.length === 0 && (
                <div className="card p-4"><div className="h-16 w-full animate-pulse rounded bg-[#eef0f7]" /></div>
              )}
              {!loading && history.length === 0 && (
                <div className="card p-8 text-center text-sm text-stone-400">No reminder history found</div>
              )}
              {history.map((h) => (
                <div key={h.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_BADGE[h.status] ?? "bg-[#f0f0f5] text-[#7d86a8]"}`}>{h.status}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      h.channel === "whatsapp" ? "bg-[#e6f8ef] text-[#14a762]" : "bg-[#eef0ff] text-[#3033a1]"
                    }`}>{h.channel?.toUpperCase() || "--"}</span>
                  </div>
                  <p className="mt-2 text-xs text-[#7d86a8]">{formatDate(h.sentAt)}</p>
                  {h.message && <p className="mt-1 line-clamp-2 text-xs text-[#5f6888]">{h.message}</p>}
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="text-center">
                <button className="btn-secondary" onClick={() => selectedStudent && void loadHistory(selectedStudent.id, nextCursor)} disabled={loading}>
                  {loading ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
