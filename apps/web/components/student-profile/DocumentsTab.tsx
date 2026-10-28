"use client";

import { useEffect, useState, FormEvent } from "react";
import {
  Upload,
  FileText,
  Image,
  Trash2,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Download,
  X
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
  data
}: {
  student: Record<string, unknown>;
  data: Record<string, unknown> | null;
}) {
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: "success" | "error" | null; text: string }>({ type: null, text: "" });

  const studentId = String(student.id || "");
  const documentURLs = (student.documentURLs as Array<{ name: string; url: string }>) || [];

  useEffect(() => {
    setDocuments(
      documentURLs.map((d, i) => ({
        id: `doc-${i}`,
        name: d.name || "Document",
        type: "Other",
        url: d.url,
        uploadedAt: String(student.updatedAt || student.createdAt || ""),
        uploadedBy: "System",
        verificationStatus: "pending"
      }))
    );
    setLoading(false);
  }, [student, documentURLs]);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const file = formData.get("file") as File;
    const docType = String(formData.get("docType") || "Other");
    const academicYear = String(formData.get("academicYear") || "");

    if (!file) {
      setSubmitMessage({ type: "error", text: "Select a file to upload." });
      return;
    }

    setUploading(true);
    setSubmitMessage({ type: null, text: "" });

    try {
      const dataUrl = await uploadFile(file, `students/${String(student.admissionNumber || studentId)}/documents/${file.name}`);

      const newDoc = {
        name: file.name,
        type: docType,
        url: dataUrl,
        academicYear,
        uploadedAt: new Date().toISOString()
      };

      const updated = [...documentURLs, newDoc];

      const result = await adminApiRequest<{ success?: boolean; data?: any }>(
        `/api/admin/students/${studentId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ documentURLs: updated })
        }
      );

      if (result.success) {
        setSubmitMessage({ type: "success", text: `Document "${file.name}" uploaded successfully.` });
        setUploadOpen(false);
        form.reset();
        setDocuments((prev) => [
          ...prev,
          {
            id: `doc-${Date.now()}`,
            name: file.name,
            type: docType,
            url: dataUrl,
            uploadedAt: new Date().toISOString(),
            uploadedBy: "Current User",
            verificationStatus: "pending"
          }
        ]);
      } else {
        setSubmitMessage({ type: "error", text: "Failed to save document record." });
      }
    } catch (err) {
      setSubmitMessage({ type: "error", text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Remove this document? This cannot be undone.")) return;
    const docIndex = documentURLs.findIndex((d) => `doc-${documentURLs.indexOf(d)}` === docId);
    if (docIndex < 0) return;
    const updated = documentURLs.filter((_, i) => i !== docIndex);
    try {
      await adminApiRequest<{ success?: boolean }>(
        `/api/admin/students/${studentId}`,
        { method: "PATCH", body: JSON.stringify({ documentURLs: updated }) }
      );
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setSubmitMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to delete document." });
    }
  };

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-[#1f2136]">Documents & Certificates</h2>
          <p className="text-sm font-medium text-[#7d86a8]">Uploaded documents for {String(student.studentName || "this student")}</p>
        </div>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="btn-primary shrink-0"
        >
          <Upload size={14} className="mr-1" /> Upload Document
        </button>
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
          <RefreshCw size={20} className="animate-spin mr-2" /> Loading documents…
        </div>
      )}

      {!loading && documents.length === 0 && (
        <div className="card p-8 text-center text-sm font-medium text-[#7d86a8]">
          <FileText size={24} className="mx-auto mb-3 opacity-50" />
          <p>No documents uploaded yet.</p>
        </div>
      )}

      {!loading && documents.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#edf0f7] bg-[#f7f8fd]">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Document</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Type</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Uploaded</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const statusColor = doc.verificationStatus === "verified" ? "text-[#0f8d52] bg-[#e6f8ef]" : doc.verificationStatus === "rejected" ? "text-[#d84d5b] bg-[#fff7f8]" : "text-[#ad7413] bg-[#fff7e6]";
                return (
                  <tr key={doc.id} className="border-b border-[#f2f4fb] last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`grid h-8 w-8 place-items-center rounded-lg ${isImage(doc.url) ? "bg-[#eef0ff] text-[#3033a1]" : "bg-[#f4f5fb] text-[#5a6488]"}`}>
                          {isImage(doc.url) ? <Image size={14} /> : <FileText size={14} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[#1f2136] truncate" title={doc.name}>{doc.name}</p>
                          <p className="text-[10px] text-[#7d86a8]">{new Date(doc.uploadedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5a6488]">{doc.type}</td>
                    <td className="px-4 py-3 text-xs text-[#5a6488]">{new Date(doc.uploadedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor}`}>
                        {doc.verificationStatus.charAt(0).toUpperCase() + doc.verificationStatus.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                        <Download size={12} className="mr-1" /> Download
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        className="ml-2 text-[10px] font-semibold text-[#d84d5b] hover:bg-[#ffeaea] rounded-lg px-2 py-1"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setUploadOpen(false)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setUploadOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-[#1f2136]">Upload Document</h3>
              <button type="button" onClick={() => setUploadOpen(false)} className="rounded-lg hover:bg-[#f4f5fb]">
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

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7d86a8] mb-1">File</label>
                <input type="file" name="file" required className="field" />
                <p className="mt-1 text-[10px] text-[#7d86a8]">Images (JPG, PNG) up to 480px; PDFs and other files up to 500KB.</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7d86a8] mb-1">Document Type</label>
                <select name="docType" required className="field">
                  <option value="">Select type</option>
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7d86a8] mb-1">Academic Year</label>
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
