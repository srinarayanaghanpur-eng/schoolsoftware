import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, requirePermission, serializeDoc, json } from "@/lib/apiUtils";
import { docCursor, readLimit } from "@/lib/firestoreReadLogger";
import { createDebitVoucherFromExpense } from "@/lib/debitVoucherService";

const COLLECTION = "expenses";

// GET /api/admin/finance/expenses?status=&category=&pageSize=&cursor=
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  let query: FirebaseFirestore.Query = adminDb().collection(COLLECTION);
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  if (status) query = query.where("status", "==", status);
  else if (category) query = query.where("category", "==", category);

  // Paginated newest-first path (no filters — where + orderBy would need a
  // composite index). Filtered callers keep the legacy bounded scan.
  if (!status && !category) {
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 50, 200);
    const cursor = docCursor(searchParams.get("cursor"));
    let paged = query.orderBy("date", "desc");
    if (cursor) {
      const cursorDoc = await adminDb().collection(COLLECTION).doc(cursor).get();
      if (cursorDoc.exists) paged = paged.startAfter(cursorDoc);
    }
    const snap = await paged.limit(pageSize + 1).get();
    const hasMore = snap.docs.length > pageSize;
    const expenses = snap.docs.slice(0, pageSize).map((d) => serializeDoc(d));
    return json({
      ok: true,
      expenses,
      hasMore,
      nextCursor: hasMore ? snap.docs[pageSize - 1].id : null,
      pageSize
    });
  }

  // Hard read cap so the query cost stays bounded as the collection grows
  // (protects the Firestore free-tier daily read quota). Raise/paginate if a
  // school ever exceeds this many expense records in scope.
  const snap = await query.limit(500).get();
  const expenses = snap.docs
    .map((d) => serializeDoc(d))
    .filter((expense) => (!status || expense.status === status) && (!category || expense.category === category))
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  return json({ ok: true, expenses, hasMore: false, nextCursor: null });
}

// POST /api/admin/finance/expenses — record an expense (starts as "pending").
export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const result = await createDebitVoucherFromExpense(await req.json(), token, { expenseStatus: "pending" });
    return json({ ok: true, id: result.expenseId, ...result });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to record expense") }, { status: 400 });
  }
}

