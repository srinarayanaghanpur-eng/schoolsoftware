import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Info } from "lucide-react";
import { StudentProfileHeader } from "@/components/student-profile/StudentProfileHeader";
import { StudentProfileActions } from "@/components/student-profile/StudentProfileActions";
import { SummaryCards } from "@/components/student-profile/SummaryCards";
import { OverviewTab } from "@/components/student-profile/OverviewTab";
import { FeeLedgerTab } from "@/components/student-profile/FeeLedgerTab";
import { DocumentsTab } from "@/components/student-profile/DocumentsTab";
import { CertificatesTab } from "@/components/student-profile/CertificatesTab";
import { AttendanceTab } from "@/components/student-profile/AttendanceTab";
import { ExamsTab } from "@/components/student-profile/ExamsTab";
import { HistoryTab } from "@/components/student-profile/HistoryTab";
import { getStudentProfile } from "@/app/admin/student/[studentId]/page.server";
import { CLASS_LABELS, classIdToSlug } from "@/lib/studentClasses";

type TabKey = "overview" | "fees" | "documents" | "certificates" | "attendance" | "exams" | "history";

const TAB_LABELS: Record<TabKey, string> = {
  overview: "Overview",
  fees: "Fees & Receipts",
  documents: "Documents & Certificates",
  certificates: "Certificates",
  attendance: "Attendance",
  exams: "Exams & Marks",
  history: "History"
};

const ALL_TABS: TabKey[] = ["overview", "fees", "documents", "certificates", "attendance", "exams", "history"];

export default async function StudentProfilePage({
  params,
  searchParams
}: {
  params: { studentId: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const studentId = params.studentId;
  const initialTab = (typeof searchParams.tab === "string" ? searchParams.tab : "overview") as TabKey;

  let data: any = null;
  let error: string | null = null;

  try {
    data = await getStudentProfile(studentId);
    if (!data?.student) {
      error = "Student not found.";
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load student profile.";
    console.error("Student profile load error:", err);
  }

  if (error) {
    return (
      <div className="p-4 md:p-7">
        <h1 className="text-2xl font-extrabold text-[#1f2136]">Student Profile</h1>
        <div className="card border-l-4 border-[#d84d5b] p-4 text-sm font-semibold text-[#d84d5b]">
          <p>{error}</p>
        </div>
        <Link href="/admin/students" className="btn-secondary mt-4">
          Back to Students
        </Link>
      </div>
    );
  }

  if (!data || !data.student) {
    return notFound();
  }

  const student = data.student;
  const studentName = String(student.studentName || "");
  const className = String(student.class || "");
  const status = String(student.status || "active");
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const activeTab = ALL_TABS.includes(initialTab) ? initialTab : "overview";
  const classLabel = className && CLASS_LABELS[className] ? CLASS_LABELS[className] : "";

  return (
    <div className="space-y-5 p-4 md:p-7">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs font-semibold text-muted-foreground">
        <Link
          href="/admin/students"
          className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition hover:text-primary"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          Students
        </Link>
        {classLabel && (
          <>
            <ChevronRight size={12} className="opacity-60" aria-hidden="true" />
            <Link
              href={`/admin/students/${classIdToSlug(className)}`}
              className="rounded-md px-1 py-0.5 transition hover:text-primary"
            >
              {classLabel}
            </Link>
          </>
        )}
        <ChevronRight size={12} className="opacity-60" aria-hidden="true" />
        <span className="max-w-[16rem] truncate text-foreground" aria-current="page">
          {studentName}
        </span>
      </nav>

      <StudentProfileHeader student={student} />
      <StudentProfileActions student={student} />

      {status !== "active" && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
          <Info size={17} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-foreground">Student status: {statusLabel}</p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              Some actions may be restricted while the student is {status}.
            </p>
          </div>
        </div>
      )}

      <SummaryCards data={data} canViewFees />

      <div className="card overflow-hidden">
        <div className="border-b border-border bg-muted/40 p-2">
          <nav aria-label="Student profile sections" className="flex gap-1 overflow-x-auto pb-0.5">
            {ALL_TABS.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <Link
                  key={tab}
                  href={`/admin/student/${studentId}?tab=${tab}`}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex h-10 shrink-0 items-center rounded-lg px-4 text-sm font-bold transition ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-card hover:text-foreground"
                  }`}
                >
                  {TAB_LABELS[tab]}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-4 md:p-6">
          {activeTab === "overview" && <OverviewTab student={student} />}
          {activeTab === "fees" && <FeeLedgerTab student={student} data={data} canViewFees canCreateFees />}
          {activeTab === "documents" && <DocumentsTab student={student} data={data} />}
          {activeTab === "certificates" && <CertificatesTab student={student} data={data} canView canCreate />}
          {activeTab === "attendance" && <AttendanceTab student={student} data={data} />}
          {activeTab === "exams" && <ExamsTab student={student} data={data} />}
          {activeTab === "history" && <HistoryTab student={student} data={data} />}
        </div>
      </div>
    </div>
  );
}
