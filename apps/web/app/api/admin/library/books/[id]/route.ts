import { FieldValue } from "firebase-admin/firestore";
import { bookUpdateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";

// PUT /api/admin/library/books/[id] — edit metadata or copy count.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "library.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const parsed = bookUpdateSchema.parse(await req.json());
    const ref = adminDb().collection("books").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return json({ ok: false, error: "Book not found" }, { status: 404 });
    const current = snap.data() as { copies?: number; available?: number };
    const patch: Record<string, unknown> = { ...parsed, updatedAt: FieldValue.serverTimestamp() };
    if (parsed.copies !== undefined) {
      const issued = (current.copies ?? 0) - (current.available ?? 0);
      const available = parsed.copies - issued;
      if (available < 0) return json({ ok: false, error: "Copies cannot be lower than currently issued" }, { status: 400 });
      patch.available = available;
    }
    await ref.update(patch);
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

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
