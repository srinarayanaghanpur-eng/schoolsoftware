import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";

const COLLECTION = "certificates";

type PrintResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * GET /api/admin/certificates/[id]/print
 * Authenticated payload for the certificate print view. The print page itself
 * is a client component so it can send the Firebase bearer token; this route
 * replaces the previous unauthenticated server-side data read.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "certificates.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const db = adminDb();
  const certSnap = await db.collection(COLLECTION).doc(params.id).get();
  if (!certSnap.exists) {
    return json({ ok: false, error: "Certificate not found" }, { status: 404 });
  }

  const certificate = serializeDoc(certSnap as unknown as FirebaseFirestore.QueryDocumentSnapshot);
  const studentId = String(certificate.studentId || "");
  if (!studentId) {
    return json({ ok: false, error: "Certificate has no linked student" }, { status: 404 });
  }

  const studentSnap = await db.collection("students").doc(studentId).get();
  if (!studentSnap.exists) {
    return json({ ok: false, error: "Student not found" }, { status: 404 });
  }

  const student = serializeDoc(studentSnap as unknown as FirebaseFirestore.QueryDocumentSnapshot);
  return json({ ok: true, certificate, student });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "certificates.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const db = adminDb();
  const ref = db.collection(COLLECTION).doc(params.id);

  try {
    const result: PrintResult = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        return { ok: false, status: 404, error: "Certificate not found" };
      }

      const data = snap.data() as Record<string, unknown>;
      const isBonafide = String(data.certificateType || "") === "bonafide";
      const printCount = Number(data.printCount || 0);

      if (isBonafide && printCount > 0) {
        return {
          ok: false,
          status: 409,
          error: "This bonafide certificate was already printed. Its print link is no longer valid."
        };
      }

      tx.update(ref, {
        printCount: FieldValue.increment(1),
        printedAt: FieldValue.serverTimestamp(),
        printedByUserId: token.uid,
        printedBy: String(token.email || token.name || ""),
        updatedAt: FieldValue.serverTimestamp()
      });

      return { ok: true };
    });

    if (!result.ok) return json({ ok: false, error: result.error }, { status: result.status });
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed to mark print" }, { status: 500 });
  }
}
