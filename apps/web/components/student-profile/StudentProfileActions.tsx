"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Edit2, Printer, QrCode, ReceiptText } from "lucide-react";
import { useAdminSession } from "@/components/AdminSessionContext";
import { usePopup } from "@/components/CenterPopup";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";
import { classIdToSlug } from "@/lib/studentClasses";

const actionButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-extrabold text-primary-foreground shadow-sm transition hover:bg-primary/90 hover:shadow-md active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2";

export function StudentProfileActions({ student }: { student: Record<string, unknown> }) {
  const { hasPermission } = useAdminSession();
  const router = useRouter();
  const popup = usePopup();
  const [showQr, setShowQr] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const studentId = String(student.id || "");
  const studentName = String(student.studentName || "Student");
  const admissionNumber = String(student.admissionNumber || student.admissionNo || "");
  const className = String(student.class || "");
  const status = String(student.status || "active");
  const isArchived = status === "archived";
  const canEdit = hasPermission("students.edit") && Boolean(className);
  const canArchive = hasPermission("students.delete");
  const canViewFees = hasPermission("fees.view");

  useEffect(() => {
    if (!showQr) return;
    let cancelled = false;
    setQrUrl(null);
    (async () => {
      try {
        const issued = await adminApiRequest<{ ok: true; token: string; expiresInMs: number }>(
          "/api/student-qr",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ studentId })
          }
        );
        const QRCode = (await import("qrcode")).default;
        const dataUrl = await QRCode.toDataURL(
          `${window.location.origin}/student-qr?t=${encodeURIComponent(issued.token)}`,
          { width: 240, margin: 1 }
        );
        if (!cancelled) setQrUrl(dataUrl);
      } catch (err) {
        if (!cancelled) {
          popup.error(
            "Could not generate QR code",
            err instanceof AdminApiError ? err.message : "Please try again."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showQr, studentId, popup]);

  const openEdit = () => {
    router.push(`/admin/students/${classIdToSlug(className)}?edit=${encodeURIComponent(studentId)}`);
  };

  const archive = async () => {
    if (!canArchive) return;
    const ok = await popup.confirm(
      `Archive ${studentName}?`,
      `${admissionNumber} will leave the active list. All history (fees, attendance, marks) is kept and they can be restored.`,
      { okLabel: "Archive", danger: false }
    );
    if (!ok) return;
    try {
      await adminApiRequest(`/api/admin/students/${studentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "archived" })
      });
      popup.success("Student archived. History preserved.");
      router.refresh();
    } catch (err) {
      popup.error("Failed to archive student", err instanceof AdminApiError ? err.message : undefined);
    }
  };

  const restore = async () => {
    if (!canArchive) return;
    try {
      await adminApiRequest(`/api/admin/students/${studentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "active" })
      });
      popup.success("Student restored to the active list.");
      router.refresh();
    } catch (err) {
      popup.error("Failed to restore student", err instanceof AdminApiError ? err.message : undefined);
    }
  };

  return (
    <>
      <section aria-label="Student actions" className="card p-3 md:p-4">
        <p className="mb-2 px-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
          Quick Actions
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <button type="button" onClick={openEdit} className={actionButton}>
              <Edit2 size={16} />
              Edit
            </button>
          )}
          {canViewFees && (
            <Link href={`/admin/payments?studentId=${encodeURIComponent(studentId)}`} className={actionButton}>
              <ReceiptText size={16} />
              Fee Receipts
            </Link>
          )}
          <Link href={`/admin/admission-form/${encodeURIComponent(studentId)}`} className={actionButton}>
            <Printer size={16} />
            Admission Form
          </Link>
          <button type="button" onClick={() => setShowQr(true)} className={actionButton}>
            <QrCode size={16} />
            QR Code
          </button>
          <span className="hidden flex-1 sm:block" />
          {canArchive && !isArchived && (
            <button type="button" onClick={() => void archive()} className={actionButton}>
              <Archive size={16} />
              Archive
            </button>
          )}
          {canArchive && isArchived && (
            <button type="button" onClick={() => void restore()} className={actionButton}>
              <ArchiveRestore size={16} />
              Restore
            </button>
          )}
        </div>
      </section>

      {showQr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowQr(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-card p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="Student QR Code" className="mx-auto" />
            ) : (
              <div className="mx-auto grid h-[160px] w-[160px] place-items-center rounded-xl bg-muted text-xs font-semibold text-muted-foreground">
                Generating…
              </div>
            )}
            <div className="mt-3">
              <p className="text-sm font-bold text-foreground">{studentName}</p>
              <p className="text-xs font-medium text-muted-foreground">Scan to open student details</p>
            </div>
            <button type="button" onClick={() => setShowQr(false)} className="btn-primary mt-4 w-full">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
