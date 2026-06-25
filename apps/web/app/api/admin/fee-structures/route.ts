import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { feeStructureCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

const COLLECTION = "fee_structures";

// GET /api/admin/fee-structures?academicYearId=&className=
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const academicYearId = searchParams.get("academicYearId");
  const className = searchParams.get("className");

  let query: FirebaseFirestore.Query = adminDb().collection(COLLECTION);
  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  if (className) query = query.where("className", "==", className);

  const snapshot = await query.get();
  const structures = snapshot.docs.map((doc) => serializeDoc(doc));
  return NextResponse.json({ ok: true, structures });
}

// POST /api/admin/fee-structures — create class-wise fee structure (total computed).
export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = feeStructureCreateSchema.parse(await req.json());
    const total = parsed.heads.reduce((sum, h) => sum + h.amount, 0);
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({ ...parsed, total, createdAt: now, updatedAt: now });
    return NextResponse.json({ ok: true, id: ref.id, total });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create fee structure";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
