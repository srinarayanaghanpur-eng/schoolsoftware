import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { expenseCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

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
    const parsed = expenseCreateSchema.parse(await req.json());
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({ ...parsed, status: "pending", createdBy: token.uid, createdAt: now, updatedAt: now });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record expense";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
