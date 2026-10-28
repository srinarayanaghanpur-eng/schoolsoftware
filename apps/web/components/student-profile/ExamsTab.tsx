"use client";

import { useEffect, useState } from "react";
import { BookOpen, RefreshCw, AlertCircle, TrendingDown, Printer } from "lucide-react";

type ExamMark = {
  id: string;
  examId: string;
  examName: string;
  examType: string;
  className: string;
  section: string;
  subject: string;
  marksObtained: number;
  maxMarks: number;
  grade?: string | null;
  remarks?: string | null;
  updatedAt: string;
};

export function ExamsTab({
  student,
  data
}: {
  student: Record<string, unknown>;
  data: Record<string, unknown> | null;
}) {
  const [marks, setMarks] = useState<ExamMark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const studentId = String(student.id || "");

  useEffect(() => {
    loadMarks();
  }, [studentId]);

  const loadMarks = async () => {
    setLoading(true);
    setError("");
    try {
      const serverMarks = (data?.examMarks || []) as ExamMark[];
      setMarks(serverMarks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exam marks.");
    } finally {
      setLoading(false);
    }
  };

  const totalObtained = marks.reduce((sum, m) => sum + Number(m.marksObtained || 0), 0);
  const totalMax = marks.reduce((sum, m) => sum + Number(m.maxMarks || 0), 0);
  const percentage = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : "—";

  const gradeFor = (pct: number) => {
    if (pct >= 90) return "A+";
    if (pct >= 80) return "A";
    if (pct >= 70) return "B+";
    if (pct >= 60) return "B";
    if (pct >= 50) return "C";
    return "D";
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-[#1f2136]">Exams & Marks</h2>
          <p className="text-sm font-medium text-[#7d86a8]">Exam results for {String(student.studentName || "this student")}</p>
        </div>
        {marks.length > 0 && (
          <button type="button" onClick={() => window.print()} className="btn-secondary shrink-0">
            <Printer size={14} className="mr-1" /> Print Report Card
          </button>
        )}
      </div>

      {error && (
        <div className="card border-l-4 border-[#d84d5b] p-3 text-sm font-semibold text-[#d84d5b]">{error}</div>
      )}

      {loading && (
        <div className="card flex items-center justify-center p-8 text-sm font-medium text-[#7d86a8]">
          <RefreshCw size={20} className="animate-spin mr-2" /> Loading exam marks…
        </div>
      )}

      {!loading && marks.length === 0 && !error && (
        <div className="card p-8 text-center text-sm font-medium text-[#7d86a8]">
          <TrendingDown size={24} className="mx-auto mb-3 opacity-50" />
          <p>No exam marks recorded yet.</p>
        </div>
      )}

      {!loading && marks.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-[#edf0f7] bg-[#f7f8fd] p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#7d86a8]">Subjects</p>
                <p className="text-lg font-extrabold text-[#1f2136]">{marks.length}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#7d86a8]">Total Obtained</p>
                <p className="text-lg font-extrabold text-[#3033a1]">{totalObtained}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#7d86a8]">Total Max</p>
                <p className="text-lg font-extrabold text-[#1f2136]">{totalMax}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#7d86a8]">Percentage</p>
                <p className="text-lg font-extrabold text-[#3033a1]">{percentage}%</p>
              </div>
            </div>
          </div>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#edf0f7] bg-[#f7f8fd]">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Exam</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Subject</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Obtained</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Max Marks</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Grade</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {marks.map((m) => {
                const pct = Number(m.maxMarks) > 0 ? ((Number(m.marksObtained) / Number(m.maxMarks)) * 100) : 0;
                const grade = m.grade || gradeFor(pct);
                return (
                  <tr key={m.id} className="border-b border-[#f2f4fb] last:border-0">
                    <td className="px-4 py-3 text-xs font-medium text-[#303247]">{m.examName}</td>
                    <td className="px-4 py-3 text-xs text-[#5a6488]">{m.subject}</td>
                    <td className="px-4 py-3 text-xs font-extrabold text-[#3033a1]">{m.marksObtained}</td>
                    <td className="px-4 py-3 text-xs text-[#5a6488]">{m.maxMarks}</td>
                    <td className="px-4 py-3 text-xs font-bold text-[#3033a1]">{grade}</td>
                    <td className="px-4 py-3 text-xs text-[#5a6488] truncate" title={m.remarks || "—"}>
                      {m.remarks || "—"}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-[#3033a1] bg-[#f7f8fd] font-extrabold text-[#1f2136]">
                <td className="px-4 py-3" colSpan={2}>Total</td>
                <td className="px-4 py-3 text-xs text-right">{String(totalObtained)}</td>
                <td className="px-4 py-3 text-xs text-right">{String(totalMax)}</td>
                <td className="px-4 py-3 text-xs">{percentage}%</td>
                <td className="px-4 py-3 text-xs"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
