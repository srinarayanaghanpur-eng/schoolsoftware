import { FieldValue } from "firebase-admin/firestore";
import { parentMessageCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, requirePermission, serializeDoc, json } from "@/lib/apiUtils";
import { writeAuditLog } from "@/lib/auditLog";

const COLLECTION = "parent_messages";

export async function GET(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");

    let query: FirebaseFirestore.Query = adminDb().collection(COLLECTION);
    if (status) query = query.where("status", "==", status);
    if (type) query = query.where("type", "==", type);
    query = query.limit(500);

    // Sort after fetching so filtered tabs do not require a Firestore composite index.
    const snapshot = await query.get();
    const messages = snapshot.docs
      .map((doc) => serializeDoc(doc))
      .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
      .slice(0, 100);

    return json({ ok: true, messages });
  } catch (error) {
    console.error("Error loading parent messages:", error);
    return json({ ok: false, error: "Unable to load parent messages." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const decodedToken = await requirePermission(req, "communication.create");
    if (!decodedToken) {
      return json({ ok: false, error: "Access denied" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parentMessageCreateSchema.parse(body);

    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({
      ...parsed,
      status: "open",
      reply: "",
      createdAt: now,
      updatedAt: now
    });

    return json({ ok: true, id: ref.id, message: "Message submitted." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit message";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

