import { FieldValue } from "firebase-admin/firestore";
import { academicYearCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireRole, json } from "@/lib/apiUtils";

const COLLECTION = "academic_years";

// PATCH /api/admin/academic-years/[id] — edit name/dates.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const token = await requireRole(req, ["super_admin", "settings_manager"]);
  if (!token) return json({ ok: false, error: "Super admin or settings manager access required" }, { status: 403 });

  try {
    const parsed = academicYearCreateSchema.partial().parse(await req.json());
    const ref = adminDb().collection(COLLECTION).doc(params.id);
    if (!(await ref.get()).exists) {
      return json({ ok: false, error: "Academic year not found" }, { status: 404 });
    }
    await ref.update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update academic year";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

// DELETE /api/admin/academic-years/[id] — cannot delete the active year.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const token = await requireRole(req, ["super_admin", "settings_manager"]);
  if (!token) return json({ ok: false, error: "Super admin access required" }, { status: 403 });

  const ref = adminDb().collection(COLLECTION).doc(params.id);
  const snap = await ref.get();
  if (!snap.exists) return json({ ok: false, error: "Academic year not found" }, { status: 404 });
  if (snap.data()?.isActive) {
    return json({ ok: false, error: "Cannot delete the active academic year. Activate another year first." }, { status: 400 });
  }
  await ref.delete();
  return json({ ok: true });
}

