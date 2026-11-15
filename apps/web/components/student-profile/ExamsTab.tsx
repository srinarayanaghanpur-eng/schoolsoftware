"use client";

import { BookOpen, GraduationCap, Percent, Printer, Target, TrendingDown, Trophy } from "lucide-react";
import { printCurrentPage } from "@/lib/desktopBridge";

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

function gradeFor(pct: number) {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  return "D";
}

export function ExamsTab({
  student,
  marks
}: {
  student: Record<string, unknown>;
  marks: Record<string, unknown>[];
}) {
  const examMarks = marks as unknown as ExamMark[];
  const totalObtained = examMarks.reduce((sum, mark) => sum + Number(mark.marksObtained || 0), 0);
  const totalMax = examMarks.reduce((sum, mark) => sum + Number(mark.maxMarks || 0), 0);
  const percentage = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : "—";
  const overallGrade = totalMax > 0 ? gradeFor(Number(percentage)) : "—";

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <GraduationCap size={16} />
            </span>
            <h2 className="text-lg font-extrabold text-foreground">Exams & Marks</h2>
          </div>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Exam results for {String(student.studentName || "this student")}
          </p>
        </div>
        {examMarks.length > 0 && (
          <button type="button" onClick={() => void printCurrentPage()} className="btn-secondary shrink-0">
            <Printer size={14} className="mr-1" /> Print Report Card
          </button>
        )}
      </div>

      {examMarks.length === 0 && (
        <div className="profile-card-hover card p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <TrendingDown size={24} />
          </div>
          <p className="mt-4 text-sm font-bold text-foreground">No exam marks recorded yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs font-medium text-muted-foreground">
            Marks will appear here once exams are graded for this student.
          </p>
        </div>
      )}

      {examMarks.length > 0 && (
        <>
          <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="profile-stat card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Subjects</p>
                <BookOpen size={16} className="text-primary" />
              </div>
              <p className="mt-3 text-xl font-extrabold text-foreground">{examMarks.length}</p>
            </div>
            <div className="profile-stat card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Obtained</p>
                <Target size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="mt-3 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{totalObtained}</p>
            </div>
            <div className="profile-stat card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Percentage</p>
                <Percent size={16} className="text-violet-600 dark:text-violet-400" />
              </div>
              <p className="mt-3 text-xl font-extrabold text-primary">{percentage}%</p>
            </div>
            <div className="profile-stat card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Overall Grade</p>
                <Trophy size={16} className="text-amber-600 dark:text-amber-400" />
              </div>
              <p className="mt-3 text-xl font-extrabold text-amber-600 dark:text-amber-400">{overallGrade}</p>
            </div>
          </div>

          <div className="profile-card-hover card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
              <div>
                <p className="text-xs font-bold text-foreground">Subject-wise performance</p>
                <p className="text-[10px] font-medium text-muted-foreground">Total {totalObtained} / {totalMax} marks</p>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                {percentage}%
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Exam</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Subject</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Obtained</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Max Marks</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Grade</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {examMarks.map((mark) => {
                    const obtained = Number(mark.marksObtained || 0);
                    const max = Number(mark.maxMarks || 0);
                    const pct = max > 0 ? (obtained / max) * 100 : 0;
                    const grade = mark.grade || gradeFor(pct);
                    return (
                      <tr key={`${mark.examId}-${mark.id}`} className="border-b border-border transition hover:bg-muted/60 last:border-0">
                        <td className="px-4 py-3">
                          <p className="text-xs font-semibold text-foreground">{mark.examName || "—"}</p>
                          {mark.examType && <p className="text-[10px] text-muted-foreground">{mark.examType}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{mark.subject || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-primary">{obtained}</span>
                            <div className="profile-progress h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                              <span className="bg-gradient-to-r from-primary to-[#7c6cf0]" style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{max}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary">
                            {grade}
                          </span>
                        </td>
                        <td className="max-w-[14rem] truncate px-4 py-3 text-xs text-muted-foreground" title={mark.remarks || "—"}>
                          {mark.remarks || "—"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-primary bg-muted/40 font-extrabold text-foreground">
                    <td className="px-4 py-3" colSpan={2}>Total</td>
                    <td className="px-4 py-3 text-xs">{totalObtained}</td>
                    <td className="px-4 py-3 text-xs">{totalMax}</td>
                    <td className="px-4 py-3 text-xs">{percentage}%</td>
                    <td className="px-4 py-3 text-xs" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
