"use client";

import { ArrowLeft, Printer, Download, Pencil } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useAdmissionData } from "./useAdmissionData";
import { AdmissionPrintSheet } from "./AdmissionPrintSheet";
import AdmissionPrintStyles from "./AdmissionPrintStyles";
import { resolveValue } from "./formatters";

export default function AdmissionFormPage() {
  const params = useParams();
  const router = useRouter();

  const { student, loading, error, lookupsLoaded, resolved, printedAt } = useAdmissionData();


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
    router.push(`/admin/students?id=${params.id}&edit=1`);
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
        </div>
      </div>

      {/* A4 Sheet */}
      <AdmissionPrintSheet r={r} student={student} printedAt={printedAt} />

      <AdmissionPrintStyles />
    </div>
  );
}
