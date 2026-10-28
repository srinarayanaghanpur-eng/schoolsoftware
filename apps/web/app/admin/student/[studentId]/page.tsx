import { notFound } from "next/navigation";
import Link from "next/link";
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

  if (error) {
    return (
      <div className="p-4 md:p-7">
        <h1 className="text-2xl font-extrabold text-[#1f2136]">Student Profile</h1>
        <div className="card border-l-4 border-[#d84d5b] p-4 text-sm font-semibold text-[#d84d5b]">{error}</div>
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

  const allTabs: TabKey[] = [ "overview", "fees", "documents", "certificates", "attendance", "exams", "history" ];
  const activeTab = allTabs.includes(initialTab) ? initialTab : "overview";

  return (
    <div className="p-4 md:p-7 space-y-5">
      <h1 className="text-2xl font-extrabold text-[#1f2136]">Student Profile</h1>
      <p className="text-sm font-medium text-[#7d86a8]">{studentName} · Admission No. {admissionNumber} · Class {className}-{section}</p>
      <Link href="/admin/students" className="btn-secondary">Back to Students</Link>
      {status !== "active" && (
        <div className="card border-l-4 border-[#ad7413] bg-[#fff7e6] p-3">
          <div className="flex items-start gap-2">
            <span className="text-xs font-bold text-[#ad7413]">Student status: {status.charAt(0).toUpperCase() + status.slice(1)}</span>
            <p className="text-xs text-[#7d86a8]">Some actions may be restricted for this status.</p>
          </div>
        </div>
      )}
      <StudentProfileHeader student={student} />
      <SummaryCards data={data} />
      <div className="card border border-[#edf0f7] overflow-hidden">
        <div className="border-b border-[#edf0f7] flex flex-wrap gap-0">
          {allTabs.map((tab) => {
            const tabLabels: Record<TabKey, string> = {
              overview: "Overview",
              fees: "Fees & Receipts",
              documents: "Documents & Certificates",
              certificates: "Certificates",
              attendance: "Attendance",
              exams: "Exams & Marks",
              history: "History"
            };
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
                {tab}
              </button>
            );
          })}
        </div>
        <div className="p-4 md:p-6">
          {activeTab === "overview" && <OverviewTab student={student} />}
          {activeTab === "fees" && <FeeLedgerTab student={student} data={data} />}
          {activeTab === "documents" && <DocumentsTab student={student} data={data} />}
          {activeTab === "certificates" && <CertificatesTab student={student} data={data} />}
          {activeTab === "attendance" && <AttendanceTab student={student} data={data} />}
          {activeTab === "exams" && <ExamsTab student={student} data={data} />}
          {activeTab === "history" && <HistoryTab student={student} data={data} />}
        </div>
      </div>
    </div>
  );
}
