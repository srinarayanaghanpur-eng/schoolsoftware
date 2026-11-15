"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Edit2, Printer, QrCode, ReceiptText, Sparkles, X } from "lucide-react";
import { useAdminSession } from "@/components/AdminSessionContext";
import { usePopup } from "@/components/CenterPopup";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";
import { classIdToSlug } from "@/lib/studentClasses";

const primaryAction =
  "group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-[#5751b8] px-4 text-sm font-extrabold text-primary-foreground shadow-[0_10px_24px_-12px_hsl(var(--primary)/0.8)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-14px_hsl(var(--primary)/0.9)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2";

const secondaryAction =
  "group inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-extrabold text-foreground shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-accent hover:text-accent-foreground active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2";

const dangerAction =
  "group inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-extrabold text-rose-700 transition duration-200 hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-100 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 focus-visible:ring-offset-2 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15";

export function StudentProfileActions({
  student,
  onRefresh
}: {
  student: Record<string, unknown>;
  onRefresh: () => Promise<void>;
}) {
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
  const canCollectFees = hasPermission("fees.create");

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
      await onRefresh();
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
      await onRefresh();
    } catch (err) {
      popup.error("Failed to restore student", err instanceof AdminApiError ? err.message : undefined);
    }
  };

  return (
    <>
      <section aria-label="Student actions" className="card relative overflow-hidden p-3 md:p-4">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-[#7c6cf0] to-[#c084fc]" aria-hidden="true" />
        <div className="mb-3 flex items-center gap-2 px-1">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sparkles size={14} />
          </div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
            Quick Actions
          </p>
          <span className="ml-auto hidden text-[10px] font-medium text-muted-foreground sm:block">
            Manage this student record
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <button type="button" onClick={openEdit} className={primaryAction}>
              <Edit2 size={16} className="transition-transform duration-200 group-hover:-rotate-6" />
              Edit
            </button>
          )}
          {canCollectFees && (
            <Link
              href={`/admin/payments?studentId=${encodeURIComponent(studentId)}&collect=1`}
              className={primaryAction}
            >
              <ReceiptText size={16} className="transition-transform duration-200 group-hover:scale-110" />
              Fee Collect
            </Link>
          )}
          <Link href={`/admin/admission-form/${encodeURIComponent(studentId)}`} className={secondaryAction}>
            <Printer size={16} className="transition-transform duration-200 group-hover:translate-y-0.5" />
            Admission Form
          </Link>
          <button type="button" onClick={() => setShowQr(true)} className={secondaryAction}>
            <QrCode size={16} className="transition-transform duration-200 group-hover:rotate-6" />
            QR Code
          </button>
          <span className="hidden flex-1 sm:block" />
          {canArchive && !isArchived && (
            <button type="button" onClick={() => void archive()} className={dangerAction}>
              <Archive size={16} />
              Archive
            </button>
          )}
          {canArchive && isArchived && (
            <button type="button" onClick={() => void restore()} className={dangerAction}>
              <ArchiveRestore size={16} />
              Restore
            </button>
          )}
        </div>
      </section>

      {showQr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0f2e]/60 p-4 backdrop-blur-md"
          onClick={() => setShowQr(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Student QR code"
        >
          <div
            className="profile-panel relative w-full max-w-xs rounded-3xl border border-border bg-card p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowQr(false)}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Close QR code"
            >
              <X size={16} />
            </button>
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-[#5751b8] text-white shadow-lg shadow-primary/25">
              <QrCode size={22} />
            </div>
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="Student QR Code" className="mx-auto rounded-2xl border border-border p-2" />
            ) : (
              <div className="profile-skeleton mx-auto grid h-[160px] w-[160px] place-items-center rounded-2xl text-xs font-semibold text-muted-foreground">
                Generating…
              </div>
            )}
            <div className="mt-4">
              <p className="text-sm font-bold text-foreground">{studentName}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">Scan to open student details</p>
            </div>
            <button type="button" onClick={() => setShowQr(false)} className="btn-primary mt-5 w-full">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
