"use client";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { PageHeader } from "@/components/PageHeader";
import { usePortalChild } from "@/components/PortalChildContext";
import { adminApiRequest } from "@/lib/adminApiClient";
import { ROLES } from "@sri-narayana/shared";
import { BookOpenCheck, TrendingUp, Award } from "lucide-react";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type ExamData = {
  timetable: { id: string; name: string; examType: string; status: string; startDate: string; endDate: string }[];
  marks: { id: string; examId: string; examName: string; examStatus: string; subject: string; marksObtained: number; maxMarks: number; grade: string; remarks: string }[];
  subjectPerformance: { subject: string; total: number; obtained: number; percentage: number; exams: number }[];
};

function statusBadge(status: string) {
  const map: Record<string, string> = {
    published: "bg-[#e6f8ef] text-[#0f8d52]",
    completed: "bg-[#eef0ff] text-[#3033a1]",
    ongoing: "bg-[#fff4df] text-[#b87d0e]",
    scheduled: "bg-[#f0f2f8] text-[#7d86a8]",
  };
  return map[status] || "bg-[#f0f2f8] text-[#7d86a8]";
}

function Examinations() {
  const { selectedChildId, selectedChild, children, switchChild, loading: childrenLoading } = usePortalChild();
  const [data, setData] = useState<ExamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (studentId: string) => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await adminApiRequest<{ ok: true } & ExamData>(`/api/portal/exams?studentId=${encodeURIComponent(studentId)}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load exam data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChildId) void loadData(selectedChildId);
  }, [selectedChildId]);

  if (childrenLoading) {
    return <section className="p-4 md:p-7"><div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">Loading...</div></section>;
  }

  return (
    <>
      <PageHeader
        title="Examinations"
        description={selectedChild ? `${selectedChild.name} · Class ${selectedChild.className}` : "View exams and results"}
        action={
          children.length > 1 ? (
            <select className="field min-w-[220px]" value={selectedChildId} onChange={(e) => switchChild(e.target.value)}>
              {children.map((s) => <option key={s.id} value={s.id}>{s.name} · Class {s.className}</option>)}
            </select>
          ) : null
        }
      />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}

        {loading ? (
          <div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">Loading exam data...</div>
        ) : data ? (
          <>
            {data.subjectPerformance.length > 0 && (
              <div className="card p-5">
                <div className="mb-4 flex items-center gap-3">
                  <TrendingUp size={20} className="text-[#3033a1]" />
                  <h2 className="font-extrabold text-[#1f2136]">Overall Performance</h2>
                </div>
                <div className="h-72 min-h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.subjectPerformance} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef0f7" />
                      <XAxis dataKey="subject" tick={{ fontSize: 12, fill: "#7d86a8" }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#7d86a8" }} />
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e3e6f0", fontSize: "13px" }} />
                      <Bar dataKey="percentage" fill="#3033a1" radius={[6, 6, 0, 0]} name="Percentage" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {data.marks.length > 0 && (
              <div className="card overflow-hidden">
                <div className="flex items-center gap-3 border-b border-[#edf0f7] px-5 py-4">
                  <Award size={20} className="text-[#3033a1]" />
                  <h2 className="font-extrabold text-[#1f2136]">Marks & Grades</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-[#f7f8fd] text-xs uppercase text-[#6f7898]">
                      <tr>
                        <th className="px-4 py-3">Exam</th>
                        <th className="px-4 py-3">Subject</th>
                        <th className="px-4 py-3">Marks</th>
                        <th className="px-4 py-3">Grade</th>
                        <th className="px-4 py-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.marks.map((m, i) => (
                        <tr key={m.id || i} className="border-t border-[#edf0f7]">
                          <td className="px-4 py-3 font-semibold text-[#303247]">{m.examName}</td>
                          <td className="px-4 py-3 text-[#7d86a8]">{m.subject}</td>
                          <td className="px-4 py-3 font-bold text-[#303247]">{m.marksObtained}/{m.maxMarks}</td>
                          <td className="px-4 py-3">{m.grade || "--"}</td>
                          <td className="px-4 py-3 text-sm text-[#7d86a8]">{m.remarks || "--"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {data.marks.length === 0 && (
              <div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">
                <BookOpenCheck className="mx-auto mb-3 text-[#3033a1]" size={32} />
                No exam results published yet.
              </div>
            )}

            {data.timetable.length > 0 && (
              <div className="card overflow-hidden">
                <div className="flex items-center gap-3 border-b border-[#edf0f7] px-5 py-4">
                  <BookOpenCheck size={20} className="text-[#3033a1]" />
                  <h2 className="font-extrabold text-[#1f2136]">Exam Schedule</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px] text-left text-sm">
                    <thead className="bg-[#f7f8fd] text-xs uppercase text-[#6f7898]">
                      <tr>
                        <th className="px-4 py-3">Exam</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Start</th>
                        <th className="px-4 py-3">End</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.timetable.map((exam) => (
                        <tr key={exam.id} className="border-t border-[#edf0f7]">
                          <td className="px-4 py-3 font-semibold text-[#303247]">{exam.name}</td>
                          <td className="px-4 py-3 capitalize text-[#7d86a8]">{exam.examType.replace(/_/g, " ")}</td>
                          <td className="px-4 py-3 text-[#7d86a8]">{exam.startDate}</td>
                          <td className="px-4 py-3 text-[#7d86a8]">{exam.endDate || "--"}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadge(exam.status)}`}>
                              {exam.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">
            <BookOpenCheck className="mx-auto mb-3 text-[#3033a1]" size={32} />
            No exam data available.
          </div>
        )}
      </section>
    </>
  );
}

export default function PortalExamsPage() {
  return (
    <AuthGate roles={ROLES}>
      <AppShell>
        <Examinations />
      </AppShell>
    </AuthGate>
  );
}
