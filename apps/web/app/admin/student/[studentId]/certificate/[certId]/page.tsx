"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { CertificatePrintView } from "@/components/student-profile/CertificatePrintView";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";

type PrintPayload = {
  ok: true;
  certificate: Record<string, unknown>;
  student: Record<string, unknown>;
};

export default function CertificatePrintPage() {
  const params = useParams<{ studentId: string; certId: string }>();
  const studentId = String(params?.studentId || "");
  const certId = String(params?.certId || "");
  const [payload, setPayload] = useState<PrintPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId || !certId) return;
    let cancelled = false;
    setError("");
    setPayload(null);
    (async () => {
      try {
        const result = await adminApiRequest<PrintPayload>(
          `/api/admin/certificates/${encodeURIComponent(certId)}/print`,
          undefined,
          { fresh: true }
        );
        if (cancelled) return;
        if (String(result.certificate.studentId || "") !== studentId) {
          setError("Certificate not found for this student.");
          return;
        }
        setPayload(result);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof AdminApiError
            ? err.status === 403
              ? "You do not have permission to print certificates."
              : err.message
            : "Failed to load certificate."
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, certId]);

  if (error) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <div className="card w-full max-w-md p-6 text-center">
          <ShieldAlert size={28} className="mx-auto mb-3 text-[#d84d5b]" aria-hidden="true" />
          <h1 className="text-lg font-extrabold text-foreground">Certificate unavailable</h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground">{error}</p>
          <Link href={`/admin/student/${studentId}?tab=certificates`} className="btn-primary mt-5 inline-flex">
            Back to Certificates
          </Link>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <div className="card flex items-center gap-3 px-5 py-4 text-sm font-semibold text-muted-foreground">
          <RefreshCw size={18} className="animate-spin" aria-hidden="true" />
          Loading certificate…
        </div>
      </div>
    );
  }

  const certificate = payload.certificate;
  const isPrintedBonafide =
    String(certificate.certificateType || "") === "bonafide" && Number(certificate.printCount || 0) > 0;

  if (isPrintedBonafide) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <div className="card w-full max-w-md p-6 text-center">
          <h1 className="text-lg font-extrabold text-foreground">Certificate link expired</h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            This bonafide certificate has already been printed. The print link cannot be used again. Issue a new
            certificate if a reprint is required.
          </p>
          <Link href={`/admin/student/${studentId}?tab=certificates`} className="btn-primary mt-5 inline-flex">
            Back to Certificates
          </Link>
        </div>
      </div>
    );
  }

  return <CertificatePrintView student={payload.student} certificate={certificate} />;
}
