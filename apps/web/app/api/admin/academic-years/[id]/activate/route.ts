import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireRole } from "@/lib/apiUtils";

const COLLECTION = "academic_years";

// POST /api/admin/academic-years/[id]/activate — make this the single active year.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = await requireRole(req, ["super_admin"]);
  if (!token) return NextResponse.json({ ok: false, error: "Super admin access required" }, { status: 403 });

  const db = adminDb();
  const ref = db.collection(COLLECTION).doc(params.id);
  if (!(await ref.get()).exists) {
    return NextResponse.json({ ok: false, error: "Academic year not found" }, { status: 404 });
  }

  const now = FieldValue.serverTimestamp();
  const active = await db.collection(COLLECTION).where("isActive", "==", true).get();
  const batch = db.batch();
  active.docs.forEach((doc) => {
    if (doc.id !== params.id) batch.update(doc.ref, { isActive: false, updatedAt: now });
  });
  batch.update(ref, { isActive: true, updatedAt: now });
  await batch.commit();

  return NextResponse.json({ ok: true });
}
