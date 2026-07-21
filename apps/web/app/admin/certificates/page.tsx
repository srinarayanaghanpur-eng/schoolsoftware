"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";
import { hasPermission, formatLabel } from "@sri-narayana/shared";
import { Plus, X, Search, Download, FileText, Eye, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type Certificate = {
  id: string;
  certificateType: string;
  certificateNumber: string;
  studentId: string;
  studentName: string;
  className: string;
  section?: string;
  issueDate: string;
  status: string;
  issuedByName?: string;
  remarks?: string;
};

const CERT_TYPES = [
  { value: "transfer", label: "Transfer Certificate" },
  { value: "character", label: "Character Certificate" },
  { value: "bonafide", label: "Bonafide Certificate" },
  { value: "conduct", label: "Conduct Certificate" },
  { value: "general", label: "General Certificate" },
];

const typeStyles: Record<string, string> = {
  transfer: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  character: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  bonafide: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  conduct: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  general: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

const statusStyles: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  issued: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const emptyForm = {
  certificateType: "bonafide",
  certificateNumber: "",
  studentId: "",
  studentName: "",
  className: "",
  section: "",
  issueDate: new Date().toISOString().slice(0, 10),
  template: "default",
  data: "",
  issuedByName: "",
  remarks: "",
};

export default function CertificatesPage() {
  const { role } = useAdminSession();
  const { years, selectedYear } = useAcademicYears();

  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedYear?.id) params.set("academicYearId", selectedYear.id);
      if (typeFilter) params.set("type", typeFilter);
      if (statusFilter) params.set("status", statusFilter);
      const data = await adminApiRequest<{ certificates: Certificate[] }>(`/api/admin/certificates?${params}`);
      setCertificates(data.certificates || []);
    } catch {
      setCertificates([]);
    } finally {
      setLoading(false);
    }
  }, [selectedYear?.id, typeFilter, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data: Record<string, unknown> = { ...form };
      data.academicYearId = selectedYear?.id || "";
      if (form.data) {
        try { data.data = JSON.parse(form.data); } catch { data.data = { content: form.data }; }
      } else {
        data.data = {};
      }
      await adminApiRequest("/api/admin/certificates", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setShowForm(false);
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to create");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this certificate record?")) return;
    try {
      await adminApiRequest(`/api/admin/certificates/${id}`, { method: "DELETE" });
      await load();
    } catch {
      setError("Failed to delete");
    }
  };

  const markIssued = async (id: string) => {
    try {
      await adminApiRequest(`/api/admin/certificates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "issued" }),
      });
      await load();
    } catch {
      setError("Failed to issue");
    }
  };

  const filtered = certificates.filter(
    (c) =>
      !search ||
      c.studentName.toLowerCase().includes(search.toLowerCase()) ||
      c.certificateNumber.toLowerCase().includes(search.toLowerCase()) ||
      c.className.includes(search)
  );

  if (!hasPermission(role, "certificates.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-red-500">Access denied.</div></section>;
  }

  return (
    <>
      <PageHeader title="Certificates" description="Issue and manage student certificates" />

      <section className="space-y-4 p-4 md:p-7">
        {error && (
          <div className="card border-l-4 border-l-red-500 p-4 text-sm font-semibold text-red-500">{error}</div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input className="field !pl-9" placeholder="Search by name, no., class..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="field w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              {CERT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select className="field w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          {hasPermission(role, "certificates.create") && (
            <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? <X size={16} /> : <Plus size={16} />} Issue Certificate
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-semibold">Certificate Type
              <select className="field mt-1" required value={form.certificateType} onChange={(e) => setForm({ ...form, certificateType: e.target.value })}>
                {CERT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Certificate #
              <input className="field mt-1" required value={form.certificateNumber} onChange={(e) => setForm({ ...form, certificateNumber: e.target.value })} placeholder="TC-2025-001" />
            </label>
            <label className="text-sm font-semibold">Issue Date
              <input className="field mt-1" type="date" required value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
            </label>
            <label className="text-sm font-semibold">Student Name
              <input className="field mt-1" required value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} />
            </label>
            <label className="text-sm font-semibold">Student ID
              <input className="field mt-1" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} placeholder="Admission number" />
            </label>
            <label className="text-sm font-semibold">Class
              <input className="field mt-1" required value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} placeholder="10" />
            </label>
            <label className="text-sm font-semibold">Section
              <input className="field mt-1" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="A" />
            </label>
            <label className="text-sm font-semibold">Issued By
              <input className="field mt-1" value={form.issuedByName} onChange={(e) => setForm({ ...form, issuedByName: e.target.value })} placeholder="Principal Name" />
            </label>
            <label className="text-sm font-semibold">Template
              <select className="field mt-1" value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })}>
                <option value="default">Default</option>
                <option value="detailed">Detailed</option>
              </select>
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-sm font-semibold">Additional Data (JSON)
                <textarea className="field mt-1 font-mono text-xs" rows={3} value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} placeholder='{"fatherName":"Raju","motherName":"Geeta","dob":"2010-05-15","address":"123 Main St"}' />
              </label>
            </div>
            <label className="text-sm font-semibold">Remarks
              <input className="field mt-1" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </label>
            <div className="flex items-end justify-end gap-3 sm:col-span-2 lg:col-span-3">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Issue Certificate"}</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted-foreground">
            {certificates.length === 0 ? "No certificates issued yet." : "No certificates match your filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Certificate #</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Issue Date</th>
                  <th className="px-4 py-3">Issued By</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-t border-border hover:bg-secondary/20">
                    <td className="px-4 py-3 font-mono text-xs font-bold">{c.certificateNumber}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${typeStyles[c.certificateType] || ""}`}>
                        {formatLabel(c.certificateType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{c.studentName}</td>
                    <td className="px-4 py-3 text-muted-foreground">Class {c.className}{c.section ? `-${c.section}` : ""}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.issueDate}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.issuedByName || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusStyles[c.status] || ""}`}>
                        {formatLabel(c.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {c.status === "draft" && hasPermission(role, "certificates.edit") && (
                          <button
                            onClick={() => markIssued(c.id)}
                            className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20"
                          >
                            <Eye size={12} className="inline" /> Issue
                          </button>
                        )}
                        {hasPermission(role, "certificates.delete") && (
                          <button onClick={() => remove(c.id)} className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
