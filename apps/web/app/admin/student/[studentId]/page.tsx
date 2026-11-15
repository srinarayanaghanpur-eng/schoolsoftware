"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Info,
  RefreshCw,
  ShieldAlert,
  LayoutDashboard,
  FileText,
  Award,
  GraduationCap,
  History as HistoryIcon,
  CalendarCheck
} from "lucide-react";
import { StudentProfileHeader } from "@/components/student-profile/StudentProfileHeader";
import { StudentProfileActions } from "@/components/student-profile/StudentProfileActions";
import { SummaryCards } from "@/components/student-profile/SummaryCards";
import { OverviewTab } from "@/components/student-profile/OverviewTab";
import { DocumentsTab } from "@/components/student-profile/DocumentsTab";
import { CertificatesTab } from "@/components/student-profile/CertificatesTab";
import { AttendanceTab } from "@/components/student-profile/AttendanceTab";
import { ExamsTab } from "@/components/student-profile/ExamsTab";
import { HistoryTab } from "@/components/student-profile/HistoryTab";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";
import { CLASS_LABELS, classIdToSlug } from "@/lib/studentClasses";
import { useRefreshOnFocus } from "@/lib/useRefreshOnFocus";

type TabKey = "overview" | "documents" | "certificates" | "exams" | "history" | "attendance";

const TAB_LABELS: Record<TabKey, string> = {
  overview: "Overview",
  documents: "Documents",
  certificates: "Certificates",
  exams: "Exams & Marks",
  history: "History",
  attendance: "Attendance"
};

const TAB_ICONS = {
  overview: LayoutDashboard,
  documents: FileText,
  certificates: Award,
  exams: GraduationCap,
  history: HistoryIcon,
  attendance: CalendarCheck
};

const ALL_TABS: TabKey[] = ["overview", "documents", "certificates", "exams", "history", "attendance"];

type FeeSummary = {
  originalFee: number;
  payableFee: number;
  concession: number;
  paid: number;
  due: number;
  status: "paid" | "partial" | "pending";
};

type ProfilePermissions = {
  canViewFees: boolean;
  canViewCertificates: boolean;
  canCreateCertificate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canCollectFees: boolean;
  canViewExams: boolean;
};

type ProfileResponse = {
  ok: true;
  student: Record<string, unknown>;
  academicYear: { id: string; label: string };
  permissions: ProfilePermissions;
  feeSummary: FeeSummary | null;
  payments: Record<string, unknown>[];
  receipts: Record<string, unknown>[];
  certificates: Record<string, unknown>[];
  examMarks: Record<string, unknown>[];
  auditLogs: Record<string, unknown>[];
};

function normalizeTab(value: string | string[] | undefined): TabKey {
  const tab = typeof value === "string" ? value : "";
  return ALL_TABS.includes(tab as TabKey) ? (tab as TabKey) : "overview";
}

export default function StudentProfilePage({
  params,
  searchParams
}: {
  params: { studentId: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const studentId = params.studentId;
  const [activeTab, setActiveTab] = useState<TabKey>(() => normalizeTab(searchParams?.tab));
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (silent = false) => {
      if (!studentId) return;
      if (!silent) setLoading(true);
      setError("");
      try {
        const result = await adminApiRequest<ProfileResponse>(
          `/api/admin/students/${encodeURIComponent(studentId)}/profile`,
          undefined,
          { fresh: true }
        );
        setData(result);
      } catch (err) {
        const message =
          err instanceof AdminApiError
            ? err.status === 403
              ? "You do not have permission to view this student."
              : err.status === 404
                ? "Student not found."
                : err.message
            : "Failed to load student profile.";
        if (!silent) setError(message);
        else console.warn("[student-profile] background refresh failed:", message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [studentId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useRefreshOnFocus(() => load(true));

  if (loading) {
    return (
      <div className="space-y-5 p-4 md:p-7" aria-busy="true" aria-label="Loading student profile">
        <div className="profile-skeleton h-6 w-56 rounded-full" />
        <div className="profile-skeleton h-48 rounded-[1.75rem]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="profile-skeleton h-32 rounded-2xl" />
          ))}
        </div>
        <div className="profile-skeleton h-72 rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    const isForbidden = error.includes("permission");
    return (
      <div className="space-y-4 p-4 md:p-7">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs font-semibold text-muted-foreground">
          <Link
            href="/admin/students"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 shadow-sm transition hover:-translate-y-0.5 hover:text-primary"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            Students
          </Link>
        </nav>
        <div className="profile-panel card relative overflow-hidden border-l-4 border-[#d84d5b] p-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-rose-400/10 blur-3xl" aria-hidden="true" />
          <div className="relative flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-[#d84d5b] dark:bg-rose-500/10">
              <ShieldAlert size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#d84d5b]">{error || "Failed to load student profile."}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {isForbidden
                  ? "Ask an administrator to grant the students.view permission."
                  : "Check your connection and try again."}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => void load()}>
            <RefreshCw size={14} className="mr-1" /> Retry
          </button>
          <Link href="/admin/students" className="btn-secondary">
            Back to Students
          </Link>
        </div>
      </div>
    );
  }

  const { student, permissions } = data;
  const studentName = String(student.studentName || "");
  const className = String(student.class || "");
  const status = String(student.status || "active");
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const classLabel = className && CLASS_LABELS[className] ? CLASS_LABELS[className] : "";
  const visibleTabs = ALL_TABS.filter((tab) => {
    if (tab === "certificates") return permissions.canViewCertificates;
    if (tab === "exams") return permissions.canViewExams;
    return true;
  });
  const effectiveTab = visibleTabs.includes(activeTab) ? activeTab : "overview";

  return (
    <div className="space-y-5 p-4 md:p-7">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Link
          href="/admin/students"
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:text-primary"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          Students
        </Link>
        {classLabel && (
          <>
            <ChevronRight size={12} className="opacity-50" aria-hidden="true" />
            <Link
              href={`/admin/students/${classIdToSlug(className)}`}
              className="rounded-full px-2 py-1 transition hover:bg-muted hover:text-primary"
            >
              {classLabel}
            </Link>
          </>
        )}
        <ChevronRight size={12} className="opacity-50" aria-hidden="true" />
        <span className="max-w-[16rem] truncate rounded-full bg-muted px-2.5 py-1 text-foreground" aria-current="page">
          {studentName}
        </span>
      </nav>

      <StudentProfileHeader student={student} />
      <StudentProfileActions student={student} onRefresh={() => load(true)} />

      {status !== "active" && (
        <div className="profile-rise flex items-start gap-3 overflow-hidden rounded-2xl border border-warning/35 bg-gradient-to-r from-warning/15 via-warning/5 to-transparent p-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning">
            <Info size={17} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Student status: {statusLabel}</p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              Some actions may be restricted while the student is {status}.
            </p>
          </div>
        </div>
      )}

      {permissions.canViewFees ? (
        <SummaryCards data={data} />
      ) : (
        <div className="card flex items-center gap-3 border-dashed p-4 text-sm font-medium text-muted-foreground">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <ShieldAlert size={16} aria-hidden="true" />
          </div>
          Fee details are hidden for your role.
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-border bg-card/80 p-2 backdrop-blur">
          <nav aria-label="Student profile sections" className="flex gap-1.5 overflow-x-auto pb-0.5">
            {visibleTabs.map((tab) => {
              const isActive = effectiveTab === tab;
              const Icon = TAB_ICONS[tab];
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  aria-current={isActive ? "page" : undefined}
                  className={`profile-tab ${isActive ? "profile-tab-active" : ""}`}
                >
                  <Icon size={15} className={isActive ? "text-white" : "text-muted-foreground"} aria-hidden="true" />
                  {TAB_LABELS[tab]}
                </button>
              );
            })}
          </nav>
        </div>
        <div key={effectiveTab} className="profile-panel p-4 md:p-6">
          {effectiveTab === "overview" && <OverviewTab student={student} />}
          {effectiveTab === "documents" && (
            <DocumentsTab
              student={student}
              canEdit={permissions.canEdit}
              onRefresh={() => load(true)}
            />
          )}
          {effectiveTab === "certificates" && (
            <CertificatesTab
              student={student}
              canView={permissions.canViewCertificates}
              canCreate={permissions.canCreateCertificate}
              initialCertificates={data.certificates}
              onRefresh={() => load(true)}
            />
          )}
          {effectiveTab === "attendance" && <AttendanceTab student={student} />}
          {effectiveTab === "exams" && <ExamsTab student={student} marks={data.examMarks} />}
          {effectiveTab === "history" && <HistoryTab student={student} logs={data.auditLogs} />}
        </div>
      </div>
    </div>
  );
}
