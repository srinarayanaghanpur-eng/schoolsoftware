"use client";

import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { CLASS_LABELS } from "@/lib/studentClasses";
import {
  BookOpenCheck,
  Crown,
  LayoutGrid,
  Loader2,
  NotebookPen,
  Users
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Assignment = {
  id: string;
  kind: "subject" | "elective" | "class_teacher";
  className: string;
  section?: string;
  subjectName?: string;
  periodsPerWeek?: number;
};

const KIND_LABEL: Record<Assignment["kind"], string> = {
  subject: "Subject teacher",
  elective: "Elective teacher",
  class_teacher: "Class teacher"
};

const KIND_STYLE: Record<Assignment["kind"], string> = {
  subject: "bg-[#eeefff] text-[#3033a1]",
  elective: "bg-[#e6f8ef] text-[#14a762]",
  class_teacher: "bg-[#fff6e5] text-[#c47f00]"
};

const KIND_ICON = {
  subject: BookOpenCheck,
  elective: LayoutGrid,
  class_teacher: Crown
} as const;

export default function TeacherAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teacherName, setTeacherName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | Assignment["kind"]>("all");

  useEffect(() => {
    let active = true;
    void adminApiRequest<{ teacherName: string; assignments: Assignment[] }>("/api/teacher/assignments")
      .then((data) => {
        if (!active) return;
        setTeacherName(data.teacherName ?? "");
        setAssignments(data.assignments ?? []);
      })
      .catch((err) => {
        if (active) setError(err instanceof AdminApiError ? err.message : "Unable to load your assignments");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? assignments : assignments.filter((item) => item.kind === filter)),
    [assignments, filter]
  );

  const classCount = new Set(assignments.map((item) => `${item.className}|${item.section ?? ""}`)).size;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f8f9fd] px-4 py-6 md:px-8">
      <header className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-[#6f7899]">My Work</p>
        <h1 className="text-2xl font-black tracking-tight text-[#151a3c]">Assigned Classes</h1>
        <p className="mt-1 text-sm font-medium text-[#6f7899]">
          {teacherName ? `${teacherName} · ` : ""}
          {assignments.length} assignment(s) across {classCount} class-section(s), set by admin.
        </p>
      </header>

      {error && <div className="mb-4 rounded-2xl bg-[#ffeaec] px-4 py-3 text-sm font-bold text-[#dd5369]">{error}</div>}

      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "subject", "elective", "class_teacher"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-2 text-xs font-bold ring-1 transition ${
              filter === key
                ? "bg-[#3033a1] text-white ring-[#3033a1]"
                : "bg-white text-[#6f7899] ring-[#e6e8f2] hover:bg-[#f3f4fb]"
            }`}
          >
            {key === "all" ? "All" : KIND_LABEL[key]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="animate-spin text-[#3033a1]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center text-sm font-semibold text-[#6f7899] ring-1 ring-[#e6e8f2]">
          <Users className="mx-auto mb-2" />
          No assignments yet. Ask the admin to assign classes to you.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <li key={item.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#e6e8f2]">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`grid h-9 w-9 place-items-center rounded-xl ${KIND_STYLE[item.kind]}`}>
                      <Icon size={17} />
                    </span>
                    <div>
                      <p className="text-base font-black text-[#151a3c]">
                        {CLASS_LABELS[item.className] ?? item.className}
                        {item.section ? ` - ${item.section}` : ""}
                      </p>
                      <p className="text-xs font-bold uppercase tracking-wide text-[#9aa2bd]">
                        {KIND_LABEL[item.kind]}
                      </p>
                    </div>
                  </div>
                  {item.periodsPerWeek ? (
                    <span className="rounded-full bg-[#f3f4fb] px-2.5 py-1 text-xs font-bold text-[#6f7899]">
                      {item.periodsPerWeek}/wk
                    </span>
                  ) : null}
                </div>
                {item.subjectName && (
                  <p className="mt-3 text-sm font-semibold text-[#6f7899]">{item.subjectName}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/teacher/attendance"
                    className="rounded-xl bg-[#eeefff] px-3 py-2 text-xs font-bold text-[#3033a1]"
                  >
                    Mark attendance
                  </Link>
                  <Link
                    href="/teacher/lesson-plans"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#f3f4fb] px-3 py-2 text-xs font-bold text-[#6f7899]"
                  >
                    <NotebookPen size={13} /> Lesson plan
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
