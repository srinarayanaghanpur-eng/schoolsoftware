import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { academicYearCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

const COLLECTION = "academic_years";

// GET /api/admin/academic-years — list all years (newest first), active flagged.
export async function GET(req: Request) {
  const token = await requirePermission(req, "academic_years.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const snapshot = await adminDb().collection(COLLECTION).orderBy("startDate", "desc").get();
  const years = snapshot.docs.map((doc) => serializeDoc(doc));
  return NextResponse.json({ ok: true, years });
}

// POST /api/admin/academic-years — create a year. Only admin/principal may write.
export async function POST(req: Request) {
  const token = await requirePermission(req, "academic_years.view");
  if (!token || (token.role !== "admin" && token.role !== "principal" && token.role !== "super_admin")) {
    return NextResponse.json({ ok: false, error: "Admin or principal access required" }, { status: 403 });
  }

  try {
    const parsed = academicYearCreateSchema.parse(await req.json());
    const db = adminDb();

    // Names are unique.
    const existing = await db.collection(COLLECTION).where("name", "==", parsed.name).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json({ ok: false, error: "An academic year with that name already exists" }, { status: 400 });
    }

    const now = FieldValue.serverTimestamp();
    const ref = await db.collection(COLLECTION).add({
      name: parsed.name,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      isActive: Boolean(parsed.isActive),
      createdAt: now,
      updatedAt: now
    });

    // If this one is active, deactivate the others (only one active year).
    if (parsed.isActive) {
      const others = await db.collection(COLLECTION).where("isActive", "==", true).get();
      const batch = db.batch();
      others.docs.forEach((doc) => {
        if (doc.id !== ref.id) batch.update(doc.ref, { isActive: false, updatedAt: now });
      });
      await batch.commit();
    }

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create academic year";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
