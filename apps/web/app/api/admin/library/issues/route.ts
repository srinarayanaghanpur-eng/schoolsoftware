import { FieldValue } from "firebase-admin/firestore";
import { libraryIssueSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";

const ISSUES = "library_issues";

// GET /api/admin/library/issues?status=issued
export async function GET(req: Request) {
  const token = await requirePermission(req, "library.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  const status = new URL(req.url).searchParams.get("status");
  let query: FirebaseFirestore.Query = adminDb().collection(ISSUES);
  if (status) query = query.where("status", "==", status);
  query = query.limit(500);
  const snap = await query.get();
  const issues = snap.docs.map((d) => serializeDoc(d)).sort((a, b) => String(b.issueDate ?? "").localeCompare(String(a.issueDate ?? "")));
  return json({ ok: true, issues });
}

// POST — issue a book (decrements available copies).
export async function POST(req: Request) {
  const token = await requirePermission(req, "library.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const parsed = libraryIssueSchema.parse(await req.json());
    const db = adminDb();
    const bookRef = db.collection("books").doc(parsed.bookId);
    const book = await bookRef.get();
    if (!book.exists) return json({ ok: false, error: "Book not found" }, { status: 404 });
    if (((book.data()?.available as number) || 0) <= 0) return json({ ok: false, error: "No copies available" }, { status: 400 });

    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.update(bookRef, { available: (book.data()?.available as number) - 1, updatedAt: now });
    const issueRef = db.collection(ISSUES).doc();
    batch.set(issueRef, { ...parsed, bookTitle: (book.data()?.title as string) || "", issueDate: new Date().toISOString().slice(0, 10), fine: 0, status: "issued", createdAt: now });
    await batch.commit();
    return json({ ok: true, id: issueRef.id });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

