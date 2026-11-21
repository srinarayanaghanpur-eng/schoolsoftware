import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, json, requirePermission } from "@/lib/apiUtils";
import { isStudentRecordKind, STUDENT_RECORD_META, STUDENT_RECORD_SCHEMAS } from "@/lib/studentRecords";

export async function PATCH(req: Request, { params }: { params: { kind: string; id: string } }) {
  if (!isStudentRecordKind(params.kind)) return json({ ok: false, error: "Unknown record kind" }, { status: 404 });
  const meta = STUDENT_RECORD_META[params.kind];

  const auth = await requirePermission(req, "students.edit");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = STUDENT_RECORD_SCHEMAS[params.kind].partial().parse(await req.json());
    const ref = adminDb().collection(meta.collection).doc(params.id);
    if (!(await ref.get()).exists) return json({ ok: false, error: "Not found" }, { status: 404 });
    await ref.update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to update record") }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { kind: string; id: string } }) {
  if (!isStudentRecordKind(params.kind)) return json({ ok: false, error: "Unknown record kind" }, { status: 404 });
  const meta = STUDENT_RECORD_META[params.kind];

  const auth = await requirePermission(req, "students.edit");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    await adminDb().collection(meta.collection).doc(params.id).delete();
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to delete record") }, { status: 500 });
  }
}
