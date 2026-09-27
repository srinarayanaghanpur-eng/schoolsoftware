import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";

// DELETE /api/admin/library/books/[id] — blocked while copies are issued.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(_req, "library.delete");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const db = adminDb();
    const ref = db.collection("books").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return json({ ok: false, error: "Book not found" }, { status: 404 });
    const outstanding = await db
      .collection("library_issues")
      .where("bookId", "==", params.id)
      .where("status", "==", "issued")
      .limit(1)
      .get()
      .catch(() => null);
    if (outstanding && !outstanding.empty) {
      return json({ ok: false, error: "Cannot delete: copies are currently issued" }, { status: 409 });
    }
    await ref.delete();
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
