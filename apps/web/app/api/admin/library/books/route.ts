import { FieldValue } from "firebase-admin/firestore";
import { bookCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";

const COLLECTION = "books";

export async function GET(req: Request) {
  const token = await requirePermission(req, "library.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  const snap = await adminDb().collection(COLLECTION).orderBy("title").limit(500).get();
  return json({ ok: true, books: snap.docs.map((d) => serializeDoc(d)) });
}

export async function POST(req: Request) {
  const token = await requirePermission(req, "library.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const parsed = bookCreateSchema.parse(await req.json());
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({ ...parsed, available: parsed.copies, createdAt: now, updatedAt: now });
    return json({ ok: true, id: ref.id });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

