import { FieldValue } from "firebase-admin/firestore";
import { certificateUpdateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { writeAuditLog } from "@/lib/auditLog";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";

const COLLECTION = "certificates";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "certificates.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const snap = await adminDb().collection(COLLECTION).doc(params.id).get();
  if (!snap.exists) return json({ ok: false, error: "Certificate not found" }, { status: 404 });
  return json({ ok: true, certificate: serializeDoc(snap as FirebaseFirestore.QueryDocumentSnapshot) });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "certificates.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = certificateUpdateSchema.parse(await req.json());
    const ref = adminDb().collection(COLLECTION).doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return json({ ok: false, error: "Certificate not found" }, { status: 404 });

    const before = snap.data() as Record<string, unknown>;
    await ref.update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });

    const studentId = String(before.studentId || "");
    if (studentId) {
      const status = parsed.status || before.status;
      try {
        await writeAuditLog({
          action: status === "cancelled" ? "certificate.cancelled" : "certificate.updated",
          entityType: "student",
          entityId: studentId,
          actorId: token.uid,
          actorRole: String((token as { role?: string }).role || "admin"),
          oldValues: {
            status: before.status,
            certificateNumber: before.certificateNumber,
          },
          newValues: {
            status,
            certificateNumber: parsed.certificateNumber || before.certificateNumber,
          },
          reason:
            status === "cancelled"
              ? `Certificate ${before.certificateNumber} cancelled`
              : `Certificate ${before.certificateNumber} updated`,
          academicYearId: String(before.academicYearId || ""),
        });
      } catch (auditError) {
        console.error("[certificates] audit log failed:", auditError);
      }
    }

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "certificates.delete");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const ref = adminDb().collection(COLLECTION).doc(params.id);
  const snap = await ref.get();
  const before = snap.exists ? (snap.data() as Record<string, unknown>) : null;

  await ref.delete();

  const studentId = String(before?.studentId || "");
  if (studentId) {
    try {
      await writeAuditLog({
        action: "certificate.deleted",
        entityType: "student",
        entityId: studentId,
        actorId: token.uid,
        actorRole: String((token as { role?: string }).role || "admin"),
        oldValues: {
          certificateNumber: before?.certificateNumber,
          certificateType: before?.certificateType,
        },
        reason: `Certificate ${before?.certificateNumber} deleted`,
        academicYearId: String(before?.academicYearId || ""),
      });
    } catch (auditError) {
      console.error("[certificates] audit log failed:", auditError);
    }
  }

  return json({ ok: true });
}
