"use client";

import { useEffect, useState, FormEvent } from "react";
import { Award, RefreshCw, Printer, Plus, X, TrendingDown } from "lucide-react";
import { adminApiRequest } from "@/lib/adminApiClient";

const typeLabel = (value: string) => CERTIFICATE_TYPES.find((t) => t.id === value)?.label || value;

const CERTIFICATE_TYPES = [
  { id: "bonafide", label: "Bonafide Certificate" },
  { id: "studyConductDob", label: "Study, Conduct & DOB Certificate" },
  { id: "transfer", label: "Transfer Certificate" },
  { id: "character", label: "Character Certificate" },
  { id: "conduct", label: "Conduct Certificate" },
  { id: "general", label: "General Certificate" }
];

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
};

export function CertificatesTab({
  student,
  data,
  canView,
  canCreate
}: {
  student: Record<string, unknown>;
  data: Record<string, unknown> | null;
  canView: boolean;
  canCreate: boolean;
}) {
  const [certificates, setCertificates] = useState<StudentCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: "success" | "error" | null; text: string }>({ type: null, text: "" });

  const studentId = String(student.id || "");

  useEffect(() => {
    loadCertificates();
  }, [studentId]);

  const loadCertificates = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminApiRequest<{ ok?: boolean; certificates?: StudentCertificate[] }>(
        `/api/admin/certificates?studentId=${encodeURIComponent(studentId)}&pageSize=50`
      );
      setCertificates(result.certificates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load certificates.");
    } finally {
      setLoading(false);
    }
  };

  const handleIssue = async (e: FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const certType = String(formData.get("certificateType") || "");
    const academicYear = String(formData.get("academicYear") || "");

    if (!certType) {
      setSubmitMessage({ type: "error", text: "Select a certificate type." });
      return;
    }
    if (!academicYear) {
      setSubmitMessage({ type: "error", text: "Select an academic year." });
      return;
    }

    setIssuing(true);
    try {
      const result = await adminApiRequest<{ ok?: boolean; id?: string; certificateNumber?: string }>(
        "/api/admin/certificates",
        {
          method: "POST",
          body: JSON.stringify({
            studentId,
            certificateType: certType,
            academicYearId: academicYear,
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
              academicYear
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
        await loadCertificates();
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
      case "issued": return "bg-[#e6f8ef] text-[#0f8d52] border-[#d6f2e3]";
      case "cancelled": return "bg-[#fff7f8] text-[#d84d5b] border-[#ffeaea]";
      default: return "bg-[#fff7e6] text-[#ad7413] border-[#ffe0c7]";
    }
  };

  if (!canView) {
    return (
      <div className="card p-8 text-center text-sm font-medium text-[#7d86a8]">
        <Award size={24} className="mx-auto mb-3 opacity-50" />
        <p>Certificate access is not available for your role.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-[#1f2136]">Certificates</h2>
          <p className="text-sm font-medium text-[#7d86a8]">Issued and uploaded certificates for {String(student.studentName || "this student")}</p>
        </div>
        {canCreate && (
          <button type="button" onClick={() => setIssueOpen(true)} className="btn-primary shrink-0">
            <Plus size={14} className="mr-1" /> Issue Certificate
          </button>
        )}
      </div>

      {error && (
        <div className="card border-l-4 border-[#d84d5b] p-3 text-sm font-semibold text-[#d84d5b]">{error}</div>
      )}

      {submitMessage.text && (
        <div className={`mb-3 p-3 rounded-lg text-sm font-medium ${
          submitMessage.type === "success" ? "bg-[#e6f8ef] text-[#0f8d52] border border-[#d6f2e3]" : "bg-[#fff7f8] text-[#d84d5b] border border-[#ffeaea]"
        }`}>
          {submitMessage.text}
        </div>
      )}

      {loading && (
        <div className="card flex items-center justify-center p-8 text-sm font-medium text-[#7d86a8]">
          <RefreshCw size={20} className="animate-spin mr-2" /> Loading certificates…
        </div>
      )}

      {!loading && certificates.length === 0 && (
        <div className="card p-8 text-center text-sm font-medium text-[#7d86a8]">
          <TrendingDown size={24} className="mx-auto mb-3 opacity-50" />
          <p>No certificates issued yet.</p>
        </div>
      )}

      {!loading && certificates.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#edf0f7] bg-[#f7f8fd]">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Certificate</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Number</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Issued By</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Issue Date</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map((c) => (
                <tr key={c.id} className="border-b border-[#f2f4fb] last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#eef0ff] text-[#3033a1]">
                        <Award size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#1f2136]">{typeLabel(c.certificateType)}</p>
                        <p className="text-[10px] text-[#7d86a8]">{c.studentName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-[#303247]">{c.certificateNumber}</td>
                  <td className="px-4 py-3 text-xs text-[#5a6488]">{c.issuedByName || "—"}</td>
                  <td className="px-4 py-3 text-xs text-[#5a6488]">{new Date(c.issueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor(c.status)}`}>
                      {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/admin/student/${studentId}/certificate/${c.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary inline-flex shrink-0 items-center"
                    >
                      <Printer size={12} className="mr-1" /> Print
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {issueOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setIssueOpen(false)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIssueOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-[#1f2136]">Issue Certificate</h3>
              <button type="button" onClick={() => setIssueOpen(false)} className="rounded-lg hover:bg-[#f4f5fb]">
                <X size={18} />
              </button>
            </div>

            {submitMessage.text && (
              <div className={`mb-3 p-3 rounded-lg text-sm font-medium ${
                submitMessage.type === "success" ? "bg-[#e6f8ef] text-[#0f8d52] border border-[#d6f2e3]" : "bg-[#fff7f8] text-[#d84d5b] border border-[#ffeaea]"
              }`}>
                {submitMessage.text}
              </div>
            )}

            <form onSubmit={handleIssue} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7d86a8] mb-1">Certificate Type</label>
                <select name="certificateType" required className="field">
                  <option value="">Select type</option>
                  {CERTIFICATE_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7d86a8] mb-1">Academic Year</label>
                <input type="text" name="academicYear" required className="field" placeholder="e.g. 2026-27" />
                <p className="mt-1 text-[10px] text-[#7d86a8]">
                  Certificate number is auto-generated from the admission number (e.g. SNHS/SCD/2026/
                  {String(student.admissionNumber || "1001")}).
                </p>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button type="button" onClick={() => setIssueOpen(false)} disabled={issuing} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={issuing} className="btn-primary">
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
