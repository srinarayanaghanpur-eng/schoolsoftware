"use client";

import { useParams, useRouter, useSearchParams, notFound, usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
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
import { useAdminSession } from "@/components/AdminSessionContext";
import { hasPermission } from "@sri-narayana/shared";
import type { Permission } from "@sri-narayana/shared";
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

export default function StudentProfilePage() {
  const { studentId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { role, permissions, hasPermission: sessionHasPermission } = useAdminSession();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const canViewStudents = Boolean(role && hasPermission(role, "students.view"));
  const canEditStudent = Boolean(role && hasPermission(role, "students.edit"));
  const canViewFees = Boolean(role && hasPermission(role, "fees.view"));
  const canCreateFees = Boolean(role && hasPermission(role, "fees.create"));
  const canViewCertificates = Boolean(role && hasPermission(role, "certificates.view"));
  const canCreateCertificates = Boolean(role && hasPermission(role, "certificates.create"));

  const initialTab = (searchParams.get("tab") as TabKey) || "overview";

  useEffect(() => {
    if (!studentId) {
      setError("Missing student ID.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const result = await getStudentProfile(studentId as string);
        if (cancelled) return;
        if (!result.student) {
          setError("Student not found.");
          setLoading(false);
          return;
        }
        setData(result);
        setActiveTab(initialTab);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load student profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  if (loading) {
    return (
      <div className="p-4 md:p-7">
        <PageHeader title="Student Profile" description="Loading…" />
        <div className="card flex items-center justify-center p-16 text-sm font-medium text-[#7d86a8]">
          <Loader2 className="animate-spin mr-2 size-5" /> Loading student profile…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-7">
        <PageHeader title="Student Profile" description="" />
        <div className="card border-l-4 border-[#d84d5b] p-4 text-sm font-semibold text-[#d84d5b]">{error}</div>
        <button
          type="button"
          className="mt-3 btn-secondary"
          onClick={() => router.back()}
        >
          <ArrowLeft size={14} className="mr-1" /> Back
        </button>
      </div>
    );
  }

  if (!data || !data.student || !canViewStudents) {
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
    { label: studentName, href: pathname }
  ];

  const tabIsAllowed = (tab: TabKey): boolean => {
    switch (tab) {
      case "overview": return true;
      case "fees": return canViewFees;
      case "documents": return true;
      case "certificates": return canViewCertificates;
      case "attendance": return true;
      case "exams": return Boolean(role && hasPermission(role, "exams.view"));
      case "history": return true;
      default: return false;
    }
  };

  const allTabs: TabKey[] = Object.keys(TAB_LABELS) as TabKey[];
  const allowedTabs = allTabs.filter(tabIsAllowed);
  if (!allowedTabs.includes(activeTab)) setActiveTab(allowedTabs[0]);

  const actionButtons = (
    <div className="flex flex-wrap gap-2">
      {canEditStudent && (
        <Link
          href="/#"
          onClick={(e) => {
            e.preventDefault();
            router.push(`/admin/students/${className.toLowerCase()}`);
          }}
          className="btn-secondary"
        >
          <FileText size={14} className="mr-1" /> Edit Student
        </Link>
      )}
      {canCreateFees && (
        <button type="button" className="btn-primary">
          <CreditCard size={14} className="mr-1" /> Add Fee
        </button>
      )}
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

      <StudentProfileHeader student={student} canEdit={canEditStudent} />
      <SummaryCards data={data} canViewFees={canViewFees} />

      <div className="card border border-[#edf0f7] overflow-hidden">
        <div className="border-b border-[#edf0f7] flex flex-wrap gap-0">
          {allowedTabs.map((tab) => {
            const meta = TAB_LABELS[tab];
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
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
          {activeTab === "overview" && <OverviewTab student={student} canEdit={canEditStudent} />}
          {activeTab === "fees" && <FeeLedgerTab student={student} data={data} canViewFees={canViewFees} canCreateFees={canCreateFees} />}
          {activeTab === "documents" && <DocumentsTab student={student} data={data} />}
          {activeTab === "certificates" && <CertificatesTab student={student} data={data} canView={canViewCertificates} canCreate={canCreateCertificates} />}
          {activeTab === "attendance" && <AttendanceTab student={student} data={data} />}
          {activeTab === "exams" && <ExamsTab student={student} data={data} />}
          {activeTab === "history" && <HistoryTab student={student} data={data} />}
        </div>
      </div>
    </div>
  );
}
