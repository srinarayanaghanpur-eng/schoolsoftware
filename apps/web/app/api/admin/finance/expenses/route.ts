import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, requirePermission, serializeDoc } from "@/lib/apiUtils";
import { createDebitVoucherFromExpense } from "@/lib/debitVoucherService";

const COLLECTION = "expenses";

// GET /api/admin/finance/expenses?status=&category=
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  let query: FirebaseFirestore.Query = adminDb().collection(COLLECTION);
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  if (status) query = query.where("status", "==", status);
  else if (category) query = query.where("category", "==", category);

  // Hard read cap so the query cost stays bounded as the collection grows
  // (protects the Firestore free-tier daily read quota). Raise/paginate if a
  // school ever exceeds this many expense records in scope.
  const snap = await query.limit(500).get();
  const expenses = snap.docs
    .map((d) => serializeDoc(d))
    .filter((expense) => (!status || expense.status === status) && (!category || expense.category === category))
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  return NextResponse.json({ ok: true, expenses });
}

// POST /api/admin/finance/expenses — record an expense (starts as "pending").
export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const result = await createDebitVoucherFromExpense(await req.json(), token, { expenseStatus: "pending" });
    return NextResponse.json({ ok: true, id: result.expenseId, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error, "Unable to record expense") }, { status: 400 });
  }
}
