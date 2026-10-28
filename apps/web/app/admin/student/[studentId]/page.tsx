import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  FileText,
  Folder,
  IndianRupee,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
  ChevronRight,
  Printer
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StudentProfileHeader } from "@/components/student-profile/StudentProfileHeader";
import { SummaryCards } from "@/components/student-profile/SummaryCards";
import { OverviewTab } from "@/components/student-profile/OverviewTab";
import { FeeLedgerTab } from "@/components/student-profile/FeeLedgerTab";
import { DocumentsTab } from "@/components/student-profile/DocumentsTab";
import { CertificatesTab } from "@/components/student-profile/CertificatesTab";
import { AttendanceTab } from "@/components/student-profile/AttendanceTab";
import { ExamsTab } from "@/components/student-profile/ExamsTab";
import { HistoryTab } from "@/components/student-profile/HistoryTab";
import { getStudentProfile } from "@/app/admin/student/[studentId]/page.server";

type TabKey = "overview" | "fees" | "documents" | "certificates" | "attendance" | "exams" | "history";

const TAB_LABELS: Record<TabKey, { label: string; icon: React.ReactElement }> = {
  overview: { label: "Overview", icon: <BarChart3 size={14} /> },
  fees: { label: "Fees & Receipts", icon: <IndianRupee size={14} /> },
  documents: { label: "Documents & Certificates", icon: <Folder size={14} /> },
  certificates: { label: "Certificates", icon: <FileText size={14} /> },
  attendance: { label: "Attendance", icon: <CalendarCheck size={14} /> },
  exams: { label: "Exams & Marks", icon: <ClipboardList size={14} /> },
  history: { label: "History", icon: <CreditCard size={14} /> }
};

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
  let error = "";

  try {
    data = await getStudentProfile(studentId);
    if (!data.student) {
      error = "Student not found.";
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load student profile.";
  }

  const student = data.student;
  const admissionNumber = String(student.admissionNumber || student.admissionNo || "");
  const studentName = String(student.studentName || "");
  const className = String(student.class || "");
  const section = String(student.section || "");
  const status = String(student.status || "active");

  const breadcrumbLinks = [
    { label: "Students", href: "/admin/students" },
    { label: "Class List", href: `/admin/students/${className.toLowerCase()}` },
    { label: studentName, href: `/admin/student/${studentId}` }
  ];

  const allTabs: TabKey[] = Object.keys(TAB_LABELS) as TabKey[];
  const activeTab = allTabs.includes(initialTab) ? initialTab : (allTabs[0] || "overview");

  const actionButtons = (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/#"
        onClick={(e) => {
          e.preventDefault();
          window.location.href = `/admin/students/${className.toLowerCase()}`;
        }}
        className="btn-secondary"
      >
        <FileText size={14} className="mr-1" /> Edit Student
      </Link>
      <button type="button" className="btn-primary">
        <CreditCard size={14} className="mr-1" /> Add Fee
      </button>
      <Link
        href="/#"
        onClick={(e) => {
          e.preventDefault();
          window.print();
        }}
        className="btn-secondary"
      >
        <Printer size={14} className="mr-1" /> Print Profile
      </Link>
    </div>
  );

  return (
    <div className="p-4 md:p-7 space-y-5">
      <PageHeader
        title="Student Profile"
        description={`${studentName} · Admission No. ${admissionNumber} · Class ${className}-${section}`}
        action={actionButtons}
      />

      <nav className="flex flex-wrap items-center gap-1 text-xs font-medium text-[#7d86a8]">
        {breadcrumbLinks.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} />}
            {i === breadcrumbLinks.length - 1 ? (
              <span className="text-[#3033a1] font-bold">{crumb.label}</span>
            ) : (
              <Link href={crumb.href}>{crumb.label}</Link>
            )}
          </span>
        ))}
      </nav>

      {status !== "active" && (
        <div className="card border-l-4 border-[#ad7413] bg-[#fff7e6] p-3">
          <div className="flex items-start gap-2">
            <TrendingDown size={14} className="mt-0.5 text-[#ad7413]" />
            <div>
              <p className="text-sm font-bold text-[#303247]">Student status: {status.charAt(0).toUpperCase() + status.slice(1)}</p>
              <p className="text-xs text-[#7d86a8]">Some actions may be restricted for this status.</p>
            </div>
          </div>
        </div>
      )}

      <StudentProfileHeader student={student} canEdit />
      <SummaryCards data={data} canViewFees />

      <div className="card border border-[#edf0f7] overflow-hidden">
        <div className="border-b border-[#edf0f7] flex flex-wrap gap-0">
          {allTabs.map((tab) => {
            const meta = TAB_LABELS[tab];
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => window.location.href = `/admin/student/${studentId}?tab=${tab}`}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition ${
                  isActive
                    ? "border-[#3033a1] bg-[#3033a1]/5 text-[#3033a1]"
                    : "text-[#6f7898] hover:text-[#3033a1] hover:bg-[#f4f5fb]"
                }`}
              >
                {meta.icon}
                {meta.label}
              </button>
            );
          })}
        </div>

        <div className="p-4 md:p-6">
          {activeTab === "overview" && <OverviewTab student={student} canEdit />}
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
