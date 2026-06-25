import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { examCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

const COLLECTION = "exams";

// GET /api/admin/exams?academicYearId=&className= — list exams (optionally filtered).
export async function GET(req: Request) {
  const token = await requirePermission(req, "exams.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const academicYearId = searchParams.get("academicYearId");
  const className = searchParams.get("className");

  let query: FirebaseFirestore.Query = adminDb().collection(COLLECTION);
  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  if (className) query = query.where("className", "==", className);

  const snapshot = await query.get();
  const exams = snapshot.docs
    .map((doc) => serializeDoc(doc))
    .sort((a, b) => String(b.startDate ?? "").localeCompare(String(a.startDate ?? "")));
  return NextResponse.json({ ok: true, exams });
}

// POST /api/admin/exams — create an exam.
export async function POST(req: Request) {
  const token = await requirePermission(req, "exams.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = examCreateSchema.parse(await req.json());
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({ ...parsed, createdAt: now, updatedAt: now });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create exam";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
