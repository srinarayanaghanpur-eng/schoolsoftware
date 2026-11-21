import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, errorMessage, json, requirePermission, serializeDoc } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { getSchoolId } from "@/lib/schoolScope";

const COLLECTION = "fee_challans";

const challanSchema = z.object({
  studentId: z.string().trim().min(1),
  studentName: z.string().trim().min(1).max(160),
  admissionNumber: z.string().trim().max(40).optional().default(""),
  className: z.string().trim().max(50).optional().default(""),
  section: z.string().trim().max(10).optional().default(""),
  academicYearId: z.string().trim().max(100).optional().default(""),
  dueDate: z.string().trim().min(8),
  notes: z.string().trim().max(500).optional().default(""),
  items: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        amount: z.coerce.number().positive().max(1000000)
      })
    )
    .min(1)
    .max(10)
});

export async function GET(req: Request) {
  const auth = await requirePermission(req, "fees.view");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const snap = await adminDb().collection(COLLECTION).orderBy("createdAt", "desc").limit(200).get();
    const challans = snap.docs.map((doc) => serializeDoc(doc));
    return json({ ok: true, challans });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to load challans") }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requirePermission(req, "fees.create");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const limit = await checkRateLimit({ key: `challan-create:${auth.uid}`, maxRequests: 30, windowMinutes: 1 });
  if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

  const bodyLimit = enforceBodyLimit(req, 16 * 1024);
  if (bodyLimit) return bodyLimit;

  try {
    const parsed = challanSchema.parse(await req.json());
    const db = adminDb();
    const total = parsed.items.reduce((sum, item) => sum + item.amount, 0);
    const counterRef = db.collection("counters").doc("fee_challans");
    const sequence = await db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const next = Number(snap.data()?.next || 0) + 1;
      tx.set(counterRef, { next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return next;
    });
    const challanNumber = `CH-${new Date().getFullYear()}-${String(sequence).padStart(5, "0")}`;
    const now = FieldValue.serverTimestamp();
    const ref = await db.collection(COLLECTION).add({
      ...parsed,
      challanNumber,
      total,
      status: "issued",
      schoolId: getSchoolId(auth),
      createdBy: auth.uid,
      createdAt: now,
      updatedAt: now
    });
    return json({ ok: true, id: ref.id, challanNumber, total });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to create challan") }, { status: 400 });
  }
}
