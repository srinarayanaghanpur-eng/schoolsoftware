import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ShieldX, ArrowLeft } from "lucide-react";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Certificate Verification",
  robots: { index: false, follow: false }
};

const TYPE_LABELS: Record<string, string> = {
  transfer: "Transfer Certificate",
  character: "Character Certificate",
  bonafide: "Bonafide Certificate",
  conduct: "Conduct Certificate",
  general: "General Certificate",
  studyConductDob: "Study, Conduct & Date of Birth Certificate"
};

function formatDate(value: string) {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!iso) return value;
  const date = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function VerifyCertificatePage({ params }: { params: { certNo: string[] } }) {
  const certNo = (params.certNo || []).join("/").trim();

  let certificate: Record<string, unknown> | null = null;
  if (certNo) {
    try {
      const snap = await adminDb()
        .collection("certificates")
        .where("certificateNumber", "==", certNo)
        .limit(1)
        .get();
      if (!snap.empty) certificate = snap.docs[0].data() as Record<string, unknown>;
    } catch {
      certificate = null;
    }
  }

  const status = String(certificate?.status || "");
  const valid = Boolean(certificate) && status !== "cancelled";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className={`flex items-center gap-3 p-5 ${valid ? "bg-emerald-600" : "bg-rose-600"} text-white`}>
          {valid ? <ShieldCheck size={28} /> : <ShieldX size={28} />}
          <div>
            <h1 className="text-lg font-extrabold">
              {valid ? "Certificate Verified" : certificate ? "Certificate Cancelled" : "Certificate Not Found"}
            </h1>
            <p className="text-xs opacity-90">Sri Narayana High School · Ghanpur, Jayashankar Bhupalpally</p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {certificate && valid ? (
            <dl className="divide-y divide-slate-100 text-sm">
              <div className="flex justify-between gap-4 py-2">
                <dt className="font-semibold text-slate-500">Certificate No.</dt>
                <dd className="text-right font-mono font-bold text-slate-800">{String(certificate.certificateNumber || certNo)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="font-semibold text-slate-500">Type</dt>
                <dd className="text-right font-bold text-slate-800">
                  {TYPE_LABELS[String(certificate.certificateType || "")] || String(certificate.certificateType || "-")}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="font-semibold text-slate-500">Student Name</dt>
                <dd className="text-right font-bold text-slate-800">{String(certificate.studentName || "-")}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="font-semibold text-slate-500">Class</dt>
                <dd className="text-right font-bold text-slate-800">
                  {String(certificate.className || "-")}
                  {certificate.section ? `-${String(certificate.section)}` : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="font-semibold text-slate-500">Issue Date</dt>
                <dd className="text-right font-bold text-slate-800">{formatDate(String(certificate.issueDate || ""))}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-600">
              {certificate
                ? "This certificate has been cancelled by the school and is no longer valid."
                : "No certificate matches this number. Check the number on the certificate and scan the QR code again."}
            </p>
          )}

          <p className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
            This page verifies certificates issued by Sri Narayana High School, Ghanpur. Contact the school office for
            any discrepancy.
          </p>

          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:underline">
            <ArrowLeft size={14} /> Back to NarayanaOS
          </Link>
        </div>
      </div>
    </main>
  );
}
