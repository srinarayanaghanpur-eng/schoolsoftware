"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  Download,
  X,
  Files,
  Sparkles
} from "lucide-react";
import { uploadFile } from "@/lib/uploadService";
import { adminApiRequest } from "@/lib/adminApiClient";

const DOCUMENT_TYPES = [
  "Birth Certificate",
  "Previous School Transfer Certificate",
  "Previous School Marks Sheet",
  "Student Photograph",
  "Admission Form",
  "Parent/Guardian Document",
  "Caste Certificate",
  "Income Certificate",
  "Scholarship Document",
  "Medical / Emergency Document",
  "Other"
];

type StoredDocument = {
  name?: string;
  url?: string;
  type?: string;
  academicYear?: string;
  uploadedAt?: string;
};

type StudentDocument = {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: string;
  academicYear?: string;
  uploadedBy?: string;
  verificationStatus: "pending" | "verified" | "rejected";
  verificationRemarks?: string;
};

export function DocumentsTab({
  student,
  canEdit,
  onRefresh
}: {
  student: Record<string, unknown>;
  canEdit: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<{ type: "success" | "error" | null; text: string }>({ type: null, text: "" });

  const studentId = String(student.id || "");
  const documentURLs = useMemo<StoredDocument[]>(
    () => (Array.isArray(student.documentURLs) ? (student.documentURLs as StoredDocument[]) : []),
    [student.documentURLs]
  );

  useEffect(() => {
    setDocuments(
      documentURLs
        .map((doc, index) => ({ doc, index }))
        .filter(({ doc }) => Boolean(doc?.url))
        .map(({ doc, index }) => ({
          id: `doc-${index}`,
          name: String(doc.name || "Document"),
          type: String(doc.type || "Other"),
          url: String(doc.url),
          uploadedAt: String(doc.uploadedAt || student.updatedAt || student.createdAt || ""),
          academicYear: doc.academicYear ? String(doc.academicYear) : undefined,
          uploadedBy: "System",
          verificationStatus: "pending" as const
        }))
    );
    setLoading(false);
  }, [documentURLs, student.updatedAt, student.createdAt]);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const file = formData.get("file") as File | null;
    const docType = String(formData.get("docType") || "Other");
    const academicYear = String(formData.get("academicYear") || "");

    if (!file) {
      setSubmitMessage({ type: "error", text: "Select a file to upload." });
      return;
    }

    setUploading(true);
    setSubmitMessage({ type: null, text: "" });

    try {
      const dataUrl = await uploadFile(
        file,
        `students/${String(student.admissionNumber || studentId)}/documents/${file.name}`
      );

      const updated = [
        ...documentURLs,
        {
          name: file.name,
          type: docType,
          url: dataUrl,
          academicYear,
          uploadedAt: new Date().toISOString()
        }
      ];

      await adminApiRequest<{ success?: boolean }>(`/api/admin/students/${studentId}`, {
        method: "PATCH",
        body: JSON.stringify({ documentURLs: updated })
      });

      setSubmitMessage({ type: "success", text: `Document "${file.name}" uploaded successfully.` });
      setUploadOpen(false);
      form.reset();
      await onRefresh();
    } catch (err) {
      setSubmitMessage({ type: "error", text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!canEdit || deletingId) return;
    if (!window.confirm("Remove this document? This cannot be undone.")) return;

    const index = Number(docId.replace("doc-", ""));
    if (!Number.isInteger(index) || index < 0 || index >= documentURLs.length) return;

    setDeletingId(docId);
    setSubmitMessage({ type: null, text: "" });
    try {
      const updated = documentURLs.filter((_, i) => i !== index);
      await adminApiRequest<{ success?: boolean }>(`/api/admin/students/${studentId}`, {
        method: "PATCH",
        body: JSON.stringify({ documentURLs: updated })
      });
      await onRefresh();
    } catch (err) {
      setSubmitMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to delete document." });
    } finally {
      setDeletingId(null);
    }
  };

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url) || url.startsWith("data:image/");
  const imageCount = documents.filter((doc) => isImage(doc.url)).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Files size={16} />
            </span>
            <h2 className="text-lg font-extrabold text-foreground">Documents</h2>
          </div>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Uploaded documents for {String(student.studentName || "this student")}
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setUploadOpen(true)} className="btn-primary shrink-0">
            <Upload size={14} className="mr-1" /> Upload Document
          </button>
        )}
      </div>

      {documents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
            <Files size={11} />
            {documents.length} {documents.length === 1 ? "file" : "files"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
            <ImageIcon size={11} />
            {imageCount} {imageCount === 1 ? "image" : "images"}
          </span>
        </div>
      )}

      {!canEdit && (
        <div className="card flex items-center gap-3 border-dashed p-3 text-xs font-medium text-muted-foreground">
          <Sparkles size={15} className="shrink-0 text-primary" />
          You can view documents but not upload or remove them.
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

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="profile-skeleton h-40 rounded-2xl" />
          ))}
        </div>
      )}

      {!loading && documents.length === 0 && (
        <div className="profile-card-hover card p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <FileText size={24} />
          </div>
          <p className="mt-4 text-sm font-bold text-foreground">No documents uploaded yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs font-medium text-muted-foreground">
            Upload birth certificates, transfer certificates, photographs and other student records here.
          </p>
        </div>
      )}

      {!loading && documents.length > 0 && (
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {documents.map((doc) => {
            const statusColor =
              doc.verificationStatus === "verified"
                ? "text-[#0f8d52] bg-[#e6f8ef] dark:bg-emerald-500/10 dark:text-emerald-300"
                : doc.verificationStatus === "rejected"
                  ? "text-[#d84d5b] bg-[#fff7f8] dark:bg-rose-500/10 dark:text-rose-300"
                  : "text-[#ad7413] bg-[#fff7e6] dark:bg-amber-500/10 dark:text-amber-300";
            const uploaded = doc.uploadedAt ? new Date(doc.uploadedAt) : null;
            const uploadedLabel = uploaded && !Number.isNaN(uploaded.getTime())
              ? uploaded.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
              : "—";
            const image = isImage(doc.url);
            return (
              <article key={doc.id} className="profile-card-hover card group relative overflow-hidden p-4">
                <div className={`absolute inset-x-0 top-0 h-1 ${image ? "bg-gradient-to-r from-primary to-[#7c6cf0]" : "bg-gradient-to-r from-violet-500 to-fuchsia-400"}`} aria-hidden="true" />
                <div className="flex items-start gap-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={doc.url}
                        alt={doc.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-primary/10 text-primary">
                        <FileText size={24} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground" title={doc.name}>{doc.name}</p>
                        <p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">{doc.type}</p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-extrabold ${statusColor}`}>
                        {doc.verificationStatus.charAt(0).toUpperCase() + doc.verificationStatus.slice(1)}
                      </span>
                    </div>
                    <p className="mt-2 text-[10px] font-medium text-muted-foreground">
                      Uploaded {uploadedLabel}
                      {doc.academicYear ? ` · ${doc.academicYear}` : ""}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary flex-1 text-xs"
                  >
                    <Download size={13} className="mr-1" /> Open
                  </a>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(doc.id)}
                      disabled={deletingId === doc.id}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#d84d5b] transition hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-500/10"
                      aria-label={`Delete ${doc.name}`}
                    >
                      {deletingId === doc.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {uploadOpen && canEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0f2e]/60 p-4 backdrop-blur-md"
          onClick={() => setUploadOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Upload document"
        >
          <div className="profile-panel relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-[#5751b8] text-white shadow-lg shadow-primary/20">
                  <Upload size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-foreground">Upload Document</h3>
                  <p className="text-[10px] font-medium text-muted-foreground">Add a record to this student profile</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Close upload dialog"
              >
                <X size={18} />
              </button>
            </div>

            {submitMessage.text && submitMessage.type === "error" && (
              <div className="mb-3 rounded-xl border border-[#ffeaea] bg-[#fff7f8] p-3 text-sm font-medium text-[#d84d5b] dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
                {submitMessage.text}
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">File</label>
                <input type="file" name="file" required className="field" />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Images (JPG, PNG) up to 480px; PDFs and other files up to 500KB.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Document Type</label>
                <select name="docType" required className="field">
                  <option value="">Select type</option>
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Academic Year</label>
                <input type="text" name="academicYear" className="field" placeholder="e.g. 2026-27" />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button type="button" onClick={() => setUploadOpen(false)} disabled={uploading} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={uploading} className="btn-primary">
                  {uploading ? "Uploading…" : "Upload Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
