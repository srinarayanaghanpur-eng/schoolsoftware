import { notFound } from "next/navigation";
import { adminDb } from "@/lib/firebaseAdmin";
import { CertificatePrintView } from "@/components/student-profile/CertificatePrintView";

function toPlain(value: unknown): unknown {
  if (value && typeof value === "object" && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toPlain(v);
    return out;
  }
  return value;
}

export default async function CertificatePrintPage({
  params
}: {
  params: { studentId: string; certId: string };
}) {
  const db = adminDb();

  const certSnap = await db.collection("certificates").doc(params.certId).get();
  if (!certSnap.exists) notFound();

  const certificate = { id: certSnap.id, ...(toPlain(certSnap.data()) as Record<string, unknown>) } as Record<string, unknown>;
  if (String(certificate.studentId || "") !== params.studentId) notFound();

  const studentSnap = await db.collection("students").doc(params.studentId).get();
  if (!studentSnap.exists) notFound();

  const student = { id: studentSnap.id, ...(toPlain(studentSnap.data()) as Record<string, unknown>) } as Record<string, unknown>;

  return <CertificatePrintView student={student} certificate={certificate} />;
}
