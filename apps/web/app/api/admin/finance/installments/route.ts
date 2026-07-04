import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { installmentPlanCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

const COLLECTION = "installment_plans";

// GET /api/admin/finance/installments?studentId=
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  let query: FirebaseFirestore.Query = adminDb().collection(COLLECTION);
  const studentId = searchParams.get("studentId");
  if (studentId) query = query.where("studentId", "==", studentId);

  // Hard read cap to keep query cost bounded (Firestore free-tier quota).
  const snap = await query.orderBy("createdAt", "desc").limit(500).get();
  const plans = snap.docs.map((d) => serializeDoc(d));
  return NextResponse.json({ ok: true, plans });
}

// POST /api/admin/finance/installments — create a new installment plan.
export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = installmentPlanCreateSchema.parse(await req.json());
    const now = FieldValue.serverTimestamp();

    const studentSnap = await adminDb().collection("students").doc(parsed.studentId).get();
    const studentName = String(studentSnap.data()?.studentName ?? "");

    const doc = {
      ...parsed,
      studentName,
      paidAmount: 0,
      createdBy: token.uid,
      createdAt: now,
      updatedAt: now
    };

    const ref = await adminDb().collection(COLLECTION).add(doc);
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create installment plan";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
