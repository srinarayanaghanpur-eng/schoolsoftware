import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { incomeCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";

const COLLECTION = "incomes";

// GET /api/admin/finance/incomes — non-fee income entries (latest first, capped).
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const pageSize = readLimit(searchParams.get("limit") ?? searchParams.get("pageSize"), 50, 200);
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";

  let query: FirebaseFirestore.Query = adminDb().collection(COLLECTION);
  if (dateFrom) query = query.where("createdAt", ">=", new Date(dateFrom));
  if (dateTo) query = query.where("createdAt", "<=", new Date(`${dateTo}T23:59:59.999`));
  const snap = await query.orderBy("createdAt", "desc").limit(pageSize).get();
  logFirestoreRead("FinanceIncomesAPI", COLLECTION, snap, { dateFrom, dateTo, pageSize });
  const incomes = snap.docs.map((d) => serializeDoc(d));
  return NextResponse.json({ ok: true, incomes, truncated: snap.size === pageSize });
}

// POST /api/admin/finance/incomes
export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const parsed = incomeCreateSchema.parse(await req.json());
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({
      ...parsed,
      transactionType: "income",
      voucherType: "receipt",
      createdBy: token.uid,
      createdAt: now,
      updatedAt: now
    });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record income";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
