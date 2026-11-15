"use client";

import { useEffect, useState, FormEvent } from "react";
import {
  Award,
  Printer,
  Plus,
  X,
  TrendingDown,
  RefreshCw,
  CalendarDays,
  UserRound,
  Sparkles
} from "lucide-react";
import { adminApiRequest } from "@/lib/adminApiClient";
import { openInternalRoute } from "@/lib/desktopBridge";
import { useAcademicYears } from "@/components/AcademicYearContext";

const CERTIFICATE_TYPES = [
  { id: "bonafide", label: "Bonafide Certificate" },
  { id: "studyConductDob", label: "Study, Conduct & DOB Certificate" },
  { id: "transfer", label: "Transfer Certificate" },
  { id: "character", label: "Character Certificate" },
  { id: "conduct", label: "Conduct Certificate" },
  { id: "general", label: "General Certificate" }
];

const typeLabel = (value: string) => CERTIFICATE_TYPES.find((type) => type.id === value)?.label || value;

type StudentCertificate = {
  id: string;
  certificateType: string;
  certificateNumber: string;
  studentName: string;
  className: string;
  section?: string;
  academicYearId: string;
  issueDate: string;
  template?: string;
  status: "draft" | "issued" | "cancelled";
  issuedBy?: string;
  issuedByName?: string;
  remarks?: string;
  createdAt: string;
  printCount?: number;
};

export function CertificatesTab({
  student,
  canView,
  canCreate,
  initialCertificates,
  onRefresh
}: {
  student: Record<string, unknown>;
  canView: boolean;
  canCreate: boolean;
  initialCertificates: Record<string, unknown>[];
  onRefresh: () => Promise<void>;
}) {
  const { years, selectedYear } = useAcademicYears();
  const [certificates, setCertificates] = useState<StudentCertificate[]>(
    () => initialCertificates as unknown as StudentCertificate[]
  );
  const [academicYearId, setAcademicYearId] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: "success" | "error" | null; text: string }>({ type: null, text: "" });

  const studentId = String(student.id || "");
  const studentYearId = String(student.academicYearId || student.academicYear || "");

  useEffect(() => {
    setCertificates(initialCertificates as unknown as StudentCertificate[]);
  }, [initialCertificates]);

  useEffect(() => {
    if (academicYearId) return;
    const match = years.find((year) => year.id === studentYearId || year.name === studentYearId);
    const selectedId = selectedYear?.id;
    if (match?.id) setAcademicYearId(match.id);
    else if (selectedId) setAcademicYearId(selectedId);
  }, [academicYearId, years, selectedYear, studentYearId]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "sriNarayana.certificatePrinted") void onRefresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [onRefresh]);

  const openIssue = () => {
    const match = years.find((year) => year.id === studentYearId || year.name === studentYearId);
    setAcademicYearId(match?.id || selectedYear?.id || "");
    setSubmitMessage({ type: null, text: "" });
    setIssueOpen(true);
  };

  const handleIssue = async (e: FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const certType = String(formData.get("certificateType") || "");

    if (!certType) {
      setSubmitMessage({ type: "error", text: "Select a certificate type." });
      return;
    }
    if (!academicYearId) {
      setSubmitMessage({ type: "error", text: "Select an academic year." });
      return;
    }

    setIssuing(true);
    setSubmitMessage({ type: null, text: "" });
    try {
      const result = await adminApiRequest<{ ok?: boolean; id?: string; certificateNumber?: string }>(
        "/api/admin/certificates",
        {
          method: "POST",
          body: JSON.stringify({
            studentId,
            certificateType: certType,
            academicYearId,
            studentName: String(student.studentName || ""),
            className: String(student.class || ""),
            section: String(student.section || ""),
            issueDate: new Date().toISOString().slice(0, 10),
            data: {
              studentName: String(student.studentName || ""),
              admissionNumber: String(student.admissionNumber || ""),
              className: String(student.class || ""),
              section: String(student.section || ""),
              dateOfBirth: String(student.dateOfBirth || ""),
              gender: String(student.gender || ""),
              bloodGroup: String(student.bloodGroup || ""),
              fatherName: String(student.fatherName || ""),
              motherName: String(student.motherName || ""),
              address: String(student.address || ""),
              phone: String(student.phone || ""),
              academicYear: String(years.find((year) => year.id === academicYearId)?.name || "")
            },
            status: "issued"
          })
        }
      );
      if (result.id) {
        const numberNote = result.certificateNumber ? ` Certificate No. ${result.certificateNumber}.` : "";
        setSubmitMessage({ type: "success", text: `Certificate issued successfully.${numberNote}` });
        setIssueOpen(false);
        form.reset();
        await onRefresh();
      } else {
        setSubmitMessage({ type: "error", text: "Failed to issue certificate." });
      }
    } catch (err) {
      setSubmitMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to issue certificate." });
    } finally {
      setIssuing(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "issued":
        return "bg-[#e6f8ef] text-[#0f8d52] border-[#d6f2e3] dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300";
      case "cancelled":
        return "bg-[#fff7f8] text-[#d84d5b] border-[#ffeaea] dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300";
      default:
        return "bg-[#fff7e6] text-[#ad7413] border-[#ffe0c7] dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300";
    }
  };

  if (!canView) {
    return (
      <div className="card p-8 text-center text-sm font-medium text-muted-foreground">
        <Award size={24} className="mx-auto mb-3 opacity-50" />
        <p>Certificate access is not available for your role.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
              <Award size={16} />
            </span>
            <h2 className="text-lg font-extrabold text-foreground">Certificates</h2>
          </div>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Issued certificates for {String(student.studentName || "this student")}
          </p>
        </div>
        {canCreate && (
          <button type="button" onClick={openIssue} className="btn-primary shrink-0">
            <Plus size={14} className="mr-1" /> Issue Certificate
          </button>
        )}
      </div>

      {certificates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
            <Award size={11} />
            {certificates.length} {certificates.length === 1 ? "certificate" : "certificates"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
            <Sparkles size={11} />
            Printable records
          </span>
        </div>
      )}

      {submitMessage.text && (
        <div
          className={`profile-rise rounded-xl border p-3 text-sm font-medium ${
            submitMessage.type === "success"
              ? "border-[#d6f2e3] bg-[#e6f8ef] text-[#0f8d52] dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "border-[#ffeaea] bg-[#fff7f8] text-[#d84d5b] dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300"
          }`}
        >
          {submitMessage.text}
        </div>
      )}

      {certificates.length === 0 && (
        <div className="profile-card-hover card p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <TrendingDown size={24} />
          </div>
          <p className="mt-4 text-sm font-bold text-foreground">No certificates issued yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs font-medium text-muted-foreground">
            Issue a bonafide, transfer or conduct certificate and it will appear here.
          </p>
        </div>
      )}

      {certificates.length > 0 && (
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {certificates.map((certificate) => {
            const printed = certificate.certificateType === "bonafide" && Number(certificate.printCount || 0) > 0;
            const issuedDate = certificate.issueDate
              ? new Date(certificate.issueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
              : "—";
            return (
              <article key={certificate.id} className="profile-card-hover card group relative overflow-hidden p-4">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-400 to-primary" aria-hidden="true" />
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                    <Award size={20} />
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-extrabold ${statusColor(certificate.status)}`}>
                    {certificate.status.charAt(0).toUpperCase() + certificate.status.slice(1)}
                  </span>
                </div>

                <h3 className="mt-4 text-sm font-extrabold leading-snug text-foreground">{typeLabel(certificate.certificateType)}</h3>
                <p className="mt-1 font-mono text-[11px] font-semibold text-primary">{certificate.certificateNumber}</p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-2.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <CalendarDays size={12} />
                      <span className="text-[9px] font-bold uppercase tracking-[0.1em]">Issued</span>
                    </div>
                    <p className="mt-1 truncate text-[11px] font-semibold text-foreground">{issuedDate}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-2.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <UserRound size={12} />
                      <span className="text-[9px] font-bold uppercase tracking-[0.1em]">Issued by</span>
                    </div>
                    <p className="mt-1 truncate text-[11px] font-semibold text-foreground" title={certificate.issuedByName || "—"}>
                      {certificate.issuedByName || "—"}
                    </p>
                  </div>
                </div>

                {certificate.remarks && (
                  <p className="mt-3 line-clamp-2 text-[10px] font-medium text-muted-foreground">{certificate.remarks}</p>
                )}

                <div className="mt-4 flex items-center border-t border-border pt-3">
                  {printed ? (
                    <span
                      className="btn-secondary inline-flex w-full cursor-not-allowed items-center justify-center opacity-50"
                      title="Bonafide already printed — print link expired"
                    >
                      <Printer size={12} className="mr-1" /> Printed
                    </span>
                  ) : (
                    <a
                      href={`/admin/student/${studentId}/certificate/${certificate.id}`}
                      onClick={(event) => {
                        event.preventDefault();
                        openInternalRoute(`/admin/student/${studentId}/certificate/${certificate.id}`);
                      }}
                      className="btn-secondary inline-flex w-full items-center justify-center"
                    >
                      <Printer size={12} className="mr-1" /> Print Certificate
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {issueOpen && canCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0f2e]/60 p-4 backdrop-blur-md"
          onClick={() => setIssueOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Issue certificate"
        >
          <div className="profile-panel relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/20">
                  <Award size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-foreground">Issue Certificate</h3>
                  <p className="text-[10px] font-medium text-muted-foreground">Create a printable student record</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIssueOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Close issue certificate dialog"
              >
                <X size={18} />
              </button>
            </div>

            {submitMessage.text && submitMessage.type === "error" && (
              <div className="mb-3 rounded-xl border border-[#ffeaea] bg-[#fff7f8] p-3 text-sm font-medium text-[#d84d5b] dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
                {submitMessage.text}
              </div>
            )}

            <form onSubmit={handleIssue} className="space-y-4">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Certificate Type</label>
                <select name="certificateType" required className="field">
                  <option value="">Select type</option>
                  {CERTIFICATE_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Academic Year</label>
                {years.length > 0 ? (
                  <select
                    value={academicYearId}
                    onChange={(event) => setAcademicYearId(event.target.value)}
                    required
                    className="field"
                  >
                    <option value="">Select academic year</option>
                    {years.map((year) => (
                      <option key={year.id} value={year.id}>{year.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-[#ffeaea] bg-[#fff7f8] p-3 text-xs font-medium text-[#d84d5b] dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
                    <RefreshCw size={14} /> No academic years are configured. Ask an administrator to create one.
                  </div>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Certificate number is auto-generated from the admission number (e.g. SNHS/SCD/2026/
                  {String(student.admissionNumber || "1001")}).
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button type="button" onClick={() => setIssueOpen(false)} disabled={issuing} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={issuing || !academicYearId} className="btn-primary">
                  {issuing ? "Issuing…" : "Issue Certificate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
