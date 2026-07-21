"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";
import { hasPermission, formatLabel } from "@sri-narayana/shared";
import { ArrowLeft, BookOpen, CalendarDays, Clock, Download, FileText, Trash2, UserCheck } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Homework = {
  id: string;
  title: string;
  description: string;
  subject: string;
  className: string;
  section?: string;
  assignedBy: string;
  assignedDate: string;
  dueDate: string;
  attachments: { name: string; url: string }[];
  status: string;
  academicYearId: string;
};

type Submission = {
  id: string;
  homeworkId: string;
  studentId: string;
  studentName: string;
  submissionDate: string;
  content?: string;
  attachments: { name: string; url: string }[];
  status: string;
  grade?: string;
  remarks?: string;
  gradedBy?: string;
};

const statusStyles: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function HomeworkDetailPage() {
  const { role } = useAdminSession();
  const { id } = useParams();
  const router = useRouter();

  const [homework, setHomework] = useState<Homework | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id || typeof id !== "string") return;
    try {
      const data = await adminApiRequest<{ homework: Homework; submissions: Submission[] }>(`/api/admin/homework/${id}`);
      setHomework(data.homework);
      setSubmissions(data.submissions || []);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const grade = async (submissionId: string, grade: string, remarks: string) => {
    try {
      await adminApiRequest(`/api/admin/submissions/${submissionId}/grade`, {
        method: "PATCH",
        body: JSON.stringify({ grade, remarks, status: "graded" }),
      });
      setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, grade, remarks, status: "graded" } : s))
      );
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to grade");
    }
  };

  const removeFromState = (submissionId: string) => {
    setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
  };

  if (loading) {
    return (
      <section className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </section>
    );
  }

  if (error || !homework) {
    return (
      <section className="p-4 md:p-7">
        <div className="card p-5 font-semibold text-red-500">{error || "Homework not found"}</div>
        <Link href="/admin/homework" className="btn-secondary mt-4 inline-flex items-center gap-2">
          <ArrowLeft size={16} /> Back
        </Link>
      </section>
    );
  }

  if (!hasPermission(role, "exams.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-red-500">Access denied.</div></section>;
  }

  return (
    <>
      <PageHeader
        title={homework.title}
        description={`${homework.subject} · Class ${homework.className}${homework.section ? ` - ${homework.section}` : ""}`}
        action={
          <Link href="/admin/homework" className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft size={16} /> Back
          </Link>
        }
      />

      <section className="space-y-5 p-4 md:p-7">
        {error && (
          <div className="card border-l-4 border-l-red-500 p-4 text-sm font-semibold text-red-500">{error}</div>
        )}

        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><CalendarDays size={14} /> Assigned: {homework.assignedDate}</span>
              <span className="flex items-center gap-1.5"><Clock size={14} /> Due: {homework.dueDate}</span>
              <span className="flex items-center gap-1.5"><BookOpen size={14} /> {homework.subject}</span>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyles[homework.status] || ""}`}>
              {formatLabel(homework.status)}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{homework.description}</p>
          {homework.attachments?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {homework.attachments.map((a, i) => (
                <a
                  key={i}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-secondary/80"
                >
                  <FileText size={14} /> {a.name}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">
            Submissions <span className="text-sm font-normal text-muted-foreground">({submissions.length})</span>
          </h2>
          <span className="text-xs text-muted-foreground">
            {submissions.filter((s) => s.status === "graded").length} graded
          </span>
        </div>

        {submissions.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted-foreground">
            <UserCheck size={32} className="mx-auto mb-2 opacity-30" />
            No submissions yet.
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub) => (
              <SubmissionCard
                key={sub.id}
                submission={sub}
                onGrade={grade}
                onDelete={removeFromState}
                canGrade={hasPermission(role, "exams.edit")}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function SubmissionCard({
  submission,
  onGrade,
  onDelete,
  canGrade,
}: {
  submission: Submission;
  onGrade: (id: string, grade: string, remarks: string) => Promise<void>;
  onDelete: (id: string) => void;
  canGrade: boolean;
}) {
  const [grading, setGrading] = useState(false);
  const [gradeVal, setGrade] = useState(submission.grade || "");
  const [remarks, setRemarks] = useState(submission.remarks || "");
  const [saving, setSaving] = useState(false);

  const subStatusStyles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    graded: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  };

  const handleSave = async () => {
    setSaving(true);
    await onGrade(submission.id, gradeVal, remarks);
    setSaving(false);
    setGrading(false);
  };

  return (
    <div className="card p-4 transition hover:shadow-md">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-bold">{submission.studentName}</h4>
          <p className="text-xs text-muted-foreground">
            Submitted: {submission.submissionDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${subStatusStyles[submission.status] || ""}`}>
            {formatLabel(submission.status)}
          </span>
          {canGrade && submission.status !== "graded" && (
            <button
              className="btn-secondary !px-3 !py-1 text-xs"
              onClick={() => setGrading(!grading)}
            >
              Grade
            </button>
          )}
        </div>
      </div>

      {submission.content && (
        <p className="mb-2 text-sm text-muted-foreground">{submission.content}</p>
      )}

      {submission.attachments?.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {submission.attachments.map((a, i) => (
            <a
              key={i}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold hover:bg-secondary/80"
            >
              <Download size={12} /> {a.name}
            </a>
          ))}
        </div>
      )}

      {submission.status === "graded" && submission.grade && (
        <div className="flex items-center gap-3 text-sm">
          <span className="font-bold text-primary">Grade: {submission.grade}</span>
          {submission.remarks && <span className="text-muted-foreground">· {submission.remarks}</span>}
        </div>
      )}

      {grading && (
        <div className="mt-3 space-y-2 rounded-lg bg-secondary/30 p-3">
          <div className="flex gap-3">
            <label className="flex-1 text-xs font-semibold">
              Grade
              <input
                className="field mt-1"
                value={gradeVal}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="A, B+, 85%..."
              />
            </label>
          </div>
          <label className="text-xs font-semibold">
            Remarks
            <input
              className="field mt-1"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Good work, needs improvement..."
            />
          </label>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary !py-1 text-xs" onClick={() => setGrading(false)}>Cancel</button>
            <button className="btn-primary !py-1 text-xs" disabled={saving} onClick={handleSave}>
              {saving ? "Saving..." : "Save Grade"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
