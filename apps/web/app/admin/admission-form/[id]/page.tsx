"use client";

import { ArrowLeft, Printer, Download, Pencil, FileDown } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { auth } from "@sri-narayana/shared/firebase/client";
import { useAdmissionData } from "./useAdmissionData";
import { AdmissionPrintSheet } from "./AdmissionPrintSheet";
import AdmissionPrintStyles from "./AdmissionPrintStyles";
import { resolveValue } from "./formatters";
import { classIdToSlug } from "@/lib/studentClasses";

export default function AdmissionFormPage() {
  const params = useParams();
  const router = useRouter();

  const { student, loading, error, lookupsLoaded, resolved, printedAt } = useAdmissionData();
  const [downloading, setDownloading] = useState(false);

  const handleDownloadDocx = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please sign in again.");
      const response = await fetch(`/api/admin/admission-form/${params.id}/docx`, {
        headers: { authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error((result as { error?: string }).error ?? "Download failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Admission-${resolveValue(student?.admissionNumber) || params.id}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };


  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    // Browser print-to-PDF: set a meaningful filename, then restore.
    const previousTitle = document.title;
    const admissionNo = resolveValue(student?.admissionNumber) || params.id;
    document.title = `Admission-${admissionNo}`;
    try {
      window.print();
    } finally {
      window.setTimeout(() => {
        document.title = previousTitle;
      }, 500);
    }
  };

  const handleEdit = () => {
    const classId = resolveValue(student?.class);
    if (!classId) {
      router.push(`/admin/students?edit=${params.id}`);
      return;
    }
    router.push(`/admin/students/${classIdToSlug(classId)}?edit=${params.id}`);
  };

  if (loading || !lookupsLoaded) {
    return (
      <div className="af-loading">
        <div className="af-loading-spinner" />
        <span>Loading admission form...</span>
      </div>
    );
  }

  if (error || !student || !resolved) {
    return (
      <div className="af-loading">
        <p className="af-error-text">{error || "Student not found"}</p>
        <button
          onClick={() => router.push("/admin/students")}
          className="af-back-btn"
        >
          ← Back to Students
        </button>
      </div>
    );
  }

  const r = resolved;

  return (
    <div className="af-page-root">
      {/* Fixed Action Bar */}
      <div className="af-action-bar">
        <button
          onClick={() => router.push("/admin/students")}
          className="af-action-btn af-action-back"
        >
          <ArrowLeft size={16} />
          <span>Back to Students</span>
        </button>

        <div className="af-action-right">
          <button onClick={handleEdit} className="af-action-btn af-action-edit">
            <Pencil size={16} />
            <span>Edit Student</span>
          </button>
          <button
            onClick={handlePrint}
            className="af-action-btn af-action-print"
          >
            <Printer size={16} />
            <span>Print</span>
          </button>
          <button
            onClick={handleDownloadPDF}
            className="af-action-btn af-action-download"
          >
            <Download size={16} />
            <span>Download PDF</span>
          </button>
          <button
            onClick={handleDownloadDocx}
            disabled={downloading}
            className="af-action-btn af-action-download"
          >
            <FileDown size={16} />
            <span>{downloading ? "Preparing…" : "Download DOCX"}</span>
          </button>
        </div>
      </div>

      {/* A4 Sheet */}
      <AdmissionPrintSheet r={r} student={student} printedAt={printedAt} />

      <AdmissionPrintStyles />
    </div>
  );
}
